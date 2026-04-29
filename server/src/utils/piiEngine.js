/**
 * PII Engine — Unified Entry Point (final)
 * - Weighted utility: fully unmasked=1, partial=0.5, redacted=0
 * - Improved explanations for customer_id and date
 * - Category mapping includes 'date' as 'temporal' in breakdown
 * - Integrated compromise NLP context‑aware detection (post‑process)
 */

import { detectPII } from "./piiDetector.js";
import { maskData } from "./maskEngine.js";
import { generateReport } from "./generateReport.js";
import { augmentWithNLP } from "./nlpDetector.js";   // ← NLP enhancement

const VALID_LEVELS = ["low", "medium", "high"];

const PII_CATEGORIES = {
  directPII: ["name", "email", "phone", "customer_id"],
  sensitivePII: ["aadhaar", "pan", "account", "passport", "ssn", "creditcard", "national_id"],
  quasiIdentifiers: ["address", "dob", "pincode", "gender", "age", "city", "state", "ip", "ifsc", "city_name", "company", "date", "url"]
};

// Weighted utility: 1 = unchanged, 0.5 = partial (contains * or X), 0 = redacted
const getUtilityWeight = (original, masked) => {
    if (original === masked) return 1.0;
    if (masked === "[REDACTED]" || masked === "[MASKED]") return 0.0;
    if (typeof masked === "string" && /[*X]/.test(masked)) return 0.5;
    return 1.0;
};

const computeUtilityRecursive = (orig, masked, depth = 0) => {
    if (depth > 10) return { totalWeight: 1, totalFields: 1 };
    if (orig === null || orig === undefined) return { totalWeight: 0, totalFields: 0 };
    if (typeof orig !== "object") {
        const weight = getUtilityWeight(orig, masked);
        return { totalWeight: weight, totalFields: 1 };
    }
    if (Array.isArray(orig)) {
        let sumWeight = 0, sumFields = 0;
        for (let i = 0; i < orig.length; i++) {
            const sub = computeUtilityRecursive(orig[i], masked?.[i], depth + 1);
            sumWeight += sub.totalWeight;
            sumFields += sub.totalFields;
        }
        return { totalWeight: sumWeight, totalFields: sumFields };
    }
    let sumWeight = 0, sumFields = 0;
    for (const key of Object.keys(orig)) {
        const sub = computeUtilityRecursive(orig[key], masked?.[key], depth + 1);
        sumWeight += sub.totalWeight;
        sumFields += sub.totalFields;
    }
    return { totalWeight: sumWeight, totalFields: sumFields };
};

const computeUtilityPercent = (originalData, maskedData) => {
    if (!Array.isArray(originalData) || originalData.length === 0) return "100.00";
    let totalWeight = 0, totalFields = 0;
    for (let i = 0; i < originalData.length; i++) {
        const res = computeUtilityRecursive(originalData[i], maskedData[i]);
        totalWeight += res.totalWeight;
        totalFields += res.totalFields;
    }
    if (totalFields === 0) return "100.00";
    const utility = (totalWeight / totalFields) * 100;
    return utility.toFixed(2);
};

const getCategorizedBreakdown = (rawBreakdown) => {
    const categorized = { directPII: {}, sensitivePII: {}, quasiIdentifiers: {} };
    for (const [type, count] of Object.entries(rawBreakdown)) {
        if (PII_CATEGORIES.directPII.includes(type)) categorized.directPII[type] = count;
        else if (PII_CATEGORIES.sensitivePII.includes(type)) categorized.sensitivePII[type] = count;
        else categorized.quasiIdentifiers[type] = count;
    }
    // Rename 'date' to 'temporal' for better semantics
    if (categorized.quasiIdentifiers.date) {
        categorized.quasiIdentifiers.temporal = categorized.quasiIdentifiers.date;
        delete categorized.quasiIdentifiers.date;
    }
    return categorized;
};

const computeRiskScore = (categorizedBreakdown, totalFields, maskingLevel, piiFields) => {
    if (totalFields === 0) return { level: "low", score: 0, reason: "No data." };
    let riskSum = 0;
    const sensitiveCount = Object.values(categorizedBreakdown.sensitivePII).reduce((a,b) => a+b, 0);
    const directCount = Object.values(categorizedBreakdown.directPII).reduce((a,b) => a+b, 0);
    const quasiCount = Object.values(categorizedBreakdown.quasiIdentifiers).reduce((a,b) => a+b, 0);
    riskSum += sensitiveCount * 0.4;
    riskSum += directCount * 0.2;
    riskSum += quasiCount * 0.05;
    let rawScore = riskSum / totalFields;
    rawScore = Math.min(1.0, Math.max(0.0, rawScore));
    if (maskingLevel === "high") rawScore *= 0.3;
    if (maskingLevel === "low") rawScore = Math.min(1.0, rawScore * 1.5);
    const score = Math.round(rawScore * 100) / 100;
    let level = "low";
    if (score > 0.6) level = "high";
    else if (score > 0.3) level = "medium";
    let reason = "";
    if (sensitiveCount > 0) reason = "Sensitive identifiers present (partially masked).";
    else if (directCount > 0) reason = "Direct identifiers pseudonymized or partially masked.";
    else if (quasiCount > 0) reason = "Only quasi-identifiers remain (generalized).";
    else reason = "No PII detected.";
    if (maskingLevel === "high") reason += " Full redaction applied.";
    if (maskingLevel === "low") reason += " Minimal masking – higher risk.";
    return { level, score, reason };
};

const getExplanations = (presentTypes) => {
    const all = {
        name: "Pseudonymized with consistent aliases to enable record linkage.",
        email: "Local part partially masked, domain preserved for statistical relevance.",
        phone: "First two and last four digits retained to preserve regional distribution.",
        aadhaar: "Fully redacted due to high re‑identification risk (legal requirement).",
        pan: "Format‑preserving partial masking – first 3 and last 3 characters preserved.",
        account: "Last four digits kept to maintain uniqueness; prefix masked.",
        customer_id: "Pseudonymized to prevent identity linkage while preserving record uniqueness.",
        city: "Retained as is – not considered PII.",
        date: "Year retained for trend analysis; fine-grained info removed.",
        company: "Partially masked (first2***last2) to balance privacy and utility.",
        pincode: "First two digits kept for regional aggregation.",
        ifsc: "Bank code preserved; branch identifier masked.",
    };
    const result = {};
    for (const type of presentTypes) {
        if (all[type]) result[type] = all[type];
        else result[type] = "Masked according to policy.";
    }
    return result;
};

const detectInputType = (data) => {
    if (!Array.isArray(data) || data.length === 0) return "unknown";
    const sample = data[0];
    if (sample && typeof sample === "object" && !Array.isArray(sample)) return "tabular";
    if (typeof sample === "string") return "text";
    return "structured";
};

const getUtilityNote = () => `Utility score is weighted: fully unmasked/generalized = 1, format‑preserving partial masking = 0.5, fully redacted = 0.`;

export const detectAndMaskPII = async (data, maskingLevel = "medium") => {
    const level = VALID_LEVELS.includes(maskingLevel) ? maskingLevel : "medium";
    const normalised = Array.isArray(data) ? data : [data];

    if (normalised.length === 0) {
        return {
            result: [],
            report: {
                records: 0,
                totalFields: 0,
                piiFields: 0,
                piiPercent: "0.00",
                utilityPercent: "100.00",
                breakdown: { directPII: {}, sensitivePII: {}, quasiIdentifiers: {} },
                maskingLevel: level,
                utilityNote: getUtilityNote(),
                explanations: {},
                riskScore: { level: "low", score: 0, reason: "No data" },
                pipeline: { steps: ["ingestion","detection","masking","reporting"], inputType: "unknown", version: "3.2" }
            },
        };
    }

    // 1. Syntactic detection (your existing engine)
    let tagged = detectPII(normalised);

    // 2. 🔥 NLP context-aware enhancement (compromise)
    try {
        tagged = await augmentWithNLP(normalised, tagged);
    } catch (err) {
        console.warn('[piiEngine] NLP enhancement skipped:', err.message);
    }

    const totalFields = normalised.reduce((sum, record) => sum + countFields(record), 0);
    const rawReport = generateReport(tagged, totalFields);
    const categorizedBreakdown = getCategorizedBreakdown(rawReport.breakdown);
    const maskedResult = maskData(tagged, level);
    const utilityPercent = computeUtilityPercent(normalised, maskedResult);
    const presentTypes = new Set();
    for (const cat of Object.values(categorizedBreakdown)) Object.keys(cat).forEach(t => presentTypes.add(t));
    const explanations = getExplanations(Array.from(presentTypes));
    const riskScore = computeRiskScore(categorizedBreakdown, totalFields, level, rawReport.piiFields);
    const inputType = detectInputType(normalised);
    const report = {
        records: rawReport.records,
        totalFields: rawReport.totalFields,
        piiFields: rawReport.piiFields,
        piiPercent: rawReport.piiPercent,
        utilityPercent,
        breakdown: categorizedBreakdown,
        maskingLevel: level,
        utilityNote: getUtilityNote(),
        explanations,
        riskScore,
        pipeline: { steps: ["ingestion","detection","masking","reporting"], inputType, version: "3.2" }
    };
    return { result: maskedResult, report };
};

const countFields = (obj, depth = 0) => {
    if (depth > 10) return 1;
    if (obj === null || obj === undefined) return 0;
    if (typeof obj !== "object") return 1;
    if (Array.isArray(obj)) return obj.reduce((sum, item) => sum + countFields(item, depth + 1), 0);
    return Object.values(obj).reduce((sum, v) => sum + countFields(v, depth + 1), 0);
};