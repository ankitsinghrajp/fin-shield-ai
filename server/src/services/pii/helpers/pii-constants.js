/**
 * pii-constants.js
 * Central place for all static lookup tables, category maps, and explanations.
 */

export const VALID_LEVELS = ["low", "medium", "high"];

export const PII_CATEGORIES = {
    directPII: ["name", "email", "phone", "customer_id"],
    sensitivePII: [
        "aadhaar", "pan", "account", "passport", "ssn", "creditcard",
        "national_id", "cvv", "expiry", "otp", "session",
    ],
    quasiIdentifiers: [
        "address", "dob", "pincode", "gender", "age", "city", "state",
        "ip", "ifsc", "city_name", "company", "date", "url",
    ],
};

export const EXPLANATIONS = {
    name:        "Pseudonymized with consistent aliases to enable record linkage.",
    email:       "Local part partially masked, domain preserved for statistical relevance.",
    phone:       "First two and last four digits retained to preserve regional distribution.",
    aadhaar:     "Fully redacted — high re-identification risk (legal requirement).",
    pan:         "Fully redacted — government tax identifier.",
    account:     "Last four digits kept to maintain uniqueness; prefix masked.",
    customer_id: "Pseudonymized to prevent identity linkage while preserving record uniqueness.",
    city:        "Retained as-is — not considered PII.",
    date:        "Year retained for trend analysis; fine-grained info removed.",
    pincode:     "First two digits kept for regional aggregation.",
    ip:          "Last two octets masked; first two retained for network-region analysis.",
    creditcard:  "All but last four digits masked.",
    ifsc:        "Bank code preserved; branch identifier masked.",
    national_id: "Fully redacted — government-issued identifier.",
    ssn:         "Fully redacted — US Social Security Number.",
    passport:    "Fully redacted — government-issued travel document.",
    cvv:         "Fully redacted — card security code.",
    expiry:      "Month masked, year retained — card expiry date.",
    otp:         "Fully redacted — one-time password / verification code.",
    session:     "Fully redacted — session token / auth identifier.",
    address:     "Fully redacted — street address is a direct quasi-identifier.",
};

// Regex tokens used to detect what kind of masking was applied to a line 

export const REDACT_FULL_RE   = /\[REDACTED\]/g;
export const REDACT_ADDR_RE   = /\[ADDRESS REDACTED\]/g;
export const REDACT_MASKED_RE = /\[MASKED\]/g;
export const PARTIAL_STAR_RE  = /\*{2,}[\d\w-]*/g;
export const PARTIAL_X_RE     = /[A-Z]{2,}X{3,}[\w]*/g;
export const PSEUDONYM_RE     = /User_\d{4}/g;

// Regex used to identify squished / multi-KV blobs coming from DOCX parsing 
export const MULTI_KV_RE = /[A-Za-z][A-Za-z0-9 _.\-]*[ \t]*[=:]/g;