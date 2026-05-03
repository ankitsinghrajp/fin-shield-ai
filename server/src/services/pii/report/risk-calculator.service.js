/**
 * risk-calculator.service.js
 *
 * Computes a risk score for a given PII breakdown + masking level.
 *
 * Score formula (raw, before level adjustment):
 *   raw = clamp01( (sensitivePII×0.4 + directPII×0.2 + quasiIdentifiers×0.05) / totalFields )
 *
 * Level adjustments:
 *   high → ×0.3   (full redaction dramatically reduces residual risk)
 *   low  → ×1.5   (minimal masking amplifies risk, capped at 1)
 *
 * Thresholds:
 *   score > 0.6 → "high"
 *   score > 0.3 → "medium"
 *   else        → "low"
 */

/**
 * @param {{ directPII: object, sensitivePII: object, quasiIdentifiers: object }} breakdown
 * @param {number} totalFields
 * @param {"low"|"medium"|"high"} level
 * @returns {{ level: string, score: number, reason: string }}
 */
export const computeRiskScore = (breakdown, totalFields, level) => {
    if (totalFields === 0) {
        return { level: "low", score: 0, reason: "No data." };
    }

    const sc = Object.values(breakdown.sensitivePII    || {}).reduce((a, b) => a + b, 0);
    const dc = Object.values(breakdown.directPII       || {}).reduce((a, b) => a + b, 0);
    const qc = Object.values(breakdown.quasiIdentifiers|| {}).reduce((a, b) => a + b, 0);

    let raw = Math.min(1, Math.max(0, (sc * 0.4 + dc * 0.2 + qc * 0.05) / totalFields));

    if (level === "high") raw *= 0.3;
    if (level === "low")  raw  = Math.min(1, raw * 1.5);

    const score = Math.round(raw * 100) / 100;
    const lvl   = score > 0.6 ? "high" : score > 0.3 ? "medium" : "low";

    let reason =
        sc > 0 ? "Sensitive identifiers present (partially masked)."
        : dc > 0 ? "Direct identifiers pseudonymized or partially masked."
        : qc > 0 ? "Only quasi-identifiers remain (generalized)."
        :          "No PII detected.";

    if (level === "high") reason += " Full redaction applied.";
    if (level === "low")  reason += " Minimal masking – higher risk.";

    return { level: lvl, score, reason };
};