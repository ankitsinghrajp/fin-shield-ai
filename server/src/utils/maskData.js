/**
 * Data Masking Engine
 * Applies masking strategies per field type and masking level.
 *
 * Levels:
 *   low    → partial reveal (first chars + stars)
 *   medium → format-preserving mask (default)
 *   high   → full redaction / suppress
 */

import { createPseudonymMap } from "./pseudonymMap.js";

const LEVELS = ["low", "medium", "high"];

/**
 * Build a masker function bound to a specific pseudonym map + level.
 */
const createMasker = (pseudonymMap, level = "medium") => {
    const safeLevel = LEVELS.includes(level) ? level : "medium";

    return (value, type) => {
        if (value === null || value === undefined || value === "") return value;
        const str = String(value);

        // ── LOW: show a few chars, rest starred ──────────────────────────────
        if (safeLevel === "low") {
            const visible = Math.min(3, Math.floor(str.length / 3));
            return str.slice(0, visible) + "*".repeat(str.length - visible);
        }

        // ── HIGH: full redaction, no format preserved ────────────────────────
        if (safeLevel === "high") {
            return "[REDACTED]";
        }

        // ── MEDIUM: type-aware, format-preserving ────────────────────────────
        switch (type) {
            case "email": {
                const atIdx = str.indexOf("@");
                if (atIdx < 1) return "[REDACTED]";
                const domain = str.slice(atIdx + 1);
                const alias = pseudonymMap.getPseudonym(str, "user");
                return `${alias}@${domain}`;
            }

            case "phone": {
                // Keep last 4 digits, mask rest
                const digits = str.replace(/\D/g, "");
                return "XXXXXX" + digits.slice(-4);
            }

            case "aadhaar": {
                const digits = str.replace(/\D/g, "");
                return "XXXX-XXXX-" + digits.slice(-4);
            }

            case "pan": {
                // Mask first 5 letters, keep last 5 chars (4 digits + 1 letter)
                return "XXXXX" + str.slice(-5);
            }

            case "name": {
                return pseudonymMap.getPseudonym(str, "Person");
            }

            case "dob": {
                // Keep year only
                const yearMatch = str.match(/\d{4}/);
                return yearMatch ? `XXXX/XX/${yearMatch[0]}` : "[REDACTED]";
            }

            case "address":
            case "account":
                return "[MASKED]";

            case "pincode": {
                // Keep first 2 digits (region), mask rest
                return str.slice(0, 2) + "XXXX";
            }

            case "ifsc": {
                // Keep bank code (first 4), mask branch
                return str.slice(0, 4) + "XXXXXXX";
            }

            default:
                return "[MASKED]";
        }
    };
};

/**
 * Mask an array of records that have been tagged with __pii by detectPII.
 * Returns clean records (no __pii field) with masked values.
 */
export const maskData = (taggedData, level = "medium") => {
    const pseudonymMap = createPseudonymMap();
    const mask = createMasker(pseudonymMap, level);

    return taggedData.map((record) => {
        const { __pii = {}, ...rest } = record;
        const newRecord = { ...rest };

        for (const [field, type] of Object.entries(__pii)) {
            newRecord[field] = mask(record[field], type);
        }

        return newRecord;
    });
};