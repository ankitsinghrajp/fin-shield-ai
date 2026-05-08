
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

const LOG_PREFIX_RE =
    /^(?:\[?\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?Z?\]?|\[?\d{4}-\d{2}-\d{2}\]?)(?:\s*\[?(?:INFO|ERROR|WARN(?:ING)?|DEBUG|TRACE|FATAL|CRITICAL)\]?)?\s+(.+)$/i;

/**
 * Attempt KV masking on the KV-relevant suffix of a log line.
 *
 * Handles lines like:
 *   "[2026-05-03 10:27:45] sessionId = abc123xyz456"   → suffix: "sessionId = abc123xyz456"
 *   "2026-05-03 10:27 INFO token = resetToken123"      → suffix: "token = resetToken123"
 *   "[2026-05-03 10:27] otp = 487364"                  → suffix: "otp = 487364"
 *
 * @param {string} line 
 * @param {string} level
 * @returns {{ maskedLine: string, matched: boolean }}
 */
const tryKVOnLogSuffix = (line, level) => {
    const m = LOG_PREFIX_RE.exec(line);
    if (!m) return { maskedLine: line, matched: false };

    const suffix       = m[1];             // "sessionId = abc123xyz456"
    const prefixLength = line.length - suffix.length;

    const maskedSuffix = applyKeyValueMasking(suffix, level);
    if (maskedSuffix === null) {
        // Key not in KEY_TYPE_MAP — Presidio handle
        return { maskedLine: line, matched: false };
    }

    // KV recognised and potentially masked — splice back
    return {
        maskedLine: line.slice(0, prefixLength) + maskedSuffix,
        matched:    maskedSuffix !== suffix,   // true only when a value was changed
    };
};

/**
 * Process an array of unstructured records.
 *
 * @param {Array<string|{ content: string, [key: string]: any }>} normalised
 * @param {string} level  - "low" | "medium" | "high"
 * @returns {Promise<{ tagged: Array, maskedResult: Array }>}
 */
export const processUnstructured = async (normalised, level) => {
    console.log(`[unstructured.processor v4.9] ${normalised.length} records → KV+Presidio+regex`);

    const tagged       = [];
    const maskedResult = [];

    for (const record of normalised) {
        const rawText    = typeof record === "string" ? record : record.content;
        const baseRecord = typeof record === "object"
            ? { ...record }
            : { content: rawText };

        // Normalise DOCX text 
        const normalizedText = normalizeSquishedText(rawText);

        if (normalizedText.includes("\n")) {
            const origLines  = normalizedText.split("\n");
            const kvLines    = maskDocument(normalizedText, level).split("\n");
            const finalLines = [];
            const pii        = {};

            for (let i = 0; i < origLines.length; i++) {
                const origLine = origLines[i];
                const kvLine   = kvLines[i];

                if (kvLine !== origLine) {
                    // maskDocument masked something on this line — use its output.
                    const kvMatch = /^([A-Za-z][A-Za-z0-9_\-. ]*)[ \t]*[=:]/.exec(origLine.trim());
                    const key = kvMatch ? kvMatch[1].trim().toLowerCase() : `line_${i}`;
                    pii[key] = key;
                    finalLines.push(kvLine);
                    continue;
                }

                // maskLine had no KV match (line likely starts with timestamp, '[', etc.)

                if (origLine.trim().length === 0) {
                    finalLines.push(origLine);
                    continue;
                }

                const { maskedLine: kvSuffixLine, matched: kvSuffixMatched } =
                    tryKVOnLogSuffix(origLine, level);

                if (kvSuffixMatched) {
                    // Recognised KV key inside log line — extract field name for PII map.
                    const suffixM = LOG_PREFIX_RE.exec(origLine);
                    if (suffixM) {
                        const kvMatch = /^([A-Za-z][A-Za-z0-9_\-. ]*)[ \t]*[=:]/.exec(suffixM[1].trim());
                        const key = kvMatch ? kvMatch[1].trim().toLowerCase() : `line_${i}`;
                        pii[key] = key;
                    }
                    finalLines.push(kvSuffixLine);
                    continue;
                }

                const presidioEntities = await analyzeTextWithPresidio(origLine);
                const fallbackEntities = applyFallbackDetection(origLine);
                const allEntities      = mergeEntities(presidioEntities, fallbackEntities);

                if (allEntities.length > 0) {
                    const linePii    = mapPresidioToPII(origLine, allEntities);
                    const maskedLine = maskTextWithSpans(origLine, allEntities, level);
                    Object.assign(pii, linePii);
                    finalLines.push(maskedLine);
                } else {
                    finalLines.push(origLine);
                }
            }

            tagged.push({ ...baseRecord, __pii: pii });
            maskedResult.push({ ...baseRecord, content: finalLines.join("\n") });
            continue;
        }

        // Single-line KEY=VALUE pre-masking
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

        {
            const { maskedLine: kvLogMasked, matched: kvLogMatched } =
                tryKVOnLogSuffix(normalizedText, level);

            if (kvLogMatched) {
                const pii = {};
                const suffixM = LOG_PREFIX_RE.exec(normalizedText);
                if (suffixM) {
                    const kvMatch = /^([A-Za-z][A-Za-z0-9_\-. ]*)[ \t]*[=:]/.exec(suffixM[1].trim());
                    const key = kvMatch ? kvMatch[1].trim().toLowerCase() : "kv_field";
                    pii[key] = key;
                }
                tagged.push({ ...baseRecord, __pii: pii });
                maskedResult.push({ ...baseRecord, content: kvLogMasked });
                continue;
            }
        }

        // Presidio NLP entities 
        const presidioEntities = await analyzeTextWithPresidio(normalizedText);

        // Regex fallbacks
        const fallbackEntities = applyFallbackDetection(normalizedText);

        // Merge with priority-aware dedup
        const allEntities = mergeEntities(presidioEntities, fallbackEntities);

        // Build PII report map 
        const pii = mapPresidioToPII(normalizedText, allEntities);

        // Span-based text masking 
        const maskedText = maskTextWithSpans(normalizedText, allEntities, level);

        tagged.push({ ...baseRecord, __pii: pii });
        maskedResult.push({ ...baseRecord, content: maskedText });
    }

    return { tagged, maskedResult };
};