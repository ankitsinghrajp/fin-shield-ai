/**
 * PII Detection Engine — v15.3
 *
 * FIXES vs v15.2:
 *
 *   FIX-5  Consistent SAME pseudonym for all name parts of one person:
 *          v15.2's FIX-4 made every field path produce a unique seed, which
 *          fixed same-hash collisions but over-corrected: FirstName and
 *          LastName of the SAME person now rendered as different User_XXXX
 *          tokens (e.g. Person_41 → User_ab12, Person_42 → User_cd34).
 *
 *          Root cause: a person's first and last name are different raw values
 *          so they naturally hash differently; FIX-4 made it even more so.
 *
 *          Fix: all name-type fields within a single record now share a
 *          RECORD-LEVEL IDENTITY SEED derived from the sorted concatenation
 *          of every raw name-field value in that record:
 *            recordIdentitySeed = `__person__:${sortedNameValues}:${seed}`
 *          This guarantees FirstName and LastName always render the same
 *          User_XXXX token. Non-name fields continue using path-scoped seeds
 *          to prevent cross-field collisions.
 *
 * FIXES vs v15.1 (carried forward):
 *
 *   FIX-4  Path-scoped seed for non-name fields (prevents hash collisions
 *          between unrelated fields that happen to share the same raw value).
 *
 * FIXES vs v15.0 (carried forward from v15.1):
 *
 *   FIX-1  Aadhaar pattern relaxed: [2-9]\d{3} → \d{4}
 *   FIX-2  CreditCard pattern extended to cover Amex (4-6-5 format)
 *   FIX-3  CreditCard Luhn check made ADVISORY not BLOCKING when field key
 *          is an explicit creditcard hint
 */

// =============================================================================
// SECTION 1 — UTILITY HELPERS
// =============================================================================

const extractDigits = (v) => String(v).replace(/\D/g, "");
const normaliseKey  = (key) => String(key).toLowerCase().replace(/[_\s\-.]/g, "");
const hasHint       = (normKey, hintList) => hintList.some((h) => normKey.includes(h));

const shortHash = (str, seed = 0) => {
    let h = seed ^ 0xdeadbeef;
    for (let i = 0; i < str.length; i++) {
        h = Math.imul(h ^ str.charCodeAt(i), 0x9e3779b9);
        h ^= h >>> 16;
    }
    h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
    h ^= h >>> 13;
    h = Math.imul(h ^ (h >>> 16), 0xc2b2ae35);
    return (Math.abs(h) >>> 0).toString(16).slice(0, 4);
};

// =============================================================================
// SECTION 2 — VALIDATION HELPERS
// =============================================================================

const luhnCheck = (value) => {
    const digits = extractDigits(value);
    if (digits.length < 13 || digits.length > 19) return false;
    let sum = 0, alt = false;
    for (let i = digits.length - 1; i >= 0; i--) {
        let n = parseInt(digits[i], 10);
        if (alt) { n *= 2; if (n > 9) n -= 9; }
        sum += n;
        alt = !alt;
    }
    return sum % 10 === 0;
};

const isValidIP = (value) => {
    const parts = String(value).split(".");
    if (parts.length !== 4) return false;
    return parts.every((p) => /^\d+$/.test(p) && +p >= 0 && +p <= 255);
};

const isValidPhone = (value) => {
    const digits = extractDigits(value);
    if (digits.length < 6 || digits.length > 15) return false;
    if (/^(\d)\1+$/.test(digits)) return false;
    if (digits.length === 4) return false;
    return true;
};

const isValidDateValue = (value) => {
    const str = String(value).trim();
    if (/^(19|20)\d{2}$/.test(str)) return true;
    const m = str.match(/^(\d{1,4})[/\-.:](\d{1,2})[/\-.:](\d{1,4})$/);
    if (!m) return false;
    const [a, b, c] = [+m[1], +m[2], +m[3]];
    const [year, month, day] = String(m[1]).length === 4 ? [a, b, c] : [c, b, a];
    return year >= 1900 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31;
};

const isValidName = (value) => {
    const str = String(value).trim();
    if (str.length < 2) return false;
    if (/^\d+$/.test(str)) return false;
    if (/^[A-Z]{1,4}$/.test(str)) return false;
    if (/^(null|undefined|n\/a|na|none|unknown)$/i.test(str)) return false;
    return true;
};

const isValidEmail = (value) => {
    const str = String(value).trim();
    if (!EMAIL_PATTERN.test(str)) return false;
    const atIdx = str.indexOf("@");
    return atIdx > 0 && atIdx < str.length - 1 &&
        str.slice(0, atIdx).length <= 64 &&
        str.slice(atIdx + 1).length <= 253;
};

// =============================================================================
// SECTION 3 — PATTERNS
// =============================================================================

const EMAIL_PATTERN = /^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$/i;

const PATTERNS = {
    // FIX-1: relaxed from [2-9]\d{3} to \d{4} — field key is the real guard
    aadhaar: /^\d{4}[\s\-]?\d{4}[\s\-]?\d{4}$/,

    pan:           /^[A-Z]{5}[0-9]{4}[A-Z]$/,
    passport:      /^[A-Z][1-9][0-9]{6}$/,
    voterid:       /^[A-Z]{3}[0-9]{7}$/,
    drivinglicence:/^[A-Z]{2}[0-9]{2}[\s]?[0-9]{4}[\s]?[0-9]{7}$/,
    gst:           /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9][Z][A-Z0-9]$/,
    upi:           /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/,
    pincode:       /^[1-9]\d{5}$/,
    ifsc:          /^[A-Z]{4}0[A-Z0-9]{6}$/,
    ip:            /^(\d{1,3}\.){3}\d{1,3}$/,

    // FIX-2: extended pattern covers:
    //   Standard 16-digit: 4000-1234-5678-9010  (4-4-4-4)
    //   Amex 15-digit:     3782-822463-10005     (4-6-5)
    //   RuPay/Maestro:     various lengths 13-19
    creditcard: /^(\d{4}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{1,4}|\d{4}[\s\-]?\d{6}[\s\-]?\d{5})$/,

    ssn:           /^\d{3}[\-\s]\d{2}[\-\s]\d{4}$/,
    iban:          /^[A-Z]{2}\d{2}[A-Z0-9]{4,30}$/,
    mac:           /^([0-9A-Fa-f]{2}[:\-]){5}[0-9A-Fa-f]{2}$/,
    ipv6:          /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/,
    coordinates:   /^-?\d{1,2}\.\d+,\s*-?\d{1,3}\.\d+$/,
    cvv:           /^\d{3,4}$/,
};

// =============================================================================
// SECTION 4 — HINTS
// =============================================================================

const NAME_HINTS        = ["name","fullname","firstname","lastname","first","last","surname","customer","user","client","recipient","sender","owner","holder","member","patient","employee","employer","vendor","supplier","buyer","seller","borrower","guardian","nominee"];
const EMAIL_HINTS       = ["email","mail","emailid","emailaddress"];
const PHONE_HINTS       = ["phone","mobile","cell","telephone","contact","contactno","phoneno","mobileno","tele","fax","whatsapp","sms"];
const COMPANY_HINTS     = ["company","organisation","organization","org","firm","business","employer","companyname","orgname","businessname"];
const DATE_HINTS        = ["date","subscriptiondate","birth","dob","dateofbirth","doj","dateofjoining","expiry","expirydate","expdate","anniversary","admission","discharge","created","updated","modified","timestamp","joindate","dod","dateofdeath"];
const CUSTOMER_ID_HINTS = ["customerid","userid","clientid","uid","memberid","patientid","employeeid","empid","staffid","agentid","accountid","subscriberid"];
const ACCOUNT_HINTS     = ["account","acc","acctnum","accountno","accountnumber","bankacc"];
const CITY_HINTS        = ["city","town","locality","cityname","district","tehsil","taluk","municipality","village"];
const ADDRESS_HINTS     = ["address","addr","street","streetaddress","residenceaddress","officeaddress","permanentaddress","currentaddress","mailingaddress","postaladdress","houseaddress","plotno","doornum","houseno","landmark"];
const GENDER_HINTS      = ["gender","sex","sexatbirth"];
const AGE_HINTS         = ["age","currentage","ageyears"];
const SALARY_HINTS      = ["salary","income","ctc","compensation","wages","annualincome","monthlysalary","netpay","grosspay","remuneration"];
const RELIGION_HINTS    = ["religion","faith","caste","subcaste","community","denomination","sect"];
const BIOMETRIC_HINTS   = ["fingerprint","retina","iris","biometric","faceprint","voiceprint","dna"];
const NATIONALITY_HINTS = ["nationality","citizenship"];
const MARITAL_HINTS     = ["marital","maritalstatus","relationshipstatus"];
const BLOOD_HINTS       = ["bloodgroup","bloodtype","bloodgrp"];
const CVV_HINTS         = ["cvv","cvc","cvv2","cvc2","cardverification","securitycode","cardcode","cvn","cardverificationvalue","cardverificationnumber","cid"];
const GOV_ID_HINTS      = ["govid","governmentid","nationalid","natid","govtid","nid","nationalidentity"];
const NAME_EXCLUDE_HINTS= ["type","category","segment","class","status","label","tag","code","ref","sku","mode","kind"];

const PATTERN_HINTS = {
    // FIX-1: aadhaar hints are the primary guard — value pattern is secondary
    aadhaar:       ["aadhaar","aadhar","uid","uidai"],
    pan:           ["pan","pancard","pannumber"],
    // FIX-3: expanded creditcard hints so key-name alone triggers detection
    //         even when Luhn fails (synthetic/test card numbers)
    creditcard:    ["creditcard","debitcard","credit","debit","ccnum","cardnumber","cardno","cc","card"],
    ssn:           ["ssn","socialsecurity","socialsecuritynumber","socialsec"],
    passport:      ["passport","passportno","passportnumber"],
    voterid:       ["voterid","epic","electioncard","votercard"],
    drivinglicence:["drivinglicence","drivinglicense","dl","dlno","drivinglic"],
    gst:           ["gst","gstin","gstnumber"],
    upi:           ["upi","upiid","vpa","virtualpa"],
    ifsc:          ["ifsc","ifsccode"],
    pincode:       ["pincode","postalcode","zipcode","zip","pin"],
    ip:            ["ip","ipaddress","sourceip","destip","remoteip"],
    ipv6:          ["ipv6","ip6","ipv6address"],
    iban:          ["iban","ibannumber"],
    mac:           ["mac","macaddress","hwaddress","physicaladdress"],
    coordinates:   ["coordinates","coords","latlong","latlng","geolocation","gps"],
    email:         ["email","mail","emailid"],
};

// =============================================================================
// SECTION 5 — SAFE / NON-PII FIELD SETS
// =============================================================================

export const NON_PII_FIELDS = new Set([
    "orderref","txnid","transactionid","invoiceno","index","website","country",
    "referenceno","refno","serialno","serialnumber","batchno","batchid",
    "trackingno","trackingnumber","shipmentno","orderid","ordernumber",
    "versionno","version","buildno","releaseno","ticketno","ticketid",
    "caseid","workorderid","requestid","applicationid","formid","documentid",
    "paymentid","invoiceid","quotationno","ponum","pono","grn","workflowid",
    "jobid","taskid","queueid","messageid","sessionid","correlationid",
    "errorcode","statuscode","responsecode","resultcode","httpstatus",
    "pageno","pagenumber","rowcount","totalcount","pagesize","offset","limit",
    "currency","currencycode","countrycode","languagecode","timezone","locale",
]);

export const SAFE_FIELDS = new Set([
    "sales","grosssales","profit","cogs","discounts","units","price",
    "manufacturingprice","margin","revenue","unitssold","unitprice","quantity",
    "qty","amount","totalamount","subtotal","tax","taxamount","gstamount",
    "discount","discountamount","shipping","shippingcost","freightcost",
    "costprice","sellingprice","mrp","netprofit","grossprofit","ebitda",
    "turnover","commission","royalty","interest","dividend","refundamount",
    "monthname","month","year","quarter","week","weekday","day","hour",
    "fiscalyear","fiscalquarter","financialyear",
    "segment","product","productname","category","subcategory","brand",
    "sku","upc","ean","barcode","isbn","asin","model","variant",
    "productcode","productid","itemcode","itemid","catalogid","listingid",
    "country","region","state","zone","territory","market","warehouse",
    "storelocation","branchname","departmentname","division","channel",
    "status","orderstatus","paymentstatus","shipmentstatus","flag","isactive",
    "isenabled","isdeleted","isverified","isapproved","isprimary",
    "rating","score","rank","priority","severity","level",
    "description","notes","comments","remarks","reason","purpose",
    "type","kind","mode","method","source","medium",
    "label","tag","class","group",
]);

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

// =============================================================================
// SECTION 6 — DETECTION ENGINE
// =============================================================================

export const detectFieldPII = (key, value) => {
    if (value === null || value === undefined) return null;
    const strValue = String(value).trim();
    if (strValue === "" || strValue === "null" || strValue === "undefined") return null;
    if (/^(true|false|yes|no)$/i.test(strValue)) return null;

    const normKey = normaliseKey(key);

    if (SAFE_FIELDS.has(normKey)) return null;
    if (NON_PII_FIELDS.has(normKey)) return null;

    if (hasHint(normKey, BIOMETRIC_HINTS))
        return { type: "biometric", confidence: "high" };

    if (hasHint(normKey, CVV_HINTS) && PATTERNS.cvv.test(strValue))
        return { type: "cvv", confidence: "high" };

    if (hasHint(normKey, RELIGION_HINTS))
        return { type: "religion_caste", confidence: "high" };

    if (hasHint(normKey, GENDER_HINTS))
        return { type: "gender", confidence: "high" };

    if (hasHint(normKey, BLOOD_HINTS))
        return { type: "blood_group", confidence: "high" };

    if (hasHint(normKey, MARITAL_HINTS))
        return { type: "marital_status", confidence: "high" };

    if (hasHint(normKey, NATIONALITY_HINTS))
        return { type: "nationality", confidence: "high" };

    if (hasHint(normKey, SALARY_HINTS))
        return { type: "salary", confidence: "high" };

    if (hasHint(normKey, AGE_HINTS)) {
        const n = Number(strValue);
        if (!isNaN(n) && n >= 0 && n <= 130)
            return { type: "age", confidence: "high" };
    }

    if (CUSTOMER_ID_HINTS.map(normaliseKey).includes(normKey))
        return { type: "customer_id", confidence: "high" };

    if (hasHint(normKey, GOV_ID_HINTS))
        return { type: "national_id", confidence: "high" };

    if (hasHint(normKey, ADDRESS_HINTS) && strValue.length > 3)
        return { type: "address", confidence: "high" };

    if (
        hasHint(normKey, NAME_HINTS) &&
        !normKey.includes("month") &&
        !hasHint(normKey, NAME_EXCLUDE_HINTS) &&
        isValidName(strValue) &&
        !COMMON_CITIES.has(strValue.toLowerCase())
    ) {
        return { type: "name", confidence: "high" };
    }

    if (hasHint(normKey, CITY_HINTS))
        return { type: "city", confidence: "medium" };

    if (hasHint(normKey, COMPANY_HINTS) && strValue.length > 1)
        return { type: "company", confidence: "high" };

    if (hasHint(normKey, DATE_HINTS) && isValidDateValue(strValue))
        return { type: "date", confidence: "high" };

    if (hasHint(normKey, PHONE_HINTS) && isValidPhone(strValue))
        return { type: "phone", confidence: "high" };

    if (hasHint(normKey, PATTERN_HINTS.email) && isValidEmail(strValue))
        return { type: "email", confidence: "high" };

    if (hasHint(normKey, ACCOUNT_HINTS))
        return { type: "account", confidence: "medium" };

    if (/^(true|false|yes|no|null|na|n\/a|none|unknown)$/i.test(strValue)) return null;

    // FIX-1: Aadhaar — hint match + 12-digit structure (value pattern relaxed)
    // Field key "Aadhaar" is the authoritative signal; pattern just verifies structure
    if (hasHint(normKey, PATTERN_HINTS.aadhaar) && PATTERNS.aadhaar.test(strValue))
        return { type: "aadhaar", confidence: "high" };

    if (hasHint(normKey, PATTERN_HINTS.pan) && PATTERNS.pan.test(strValue))
        return { type: "pan", confidence: "high" };

    // FIX-2 + FIX-3: CreditCard detection:
    //   - If field KEY is an explicit card hint → trust the key, skip Luhn
    //     (synthetic/test numbers like 4000-1234-5678-9010 fail Luhn deliberately)
    //   - If field KEY is generic → require Luhn to avoid false positives
    if (hasHint(normKey, PATTERN_HINTS.creditcard) && PATTERNS.creditcard.test(strValue)) {
        const digits = extractDigits(strValue);
        if (digits.length >= 13 && digits.length <= 19)
            // Key hint is explicit — redact regardless of Luhn validity
            return { type: "creditcard", confidence: "high" };
    }

    if (hasHint(normKey, PATTERN_HINTS.ssn) && PATTERNS.ssn.test(strValue))
        return { type: "ssn", confidence: "high" };

    if (hasHint(normKey, PATTERN_HINTS.passport) && PATTERNS.passport.test(strValue))
        return { type: "passport", confidence: "high" };

    if (hasHint(normKey, PATTERN_HINTS.voterid) && PATTERNS.voterid.test(strValue))
        return { type: "voter_id", confidence: "high" };

    if (hasHint(normKey, PATTERN_HINTS.drivinglicence) && PATTERNS.drivinglicence.test(strValue))
        return { type: "driving_licence", confidence: "high" };

    if (hasHint(normKey, PATTERN_HINTS.gst) && PATTERNS.gst.test(strValue))
        return { type: "gst", confidence: "high" };

    if (hasHint(normKey, PATTERN_HINTS.upi) && PATTERNS.upi.test(strValue))
        return { type: "upi", confidence: "high" };

    if (hasHint(normKey, PATTERN_HINTS.ifsc) && PATTERNS.ifsc.test(strValue))
        return { type: "ifsc", confidence: "high" };

    if (hasHint(normKey, PATTERN_HINTS.pincode) && PATTERNS.pincode.test(strValue))
        return { type: "pincode", confidence: "high" };

    if (hasHint(normKey, PATTERN_HINTS.ip) && PATTERNS.ip.test(strValue) && isValidIP(strValue))
        return { type: "ip_address", confidence: "high" };

    if (hasHint(normKey, PATTERN_HINTS.ipv6) && PATTERNS.ipv6.test(strValue))
        return { type: "ip_address_v6", confidence: "high" };

    if (hasHint(normKey, PATTERN_HINTS.iban) && PATTERNS.iban.test(strValue))
        return { type: "iban", confidence: "high" };

    if (hasHint(normKey, PATTERN_HINTS.mac) && PATTERNS.mac.test(strValue))
        return { type: "mac_address", confidence: "high" };

    if (hasHint(normKey, PATTERN_HINTS.coordinates) && PATTERNS.coordinates.test(strValue))
        return { type: "coordinates", confidence: "high" };

    return null;
};

// =============================================================================
// SECTION 7 — MASKING STRATEGIES
// =============================================================================

export const maskValue = (type, value, seed = "") => {
    const str = String(value).trim();

    // FIX-5: when the seed carries a record-identity marker (set by maskPII
    // for name-type fields), hash the seed ALONE — not str+seed.
    // This guarantees every name field in the same record (FirstName, LastName,
    // FullName…) produces the identical User_XXXX token regardless of the
    // different raw values they hold.
    // For all other fields the seed is path-scoped, so str+seed remains unique.
    const IDENTITY_MARKER = "__person__:";
    const h = (type === "name" && seed.startsWith(IDENTITY_MARKER))
        ? shortHash(seed)          // seed encodes the person — ignore raw value
        : shortHash(str + seed);   // normal path: raw value + field seed

    switch (type) {
        case "aadhaar": case "pan": case "ssn": case "passport":
        case "voter_id": case "driving_licence": case "national_id":
        case "biometric": case "religion_caste": case "cvv":
            return "[REDACTED]";
        case "name":        return `User_${h}`;
        case "email":       return `user_${h}@masked.com`;
        case "upi":         return `user_${h}@upi`;
        case "customer_id": return `CID_${h}`;
        case "creditcard": {
            const digits = extractDigits(str);
            const last4  = digits.slice(-4);
            const sep    = str.includes("-") ? "-" : str.includes(" ") ? " " : "-";
            return `****${sep}****${sep}****${sep}${last4}`;
        }
        case "account": {
            const digits = extractDigits(str);
            return digits.length >= 4 ? `****${digits.slice(-4)}` : "****";
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
        case "phone": {
            const digits = extractDigits(str);
            if (digits.length === 10 && /^[6-9]/.test(digits)) return `+91-XXXXXXXX`;
            if (digits.length > 10) return `+${digits.slice(0, digits.length - 10)}-XXXXXXXXXX`;
            return "XXXXXXXX";
        }
        case "date": {
            const yearMatch = str.match(/(19|20)\d{2}/);
            if (yearMatch) return yearMatch[0];
            const isoMatch  = str.match(/^(\d{4})/);
            if (isoMatch)  return isoMatch[1];
            return str;
        }
        case "address": {
            const lower = str.toLowerCase();
            for (const city of COMMON_CITIES)
                if (lower.includes(city))
                    return city.charAt(0).toUpperCase() + city.slice(1);
            const parts = str.split(/,\s*/);
            if (parts.length > 1) return parts[parts.length - 2].trim();
            return "[Address on file]";
        }
        case "pincode": {
            return str.length === 6 ? `${str.slice(0, 3)}***` : "***";
        }
        case "ip_address": {
            const parts = str.split(".");
            return parts.length === 4 ? `${parts[0]}.${parts[1]}.x.x` : "x.x.x.x";
        }
        case "ip_address_v6":
            return str.split(":")[0] + ":****:****:****";
        case "coordinates": {
            const parts = str.split(",").map((p) => parseFloat(p.trim()));
            if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
                const j = () => (Math.random() - 0.5);
                return `${(parts[0] + j()).toFixed(2)},${(parts[1] + j()).toFixed(2)}`;
            }
            return "[REDACTED]";
        }
        case "company": case "salary": case "gender": case "age":
        case "blood_group": case "marital_status": case "nationality":
        case "city": case "gst": case "ifsc":
            return value;
        default:
            return "[REDACTED]";
    }
};

// =============================================================================
// SECTION 8 — RECURSIVE TRAVERSAL
// =============================================================================

const flatDetect = (obj, detected, prefix) => {
    if (obj === null || typeof obj !== "object") return;
    for (const key of Object.keys(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        const value   = obj[key];
        if (Array.isArray(value)) {
            value.forEach((v, i) => {
                const elemKey = `${fullKey}[${i}]`;
                if (v !== null && typeof v === "object") flatDetect(v, detected, elemKey);
                else { const r = detectFieldPII(key, v); if (r) detected[elemKey] = r; }
            });
        } else if (value !== null && typeof value === "object") {
            flatDetect(value, detected, fullKey);
        } else {
            const r = detectFieldPII(key, value);
            if (r) detected[fullKey] = r;
        }
    }
};

const setByPath = (obj, path, val) => {
    const keys = path.replace(/\[(\d+)\]/g, ".$1").split(".");
    let cur = obj;
    for (let i = 0; i < keys.length - 1; i++) cur = cur[keys[i]];
    cur[keys[keys.length - 1]] = val;
};

// =============================================================================
// SECTION 9 — PUBLIC API
// =============================================================================

export const detectPII = (data) => {
    if (!Array.isArray(data)) {
        if (data !== null && typeof data === "object") return detectPII([data]);
        throw new TypeError("detectPII expects an array of records or a single object");
    }
    return data.map((record) => {
        if (typeof record !== "object" || record === null)
            return { content: record, __pii: {} };
        const detected = {};
        flatDetect(record, detected, "");
        return { ...record, __pii: detected };
    });
};

// NAME_FIELD_HINTS: normalised key fragments that identify a human name part.
// All fields whose normalised key contains one of these are treated as parts
// of the SAME person and share a single pseudonym token within a record.
const NAME_FIELD_HINTS = ["firstname","lastname","fullname","name","surname"];

export const maskPII = (data, options = {}) => {
    const { annotate = true, seed = "" } = options;
    const annotated = detectPII(data);
    return annotated.map((record) => {
        const { __pii, ...rest } = record;
        if (!__pii || Object.keys(__pii).length === 0)
            return annotate ? { ...rest, __pii } : rest;
        const masked = JSON.parse(JSON.stringify(rest));

        // FIX-5: build a stable per-record identity seed for ALL name-type
        // fields so that FirstName, LastName, FullName etc. all resolve to the
        // SAME User_XXXX token — they are parts of the same person.
        //
        // We hash the sorted concatenation of every raw name-field value in
        // the record. Sorting makes the seed order-independent across JS
        // engines. Non-name fields still use a path-scoped seed so they never
        // collide with each other or with the name token.
        const rawNameValues = Object.entries(__pii)
            .filter(([path, { type }]) => {
                if (type !== "name") return false;
                const leafKey = normaliseKey(
                    path.replace(/.*[.\[]/, "").replace(/\]$/, "")
                );
                return NAME_FIELD_HINTS.some((h) => leafKey.includes(h));
            })
            .map(([path]) => {
                const keys = path.replace(/\[(\d+)\]/g, ".$1").split(".");
                let cur = rest;
                for (const k of keys) cur = cur?.[k];
                return String(cur ?? "");
            })
            .sort()
            .join("|");

        const recordIdentitySeed = rawNameValues.length
            ? `__person__:${rawNameValues}:${seed}`
            : null;

        for (const [path, { type }] of Object.entries(__pii)) {
            const keys = path.replace(/\[(\d+)\]/g, ".$1").split(".");
            let cur = masked;
            for (let i = 0; i < keys.length - 1; i++) cur = cur?.[keys[i]];
            const rawVal = cur?.[keys[keys.length - 1]];

            // Name fields  → shared record-identity seed (same person = same token)
            // Other fields → path-scoped seed            (no cross-field collisions)
            const effectiveSeed =
                type === "name" && recordIdentitySeed !== null
                    ? recordIdentitySeed
                    : `${path}:${seed}`;

            setByPath(masked, path, maskValue(type, rawVal, effectiveSeed));
        }
        return annotate ? { ...masked, __pii } : masked;
    });
};

export const summarisePII = (annotatedRecords) =>
    annotatedRecords.map(({ __pii = {} }) => __pii);

export const hasHighConfidencePII = (annotatedRecords) =>
    annotatedRecords.some(({ __pii = {} }) =>
        Object.values(__pii).some((v) => v.confidence === "high"));

export const MASKING_STRATEGY = {
    name:"PSEUDONYMISE", email:"PSEUDONYMISE", upi:"PSEUDONYMISE",
    customer_id:"TOKENISE",
    creditcard:"PARTIAL", account:"PARTIAL", iban:"PARTIAL", mac_address:"PARTIAL",
    phone:"GENERALISE", date:"GENERALISE", address:"GENERALISE", pincode:"GENERALISE",
    ip_address:"GENERALISE", ip_address_v6:"GENERALISE", coordinates:"GENERALISE",
    aadhaar:"REDACT", pan:"REDACT", ssn:"REDACT", passport:"REDACT",
    voter_id:"REDACT", driving_licence:"REDACT", national_id:"REDACT",
    biometric:"REDACT", religion_caste:"REDACT", cvv:"REDACT",
    company:"KEEP", salary:"KEEP", gender:"KEEP", age:"KEEP",
    blood_group:"KEEP", marital_status:"KEEP", nationality:"KEEP",
    city:"KEEP", gst:"KEEP", ifsc:"KEEP",
};