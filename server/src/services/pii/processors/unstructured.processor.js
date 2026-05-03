/**
 * unstructured.processor.js
 *
 * Handles the UNSTRUCTURED path: plain strings or { line, content } records.
 *
 * Processing order per record:
 *   1. normalizeSquishedText()    — fix squished DOCX paragraphs
 *   2a. If multi-line blob        → maskDocument()
 *   2b. If single KV line         → applyKeyValueMasking()
 *       If null (key not in map)  → Presidio + regex fallback pipeline
 */

import { analyzeTextWithPresidio } from "../helpers/presidio.service.js";
import {
    mapPresidioToPII,
    maskTextWithSpans,
    applyFallbackDetection,
    applyKeyValueMasking,
    mergeEntities,
    normalizeSquishedText,
    maskDocument,
} from "../helpers/presidio-mapper.service.js";
import { looksLikeDocxBlob } from "../helpers/pii-helpers.js";

/**
 * Process an array of unstructured records.
 *
 * @param {Array<string|{ content: string, [key: string]: any }>} normalised
 * @param {string} level  - "low" | "medium" | "high"
 * @returns {Promise<{ tagged: Array, maskedResult: Array }>}
 */
export const processUnstructured = async (normalised, level) => {
    console.log(`[unstructured.processor v4.7] ${normalised.length} records → KV+Presidio+regex`);

    const tagged       = [];
    const maskedResult = [];

    for (const record of normalised) {
        const rawText    = typeof record === "string" ? record : record.content;
        const baseRecord = typeof record === "object"
            ? { ...record }
            : { content: rawText };

        // ── STEP 1: Normalise squished DOCX text ──────────────────────────────
        const normalizedText = normalizeSquishedText(rawText);

        // ── STEP 2: Route by line count ───────────────────────────────────────
        if (looksLikeDocxBlob(normalizedText)) {
            const maskedText = maskDocument(normalizedText, level);
            const pii = {};
            const origLines   = normalizedText.split("\n");
            const maskedLines = maskedText.split("\n");
            for (let i = 0; i < origLines.length; i++) {
                if (origLines[i] !== maskedLines[i]) {
                    const kvMatch = /^([A-Za-z][A-Za-z0-9_\-. ]*)[ \t]*[=:]/.exec(origLines[i].trim());
                    const key = kvMatch ? kvMatch[1].trim().toLowerCase() : `line_${i}`;
                    pii[key] = key;
                }
            }
            tagged.push({ ...baseRecord, __pii: pii });
            maskedResult.push({ ...baseRecord, content: maskedText });
            continue;
        }

        // ── STEP 3: Single-line KEY=VALUE pre-masking ─────────────────────────
        const kvMasked = applyKeyValueMasking(normalizedText, level);

        if (kvMasked !== null) {
            const pii = {};
            if (kvMasked !== normalizedText) {
                const kvMatch = /^([A-Za-z][A-Za-z0-9_\-. ]*)[ \t]*[=:]/.exec(normalizedText.trim());
                const key = kvMatch ? kvMatch[1].trim().toLowerCase() : "kv_field";
                pii[key] = key;
            }
            tagged.push({ ...baseRecord, __pii: pii });
            maskedResult.push({ ...baseRecord, content: kvMasked });
            continue;
        }

        // ── STEP 4: Presidio NLP entities ─────────────────────────────────────
        const presidioEntities = await analyzeTextWithPresidio(normalizedText);

        // ── STEP 5: Regex fallbacks ────────────────────────────────────────────
        const fallbackEntities = applyFallbackDetection(normalizedText);

        // ── STEP 6: Merge with priority-aware dedup ────────────────────────────
        const allEntities = mergeEntities(presidioEntities, fallbackEntities);

        // ── STEP 7: Build PII report map ───────────────────────────────────────
        const pii = mapPresidioToPII(normalizedText, allEntities);

        // ── STEP 8: Span-based text masking ───────────────────────────────────
        const maskedText = maskTextWithSpans(normalizedText, allEntities, level);

        tagged.push({ ...baseRecord, __pii: pii });
        maskedResult.push({ ...baseRecord, content: maskedText });
    }

    return { tagged, maskedResult };
};