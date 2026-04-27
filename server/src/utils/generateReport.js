/**
 * Quality Report Generator — v2
 *
 * Expects tagged data (with __pii) BEFORE masking.
 * totalFields is passed in from piiEngine for accuracy.
 */

/**
 * @param {Array}  taggedData  - output of detectPII
 * @param {number} totalFields - total leaf fields across all records (pre-mask)
 * @returns {Object} quality report
 */
export const generateReport = (taggedData, totalFields) => {
    if (!Array.isArray(taggedData) || taggedData.length === 0) {
        return {
            records: 0,
            totalFields: 0,
            piiRecords: 0,
            piiFields: 0,
            piiPercent: "0.00",
            utilityPercent: "100.00",
            breakdown: {},
        };
    }

    let piiFields = 0;
    let piiRecords = 0;
    const breakdown = {};

    for (const record of taggedData) {
        const piiMap = record.__pii || {};
        const count = Object.keys(piiMap).length;

        piiFields += count;
        if (count > 0) piiRecords++;

        for (const type of Object.values(piiMap)) {
            breakdown[type] = (breakdown[type] || 0) + 1;
        }
    }

    const safeTotalFields = totalFields > 0 ? totalFields : 1;

    // Utility = % of fields that were NOT masked
    const nonPiiFields = Math.max(0, safeTotalFields - piiFields);
    const utilityPercent = ((nonPiiFields / safeTotalFields) * 100).toFixed(2);

    // PII record rate = % of records that contained at least one PII field
    const piiPercent = ((piiRecords / taggedData.length) * 100).toFixed(2);

    // PII field density = % of all fields that were PII
    const piiFieldPercent = ((piiFields / safeTotalFields) * 100).toFixed(2);

    return {
        records:        taggedData.length,
        totalFields:    safeTotalFields,
        piiRecords,
        piiFields,
        nonPiiFields,
        piiPercent,        // % of records with ≥1 PII field
        piiFieldPercent,   // % of total fields that were PII
        utilityPercent,    // % of total fields retained (not masked)
        breakdown,         // count per PII type
    };
};