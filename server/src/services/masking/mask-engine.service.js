/**
 * Data Masking Engine — v9.5
 *
 * FIXES vs v9.4:
 *
 *   FIX-A  otp / token / session_id cases missing from switch:
 *          pii-detector v15.4 emits type strings "otp", "token", "session_id"
 *          but v9.4's switch had none of them → all fell through to
 *          default → [MASKED].
 *
 *          Added three explicit cases:
 *            "otp"        → [OTP REDACTED]
 *            "token"      → tok_****{last4}
 *            "session_id" → SID_{hash4}
 *
 *   FIX-B  Address fallback showed "[Address on file]" instead of the last
 *          recognisable city/locality fragment.
 *          Updated generaliseAddress() to walk comma-split parts right-to-left
 *          and return the first non-empty, non-numeric token it finds, so
 *          "12 MG Road, Bangalore 560001" → "Bangalore" even when the exact
 *          city string isn't in COMMON_CITIES.
 *
 * CARRIES FORWARD from v9.4:
 *
 *   ROOT CAUSE FIX — annotation is an object {type,confidence}; extract .type
 *   before passing to mask(). Without this every field hit default → [MASKED].
 */

import { createPseudonymMap } from "../../utils/pseudonymMap.js";

const LEVELS = ["low", "medium", "high"];

const extractDigits = (str) => String(str).replace(/\D/g, "");

// ─── Tiny stable hash (4 hex chars) ──────────────────────────────────────────
// Used for session_id pseudonymisation — same raw value → same SID token
// within a process lifetime (seed is fixed at 0 for simplicity here).
const shortHash = (str) => {
    let h = 0xdeadbeef;
    for (let i = 0; i < str.length; i++) {
        h = Math.imul(h ^ str.charCodeAt(i), 0x9e3779b9);
        h ^= h >>> 16;
    }
    h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
    h ^= h >>> 13;
    h = Math.imul(h ^ (h >>> 16), 0xc2b2ae35);
    return (Math.abs(h) >>> 0).toString(16).slice(0, 4);
};

// ─── Address generalisation ───────────────────────────────────────────────────
const COMMON_CITIES = new Set([
    "bhopal","delhi","mumbai","pune","chennai","kolkata","hyderabad","bangalore",
    "ahmedabad","jaipur","lucknow","indore","kanpur","nagpur","surat","patna",
    "chandigarh","agra","varanasi","meerut","nashik","faridabad","ghaziabad",
    "rajkot","vadodara","ludhiana","amritsar","coimbatore","vijayawada","madurai",
    "noida","gurugram","gurgaon","thane","kochi","thiruvananthapuram","visakhapatnam",
    "bhubaneswar","ranchi","raipur","dehradun","mysore","mangalore","hubli",
    "belgaum","jodhpur","udaipur","ajmer","bikaner","allahabad","prayagraj",
    "gorakhpur","moradabad","aligarh","jabalpur","gwalior","jammu","srinagar",
    "shimla","imphal","aizawl","kohima","itanagar","gangtok",
    "new york","london","paris","berlin","tokyo","sydney","toronto","dubai",
    "singapore","bangkok","beijing","shanghai","moscow","rome","amsterdam",
]);

// FIX-B: improved address generalisation.
//
// Priority 1 — scan the full string for a known city name (case-insensitive).
// Priority 2 — walk comma-split parts right-to-left, return the first part
//              that is non-empty and not purely numeric (strips pin codes etc.).
//              This surfaces the last meaningful locality token in addresses like
//              "Flat 4, MG Road, Whitefield, Bangalore 560066" → "Bangalore 560066"
//              trimmed of digits → "Bangalore".
// Priority 3 — return the second-to-last comma-split segment (old behaviour).
// Priority 4 — "[Address on file]" only as absolute last resort (no commas,
//              no recognisable city, single-token string with no useful fragment).
const generaliseAddress = (str) => {
    const lower = str.toLowerCase();

    // Priority 1: known city substring match
    for (const city of COMMON_CITIES) {
        if (lower.includes(city)) {
            return city.charAt(0).toUpperCase() + city.slice(1);
        }
    }

    // Priority 2 & 3: comma-split walk
    const parts = str.split(/,\s*/);
    if (parts.length > 1) {
        // Walk right-to-left, skip purely numeric / empty segments
        for (let i = parts.length - 1; i >= 0; i--) {
            const part = parts[i].trim();
            // Strip trailing pin/zip codes (e.g. "Bangalore 560066" → "Bangalore")
            const withoutPin = part.replace(/\b\d{4,6}\b/g, "").trim();
            if (withoutPin && !/^\d+$/.test(withoutPin)) {
                return withoutPin;
            }
        }
        // Fallback to second-to-last segment
        return parts[parts.length - 2].trim();
    }

    // Priority 4: absolute last resort
    return "[Address on file]";
};

// ─── Masker factory ───────────────────────────────────────────────────────────
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

            // ── PSEUDONYMISE ───────────────────────────────────────────────
            case "name":
                return pseudonymMap.getPseudonym(str, "Person");

            case "email": {
                const atIdx = str.indexOf("@");
                if (atIdx < 1) return "[REDACTED]";
                const local  = str.slice(0, atIdx);
                const domain = str.slice(atIdx + 1);
                return `${local.slice(0, 2)}${"*".repeat(Math.max(1, local.length - 2))}@${domain}`;
            }

            case "upi":
                return pseudonymMap.getPseudonym(str, "UPI") + "@upi";

            case "customer_id":
                return pseudonymMap.getPseudonym(str, "CID");

            // ── FIX-A: OTP — fully redacted (4–8 digit one-time code) ──────
            case "otp":
                return "[OTP REDACTED]";

            // ── FIX-A: Token / API key — partial mask, last 4 chars visible ─
            // Preserves enough context for log correlation without leaking the
            // secret. Works for any token length ≥ 4.
            case "token":
                return `tok_****${str.slice(-4)}`;

            // ── FIX-A: Session ID — stable pseudonym ──────────────────────
            // Same raw session value always maps to the same SID token within
            // a run, making log traces correlatable without exposing the real ID.
            case "session_id":
                return `SID_${shortHash(str)}`;

            // ── PARTIAL ────────────────────────────────────────────────────
            case "creditcard": {
                const d = extractDigits(str);
                if (d.length < 12) return "****-****-****-****";
                return `****-****-****-${d.slice(-4)}`;
            }

            case "account":
            case "account_number":
            case "accno":
            case "bankaccount":
            case "bankAcc":
            case "acctNum": {
                const d = extractDigits(str);
                return d.length >= 4 ? `****${d.slice(-4)}` : "****";
            }

            case "iban": {
                const clean = str.replace(/\s/g, "");
                return clean.length >= 8 ? `${clean.slice(0, 4)}****${clean.slice(-4)}` : "****";
            }

            case "mac_address": {
                const sep  = str.includes(":") ? ":" : "-";
                const octs = str.split(/[:\-]/);
                return octs.length === 6
                    ? `${octs[0]}${sep}${octs[1]}${sep}${octs[2]}${sep}**${sep}**${sep}**`
                    : "**:**:**:**:**:**";
            }

            // ── GENERALISE ─────────────────────────────────────────────────
            case "phone": {
                const digits = extractDigits(str);
                if (digits.length < 6) return "XXXXXXXX";
                if (digits.length === 10 && /^[6-9]/.test(digits)) return "+91-XXXXXXXX";
                if (digits.length > 10) return `+${digits.slice(0, digits.length - 10)}-XXXXXXXXXX`;
                return `${digits.slice(0, 2)}XXXX${digits.slice(-4)}`;
            }

            case "date":
            case "dob": {
                const y = str.match(/\b(19|20)\d{2}\b/);
                return y ? y[0] : "[REDACTED]";
            }

            case "address":
            case "addr":
            case "streetaddress":
                return generaliseAddress(str);   // FIX-B applied here

            case "pincode": {
                const d = extractDigits(str);
                if (d.length === 6) return `${d.slice(0, 3)}***`;
                return d.length >= 2 ? `${d.slice(0, 2)}XXXX` : "XXXXXX";
            }

            case "ip":
            case "ip_address": {
                const parts = str.split(".");
                return parts.length === 4
                    ? `${parts[0]}.${parts[1]}.XXX.XXX`
                    : "[MASKED]";
            }

            case "ip_address_v6":
                return str.split(":")[0] + ":****:****:****";

            case "coordinates": {
                const parts = str.split(",").map(p => parseFloat(p.trim()));
                if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
                    const j = () => (Math.random() - 0.5);
                    return `${(parts[0] + j()).toFixed(2)},${(parts[1] + j()).toFixed(2)}`;
                }
                return "[REDACTED]";
            }

            case "ifsc":
                return str.length >= 4 ? `${str.slice(0, 4)}XXXXXXX` : "[MASKED]";

            case "expiry": {
                // MM/YY carries no personal identity — keep as-is
                return str;
            }

            // ── REDACT ─────────────────────────────────────────────────────
            case "aadhaar":
            case "pan":
            case "ssn":
            case "passport":
            case "voter_id":
            case "voterid":
            case "driving_licence":
            case "drivinglicence":
            case "drivinglicense":
            case "national_id":
            case "gov_id":
            case "cvv":
            case "cvc":
            case "cvv2":
            case "cvv_line":
            case "biometric":
            case "religion_caste":
            case "otp_sensitive":
            case "session_sensitive":
                return "[REDACTED]";

            // ── KEEP — statistical / non-identifying fields ─────────────────
            case "company":
            case "organisation":
            case "organization":
            case "salary":
            case "income":
            case "ctc":
            case "wages":
            case "compensation":
            case "gender":
            case "sex":
            case "age":
            case "blood_group":
            case "bloodgroup":
            case "marital_status":
            case "maritalstatus":
            case "nationality":
            case "citizenship":
            case "city":
            case "state":
            case "city_name":
            case "town":
            case "district":
            case "gst":
            case "gstin":
            case "url_skip":
                return value;

            default:
                return "[MASKED]";
        }
    };
};

// ─── Path helpers ─────────────────────────────────────────────────────────────
const setNestedValue = (obj, path, value) => {
    const parts = path.replace(/\[(\d+)\]/g, ".$1").split(".");
    let cur = obj;
    for (let i = 0; i < parts.length - 1; i++) {
        if (cur[parts[i]] === undefined) return;
        cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = value;
};

const getNestedValue = (obj, path) => {
    const parts = path.replace(/\[(\d+)\]/g, ".$1").split(".");
    let cur = obj;
    for (const part of parts) {
        if (cur === undefined || cur === null) return undefined;
        cur = cur[part];
    }
    return cur;
};

// ─── Public API ───────────────────────────────────────────────────────────────
export const maskData = (taggedData, level = "medium") => {
    const pseudonymMap = createPseudonymMap();
    const mask = createMasker(pseudonymMap, level);

    return taggedData.map((record) => {
        const { __pii = {}, ...rest } = record;
        const newRecord = JSON.parse(JSON.stringify(rest));

        for (const [fieldPath, annotation] of Object.entries(__pii)) {

            // ROOT CAUSE FIX (carried from v9.4):
            // pii-detector v15 stores __pii values as objects {type, confidence}.
            // Extract .type before passing to the switch.
            const typeStr = annotation && typeof annotation === "object"
                ? annotation.type
                : annotation;

            if (!typeStr) continue;

            const originalValue = getNestedValue(record, fieldPath);
            const maskedValue   = mask(originalValue, typeStr);
            setNestedValue(newRecord, fieldPath, maskedValue);
        }

        return newRecord;
    });
};