/**
 * PII Engine — Unified Entry Point
 *
 * Wires together:
 *   detectPII      (piiDetector.js)
 *   maskData       (maskingEngine.js)
 *   generateReport (reportGenerator.js)
 *
 * This is the ONLY function the controller should call.
 */

import { detectPII } from "./piiDetector.js";
import { maskData } from "./maskEngine.js";
import { generateReport } from "./generateReport.js";

const VALID_LEVELS = ["low", "medium", "high"];

/**
 * Full pipeline: detect → report → mask
 *
 * @param {Array|Object} data         - parsed input data
 * @param {string}       maskingLevel - "low" | "medium" | "high"
 * @returns {{ result: Array, report: Object }}
 */
export const detectAndMaskPII = (data, maskingLevel = "medium") => {
    // 1. Validate + normalise masking level
    const level = VALID_LEVELS.includes(maskingLevel) ? maskingLevel : "medium";

    // 2. Ensure data is always an array (handles single-object JSON)
    const normalised = Array.isArray(data) ? data : [data];

    if (normalised.length === 0) {
        return {
            result: [],
            report: {
                records: 0,
                totalFields: 0,
                piiRecords: 0,
                piiFields: 0,
                piiPercent: "0.00",
                utilityPercent: "100.00",
                breakdown: {},
                maskingLevel: level,
            },
        };
    }

    // 3. Tag every record with __pii metadata
    const tagged = detectPII(normalised);

    // 4. Count total fields BEFORE masking (for accurate utility calculation)
    const totalFields = normalised.reduce((sum, record) => {
        return sum + countFields(record);
    }, 0);

    // 5. Generate quality report (uses tagged data)
    const report = generateReport(tagged, totalFields);
    report.maskingLevel = level;

    // 6. Mask the data (returns clean records, no __pii)
    const result = maskData(tagged, level);

    return { result, report };
};

/**
 * Count all leaf-level fields in an object recursively.
 */
const countFields = (obj, depth = 0) => {
    if (depth > 10) return 1; // guard against circular/extremely deep objects
    if (obj === null || obj === undefined) return 0;
    if (typeof obj !== "object") return 1;
    if (Array.isArray(obj)) {
        return obj.reduce((sum, item) => sum + countFields(item, depth + 1), 0);
    }
    return Object.values(obj).reduce((sum, v) => sum + countFields(v, depth + 1), 0);
};