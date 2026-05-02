/**
 * PII Engine — v4.7
 *
 * Changes vs 4.6:
 *
 *   FIX-REPORT-1  totalFields calculation for UNSTRUCTURED path corrected.
 *
 *     Root cause: countFields() performed a recursive object-key walk, so a
 *     line-based record { line: 1, content: "Name: Ankit" } counted as 2
 *     fields (the keys "line" and "content").  For a 2-record document with
 *     15 PII entities detected, this produced:
 *
 *       totalFields = 4   (2 records × 2 keys)
 *       piiFields   = 15
 *       piiPercent  = 375.00%   ← mathematically impossible / meaningless
 *
 *     Fix: for the UNSTRUCTURED path, totalFields is now set to the number
 *     of records (i.e. lines), not the total recursive key count.  Each line
 *     is one logical "field" being evaluated for PII.  piiFields is capped at
 *     totalFields so piiPercent is always in [0, 100].
 *
 *   FIX-REPORT-2  piiFields for unstructured path derived from changed-line
 *     count, not from generateReport() which was designed for structured data
 *     and inflates the count when KV masking fires on multi-token lines.
 *
 *   FIX-DOCX-INTEGRATION  (inherited from v4.6, documented here for clarity)
 *     parseDOCX() now calls normalizeSquishedText() before splitting into
 *     lines, so the engine always receives one {line, content} record per
 *     logical field — not one giant blob per paragraph.  This is the upstream
 *     fix that makes FIX-REPORT-1 effective end-to-end.
 *
 *   All prior fixes (v4.4 → v4.6) are retained unchanged.
 *
 * ─────────────────────────────────────────────────────────────────────────────
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
    applyKeyValueMasking,
    mergeEntities,
    normalizeSquishedText,
    maskDocument,
} from "./presidioMapper.js";
import { applyOverrides } from "./override.js";

const VALID_LEVELS = ["low", "medium", "high"];

const PII_CATEGORIES = {
    directPII:        ["name", "email", "phone", "customer_id"],
    sensitivePII:     ["aadhaar", "pan", "account", "passport", "ssn", "creditcard",
                       "national_id", "cvv", "expiry", "otp", "session"],
    quasiIdentifiers: ["address", "dob", "pincode", "gender", "age", "city", "state",
                       "ip", "ifsc", "city_name", "company", "date", "url"],
};

// ─── Utility scoring ──────────────────────────────────────────────────────────
const getUtilityWeight = (orig, masked) => {
    const o = String(orig ?? ""), m = String(masked ?? "");
    if (o === m) return 1.0;
    if (m === "[REDACTED]" || m === "[MASKED]" || m === "[ADDRESS REDACTED]") return 0.0;
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

/**
 * Utility percent for the UNSTRUCTURED path.
 *
 * We compare content strings directly rather than walking object keys,
 * because line-based records have structural keys (line, content) that
 * are never masked and would inflate the utility score.
 *
 * Weight per line:
 *   unchanged     → 1.0  (not PII, or already clean)
 *   partial mask  → 0.5  (contains * or X substitutions)
 *   full redact   → 0.0  ([REDACTED] / [MASKED] / [ADDRESS REDACTED])
 */
const computeUnstructuredUtilityPercent = (origRecords, maskedRecords) => {
    if (!origRecords.length) return "100.00";
    let tw = 0;
    const n = origRecords.length;
    for (let i = 0; i < n; i++) {
        const o = String(origRecords[i]?.content  ?? origRecords[i]  ?? "");
        const m = String(maskedRecords[i]?.content ?? maskedRecords[i] ?? "");
        tw += getUtilityWeight(o, m);
    }
    return ((tw / n) * 100).toFixed(2);
};

// ─── Breakdown + risk ─────────────────────────────────────────────────────────
const getCategorizedBreakdown = (raw) => {
    const out = { directPII: {}, sensitivePII: {}, quasiIdentifiers: {} };
    for (const [type, count] of Object.entries(raw)) {
        if      (PII_CATEGORIES.directPII.includes(type))    out.directPII[type]        = count;
        else if (PII_CATEGORIES.sensitivePII.includes(type)) out.sensitivePII[type]     = count;
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
    otp:         "Fully redacted — one-time password / verification code.",
    session:     "Fully redacted — session token / auth identifier.",
    address:     "Fully redacted — street address is a direct quasi-identifier.",
};
const getExplanations = (types) =>
    Object.fromEntries(types.map((t) => [t, EXPLANATIONS[t] || "Masked according to policy."]));

// ─── Input router ─────────────────────────────────────────────────────────────
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

// ─── Helpers ──────────────────────────────────────────────────────────────────
/**
 * countFields: used for STRUCTURED data only.
 * For unstructured (line-based) data we use record count directly (see below).
 */
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

// ─── Squish detection ──────────────────────────────────────────────────────────
const MULTI_KV_RE = /[A-Za-z][A-Za-z0-9 _.\-]*[ \t]*[=:]/g;
const looksLikeDocxBlob = (text) => {
    if (typeof text !== "string") return false;
    if (text.includes("\n")) return true;
    const hits = text.match(MULTI_KV_RE);
    return hits !== null && hits.length >= 2;
};

// ─── PII count helper for unstructured path ────────────────────────────────────
/**
 * Build a lightweight PII-type → count map by comparing original vs masked
 * content lines.  This is used instead of generateReport() for the unstructured
 * path because generateReport() was built for structured key→type maps and
 * double-counts when a single masked line contains multiple tokens.
 *
 * Strategy: for each line that was changed, we look at which masking tokens
 * appear in the masked output and bucket them into PII categories.
 */
const REDACT_FULL_RE    = /\[REDACTED\]/g;
const REDACT_ADDR_RE    = /\[ADDRESS REDACTED\]/g;
const REDACT_MASKED_RE  = /\[MASKED\]/g;
const PARTIAL_STAR_RE   = /\*{2,}[\d\w-]*/g;
const PARTIAL_X_RE      = /[A-Z]{2,}X{3,}[\w]*/g;
const PSEUDONYM_RE      = /User_\d{4}/g;

const buildUnstructuredPIIMap = (origRecords, maskedRecords) => {
    const counts = {};
    const add = (type) => { counts[type] = (counts[type] || 0) + 1; };

    for (let i = 0; i < origRecords.length; i++) {
        const o = String(origRecords[i]?.content  ?? origRecords[i]  ?? "");
        const m = String(maskedRecords[i]?.content ?? maskedRecords[i] ?? "");
        if (o === m) continue; // line unchanged — no PII masked

        // Count masking token types in the masked line
        const fullRedacts  = (m.match(REDACT_FULL_RE)   || []).length;
        const addrRedacts  = (m.match(REDACT_ADDR_RE)   || []).length;
        const genRedacts   = (m.match(REDACT_MASKED_RE) || []).length;
        const partialStars = (m.match(PARTIAL_STAR_RE)  || []).length;
        const partialXs    = (m.match(PARTIAL_X_RE)     || []).length;
        const pseudonyms   = (m.match(PSEUDONYM_RE)     || []).length;

        if (addrRedacts) for (let j = 0; j < addrRedacts; j++) add("address");
        if (pseudonyms)  for (let j = 0; j < pseudonyms;  j++) add("name");

        // For full redacts and partial masks, infer category from original line's key
        const kvMatch = /^([A-Za-z][A-Za-z0-9_\-. ]*)[ \t]*[=:]/.exec(o.trim());
        const keyHint  = kvMatch ? kvMatch[1].trim().toLowerCase().replace(/[^a-z]/g, "") : "";

        // Sensitive bucket
        if (keyHint.includes("cvv") || keyHint.includes("cvc")) {
            for (let j = 0; j < fullRedacts; j++) add("cvv");
        } else if (keyHint.includes("pan") || keyHint.includes("aadhaar")) {
            for (let j = 0; j < fullRedacts; j++) add(keyHint.includes("pan") ? "pan" : "aadhaar");
        } else if (keyHint.includes("sessionid") || keyHint.includes("token")) {
            for (let j = 0; j < fullRedacts; j++) add("session");
        } else if (fullRedacts > 0) {
            // Generic full redact: use key hint to categorize, or fall back to "pan"
            const mappings = {
                expiry: "expiry", expiration: "expiry",
                otp: "otp", passcode: "otp",
                session: "session", auth: "session",
            };
            const mapped = Object.entries(mappings).find(([k]) => keyHint.includes(k));
            for (let j = 0; j < fullRedacts; j++) add(mapped ? mapped[1] : "pan");
        }

        if (genRedacts > 0) {
            for (let j = 0; j < genRedacts; j++) add("session");
        }

        // Quasi / partial
        if (partialStars > 0) {
            // creditcard has 4 star groups; account has 1
            const starTokens = (m.match(PARTIAL_STAR_RE) || []);
            for (const tok of starTokens) {
                if (tok.includes("-") || tok.length > 8) add("creditcard");
                else add("account");
            }
        }
        if (partialXs > 0) {
            const xTokens = (m.match(PARTIAL_X_RE) || []);
            for (const tok of xTokens) {
                if (/^\d{2}X/.test(tok)) add("pincode");
                else if (/^[A-Z]{4}X/.test(tok)) add("ifsc");
                else add("ip");
            }
        }

        // email / phone — detected by pattern in masked output
        if (/\*+@/.test(m)) add("email");
        if (/\d{2}XXXX\d{4}/.test(m)) add("phone");
    }

    return counts;
};

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
                pipeline: {
                    steps: ["ingestion","detection","masking","reporting"],
                    inputType: "unknown", version: "4.7",
                },
            },
        };
    }

    const unstructured = isUnstructured(normalised);
    let tagged;
    let maskedResult;

    if (unstructured) {
        // ══════════════════════════════════════════════════════════════════════
        // UNSTRUCTURED PATH
        //
        // Processing order per record:
        //   1. normalizeSquishedText()   — fix squished docx paragraphs
        //   2a. If multi-line after normalisation → maskDocument()
        //   2b. If single-line → applyKeyValueMasking()
        //       If null (key not in map) → Presidio + regex fallback pipeline
        // ══════════════════════════════════════════════════════════════════════
        console.log(`[piiEngine v4.7] Unstructured input (${normalised.length} records) → KV+Presidio+regex`);
        tagged       = [];
        maskedResult = [];

        for (const record of normalised) {
            const rawText    = typeof record === "string" ? record : record.content;
            const baseRecord = typeof record === "object" ? { ...record } : { content: rawText };

            // ── STEP 1: Normalise squished docx text ─────────────────────────
            const normalizedText = normalizeSquishedText(rawText);

            // ── STEP 2: Route by line count ───────────────────────────────────
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

            // ── STEP 3: Single-line KEY=VALUE pre-masking ─────────────────────
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

            // ── STEP 4: Presidio NLP entities ────────────────────────────────
            const presidioEntities = await analyzeTextWithPresidio(normalizedText);

            // ── STEP 5: Regex fallbacks ───────────────────────────────────────
            const fallbackEntities = applyFallbackDetection(normalizedText);

            // ── STEP 6: Merge with priority-aware dedup ───────────────────────
            const allEntities = mergeEntities(presidioEntities, fallbackEntities);

            // ── STEP 7: Build PII report map ──────────────────────────────────
            const pii = mapPresidioToPII(normalizedText, allEntities);

            // ── STEP 8: Span-based text masking ───────────────────────────────
            const maskedText = maskTextWithSpans(normalizedText, allEntities, level);

            tagged.push({ ...baseRecord, __pii: pii });
            maskedResult.push({ ...baseRecord, content: maskedText });
        }

    } else {
        // ══════════════════════════════════════════════════════════════════════
        // STRUCTURED PATH: syntactic engine + NLP augmentation (unchanged)
        // ══════════════════════════════════════════════════════════════════════
        console.log(`[piiEngine v4.7] Structured input (${normalised.length} records) → syntactic engine`);
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

    let totalFields;
    let piiTypeMap;
    let utilityPercent;

    if (unstructured) {
        // ── FIX-REPORT-1: For unstructured (line-based) data:
        //   totalFields = number of input records (lines).
        //   Each record is one logical unit being evaluated for PII.
        //   Using countFields() here would count object keys (line, content)
        //   → 2× inflation, causing piiPercent > 100%.
        totalFields = normalised.length;

        // ── FIX-REPORT-2: Build PII type counts from actual masking deltas
        //   rather than from generateReport() which was designed for structured
        //   data and can over-count on the unstructured path.
        piiTypeMap = buildUnstructuredPIIMap(normalised, maskedResult);

        // ── Utility: compare content strings, not object key walks
        utilityPercent = computeUnstructuredUtilityPercent(normalised, maskedResult);

    } else {
        // Structured path: unchanged behaviour
        totalFields    = normalised.reduce((s, r) => s + countFields(r), 0);
        const rawReport = generateReport(tagged, totalFields);
        piiTypeMap      = rawReport.breakdown ?? {};
        utilityPercent  = computeUtilityPercent(normalised, maskedResult);
    }

    // ── piiFields: total PII entity count, capped at totalFields ─────────────
    //   Capping ensures piiPercent is always in [0, 100].
    const rawPiiFields = Object.values(piiTypeMap).reduce((s, n) => s + (Number(n) || 0), 0);
    const piiFields    = Math.min(rawPiiFields, totalFields);
    const piiPercent   = totalFields > 0
        ? ((piiFields / totalFields) * 100).toFixed(2)
        : "0.00";

    const categorizedBreakdown = getCategorizedBreakdown(piiTypeMap);

    const presentTypes = new Set();
    for (const cat of Object.values(categorizedBreakdown)) {
        Object.keys(cat).forEach((t) => presentTypes.add(t));
    }

    const report = {
        records:       normalised.length,
        totalFields,
        piiFields,
        piiPercent,
        utilityPercent,
        breakdown:     categorizedBreakdown,
        maskingLevel:  level,
        utilityNote:   getUtilityNote(),
        explanations:  getExplanations(Array.from(presentTypes)),
        riskScore:     computeRiskScore(categorizedBreakdown, totalFields, level),
        pipeline: {
            steps:     ["ingestion", "detection", "masking", "reporting"],
            inputType: detectInputType(normalised),
            version:   "4.7",
            detector:  unstructured ? "kv+presidio+regex" : "syntactic+nlp",
        },
    };

    console.log(`[piiEngine v4.7] Done — records=${report.records} totalFields=${totalFields} piiFields=${piiFields} piiPercent=${piiPercent}%`);

    return { result: maskedResult, report };
};