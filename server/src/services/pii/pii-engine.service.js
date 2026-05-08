/**
 *
 * Main orchestrator.  Responsibilities:
 *   1. Validate / normalise inputs.
 *   2. Route to the correct processor (structured vs unstructured).
 *   3. Delegate report building.
 *   4. Return { result, report }.
 */

import { VALID_LEVELS }           from "./helpers/pii-constants.js";
import { isUnstructured }         from "./helpers/pii-helpers.js";
import { processStructured }      from "./processors/structured.processor.js";
import { processUnstructured }    from "./processors/unstructured.processor.js";
import { buildReport, buildEmptyReport } from "./report/report-builder.service.js";

/**
 * Detect and mask PII in the supplied data.
 *
 * @param {Array|object} data         - input records (structured objects or
 *                                      plain strings / { content } objects)
 * @param {"low"|"medium"|"high"} maskingLevel
 * @returns {Promise<{ result: Array, report: object }>}
 */
export const detectAndMaskPII = async (data, maskingLevel = "medium") => {
    const level      = VALID_LEVELS.includes(maskingLevel) ? maskingLevel : "medium";
    const normalised = Array.isArray(data) ? data : [data];

    // Early-exit for empty input 
    if (normalised.length === 0) {
        return { result: [], report: buildEmptyReport(level) };
    }

    // ── Route to the correct processor ───────────────────────────────────────
    const unstructured = isUnstructured(normalised);

    const { tagged, maskedResult } = unstructured
        ? await processUnstructured(normalised, level)
        : await processStructured(normalised, level);

    // ── Build report ──────────────────────────────────────────────────────────
    const report = buildReport({ normalised, maskedResult, tagged, unstructured, level });

    console.log(
        `[piiEngine v4.7] Done — records=${report.records} ` +
        `totalFields=${report.totalFields} piiFields=${report.piiFields} ` +
        `piiPercent=${report.piiPercent}%`
    );

    return { result: maskedResult, report };
};