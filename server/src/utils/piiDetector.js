/**
 * PII Detection Engine — v2
 * Detects PII by field-name heuristics AND value pattern matching.
 * Returns records with a __pii map: { fieldName: "piiType" }
 */

const PATTERNS = {
    email:   /\b[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}\b/i,
    phone:   /(?<!\d)(\+?\d{1,3}[\s\-]?)?(\(?\d{2,4}\)?[\s\-]?)?\d{6,10}(?!\d)/,
    aadhaar: /(?<!\d)\d{4}[\s\-]?\d{4}[\s\-]?\d{4}(?!\d)/,
    pan:     /\b[A-Z]{5}[0-9]{4}[A-Z]\b/,
    dob:     /\b\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}\b|\b\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2}\b/,
    pincode: /(?<!\d)[1-9]\d{5}(?!\d)/,
    ifsc:    /\b[A-Z]{4}0[A-Z0-9]{6}\b/,
    ip:      /\b(\d{1,3}\.){3}\d{1,3}\b/,
    passport:/\b[A-Z]{1,2}[0-9]{6,9}\b/,
    ssn:     /\b\d{3}[\-\s]\d{2}[\-\s]\d{4}\b/,
    creditcard: /\b(?:\d[ \-]?){13,19}\b/,
};

const KEY_HEURISTICS = {
    name:    ["name", "fullname", "firstname", "lastname", "surname", "username",
              "givenname", "middlename", "displayname", "legal_name", "customername"],
    email:   ["email", "mail", "emailid", "e_mail", "emailaddress", "useremail"],
    phone:   ["phone", "mobile", "contact", "tel", "phoneno", "mobileno", "cellphone",
              "phonenumber", "mobilenumber", "contactnumber", "whatsapp"],
    aadhaar: ["aadhaar", "aadhar", "uid", "aadhaarno", "aadhaarnumber", "uidai"],
    pan:     ["pan", "panno", "pancard", "pannumber", "permanentaccountnumber"],
    dob:     ["dob", "birthdate", "dateofbirth", "birth_date", "birthday", "bornon"],
    address: ["address", "addr", "street", "locality", "area", "landmark",
              "residentialaddress", "permanentaddress", "mailingaddress"],
    city:    ["city", "town", "district", "tehsil"],
    state:   ["state", "province", "region"],
    pincode: ["pincode", "zip", "postal", "postalcode", "zipcode"],
    ifsc:    ["ifsc", "ifsccode", "bankifsc"],
    account: ["account", "accountno", "accno", "bankaccount", "accountnumber",
              "bankaccountnumber", "savingsaccount"],
    ip:      ["ip", "ipaddress", "userip", "clientip"],
    passport:["passport", "passportno", "passportnumber"],
    ssn:     ["ssn", "socialsecurity", "socialsecuritynumber"],
    creditcard: ["creditcard", "cardnumber", "debitcard", "ccnumber"],
    gender:  ["gender", "sex"],
    age:     ["age", "currentage"],
};

/**
 * Normalise a field key — strips underscores, spaces, hyphens,
 * AND splits camelCase so "phoneNumber" → "phonenumber".
 */
const normaliseKey = (key) =>
    key
        .replace(/([a-z])([A-Z])/g, "$1$2") // keep camelCase but lowercase everything
        .toLowerCase()
        .replace(/[_\s\-\.]/g, "");

/**
 * Detect PII type for a single field.
 * Key-name heuristic wins first; value pattern is a fallback.
 */
export const detectFieldPII = (key, value) => {
    const normKey = normaliseKey(key);

    // 1. Key-name heuristic (exact substring match)
    for (const [type, hints] of Object.entries(KEY_HEURISTICS)) {
        if (hints.some((h) => normKey.includes(h))) return type;
    }

    // 2. Value pattern fallback (only for non-null, non-empty values)
    if (value === null || value === undefined) return null;
    const strValue = String(value).trim();
    if (!strValue || strValue === "null" || strValue === "undefined") return null;

    // Skip obviously non-PII values (pure numbers for IDs, booleans, etc.)
    if (/^(true|false|yes|no)$/i.test(strValue)) return null;

    for (const [type, regex] of Object.entries(PATTERNS)) {
        if (regex.test(strValue)) return type;
    }

    return null;
};

/**
 * Tag every record with __pii: { fieldName: "piiType" }
 * Handles nested objects and arrays recursively.
 */
export const detectPII = (data) => {
    if (!Array.isArray(data)) {
        // Auto-wrap single object
        if (data && typeof data === "object") return detectPII([data]);
        throw new TypeError("detectPII expects an array of records or a single object");
    }

    return data.map((record) => {
        if (typeof record !== "object" || record === null) {
            // Primitive rows (e.g. plain text lines) — wrap in content
            return { content: record, __pii: {} };
        }

        const detected = {};
        flatDetect(record, detected, "");

        return { ...record, __pii: detected };
    });
};

/**
 * Recursively walk nested objects/arrays to detect PII at any depth.
 * Uses dot-notation keys for nested fields.
 */
const flatDetect = (obj, detected, prefix) => {
    for (const key of Object.keys(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        const value = obj[key];

        if (Array.isArray(value)) {
            // Detect PII in array elements (strings/numbers)
            value.forEach((v, i) => {
                if (v && typeof v === "object") {
                    flatDetect(v, detected, `${fullKey}[${i}]`);
                } else {
                    const piiType = detectFieldPII(key, v);
                    if (piiType) detected[`${fullKey}[${i}]`] = piiType;
                }
            });
        } else if (value && typeof value === "object") {
            flatDetect(value, detected, fullKey);
        } else {
            const piiType = detectFieldPII(key, value);
            if (piiType) detected[fullKey] = piiType;
        }
    }
};