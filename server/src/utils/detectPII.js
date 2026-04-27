/**
 * PII Detection Engine
 * Detects PII by both field name heuristics AND value pattern matching.
 * Returns records with a __pii map: { fieldName: "piiType" }
 */

const PATTERNS = {
    email:   /\b[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}\b/i,
    phone:   /(?<!\d)(\+91[\-\s]?)?[6-9]\d{9}(?!\d)/,      // Indian mobile
    aadhaar: /(?<!\d)\d{4}[\s\-]?\d{4}[\s\-]?\d{4}(?!\d)/,
    pan:     /\b[A-Z]{5}[0-9]{4}[A-Z]\b/,
    dob:     /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/,
    pincode: /(?<!\d)[1-9]\d{5}(?!\d)/,
    ifsc:    /\b[A-Z]{4}0[A-Z0-9]{6}\b/,
};

const KEY_HEURISTICS = {
    name:    ["name", "fullname", "firstname", "lastname", "surname"],
    email:   ["email", "mail", "emailid", "e_mail"],
    phone:   ["phone", "mobile", "contact", "tel", "phoneno", "mobileno"],
    aadhaar: ["aadhaar", "aadhar", "uid", "aadhaarno"],
    pan:     ["pan", "panno", "pancard"],
    dob:     ["dob", "birthdate", "dateofbirth", "birth_date"],
    address: ["address", "addr", "street", "locality", "city", "state"],
    pincode: ["pincode", "zip", "postal", "postalcode"],
    ifsc:    ["ifsc", "ifsccode"],
    account: ["account", "accountno", "accno", "bankaccount"],
};

/**
 * Normalise a field key for comparison.
 */
const normaliseKey = (key) => key.toLowerCase().replace(/[_\s\-]/g, "");

/**
 * Detect PII type for a single field.
 * Key-name heuristic wins first; value pattern is a fallback.
 * Returns the PII type string or null if none detected.
 */
export const detectFieldPII = (key, value) => {
    const normKey = normaliseKey(key);

    // 1. Key-name heuristic
    for (const [type, hints] of Object.entries(KEY_HEURISTICS)) {
        if (hints.some((h) => normKey.includes(h))) return type;
    }

    // 2. Value pattern (only test strings and numbers coerced to string)
    if (value === null || value === undefined) return null;
    const strValue = String(value).trim();
    if (!strValue) return null;

    for (const [type, regex] of Object.entries(PATTERNS)) {
        if (regex.test(strValue)) return type;
    }

    return null;
};

/**
 * Tag every record with __pii: { fieldName: "piiType" }
 */
export const detectPII = (data) => {
    if (!Array.isArray(data)) {
        throw new TypeError("detectPII expects an array of records");
    }

    return data.map((record) => {
        const detected = {};

        for (const key of Object.keys(record)) {
            const piiType = detectFieldPII(key, record[key]);
            if (piiType) detected[key] = piiType;
        }

        return { ...record, __pii: detected };
    });
};