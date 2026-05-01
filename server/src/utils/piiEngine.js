/**
 * PII Engine — v4.3
 *
 * Changes vs 4.2:
 *   - isUnstructured() tightened: requires EVERY item to have a string `content`
 *     field OR be a plain string. Mixed arrays route to structured engine.
 *   - Unstructured path calls mergeEntities() with correct sort order (FIX-B).
 *   - mapPresidioToPII receives merged entities (post-dedup) for accurate report.
 *   - applyOverrides() retained for structured path only (unstructured types are
 *     already normalised by presidioMapper).
 */

import { detectPII }               from "./piiDetector.js";
import { maskData }                from "./maskEngine.js";
import { generateReport }          from "./generateReport.js";
import { augmentWithNLP }          from "./nlpDetector.js";
import { analyzeTextWithPresidio } from "./presidioService.js";
import {
  mapPresidioToPII,
  maskTextWithSpans,
  applyFallbackDetection,
  mergeEntities,
} from "./presidioMapper.js";
import { applyOverrides } from "./override.js";

const VALID_LEVELS = ["low", "medium", "high"];

const PII_CATEGORIES = {
  directPII:        ["name", "email", "phone", "customer_id"],
  sensitivePII:     ["aadhaar", "pan", "account", "passport", "ssn", "creditcard",
                     "national_id", "cvv", "expiry"],
  quasiIdentifiers: ["address", "dob", "pincode", "gender", "age", "city", "state",
                     "ip", "ifsc", "city_name", "company", "date", "url"],
};

// ─── Utility scoring ─────────────────────────────────────────────────────────
const getUtilityWeight = (orig, masked) => {
  const o = String(orig ?? ""), m = String(masked ?? "");
  if (o === m) return 1.0;
  if (m === "[REDACTED]" || m === "[MASKED]") return 0.0;
  if (/[*X]/.test(m)) return 0.5;
  return 1.0;
};

const computeUtilityRecursive = (orig, masked, depth = 0) => {
  if (depth > 10) return { totalWeight: 1, totalFields: 1 };
  if (orig == null) return { totalWeight: 0, totalFields: 0 };
  if (typeof orig !== "object") {
    return { totalWeight: getUtilityWeight(orig, masked), totalFields: 1 };
  }
  if (Array.isArray(orig)) {
    let sw = 0, sf = 0;
    for (let i = 0; i < orig.length; i++) {
      const s = computeUtilityRecursive(orig[i], masked?.[i], depth + 1);
      sw += s.totalWeight; sf += s.totalFields;
    }
    return { totalWeight: sw, totalFields: sf };
  }
  let sw = 0, sf = 0;
  for (const k of Object.keys(orig)) {
    const s = computeUtilityRecursive(orig[k], masked?.[k], depth + 1);
    sw += s.totalWeight; sf += s.totalFields;
  }
  return { totalWeight: sw, totalFields: sf };
};

const computeUtilityPercent = (orig, masked) => {
  if (!Array.isArray(orig) || orig.length === 0) return "100.00";
  let tw = 0, tf = 0;
  for (let i = 0; i < orig.length; i++) {
    const r = computeUtilityRecursive(orig[i], masked[i]);
    tw += r.totalWeight; tf += r.totalFields;
  }
  return tf === 0 ? "100.00" : ((tw / tf) * 100).toFixed(2);
};

// ─── Breakdown + risk ─────────────────────────────────────────────────────────
const getCategorizedBreakdown = (raw) => {
  const out = { directPII: {}, sensitivePII: {}, quasiIdentifiers: {} };
  for (const [type, count] of Object.entries(raw)) {
    if      (PII_CATEGORIES.directPII.includes(type))    out.directPII[type]       = count;
    else if (PII_CATEGORIES.sensitivePII.includes(type)) out.sensitivePII[type]    = count;
    else                                                  out.quasiIdentifiers[type] = count;
  }
  if (out.quasiIdentifiers.date) {
    out.quasiIdentifiers.temporal = out.quasiIdentifiers.date;
    delete out.quasiIdentifiers.date;
  }
  return out;
};

const computeRiskScore = (bd, totalFields, level) => {
  if (totalFields === 0) return { level: "low", score: 0, reason: "No data." };
  const sc = Object.values(bd.sensitivePII).reduce((a, b) => a + b, 0);
  const dc = Object.values(bd.directPII).reduce((a, b) => a + b, 0);
  const qc = Object.values(bd.quasiIdentifiers).reduce((a, b) => a + b, 0);
  let raw = Math.min(1, Math.max(0, (sc * 0.4 + dc * 0.2 + qc * 0.05) / totalFields));
  if (level === "high") raw *= 0.3;
  if (level === "low")  raw  = Math.min(1, raw * 1.5);
  const score = Math.round(raw * 100) / 100;
  const lvl   = score > 0.6 ? "high" : score > 0.3 ? "medium" : "low";
  let reason  = sc > 0 ? "Sensitive identifiers present (partially masked)."
    : dc > 0 ? "Direct identifiers pseudonymized or partially masked."
    : qc > 0 ? "Only quasi-identifiers remain (generalized)."
    :          "No PII detected.";
  if (level === "high") reason += " Full redaction applied.";
  if (level === "low")  reason += " Minimal masking – higher risk.";
  return { level: lvl, score, reason };
};

const EXPLANATIONS = {
  name:        "Pseudonymized with consistent aliases to enable record linkage.",
  email:       "Local part partially masked, domain preserved for statistical relevance.",
  phone:       "First two and last four digits retained to preserve regional distribution.",
  aadhaar:     "Fully redacted — high re-identification risk (legal requirement).",
  pan:         "Fully redacted — government tax identifier.",
  account:     "Last four digits kept to maintain uniqueness; prefix masked.",
  customer_id: "Pseudonymized to prevent identity linkage while preserving record uniqueness.",
  city:        "Retained as-is — not considered PII.",
  date:        "Year retained for trend analysis; fine-grained info removed.",
  pincode:     "First two digits kept for regional aggregation.",
  ip:          "Last two octets masked; first two retained for network-region analysis.",
  creditcard:  "All but last four digits masked.",
  ifsc:        "Bank code preserved; branch identifier masked.",
  national_id: "Fully redacted — government-issued identifier.",
  ssn:         "Fully redacted — US Social Security Number.",
  passport:    "Fully redacted — government-issued travel document.",
  cvv:         "Fully redacted — card security code.",
  expiry:      "Month masked, year retained — card expiry date.",
};
const getExplanations = (types) =>
  Object.fromEntries(types.map((t) => [t, EXPLANATIONS[t] || "Masked according to policy."]));

// ─── Input router ──────────────────────────────────────────────────────────────
/**
 * True when input is unstructured text: every record is either a plain string
 * or an object with a `content` string field (produced by parseTXTorLOG).
 * Mixed arrays → structured engine.
 */
const isUnstructured = (data) =>
  Array.isArray(data) &&
  data.length > 0 &&
  data.every(
    (item) =>
      typeof item === "string" ||
      (item !== null &&
       typeof item === "object" &&
       !Array.isArray(item) &&
       typeof item.content === "string")
  );

// ─── Helpers ───────────────────────────────────────────────────────────────────
const countFields = (obj, d = 0) => {
  if (d > 10 || obj == null) return d > 10 ? 1 : 0;
  if (typeof obj !== "object") return 1;
  if (Array.isArray(obj)) return obj.reduce((s, i) => s + countFields(i, d + 1), 0);
  return Object.values(obj).reduce((s, v) => s + countFields(v, d + 1), 0);
};

const detectInputType = (data) => {
  if (!Array.isArray(data) || data.length === 0) return "unknown";
  const s = data[0];
  if (typeof s === "string") return "text";
  if (s && typeof s === "object" && typeof s.content === "string") return "log";
  return "tabular";
};

const getUtilityNote = () =>
  "Utility score is weighted: fully unmasked/generalized = 1, format-preserving partial masking = 0.5, fully redacted = 0.";

// ─── Main export ───────────────────────────────────────────────────────────────
export const detectAndMaskPII = async (data, maskingLevel = "medium") => {
  const level      = VALID_LEVELS.includes(maskingLevel) ? maskingLevel : "medium";
  const normalised = Array.isArray(data) ? data : [data];

  if (normalised.length === 0) {
    return {
      result: [],
      report: {
        records: 0, totalFields: 0, piiFields: 0,
        piiPercent: "0.00", utilityPercent: "100.00",
        breakdown: { directPII: {}, sensitivePII: {}, quasiIdentifiers: {} },
        maskingLevel: level, utilityNote: getUtilityNote(),
        explanations: {}, riskScore: { level: "low", score: 0, reason: "No data" },
        pipeline: { steps: ["ingestion","detection","masking","reporting"],
                    inputType: "unknown", version: "4.3" },
      },
    };
  }

  const unstructured = isUnstructured(normalised);
  let tagged;
  let maskedResult;

  if (unstructured) {
    // ══════════════════════════════════════════════════════════════════════
    // UNSTRUCTURED PATH: per-line Presidio + regex, span-based masking
    // ══════════════════════════════════════════════════════════════════════
    console.log(`[piiEngine] Unstructured input (${normalised.length} records) → Presidio+regex`);
    tagged       = [];
    maskedResult = [];

    for (const record of normalised) {
      const originalText = typeof record === "string" ? record : record.content;
      const baseRecord   = typeof record === "object" ? { ...record } : { content: originalText };

      // 1. Presidio NLP entities with character offsets
      const presidioEntities = await analyzeTextWithPresidio(originalText);

      // 2. Regex fallbacks for PAN, Aadhaar, pincode, IFSC, credit-card
      const fallbackEntities = applyFallbackDetection(originalText);

      // 3. Merge with priority-aware dedup (FIX-B: sort START-ASC, PRIORITY-DESC)
      const allEntities = mergeEntities(presidioEntities, fallbackEntities);

      // 4. Build __pii map for report statistics
      const pii = mapPresidioToPII(originalText, allEntities);

      // 5. In-place text masking (FIX-A/C/B all applied inside maskTextWithSpans)
      const maskedText = maskTextWithSpans(originalText, allEntities, level);

      tagged.push({ ...baseRecord, __pii: pii });
      maskedResult.push({ ...baseRecord, content: maskedText });
    }

  } else {
    // ══════════════════════════════════════════════════════════════════════
    // STRUCTURED PATH: syntactic engine + NLP augmentation
    // ══════════════════════════════════════════════════════════════════════
    console.log(`[piiEngine] Structured input (${normalised.length} records) → syntactic engine`);
    tagged = detectPII(normalised);

    try {
      tagged = await augmentWithNLP(normalised, tagged);
    } catch (err) {
      console.warn("[piiEngine] NLP augmentation skipped:", err.message);
    }

    tagged       = applyOverrides(tagged);
    maskedResult = maskData(tagged, level);
  }

  // ══════════════════════════════════════════════════════════════════════
  // SHARED: report generation + scoring
  // ══════════════════════════════════════════════════════════════════════
  const totalFields          = normalised.reduce((s, r) => s + countFields(r), 0);
  const rawReport            = generateReport(tagged, totalFields);
  const categorizedBreakdown = getCategorizedBreakdown(rawReport.breakdown);
  const utilityPercent       = computeUtilityPercent(normalised, maskedResult);

  const presentTypes = new Set();
  for (const cat of Object.values(categorizedBreakdown)) {
    Object.keys(cat).forEach((t) => presentTypes.add(t));
  }

  const report = {
    records:       rawReport.records,
    totalFields:   rawReport.totalFields,
    piiFields:     rawReport.piiFields,
    piiPercent:    rawReport.piiPercent,
    utilityPercent,
    breakdown:     categorizedBreakdown,
    maskingLevel:  level,
    utilityNote:   getUtilityNote(),
    explanations:  getExplanations(Array.from(presentTypes)),
    riskScore:     computeRiskScore(categorizedBreakdown, totalFields, level),
    pipeline: {
      steps:     ["ingestion", "detection", "masking", "reporting"],
      inputType: detectInputType(normalised),
      version:   "4.3",
      detector:  unstructured ? "presidio+regex" : "syntactic+nlp",
    },
  };

  return { result: maskedResult, report };
};