/**
 * PII Detection Engine — v13.4 (strict pattern + field hints)
 * - Patterns (aadhaar, pan, creditcard, etc.) require relevant keyword in field name
 * - Name detection excludes type/category/segment/class
 * - Phone detection only with phone hint
 * - Safe fields blocklist for business data
 *
 * ✅ Phone detection already rejects values like "98123xxxxx"
 *    because extractDigits() → "98123" (length 5) fails isValidPhone().
 */

// Helper: extract digits from any string
const extractDigits = (value) => String(value).replace(/\D/g, "");

// Phone detection: after extracting digits, length must be 6-15
const isValidPhone = (value) => {
    const digits = extractDigits(value);
    return digits.length >= 6 && digits.length <= 15;
};

// Relaxed date pattern: catches "2021", "2021-01-15", etc.
const datePattern = /\b(19|20)\d{2}\b|^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/;

// ----------------------------------------------------------------------
// PATTERNS (syntactic)
// ----------------------------------------------------------------------
const PATTERNS = {
    email:   /\b[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}\b/i,
    aadhaar: /^\d{4}[\s\-]?\d{4}[\s\-]?\d{4}$/,
    pan:     /^[A-Z]{5}[0-9]{4}[A-Z]$/,
    dob:     /^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}$|^\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2}$/,
    pincode: /^[1-9]\d{5}$/,
    ifsc:    /^[A-Z]{4}0[A-Z0-9]{6}$/,
    ip:      /^(\d{1,3}\.){3}\d{1,3}$/,
    creditcard: /^\d{4}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4}$/,
    ssn:     /^\d{3}[\-\s]\d{2}[\-\s]\d{4}$/,
    passport: /^[A-Z]{1,2}[0-9]{6,9}$/,
};

// ----------------------------------------------------------------------
// HINTS (field name keywords)
// ----------------------------------------------------------------------
const NAME_HINTS = ["name", "fullname", "first", "last", "surname", "customer", "user", "client"];
const EMAIL_HINTS = ["email", "mail"];
const PHONE_HINTS = ["phone", "mobile", "cell", "telephone", "contact", "phone1", "phone2"];
const COMPANY_HINTS = ["company", "organisation", "org"];
const DATE_HINTS = ["date", "subscription_date", "birth", "dob"];
const CUSTOMER_ID_HINTS = ["customerid", "userid", "clientid", "uid"];
const ACCOUNT_HINTS = ["account", "acc", "iban", "acctnum"];
const CITY_HINTS = ["city", "town", "locality", "city_name", "location"];

// Pattern‑specific hints – without these, the pattern is ignored
const PATTERN_HINTS = {
    aadhaar:   ["aadhaar", "uid", "uidai", "aadhar"],
    pan:       ["pan", "pancard"],
    creditcard:["creditcard", "credit_card", "cc", "card_number", "cardno"],
    ssn:       ["ssn", "socialsecurity", "social_sec"],
    passport:  ["passport", "passport_no"],
    ifsc:      ["ifsc", "ifsccode"],
    pincode:   ["pincode", "postalcode", "zipcode", "zip"],
    ip:        ["ip", "ipaddress", "ip_address"],
    email:     ["email", "mail"],
};

// ----------------------------------------------------------------------
// BLOCKLISTS & EXCLUSIONS
// ----------------------------------------------------------------------
const NAME_EXCLUDE = ["type", "category", "segment", "class"];
const NON_PII_FIELDS = new Set(["order_ref", "txn_id", "transaction_id", "invoice_no", "index", "website", "country"]);
const SAFE_FIELDS = new Set([
    "sales", "grosssales", "profit", "cogs", "discounts",
    "units", "price", "manufacturingprice", "margin", "revenue",
    "monthname", "month", "year", "quarter",
    "segment", "product", "productname", "category",
    "country", "region"
]);
const COMMON_CITIES = new Set(["bhopal","delhi","mumbai","pune","chennai","kolkata","hyderabad","bangalore","ahmedabad","jaipur","lucknow","indore","kanpur","nagpur","surat","patna","chandigarh"]);

const normaliseKey = (key) => key.toLowerCase().replace(/[_\s\-\.]/g, "");

// Helper: check if field name contains any hint from a list
const hasHint = (normKey, hintList) => hintList.some(hint => normKey.includes(hint));

// ----------------------------------------------------------------------
// MAIN DETECTION
// ----------------------------------------------------------------------
export const detectFieldPII = (key, value) => {
    const normKey = normaliseKey(key);
    const strValue = (value !== null && value !== undefined) ? String(value).trim() : "";

    // 1. Safe fields (business data)
    if (SAFE_FIELDS.has(normKey)) return null;
    // 2. Hard non‑PII
    if (NON_PII_FIELDS.has(normKey)) return null;

    // 3. Customer ID (exact match)
    if (CUSTOMER_ID_HINTS.includes(normKey)) return "customer_id";

    // 4. Name (with exclusion)
    if (hasHint(normKey, NAME_HINTS) && !normKey.includes("month") && !hasHint(normKey, NAME_EXCLUDE)) {
        if (strValue.length > 1 && !COMMON_CITIES.has(strValue.toLowerCase())) {
            return "name";
        }
    }

    // 5. City
    if (hasHint(normKey, CITY_HINTS)) return "city";

    // 6. Company
    if (hasHint(normKey, COMPANY_HINTS)) return "company";

    // 7. Date (requires hint and pattern)
    if (hasHint(normKey, DATE_HINTS) && datePattern.test(strValue)) return "date";

    // 8. Phone (requires hint and valid digits)
    if (hasHint(normKey, PHONE_HINTS) && isValidPhone(strValue)) return "phone";

    // 9. Pattern‑based types – ONLY if field name contains a relevant hint
    if (strValue && !/^(true|false|yes|no)$/i.test(strValue) && strValue !== "null") {
        // Aadhaar
        if (hasHint(normKey, PATTERN_HINTS.aadhaar) && PATTERNS.aadhaar.test(strValue)) return "aadhaar";
        // PAN
        if (hasHint(normKey, PATTERN_HINTS.pan) && PATTERNS.pan.test(strValue)) return "pan";
        // Credit card
        if (hasHint(normKey, PATTERN_HINTS.creditcard) && PATTERNS.creditcard.test(strValue)) return "creditcard";
        // SSN
        if (hasHint(normKey, PATTERN_HINTS.ssn) && PATTERNS.ssn.test(strValue)) return "ssn";
        // Passport
        if (hasHint(normKey, PATTERN_HINTS.passport) && PATTERNS.passport.test(strValue)) return "passport";
        // IFSC
        if (hasHint(normKey, PATTERN_HINTS.ifsc) && PATTERNS.ifsc.test(strValue)) return "ifsc";
        // Pincode
        if (hasHint(normKey, PATTERN_HINTS.pincode) && PATTERNS.pincode.test(strValue)) return "pincode";
        // IP address
        if (hasHint(normKey, PATTERN_HINTS.ip) && PATTERNS.ip.test(strValue)) return "ip";
        // Email (also hint‑gated now)
        if (hasHint(normKey, PATTERN_HINTS.email) && PATTERNS.email.test(strValue)) return "email";
    }

    // 10. Account (hint only)
    if (hasHint(normKey, ACCOUNT_HINTS)) return "account";

    return null;
};

// ----------------------------------------------------------------------
// RECURSIVE DETECTION
// ----------------------------------------------------------------------
const flatDetect = (obj, detected, prefix) => {
    for (const key of Object.keys(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        const value = obj[key];
        if (Array.isArray(value)) {
            value.forEach((v, i) => {
                if (v && typeof v === "object") flatDetect(v, detected, `${fullKey}[${i}]`);
                else {
                    const piiType = detectFieldPII(key, v);
                    if (piiType) detected[`${fullKey}[${i}]`] = piiType;
                }
            });
        } else if (value && typeof value === "object") flatDetect(value, detected, fullKey);
        else {
            const piiType = detectFieldPII(key, value);
            if (piiType) detected[fullKey] = piiType;
        }
    }
};

export const detectPII = (data) => {
    if (!Array.isArray(data)) {
        if (data && typeof data === "object") return detectPII([data]);
        throw new TypeError("detectPII expects an array of records or a single object");
    }
    return data.map((record) => {
        if (typeof record !== "object" || record === null) return { content: record, __pii: {} };
        const detected = {};
        flatDetect(record, detected, "");
        return { ...record, __pii: detected };
    });
};