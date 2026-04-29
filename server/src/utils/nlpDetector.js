/**
 * NLP-enhanced PII detection using "compromise".
 * Runs on every string field and extracts:
 *   People        → maps to "name"
 *   Places        → maps to "city"
 *   Organizations → maps to "company"
 *
 * Complements the existing syntactic (regex/field‑name) detector.
 * Only adds fields that were not already flagged.
 */

import nlp from 'compromise';

// ---------------------------------------------------------------------------
// Analyse a single string, returning the first PII type found (if any)
// ---------------------------------------------------------------------------
const detectTypeFromText = (text) => {
  const doc = nlp(text);

  // Check People first (most sensitive)
  const people = doc.people().out('array');
  if (people.length > 0) return 'name';

  // Then Organizations
  const orgs = doc.organizations().out('array');
  if (orgs.length > 0) return 'company';

  // Then Places
  const places = doc.places().out('array');
  if (places.length > 0) return 'city';   // city is not masked in your policy

  return null;
};

// ---------------------------------------------------------------------------
// Walk an object recursively, detect PII in every string leaf
// ---------------------------------------------------------------------------
const detectInObject = (obj, path = '') => {
  const findings = {};
  if (obj === null || typeof obj !== 'object') return findings;

  for (const key of Object.keys(obj)) {
    const fullKey = path ? `${path}.${key}` : key;
    const value = obj[key];

    if (typeof value === 'string' && value.trim().length > 0) {
      const type = detectTypeFromText(value);
      if (type) {
        findings[fullKey] = type;
      }
    } else if (value && typeof value === 'object') {
      Object.assign(findings, detectInObject(value, fullKey));
    }
  }
  return findings;
};

// ---------------------------------------------------------------------------
// Augment existing detection results with NLP findings.
// existingPii always wins – we only add fields that were not already tagged.
// ---------------------------------------------------------------------------
export const augmentWithNLP = async (originalData, taggedData) => {
  const augTagged = [];

  for (let i = 0; i < taggedData.length; i++) {
    const record = taggedData[i];
    const existingPii = record.__pii || {};
    const origRecord = originalData[i];

    // Only analyse if the record is an object
    let nlpFindings = {};
    if (origRecord && typeof origRecord === 'object') {
      nlpFindings = detectInObject(origRecord);
    }

    const merged = { ...existingPii };
    for (const [field, type] of Object.entries(nlpFindings)) {
      if (!merged[field]) {
        merged[field] = type;
      }
    }

    augTagged.push({ ...record, __pii: merged });
  }

  return augTagged;
};