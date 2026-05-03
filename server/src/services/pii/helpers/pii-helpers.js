/**
 * pii-helpers.js
 * Pure helper functions: categorization, explanations, input-type detection.
 */

import { PII_CATEGORIES, EXPLANATIONS } from "./pii-constants.js";

/**
 * Split a flat PII-type → count map into the three category buckets.
 * Also renames "date" → "temporal" inside quasiIdentifiers.
 */
export const getCategorizedBreakdown = (raw) => {
    const out = { directPII: {}, sensitivePII: {}, quasiIdentifiers: {} };

    for (const [type, count] of Object.entries(raw)) {
        if (PII_CATEGORIES.directPII.includes(type)) {
            out.directPII[type] = count;
        } else if (PII_CATEGORIES.sensitivePII.includes(type)) {
            out.sensitivePII[type] = count;
        } else {
            out.quasiIdentifiers[type] = count;
        }
    }

    if (out.quasiIdentifiers.date) {
        out.quasiIdentifiers.temporal = out.quasiIdentifiers.date;
        delete out.quasiIdentifiers.date;
    }

    return out;
};

/**
 * Return an explanation map for the PII types actually present in this run.
 */
export const getExplanations = (types) =>
    Object.fromEntries(
        types.map((t) => [t, EXPLANATIONS[t] || "Masked according to policy."])
    );

/**
 * Detect the high-level input type for the pipeline metadata field.
 */
export const detectInputType = (data) => {
    if (!Array.isArray(data) || data.length === 0) return "unknown";
    const s = data[0];
    if (typeof s === "string") return "text";
    if (s && typeof s === "object" && typeof s.content === "string") return "log";
    return "tabular";
};

/**
 * Standard utility-note string.
 */
export const getUtilityNote = () =>
    "Utility score is weighted: fully unmasked/generalized = 1, format-preserving partial masking = 0.5, fully redacted = 0.";

/**
 * Returns true if the data array contains only unstructured records
 * (plain strings or objects with a `content: string` field).
 */
export const isUnstructured = (data) =>
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

/**
 * Detect whether a text string looks like a squished DOCX paragraph
 * (contains newlines, or has two or more KEY= / KEY: patterns).
 */
export const looksLikeDocxBlob = (text) => {
    if (typeof text !== "string") return false;
    if (text.includes("\n")) return true;
    const hits = text.match(/[A-Za-z][A-Za-z0-9 _.\-]*[ \t]*[=:]/g);
    return hits !== null && hits.length >= 2;
};