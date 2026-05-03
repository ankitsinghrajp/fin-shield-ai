/**
 * generate-report.service.js — Quality Report Generator v4
 *
 * Generates a structured PII breakdown report from tagged records.
 * Used ONLY by the STRUCTURED data path.
 *
 * NOTE: This function is intentionally NOT used for unstructured / line-based
 * data because it was designed for key→type maps and inflates counts when KV
 * masking fires on multi-token lines.  See FIX-REPORT-2 in pii-engine.service.js.
 *
 * Contract:
 *   generateReport(taggedRecords, totalFields) →
 *     { records, totalFields, piiFields, piiPercent, breakdown }
 */

/**
 * @param {Array}  taggedData   - records with __pii metadata attached
 * @param {number} totalFields  - total leaf-field count from countFields()
 * @returns {{
 *   records:     number,
 *   totalFields: number,
 *   piiFields:   number,
 *   piiPercent:  string,
 *   breakdown:   Record<string, number>
 * }}
 */
export const generateReport = (taggedData, totalFields) => {
    if (!Array.isArray(taggedData) || taggedData.length === 0) {
        return {
            records:     0,
            totalFields: 0,
            piiFields:   0,
            piiPercent:  "0.00",
            breakdown:   {},
        };
    }

    let piiFields = 0;
    const breakdown = {};

    for (const record of taggedData) {
        const piiMap    = record.__pii || {};
        const fieldCount = Object.keys(piiMap).length;
        piiFields += fieldCount;

        for (const type of Object.values(piiMap)) {
            breakdown[type] = (breakdown[type] || 0) + 1;
        }
    }

    // Guard against a zero totalFields being passed in (shouldn't happen, but safe)
    const safeTotalFields = totalFields > 0 ? totalFields : 1;
    const piiPercent      = ((piiFields / safeTotalFields) * 100).toFixed(2);

    return {
        records:     taggedData.length,
        totalFields: safeTotalFields,
        piiFields,
        piiPercent,
        breakdown,
    };
};