/**
 * Data Masking Engine — v2
 *
 * Levels:
 *   low    → partial reveal (first chars + stars)
 *   medium → format-preserving mask (default)
 *   high   → full redaction
 */

import { createPseudonymMap } from "./pseudonymMap.js";

const LEVELS = ["low", "medium", "high"];

const createMasker = (pseudonymMap, level = "medium") => {
    const safeLevel = LEVELS.includes(level) ? level : "medium";

    return (value, type) => {
        if (value === null || value === undefined || value === "") return value;
        const str = String(value);

        // ── LOW ──────────────────────────────────────────────────────────────
        if (safeLevel === "low") {
            const visible = Math.max(1, Math.min(3, Math.floor(str.length / 4)));
            return str.slice(0, visible) + "*".repeat(Math.max(1, str.length - visible));
        }

        // ── HIGH ─────────────────────────────────────────────────────────────
        if (safeLevel === "high") {
            return "[REDACTED]";
        }

        // ── MEDIUM: type-aware ────────────────────────────────────────────────
        switch (type) {
            case "email": {
                const atIdx = str.indexOf("@");
                if (atIdx < 1) return "[REDACTED]";
                const domain = str.slice(atIdx + 1);
                const alias = pseudonymMap.getPseudonym(str, "user");
                return `${alias}@${domain}`;
            }

            case "phone": {
                const digits = str.replace(/\D/g, "");
                if (digits.length < 4) return "XXXXXX";
                return "XXXXXX" + digits.slice(-4);
            }

            case "aadhaar": {
                const digits = str.replace(/\D/g, "");
                if (digits.length < 4) return "XXXX-XXXX-XXXX";
                return "XXXX-XXXX-" + digits.slice(-4);
            }

            case "pan": {
                if (str.length < 5) return "[REDACTED]";
                return "XXXXX" + str.slice(5);
            }

            case "name": {
                return pseudonymMap.getPseudonym(str, "Person");
            }

            case "dob": {
                // FIX: was putting year at end incorrectly — now masks day/month, keeps year
                const yearMatch = str.match(/\b(19|20)\d{2}\b/);
                return yearMatch ? `XX/XX/${yearMatch[0]}` : "[REDACTED]";
            }

            case "address":
            case "account":
            case "creditcard":
            case "ssn":
            case "passport":
                return "[MASKED]";

            case "city":
            case "state":
            case "gender":
            case "age":
                return "[MASKED]";

            case "pincode": {
                if (str.length < 2) return "XXXXXX";
                return str.slice(0, 2) + "XXXX";
            }

            case "ifsc": {
                if (str.length < 4) return "[MASKED]";
                return str.slice(0, 4) + "XXXXXXX";
            }

            case "ip": {
                const parts = str.split(".");
                if (parts.length === 4) return `${parts[0]}.${parts[1]}.XXX.XXX`;
                return "[MASKED]";
            }

            default:
                return "[MASKED]";
        }
    };
};

/**
 * Set a nested value in an object using a dot-notation path.
 * Handles array notation like "address[0].street"
 */
const setNestedValue = (obj, path, value) => {
    const parts = path.replace(/\[(\d+)\]/g, ".$1").split(".");
    let current = obj;
    for (let i = 0; i < parts.length - 1; i++) {
        if (current[parts[i]] === undefined) return; // path doesn't exist, skip
        current = current[parts[i]];
    }
    current[parts[parts.length - 1]] = value;
};

/**
 * Get a nested value using dot-notation path.
 */
const getNestedValue = (obj, path) => {
    const parts = path.replace(/\[(\d+)\]/g, ".$1").split(".");
    let current = obj;
    for (const part of parts) {
        if (current === undefined || current === null) return undefined;
        current = current[part];
    }
    return current;
};

/**
 * Mask an array of tagged records (with __pii).
 * Returns clean records (no __pii) with masked values.
 * Supports nested field paths from the enhanced detector.
 */
export const maskData = (taggedData, level = "medium") => {
    const pseudonymMap = createPseudonymMap();
    const mask = createMasker(pseudonymMap, level);

    return taggedData.map((record) => {
        const { __pii = {}, ...rest } = record;

        // Deep clone to avoid mutating original
        const newRecord = JSON.parse(JSON.stringify(rest));

        for (const [fieldPath, type] of Object.entries(__pii)) {
            const originalValue = getNestedValue(record, fieldPath);
            const maskedValue = mask(originalValue, type);
            setNestedValue(newRecord, fieldPath, maskedValue);
        }

        return newRecord;
    });
};