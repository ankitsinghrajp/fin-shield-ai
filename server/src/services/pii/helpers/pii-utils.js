/**
 * pii-utils.js
 * Low-level utility functions: recursive field counting, unstructured PII map.
 */

import {
    REDACT_FULL_RE,
    REDACT_ADDR_RE,
    REDACT_MASKED_RE,
    PARTIAL_STAR_RE,
    PARTIAL_X_RE,
    PSEUDONYM_RE,
} from "./pii-constants.js";

/**
 * Recursively count leaf fields in a structured record object.
 * Used ONLY for the structured path — do NOT use for unstructured line-based data.
 */
export const countFields = (obj, d = 0) => {
    if (d > 10 || obj == null) return d > 10 ? 1 : 0;
    if (typeof obj !== "object") return 1;
    if (Array.isArray(obj)) return obj.reduce((s, i) => s + countFields(i, d + 1), 0);
    return Object.values(obj).reduce((s, v) => s + countFields(v, d + 1), 0);
};

/**
 * Build a PII-type → count map by comparing original vs masked content lines.
 *
 * Used instead of generateReport() for the unstructured path because
 * generateReport() was designed for structured key→type maps and double-counts
 * when a single masked line contains multiple tokens.
 *
 * Strategy: for each changed line, inspect masking tokens in the output
 * and infer PII category from KV key hints or token shape.
 */
export const buildUnstructuredPIIMap = (origRecords, maskedRecords) => {
    const counts = {};
    const add = (type) => { counts[type] = (counts[type] || 0) + 1; };

    for (let i = 0; i < origRecords.length; i++) {
        const o = String(origRecords[i]?.content  ?? origRecords[i]  ?? "");
        const m = String(maskedRecords[i]?.content ?? maskedRecords[i] ?? "");
        if (o === m) continue; // line unchanged — no PII masked

        const fullRedacts  = (m.match(REDACT_FULL_RE)   || []).length;
        const addrRedacts  = (m.match(REDACT_ADDR_RE)   || []).length;
        const genRedacts   = (m.match(REDACT_MASKED_RE) || []).length;
        const partialStars = (m.match(PARTIAL_STAR_RE)  || []).length;
        const partialXs    = (m.match(PARTIAL_X_RE)     || []).length;
        const pseudonyms   = (m.match(PSEUDONYM_RE)     || []).length;

        if (addrRedacts) for (let j = 0; j < addrRedacts; j++) add("address");
        if (pseudonyms)  for (let j = 0; j < pseudonyms;  j++) add("name");

        // Infer category from the line's KV key
        const kvMatch = /^([A-Za-z][A-Za-z0-9_\-. ]*)[ \t]*[=:]/.exec(o.trim());
        const keyHint = kvMatch ? kvMatch[1].trim().toLowerCase().replace(/[^a-z]/g, "") : "";

        if (keyHint.includes("cvv") || keyHint.includes("cvc")) {
            for (let j = 0; j < fullRedacts; j++) add("cvv");
        } else if (keyHint.includes("pan") || keyHint.includes("aadhaar")) {
            for (let j = 0; j < fullRedacts; j++) add(keyHint.includes("pan") ? "pan" : "aadhaar");
        } else if (keyHint.includes("sessionid") || keyHint.includes("token")) {
            for (let j = 0; j < fullRedacts; j++) add("session");
        } else if (fullRedacts > 0) {
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

        if (partialStars > 0) {
            const starTokens = m.match(PARTIAL_STAR_RE) || [];
            for (const tok of starTokens) {
                if (tok.includes("-") || tok.length > 8) add("creditcard");
                else add("account");
            }
        }

        if (partialXs > 0) {
            const xTokens = m.match(PARTIAL_X_RE) || [];
            for (const tok of xTokens) {
                if (/^\d{2}X/.test(tok))    add("pincode");
                else if (/^[A-Z]{4}X/.test(tok)) add("ifsc");
                else                        add("ip");
            }
        }

        if (/\*+@/.test(m))           add("email");
        if (/\d{2}XXXX\d{4}/.test(m)) add("phone");
    }

    return counts;
};