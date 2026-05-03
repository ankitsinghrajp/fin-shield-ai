/**
 * Data Masking Engine — v9.2 (fixed phone masking, added national_id/gov_id redaction)
 */

import { createPseudonymMap } from "../../utils/pseudonymMap.js";

const LEVELS = ["low", "medium", "high"];

const extractDigits = (str) => String(str).replace(/\D/g, "");

const createMasker = (pseudonymMap, level = "medium") => {
    const safeLevel = LEVELS.includes(level) ? level : "medium";

    return (value, type) => {
        if (value === null || value === undefined || value === "") return value;
        const str = String(value);

        if (safeLevel === "low") {
            const visible = Math.max(1, Math.min(3, Math.floor(str.length / 4)));
            return str.slice(0, visible) + "*".repeat(Math.max(1, str.length - visible));
        }
        if (safeLevel === "high") return "[REDACTED]";

        switch (type) {
            case "email":
                const atIdx = str.indexOf("@");
                if (atIdx < 1) return "[REDACTED]";
                const domain = str.slice(atIdx + 1);
                const local = str.slice(0, atIdx);
                const visibleLocal = local.slice(0, 2);
                const stars = "*".repeat(Math.max(1, local.length - 2));
                return `${visibleLocal}${stars}@${domain}`;

            case "phone": {
                const digits = extractDigits(str);
                if (digits.length < 6) return "[MASKED]";
                const firstTwo = digits.slice(0, 2);
                const lastFour = digits.slice(-4);
                return `${firstTwo}XXXX${lastFour}`;
            }

            case "date": {
                const yearMatch = str.match(/\b(19|20)\d{2}\b/);
                return yearMatch ? yearMatch[0] : "[REDACTED]";
            }

            case "aadhaar":
                return "[REDACTED]";
            case "pan": {
                if (str.length < 6) return "[REDACTED]";
                const first3 = str.slice(0, 3);
                const last3 = str.slice(-3);
                const stars = "*".repeat(str.length - 6);
                return `${first3}${stars}${last3}`;
            }
            case "name":
                return pseudonymMap.getPseudonym(str, "Person");
            case "customer_id":
                return pseudonymMap.getPseudonym(str, "ID");
            case "dob": {
                const yearMatch = str.match(/\b(19|20)\d{2}\b/);
                return yearMatch ? yearMatch[0] : "[REDACTED]";
            }
            case "company": {
                if (str.length <= 4) return str;
                const first2 = str.slice(0, 2);
                const last2 = str.slice(-2);
                return `${first2}***${last2}`;
            }
            case "city":
            case "state":
            case "city_name":
            case "location_city":
                return str;
            case "national_id":
            case "gov_id":
                return "[REDACTED]";
            case "account":
            case "account_number":
            case "accno":
            case "bankaccount":
            case "bankAcc":
            case "acctNum": {
                const accDigits = extractDigits(str);
                if (accDigits.length < 4) return "****";
                return "****" + accDigits.slice(-4);
            }
            case "creditcard": {
                const ccDigits = extractDigits(str);
                if (ccDigits.length < 12) return "****-****-****";
                return `****-****-****-${ccDigits.slice(-4)}`;
            }
            case "passport":
                return "[REDACTED]";
            case "ssn":
                return "[REDACTED]";
            case "pincode":
                if (str.length < 2) return "XXXXXX";
                return str.slice(0, 2) + "XXXX";
            case "ifsc":
                if (str.length < 4) return "[MASKED]";
                return str.slice(0, 4) + "XXXXXXX";
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

const setNestedValue = (obj, path, value) => {
    const parts = path.replace(/\[(\d+)\]/g, ".$1").split(".");
    let current = obj;
    for (let i = 0; i < parts.length - 1; i++) {
        if (current[parts[i]] === undefined) return;
        current = current[parts[i]];
    }
    current[parts[parts.length - 1]] = value;
};

const getNestedValue = (obj, path) => {
    const parts = path.replace(/\[(\d+)\]/g, ".$1").split(".");
    let current = obj;
    for (const part of parts) {
        if (current === undefined || current === null) return undefined;
        current = current[part];
    }
    return current;
};

export const maskData = (taggedData, level = "medium") => {
    const pseudonymMap = createPseudonymMap();
    const mask = createMasker(pseudonymMap, level);

    return taggedData.map((record) => {
        const { __pii = {}, ...rest } = record;
        const newRecord = JSON.parse(JSON.stringify(rest));

        for (const [fieldPath, type] of Object.entries(__pii)) {
            const originalValue = getNestedValue(record, fieldPath);
            const maskedValue = mask(originalValue, type);
            setNestedValue(newRecord, fieldPath, maskedValue);
        }
        return newRecord;
    });
};