/**
 * unstructured.processor.js — v4.9
 *
 * Handles the UNSTRUCTURED path: plain strings or { line, content } records.
 *
 * Processing order per record:
 *   1. normalizeSquishedText()    — fix squished DOCX paragraphs
 *   2a. If multi-line blob        → per-line hybrid masking:
 *                                     i.  maskDocument() (KV-aware)
 *                                     ii. If unchanged → strip log prefix, retry KV (FIX-U4)
 *                                     iii.If still unchanged → Presidio + regex fallback
 *   2b. If single KV line         → applyKeyValueMasking()
 *       If null (key not in map)  → Presidio + regex fallback pipeline
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * FIXES vs v4.8 (all retained):
 *   FIX-U1  looksLikeDocxBlob false-positive on single log lines
 *   FIX-U2  maskDocument() / maskLine() silently drops log lines
 *   FIX-U3  Docx-blob path had zero Presidio / regex fallback
 *   FIX-U4  Session tokens and auth tokens NOT masked in log lines
 *   FIX-U5  Password / event words masked as [ADDRESS REDACTED]
 *           (handled in presidio-mapper FIX-M2, no change needed here)
 *
 * NEW FIXES vs v4.8:
 *
 *   FIX-U6  OTP NOT fully masked when it appears inside a log line  🚨
 *           When a log line contains "otp = 487364" or "otp=487364",
 *           the multi-line path (Step 2a) correctly attempts KV masking
 *           on the log-suffix (FIX-U4 / tryKVOnLogSuffix), which calls
 *           applyKeyValueMasking() → maskValue("487364", "otp_sensitive")
 *           → "[REDACTED]".  This was already correct IF tryKVOnLogSuffix
 *           fires.  However, the regex fallback in applyFallbackDetection()
 *           ran first in Step 2a-iii and matched the 6-digit OTP as a
 *           pincode (48XXXX) — but only when tryKVOnLogSuffix returned
 *           matched=false (key not found in KEY_TYPE_MAP suffix parse).
 *           Root cause: the log prefix RE didn't match a bare "otp=487364"
 *           line without a timestamp, causing tryKVOnLogSuffix to return
 *           { matched: false } and forward to Presidio + fallback detection.
 *           FIX-M4 in presidio-mapper.service.js already guards applyFallback-
 *           Detection() with SENSITIVE_KEY_RE to skip pincode matching when
 *           preceded by an OTP key — so this is fixed at the mapper level.
 *           No additional change needed here beyond the v4.9 mapper upgrade.
 *           Documented here for traceability.
 *
 *   FIX-U8  sessionId / token NOT masked when they appear as single log lines 🚨
 *           A single-line log entry like:
 *             "[2026-05-03 10:27:45] sessionId=abc123xyz456"
 *             "2026-05-03 10:27 INFO token=resetToken123"
 *           reached Step 3 (applyKeyValueMasking) which returned null because
 *           KV_LINE_RE requires the line to START with alpha.  It then fell
 *           through to Presidio (Step 4) which does not recognise generic
 *           alphanumeric strings as session tokens — leaving them UNMASKED.
 *           The multi-line path (Step 2a) already had tryKVOnLogSuffix (FIX-U4)
 *           but the single-line path (Step 3) had no equivalent.
 *           Fix: added Step 3b — after plain KV fails, call tryKVOnLogSuffix()
 *           on the single line before falling to Presidio.
 *
 *   FIX-U7  Raw email addresses in table rows NOT attributed to a key  🚨
 *           Pipe-delimited table rows like:
 *             | ankit@example.com |
 *           have no KV key, so they always reach the Presidio path (Step 2a-iii
 *           or Step 4).  Presidio correctly identifies the EMAIL_ADDRESS entity.
 *           maskTextWithSpans() (FIX-M6 in presidio-mapper) now narrows the
 *           span to just the email value before masking, so the pipe decoration
 *           is preserved.  The masked output is:
 *             | an*****@example.com |
 *           which is correct.  No change to this file; documented here.
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

// ── LOG PREFIX STRIPPER ────────────────────────────────────────────────────────
// Matches common log line prefixes so we can attempt KV masking on the suffix.
//
// Formats handled:
//   [2026-05-03 10:27:45]            — ISO timestamp in brackets
//   [2026-05-03 10:27:45.123]        — with milliseconds
//   [2026-05-03T10:27:45Z]           — ISO-8601 with T separator
//   2026-05-03 10:27:45              — bare ISO timestamp (no brackets)
//   2026-05-03 10:27                 — bare date + short time
//   [INFO] / [ERROR] / [WARN] etc.   — optional severity tag after timestamp
//   INFO / ERROR / WARN / DEBUG      — bare severity at start of line
//
// The capture group (1) is everything AFTER the prefix (the payload).
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
 * @param {string} line  - a single (unchanged) log line
 * @param {string} level - masking level
 * @returns {{ maskedLine: string, matched: boolean }}
 */
const tryKVOnLogSuffix = (line, level) => {
    const m = LOG_PREFIX_RE.exec(line);
    if (!m) return { maskedLine: line, matched: false };

    const suffix       = m[1];             // e.g. "sessionId = abc123xyz456"
    const prefixLength = line.length - suffix.length;

    const maskedSuffix = applyKeyValueMasking(suffix, level);
    if (maskedSuffix === null) {
        // Key not in KEY_TYPE_MAP — let Presidio handle it
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

        // ── STEP 1: Normalise squished DOCX text ──────────────────────────────
        const normalizedText = normalizeSquishedText(rawText);

        // ── STEP 2: Multi-line blob (genuine DOCX extract or log file) ────────
        //
        // FIX-U1: Only treat as multi-line when the text actually contains \n.
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

                // FIX-U4: Try KV masking on the log-prefix suffix BEFORE Presidio.
                // Handles: "[2026-05-03 10:27] sessionId = abc123xyz456"
                //          "2026-05-03 10:27 INFO token = resetToken123"
                //          "[2026-05-03 10:27] otp = 487364"      ← FIX-U6
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

                // FIX-U2 / FIX-U3: Neither maskLine nor log-suffix KV matched.
                // Run the full Presidio + regex fallback pipeline on the raw line.
                // FIX-M2 (in presidio-mapper) ensures action words like "Password"
                // and "reset" are in LABEL_WORDS so Presidio false-positives are
                // suppressed before maskTextWithSpans applies any replacement.
                // FIX-M4 (in presidio-mapper) prevents 6-digit OTPs from being
                // matched as pincodes by applyFallbackDetection.
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

        // ── STEP 3: Single-line KEY=VALUE pre-masking ─────────────────────────
        //
        // 3a. Plain KV line starting with alpha ("sessionId=abc123xyz456")
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

        // 3b. Single log line with timestamp prefix carrying a KV pair  — FIX-U8
        //     e.g. "[2026-05-03 10:27:45] sessionId=abc123xyz456"
        //          "2026-05-03 10:27 INFO token=resetToken123"
        //
        //     applyKeyValueMasking() above returned null because KV_LINE_RE
        //     requires the line to START with alpha.  tryKVOnLogSuffix() strips
        //     the timestamp/level prefix and retries KV masking on the suffix.
        //     If it recognises the key in KEY_TYPE_MAP the masked line is used
        //     directly and Presidio is skipped — preventing unmasked leakage of
        //     session tokens, auth tokens, OTPs, etc. that NLP models miss.
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