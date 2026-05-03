/**
 * structured.processor.js
 *
 * Handles the STRUCTURED path: arrays of objects with typed key→value fields.
 *
 * Pipeline:
 *   1. detectPII()        — syntactic regex detection
 *   2. augmentWithNLP()   — NLP layer (optional, fails gracefully)
 *   3. applyOverrides()   — user-defined override rules
 *   4. maskData()         — apply masking per level
 */

import { detectPII }      from "./pii-detector.service.js";
import { augmentWithNLP } from "./nlp-detector.service.js";
import { maskData }       from "../../masking/mask-engine.service.js";
import { applyOverrides } from "../../../utils/override.js";

/**
 * Process an array of structured records.
 *
 * @param {Array<object>} normalised
 * @param {string}        level  - "low" | "medium" | "high"
 * @returns {Promise<{ tagged: Array, maskedResult: Array }>}
 */
export const processStructured = async (normalised, level) => {
    console.log(`[structured.processor v4.7] ${normalised.length} records → syntactic engine`);

    // Step 1: syntactic PII detection
    let tagged = detectPII(normalised);

    // Step 2: NLP augmentation (non-fatal)
    try {
        tagged = await augmentWithNLP(normalised, tagged);
    } catch (err) {
        console.warn("[structured.processor] NLP augmentation skipped:", err.message);
    }

    // Step 3: apply user-defined overrides
    tagged = applyOverrides(tagged);

    // Step 4: mask
    const maskedResult = maskData(tagged, level);

    return { tagged, maskedResult };
};