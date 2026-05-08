/**
 *
 * Computes the "utility score" — how much of the original data value is
 * preserved after masking.
 *
 * Weight table:
 *   unchanged / generalized  → 1.0
 *   partial mask (* / X)     → 0.5
 *   full redact               → 0.0
 */

// ─── Leaf-level weight ────────────────────────────────────────────────────────

/**
 * Return a weight in [0, 1] for a single original → masked value pair.
 *
 * @param {*} orig
 * @param {*} masked
 * @returns {number}
 */
export const getUtilityWeight = (orig, masked) => {
    const o = String(orig  ?? "");
    const m = String(masked ?? "");
    if (o === m) return 1.0;
    if (m === "[REDACTED]" || m === "[MASKED]" || m === "[ADDRESS REDACTED]") return 0.0;
    if (/[*X]/.test(m)) return 0.5;
    return 1.0;
};

// ─── Structured (recursive) ───────────────────────────────────────────────────

/**
 * Walk a structured record recursively and sum utility weights.
 *
 * @param {*}      orig
 * @param {*}      masked
 * @param {number} depth  - guard against circular structures
 * @returns {{ totalWeight: number, totalFields: number }}
 */
export const computeUtilityRecursive = (orig, masked, depth = 0) => {
    if (depth > 10) return { totalWeight: 1, totalFields: 1 };
    if (orig == null) return { totalWeight: 0, totalFields: 0 };

    if (typeof orig !== "object") {
        return { totalWeight: getUtilityWeight(orig, masked), totalFields: 1 };
    }

    if (Array.isArray(orig)) {
        let sw = 0, sf = 0;
        for (let i = 0; i < orig.length; i++) {
            const s = computeUtilityRecursive(orig[i], masked?.[i], depth + 1);
            sw += s.totalWeight;
            sf += s.totalFields;
        }
        return { totalWeight: sw, totalFields: sf };
    }

    let sw = 0, sf = 0;
    for (const k of Object.keys(orig)) {
        const s = computeUtilityRecursive(orig[k], masked?.[k], depth + 1);
        sw += s.totalWeight;
        sf += s.totalFields;
    }
    return { totalWeight: sw, totalFields: sf };
};

/**
 * Compute the final utility percentage for the STRUCTURED path.
 *
 * @param {Array} origRecords
 * @param {Array} maskedRecords
 * @returns {string}  e.g. "87.50"
 */
export const computeUtilityPercent = (origRecords, maskedRecords) => {
    if (!Array.isArray(origRecords) || origRecords.length === 0) return "100.00";
    let tw = 0, tf = 0;
    for (let i = 0; i < origRecords.length; i++) {
        const r = computeUtilityRecursive(origRecords[i], maskedRecords[i]);
        tw += r.totalWeight;
        tf += r.totalFields;
    }
    return tf === 0 ? "100.00" : ((tw / tf) * 100).toFixed(2);
};

// ─── Unstructured (line-based) ────────────────────────────────────────────────

/**
 * Compute utility percentage for the UNSTRUCTURED path.
 *
 * We compare content strings directly instead of walking object keys,
 * because structural keys (line, content) are never masked and would
 * inflate the utility score if included.
 *
 * @param {Array} origRecords    - raw input records (strings or { content })
 * @param {Array} maskedRecords  - masked output records
 * @returns {string}  e.g. "72.00"
 */
export const computeUnstructuredUtilityPercent = (origRecords, maskedRecords) => {
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