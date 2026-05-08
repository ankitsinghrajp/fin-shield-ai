
import { getCategorizedBreakdown, getExplanations, detectInputType, getUtilityNote } from "../helpers/pii-helpers.js";
import { countFields, buildUnstructuredPIIMap }                                       from "../helpers/pii-utils.js";
import { computeUtilityPercent, computeUnstructuredUtilityPercent }                   from "./utility-calculator.service.js";
import { computeRiskScore }                                                            from "./risk-calculator.service.js";
import { generateReport }                                                              from "./generate-report.service.js";

/**
 * Build the complete report object.
 *
 * @param {object} params
 * @param {Array}   params.normalised       - original (normalised) input records
 * @param {Array}   params.maskedResult     - masked output records
 * @param {Array}   params.tagged           - records annotated with __pii metadata
 * @param {boolean} params.unstructured     - true if the unstructured path was used
 * @param {string}  params.level            - masking level
 * @returns {{ totalFields: number, piiFields: number, piiPercent: string,
 *             utilityPercent: string, breakdown: object, records: number,
 *             maskingLevel: string, utilityNote: string, explanations: object,
 *             riskScore: object, pipeline: object }}
 */
export const buildReport = ({ normalised, maskedResult, tagged, unstructured, level }) => {
    let totalFields;
    let piiTypeMap;
    let utilityPercent;
    let piiFields;
    let piiPercent;

    if (unstructured) {
        totalFields = normalised.length;
        piiTypeMap = buildUnstructuredPIIMap(normalised, maskedResult);

        utilityPercent = computeUnstructuredUtilityPercent(normalised, maskedResult);

        // Cap piiFields at totalFields so piiPercent stays in [0, 100]
        const rawPiiFields = Object.values(piiTypeMap).reduce((s, n) => s + (Number(n) || 0), 0);
        piiFields  = Math.min(rawPiiFields, totalFields);
        piiPercent = totalFields > 0
            ? ((piiFields / totalFields) * 100).toFixed(2)
            : "0.00";
    } else {
        totalFields = normalised.reduce((s, r) => s + countFields(r), 0);

        // generateReport() is the authoritative source for the structured path.
        // It counts piiFields via Object.keys(__pii).length per record — correct
        // semantics for structured data (one field = one __pii entry).
        const rawReport = generateReport(tagged, totalFields);
        piiTypeMap  = rawReport.breakdown ?? {};
        piiFields   = rawReport.piiFields  ?? 0;
        piiPercent  = rawReport.piiPercent ?? "0.00";

        utilityPercent = computeUtilityPercent(normalised, maskedResult);
    }

    const breakdown = getCategorizedBreakdown(piiTypeMap);

    const presentTypes = new Set();
    for (const cat of Object.values(breakdown)) {
        Object.keys(cat).forEach((t) => presentTypes.add(t));
    }

    return {
        records:       normalised.length,
        totalFields,
        piiFields,
        piiPercent,
        utilityPercent,
        breakdown,
        maskingLevel:  level,
        utilityNote:   getUtilityNote(),
        explanations:  getExplanations(Array.from(presentTypes)),
        riskScore:     computeRiskScore(breakdown, totalFields, level),
        pipeline: {
            steps:     ["ingestion", "detection", "masking", "reporting"],
            inputType: detectInputType(normalised),
            version:   "4.7",
            detector:  unstructured ? "kv+presidio+regex" : "syntactic+nlp",
        },
    };
};


  // Return an empty report used when the input array is empty.

export const buildEmptyReport = (level) => ({
    records:       0,
    totalFields:   0,
    piiFields:     0,
    piiPercent:    "0.00",
    utilityPercent:"100.00",
    breakdown:     { directPII: {}, sensitivePII: {}, quasiIdentifiers: {} },
    maskingLevel:  level,
    utilityNote:   getUtilityNote(),
    explanations:  {},
    riskScore:     { level: "low", score: 0, reason: "No data" },
    pipeline: {
        steps:     ["ingestion", "detection", "masking", "reporting"],
        inputType: "unknown",
        version:   "4.7",
    },
});