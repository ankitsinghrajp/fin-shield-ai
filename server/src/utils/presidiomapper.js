/**
 * presidioMapper.js — v8.1
 *
 * INTEGRATION: Merged with finshield_pii_masker.js (standalone v2.0)
 *
 * What changed vs v8.0:
 *
 *   INTEGRATION-1  KEY_TYPE_MAP unified
 *                  finshield_pii_masker.js and presidioMapper.js had IDENTICAL
 *                  KEY_TYPE_MAP / normalizeKey / KV_LINE_RE logic duplicated in
 *                  two files. They are now maintained here only; the standalone
 *                  masker imports from this file.
 *
 *   INTEGRATION-2  normalizeSquishedText() added (from finshield_pii_masker §E)
 *                  Docx files extracted by mammoth produce squished paragraphs
 *                  ("Name: AnkitEmail: ankit@…"). This function inserts \n
 *                  before every known field label so each KV pair lands on its
 *                  own line before applyKeyValueMasking() runs.
 *                  Exported so piiEngine can call it on unstructured docx text.
 *
 *   INTEGRATION-3  maskDocument() added (from finshield_pii_masker §F)
 *                  Splits multi-line text on \n, calls maskLine() on every line,
 *                  rejoins. Used by the standalone CLI AND by piiEngine's
 *                  unstructured path when the full text is presented as a single
 *                  string (docx extraction scenario).
 *
 *   INTEGRATION-4  maskLine() added (from finshield_pii_masker §D)
 *                  Thin wrapper: parseKVLine → lookup KEY_TYPE_MAP → maskValue.
 *
 *   INTEGRATION-5  Individual masking helpers re-exported
 *                  maskEmail, maskPhone, maskName, maskCreditCard, maskAccount,
 *                  maskIFSC, maskIP, maskPincode, maskExpiry, maskDate
 *                  are now named exports so the standalone CLI can import them.
 *
 *   All prior fixes from v8.0 are retained unchanged:
 *     FIX-8   Multi-word keys (IP Address, Account Number, Card Number,
 *             Card Holder Name, IFSC Code) matched via space-allowed KV_LINE_RE.
 *     FIX-9   Missing KEY_TYPE_MAP entries (cardholdername → name, etc.)
 *     FIX-10  Address value: multi-word key fix ensures full value reaches
 *             maskValue("address") → "[ADDRESS REDACTED]".
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * All earlier fixes (v1–v7) are documented in the git history / piiEngine.
 */

"use strict";

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION A — KEY → PII-TYPE MAP  (unified from both files)
// ═══════════════════════════════════════════════════════════════════════════════
export const KEY_TYPE_MAP = {
  // ── Direct PII ──────────────────────────────────────────────────────────
  email:              "email",
  emailaddress:       "email",
  useremail:          "email",
  mail:               "email",
  phone:              "phone",
  mobile:             "phone",
  phonenumber:        "phone",
  mobilenumber:       "phone",
  contactnumber:      "phone",
  contact:            "phone",
  tel:                "phone",
  name:               "name",
  username:           "name",
  fullname:           "name",
  customername:       "name",
  firstname:          "name",
  lastname:           "name",
  user:               "name",
  // Multi-word name keys (FIX-9 / INTEGRATION-1)
  cardholdername:     "name",
  holdername:         "name",
  accountholdername:  "name",
  // ── Sensitive PII ────────────────────────────────────────────────────────
  aadhaar:            "aadhaar",
  aadhaarnumber:      "aadhaar",
  uidai:              "aadhaar",
  pan:                "pan",
  pannumber:          "pan",
  pancard:            "pan",
  cvv:                "cvv",
  cvc:                "cvv",
  cvn:                "cvv",
  csc:                "cvv",
  cardnumber:         "creditcard",   // "Card Number"
  card:               "creditcard",
  creditcard:         "creditcard",
  creditcardnumber:   "creditcard",
  cc:                 "creditcard",
  expiry:             "expiry",
  expiration:         "expiry",
  exp:                "expiry",
  validthru:          "expiry",
  cardexpiry:         "expiry",
  account:            "account",
  accountnumber:      "account",      // "Account Number"
  accountno:          "account",
  accno:              "account",
  bankaccount:        "account",
  ifsc:               "ifsc",
  ifsccode:           "ifsc",         // "IFSC Code"
  ssn:                "ssn",
  socialsecurity:     "ssn",
  passport:           "passport",
  passportnumber:     "passport",
  otp:                "otp_sensitive",
  passcode:           "otp_sensitive",
  verificationcode:   "otp_sensitive",
  // ── Session / auth tokens ────────────────────────────────────────────────
  sessionid:          "session_sensitive",
  session:            "session_sensitive",
  token:              "session_sensitive",
  authtoken:          "session_sensitive",
  accesstoken:        "session_sensitive",
  refreshtoken:       "session_sensitive",
  // ── Quasi-identifiers ────────────────────────────────────────────────────
  dob:                "date",
  dateofbirth:        "date",
  birthdate:          "date",
  birthday:           "date",
  address:            "address",
  addr:               "address",
  streetaddress:      "address",
  pincode:            "pincode",
  zip:                "pincode",
  zipcode:            "pincode",
  postalcode:         "pincode",
  ip:                 "ip",
  ipaddress:          "ip",           // "IP Address"
  ipaddr:             "ip",
};

/**
 * Normalise a key: lowercase, strip ALL non-alpha chars.
 *   "IP Address"       → "ipaddress"
 *   "Account Number"   → "accountnumber"
 *   "Card Holder Name" → "cardholdername"
 *   "IFSC Code"        → "ifsccode"
 */
export const normalizeKey = (k) => k.toLowerCase().replace(/[^a-z]/g, "");

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION B — KV LINE PARSER  (FIX-8: key allows internal spaces)
// ═══════════════════════════════════════════════════════════════════════════════
/**
 * Matches "Key: Value" and "Key=Value" and "Multi Word Key: Value".
 *
 * OLD (broken): /^([A-Za-z][A-Za-z0-9_\-.]*)[ \t]*[=:][ \t]*(.+)$/
 * NEW  (fixed): /^([A-Za-z][A-Za-z0-9_\-. ]*)[ \t]*[=:][ \t]*(.+)$/
 *                                           ^^^  ← space added
 */
const KV_LINE_RE = /^([A-Za-z][A-Za-z0-9_\-. ]*)[ \t]*[=:][ \t]*(.+)$/;

/**
 * Parse a "Key: Value" or "Key=Value" line.
 * Returns { key, rawValue, valueStart, valueEnd } or null.
 * valueStart / valueEnd are character offsets into the ORIGINAL (untrimmed) line.
 */
export const parseKVLine = (line) => {
  const trimmed = line.trim();
  const m = KV_LINE_RE.exec(trimmed);
  if (!m) return null;

  const key      = m[1].trimEnd();
  const rawValue = m[2].trim();

  const leadingSpaces = line.length - line.trimStart().length;
  const keyInLine     = line.indexOf(key, leadingSpaces);
  const afterKey      = keyInLine + key.length;
  let   sepIdx        = afterKey;
  while (sepIdx < line.length && (line[sepIdx] === " " || line[sepIdx] === "\t")) sepIdx++;
  let valueStart = sepIdx + 1;
  while (valueStart < line.length && (line[valueStart] === " " || line[valueStart] === "\t")) valueStart++;
  const valueEnd = valueStart + rawValue.length;

  return { key, rawValue, valueStart, valueEnd };
};

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION C — INDIVIDUAL MASKING HELPERS
//   Exported so finshield_pii_masker.js (standalone CLI) can import them
//   instead of duplicating code.
// ═══════════════════════════════════════════════════════════════════════════════
export const maskEmail = (s) => {
  const at = s.indexOf("@");
  if (at < 1) return "[REDACTED]";
  const local  = s.slice(0, at);
  const domain = s.slice(at + 1);
  if (local.length <= 2) return `${local}@${domain}`;
  return `${local.slice(0, 2)}${"*".repeat(local.length - 2)}@${domain}`;
};

export const maskPhone = (s) => {
  const d = s.replace(/\D/g, "");
  if (d.length < 6) return "[MASKED]";
  const core = d.length > 10 ? d.slice(-10) : d;
  return `${core.slice(0, 2)}XXXX${core.slice(-4)}`;
};

/** Deterministic pseudonym — same input always produces same User_NNNN. */
export const maskName = (s) => {
  const h = [...s].reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) & 0xffff, 0);
  return `User_${(h % 9000) + 1000}`;
};

export const maskCreditCard = (s) => {
  const d = s.replace(/\D/g, "");
  if (d.length < 13) return "****-****-****-****";
  return `****-****-****-${d.slice(-4)}`;
};

export const maskAccount = (s) => {
  const d = s.replace(/\D/g, "");
  if (d.length < 4) return "****";
  return `****${d.slice(-4)}`;
};

export const maskIFSC = (s) =>
  s.length >= 4 ? `${s.slice(0, 4)}XXXXXXX` : "[MASKED]";

export const maskIP = (s) => {
  const parts = s.split(".");
  if (parts.length === 4) return `${parts[0]}.${parts[1]}.XXX.XXX`;
  return "[MASKED]";
};

export const maskPincode = (s) => {
  const d = s.replace(/\D/g, "");
  return d.length >= 2 ? `${d.slice(0, 2)}XXXX` : "XXXXXX";
};

export const maskExpiry = (s) => {
  const m = s.match(/^(\d{1,2})([\/-])(\d{2,4})$/);
  if (m) return `XX${m[2]}${m[3]}`;
  return "[REDACTED]";
};

export const maskDate = (s) => {
  const m = s.match(/\b(19|20)\d{2}\b/);
  return m ? m[0] : "[REDACTED]";
};

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION D — PER-TYPE MASKING DISPATCH
// ═══════════════════════════════════════════════════════════════════════════════
export const maskValue = (str, type, level = "medium") => {
  if (str == null || str === "") return str;
  const s = String(str).trim();
  if (!s) return s;

  if (level === "high") return "[REDACTED]";
  if (level === "low") {
    const vis = Math.max(1, Math.min(3, Math.floor(s.length / 4)));
    return s.slice(0, vis) + "*".repeat(Math.max(1, s.length - vis));
  }

  // medium (default)
  switch (type) {
    case "email":             return maskEmail(s);
    case "phone":             return maskPhone(s);
    case "name":              return maskName(s);
    case "creditcard":        return maskCreditCard(s);
    case "account":           return maskAccount(s);
    case "ifsc":              return maskIFSC(s);
    case "ip":                return maskIP(s);
    case "pincode":           return maskPincode(s);
    case "expiry":
    case "expiry_line":       return maskExpiry(s);
    case "date":              return maskDate(s);
    case "address":           return "[ADDRESS REDACTED]";
    case "aadhaar":
    case "pan":
    case "passport":
    case "ssn":
    case "national_id":
    case "cvv":
    case "cvv_line":
    case "otp_sensitive":
    case "session_sensitive": return "[REDACTED]";
    case "city":
    case "url_skip":          return s;
    default:                  return "[MASKED]";
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION E — LINE-LEVEL MASKER  (INTEGRATION-4 from finshield §D)
// ═══════════════════════════════════════════════════════════════════════════════
/**
 * Mask a single "Key: Value" line.
 * Returns the line with the value portion replaced, or the original line if
 *   - it is not a KV line, or
 *   - the key is not in KEY_TYPE_MAP (non-PII → pass through unchanged).
 */
export const maskLine = (line, level = "medium") => {
  const kv = parseKVLine(line);
  if (!kv) return line;
  const piiType = KEY_TYPE_MAP[normalizeKey(kv.key)];
  if (piiType === undefined) return line;
  const masked = maskValue(kv.rawValue, piiType, level);
  return line.slice(0, kv.valueStart) + masked + line.slice(kv.valueEnd);
};

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION F — DOCUMENT-LEVEL MASKER  (INTEGRATION-3 from finshield §F)
// ═══════════════════════════════════════════════════════════════════════════════
/**
 * Mask every KV pair in a multi-line text document.
 * Non-KV lines (headers, log entries, blank lines) pass through unchanged.
 * Used by the standalone CLI and by piiEngine's unstructured docx path.
 */
export const maskDocument = (text, level = "medium") =>
  text
    .split("\n")
    .map(line => maskLine(line, level))
    .join("\n");

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION G — DOCX PRE-PROCESSOR  (INTEGRATION-2 from finshield §E)
//
// mammoth extracts docx text without paragraph breaks between runs, yielding
// lines like "Name: Ankit SinghEmail: ankit@…". We insert \n before every
// known field label so each KV pair is on its own line.
//
// Longest labels are processed first (longest-match priority) so
// "Card Holder Name" is split as a unit before sub-words can split it.
// ═══════════════════════════════════════════════════════════════════════════════
export const KNOWN_FIELD_LABELS = [
  // Multi-word first (longest-match priority)
  "Card Holder Name", "Card Number", "Account Number", "IP Address", "IFSC Code",
  "Date of Birth",
  // Single-word
  "Name", "Email", "Phone", "Address", "Pincode",
  "CustomerID", "PAN", "Aadhaar", "IP",
  "Expiry", "CVV", "User", "SessionID", "Reason",
  "TransactionID", "Order_ref", "Amount", "Status", "Product",
  "DOB", "OTP", "Token", "Session",
];

const SORTED_LABELS = [...KNOWN_FIELD_LABELS].sort((a, b) => b.length - a.length);

const escapeRE = (s) => s.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");

const LABEL_SPLIT_RE = new RegExp(
  "(?<!\n)(" + SORTED_LABELS.map(escapeRE).join("|") + ")(?=\\s*[=:])",
  "g"
);

/**
 * Insert newlines before each known field label in squished docx text.
 * Also handles SECTION headers and log timestamps.
 *
 * Call this on raw mammoth output BEFORE maskDocument() / applyKeyValueMasking().
 */
export const normalizeSquishedText = (text) => {
  // 1. Insert \n before known field labels
  let out = text.replace(LABEL_SPLIT_RE, "\n$1");
  // 2. Insert \n before SECTION headers
  out = out.replace(/(?<!\n)(SECTION\s+\d)/g, "\n$1");
  // 3. Insert \n before log timestamps [YYYY-MM-DD
  out = out.replace(/(?<!\n)(\[\d{4}-\d{2}-\d{2})/g, "\n$1");
  return out.trim();
};

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION H — PRESIDIO SUPPORT: type normaliser, guards, regex fallbacks,
//             span helpers (all unchanged from v8.0)
// ═══════════════════════════════════════════════════════════════════════════════

// ── Label words that Presidio mis-fires PERSON on ────────────────────────────
const LABEL_WORDS = new Set([
  "email","name","user","phone","mobile","address","pincode","aadhaar","pan",
  "account","card","cvv","expiry","expiration","location","city","ip","gender",
  "dob","birth","company","customer","client","ref","id","number","amount",
  "reason","status","session","cache","order","transaction","retrying","otp",
  "flat","plot","house","door","shop","unit","no","block","sector","type",
]);

const splitTokens = (text) =>
  text
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .split(/[\s_\-=:]+/)
    .map(w => w.toLowerCase().replace(/[^a-z]/g, ""))
    .filter(Boolean);

const isLabelPhrase = (spanText) =>
  splitTokens(spanText).length > 0 &&
  splitTokens(spanText).every(w => LABEL_WORDS.has(w));

// ── Non-PII system-reference guard ───────────────────────────────────────────
const NON_PII_PREFIX_RE  = /^(TXN|ORD|REF|INV|SESS|TRANS|TID|RID|USR|CUST|REQID|MSGID|BATCHID)[_\-]/i;
const NON_PII_CONTEXT_RE = /(TXN|ORD|REF|INV|SESS|TRANS|TID|RID|USR|CUST|REQID|MSGID|BATCHID)[_\-]\S*$/i;

const isNonPIIToken = (text, spanStart, spanValue) => {
  if (NON_PII_PREFIX_RE.test(spanValue)) return true;
  const contextBefore = text.slice(Math.max(0, spanStart - 12), spanStart);
  if (NON_PII_CONTEXT_RE.test(contextBefore + spanValue)) return true;
  return false;
};

// ── Regex fallbacks (priority=10) ────────────────────────────────────────────
const REGEX_FALLBACKS = [
  { re: /\b\d{4}[\s\-]\d{4}[\s\-]\d{4}\b/,
    type: "aadhaar",     priority: 10 },
  { re: /\b[A-Z]{5}[0-9]{4}[A-Z]\b/,
    type: "pan",         priority: 10 },
  { re: /(?<!\d)[1-9]\d{5}(?!\d)/,
    type: "pincode",     priority: 10 },
  { re: /\b\d{4}[\s\-]\d{4}[\s\-]\d{4}[\s\-]\d{4}\b/,
    type: "creditcard",  priority: 10 },
  { re: /\b[A-Z]{4}0[A-Z0-9]{6}\b/,
    type: "ifsc",        priority: 10 },
  { re: /(?:(?:Flat|Plot|House|No|Shop|Door|Unit|Villa|Room|H\.?No)\.?[ \t]*[A-Z0-9\-\/]+[ \t]*,?[ \t]*|[A-Z]?\d+[A-Z]?[ \t]+)[\w ,]{2,80}(?:Street|St|Road|Rd|Avenue|Ave|Lane|Ln|Nagar|Colony|Marg|Chowk|Block|Sector|Phase|Layout|Enclave|Vihar|Bagh|Puram|Ganj|Bazaar|Way|Drive|Dr|Court|Ct|Place|Pl|Close|Crescent|Row|Gardens?|Park|Square|Hills?|View|Heights?|Towers?|Apartments?|Flats?|Residency|Complex|Compound)\b/i,
    type: "address",     priority: 10 },
  { re: /(?:CVV|CVC|CVN|CSC)[=:\s]+(\d{3,4})/i,
    type: "cvv_line",    priority: 10 },
  { re: /(?:Expiry|Expiration|Exp|Valid(?:[ \t]+Thru)?)[=:\s]+(\d{1,2}\/\d{2,4})/i,
    type: "expiry_line", priority: 10 },
];

// ── Type normaliser ───────────────────────────────────────────────────────────
export const normaliseType = (entity_type = "") => {
  const KNOWN = [
    "aadhaar","pan","pincode","ifsc","creditcard","account","phone",
    "email","ip","name","city","date","national_id","ssn","passport",
    "address","cvv","expiry","cvv_line","expiry_line",
    "otp_sensitive","session_sensitive",
  ];
  if (KNOWN.includes(entity_type)) return entity_type;

  const t = entity_type.toLowerCase();
  if (t === "email_address"  || t.includes("email"))       return "email";
  if (t === "phone_number"   || t.includes("phone"))       return "phone";
  if (t === "ip_address"     || t === "ip")                return "ip";
  if (t === "person"         || t === "per")               return "name";
  if (t === "credit_card"    || t.includes("credit_card")) return "creditcard";
  if (t.includes("aadhaar")  || t === "in_aadhaar")        return "aadhaar";
  if (t === "in_pan"         || t === "pan")               return "pan";
  if (t.includes("passport"))                              return "passport";
  if (t === "us_ssn"         || t === "ssn")               return "ssn";
  if (t === "us_bank_number" || t.includes("bank_number")
                             || t.includes("account"))     return "account";
  if (t.includes("driver_license") || t.includes("nhs"))  return "national_id";
  if (t === "location"       || t === "gpe")               return "city";
  if (t.includes("date_time") || t.includes("date"))       return "date";
  if (t.includes("nrp")      || t.includes("nationality")) return "name";
  if (t === "url"            || t.includes("url"))         return "url_skip";
  return t;
};

// ── Guards ────────────────────────────────────────────────────────────────────
const LOG_TS_RE = /^\[?\d{4}[-/]\d{2}[-/]\d{2}[\sT]\d{2}:\d{2}:\d{2}/;
const isLogTimestamp = (text, start) =>
  LOG_TS_RE.test(text.slice(Math.max(0, start - 1), start + 26));

const LABEL_RE = /[A-Za-z][A-Za-z0-9 _.\-]*[ \t]*[=:][ \t]*$/;
const trimLabel = (origText, start, end) => {
  const before = origText.slice(0, start);
  if (!LABEL_RE.test(before)) return { start, end };
  const lastEq    = before.lastIndexOf("=");
  const lastColon = before.lastIndexOf(":");
  const sep       = Math.max(lastEq, lastColon);
  if (sep < 0) return { start, end };
  let s = sep + 1;
  while (s < origText.length && (origText[s] === " " || origText[s] === "\t")) s++;
  if (s >= end) return null;
  return { start: s, end };
};

const CONTAINER_TYPES = new Set(["email", "creditcard", "phone", "address"]);
const removeContainedSpans = (entities) => {
  const norm       = entities.map(e => ({ ...e, _type: normaliseType(e.entity_type) }));
  const containers = norm.filter(e => CONTAINER_TYPES.has(e._type));
  return norm.filter(e => {
    if (CONTAINER_TYPES.has(e._type)) return true;
    return !containers.some(c => c.start <= e.start && c.end >= e.end && c !== e);
  });
};

const resolveValueSpan = (text, entity) => {
  const type = normaliseType(entity.entity_type);
  if (type !== "cvv_line" && type !== "expiry_line") return entity;
  const pattern = type === "cvv_line"
    ? /(?:CVV|CVC|CVN|CSC)[=:\s]+(\d{3,4})/i
    : /(?:Expiry|Expiration|Exp|Valid(?:[ \t]+Thru)?)[=:\s]+(\d{1,2}\/\d{2,4})/i;
  const slice = text.slice(entity.start, entity.end);
  const m     = pattern.exec(slice);
  if (!m) return entity;
  const valueStart = entity.start + m.index + (m[0].length - m[1].length);
  return { ...entity, start: valueStart, end: valueStart + m[1].length };
};

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION I — KEY=VALUE PRE-PROCESSOR  (unchanged from v8.0, uses unified map)
// ═══════════════════════════════════════════════════════════════════════════════
/**
 * Runs on every line BEFORE Presidio.
 *
 * Supports multi-word keys (FIX-8). Lines like:
 *   "IP Address: 192.168.1.45"
 *   "Account Number: 12345678901239"
 *   "Card Number: 4111 1111 1111 1111"
 *   "Card Holder Name: Riya Sharma"
 *   "IFSC Code: SBIN0001234"
 * are parsed and masked here, bypassing Presidio entirely.
 *
 * Returns the masked line string, or null if the key is not in KEY_TYPE_MAP.
 */
export const applyKeyValueMasking = (line, level = "medium") => {
  const kv = parseKVLine(line);
  if (!kv) return null;

  const normKey    = normalizeKey(kv.key);
  const forcedType = KEY_TYPE_MAP[normKey];
  if (!forcedType) return null;

  const { rawValue, valueStart, valueEnd } = kv;
  if (!rawValue) return line;

  const masked = maskValue(rawValue, forcedType, level);
  return line.slice(0, valueStart) + masked + line.slice(valueEnd);
};

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION J — PRESIDIO PIPELINE EXPORTS  (unchanged from v8.0)
// ═══════════════════════════════════════════════════════════════════════════════
export const mapPresidioToPII = (_text, entities) => {
  const pii = {};
  entities.forEach((e, i) => {
    const type = normaliseType(e.entity_type);
    if (["url_skip"].includes(type)) return;
    pii[`presidio_field_${i}`] = type === "cvv_line"          ? "cvv"
                                : type === "expiry_line"       ? "expiry"
                                : type === "otp_sensitive"     ? "otp"
                                : type === "session_sensitive" ? "session"
                                : type;
  });
  return pii;
};

export const applyFallbackDetection = (text) => {
  const extras = [];
  for (const { re, type, priority } of REGEX_FALLBACKS) {
    const g = new RegExp(re.source, (re.flags || "").includes("g") ? re.flags : (re.flags || "") + "g");
    let m;
    while ((m = g.exec(text)) !== null) {
      if (isNonPIIToken(text, m.index, m[0])) continue;
      extras.push({ start: m.index, end: m.index + m[0].length, entity_type: type, score: 1.0, priority });
    }
  }
  return extras;
};

export const mergeEntities = (presidioEntities, fallbackEntities) => {
  const all = [
    ...presidioEntities.map(e => ({ ...e, priority: e.priority ?? 0 })),
    ...fallbackEntities,
  ].sort((a, b) => a.start !== b.start ? a.start - b.start : b.priority - a.priority);

  const merged = [];
  let cursor = 0;
  for (const e of all) {
    if (e.start >= cursor) {
      merged.push(e);
      cursor = e.end;
    } else if (e.end > cursor && (e.priority ?? 0) > (merged[merged.length - 1]?.priority ?? 0)) {
      merged[merged.length - 1] = e;
      cursor = e.end;
    }
  }
  return merged;
};

export const maskTextWithSpans = (text, entities, level = "medium") => {
  if (!entities || entities.length === 0) return text;

  const deduped  = removeContainedSpans(entities);
  const resolved = deduped.map(e => resolveValueSpan(text, e));
  const sorted   = [...resolved].sort((a, b) => b.start - a.start);

  let result = text;
  for (const entity of sorted) {
    const type = normaliseType(entity.entity_type);

    if (["url_skip"].includes(type)) continue;
    if (isLogTimestamp(text, entity.start)) continue;
    if (entity.end - entity.start < 1) continue;

    const rawSpan = text.slice(entity.start, entity.end).trim();
    if (LABEL_WORDS.has(rawSpan.toLowerCase()) || isLabelPhrase(rawSpan)) continue;
    if (isNonPIIToken(text, entity.start, rawSpan)) continue;

    if (type === "creditcard" && rawSpan.replace(/\D/g, "").length < 13) {
      result = result.slice(0, entity.start) + "****" + result.slice(entity.end);
      continue;
    }

    const trimmed = trimLabel(text, entity.start, entity.end);
    if (!trimmed) continue;

    const { start: s, end: e } = trimmed;
    const original = text.slice(s, e);
    if (!original.trim()) continue;
    if (LABEL_WORDS.has(original.trim().toLowerCase()) || isLabelPhrase(original.trim())) continue;
    if (isNonPIIToken(text, s, original.trim())) continue;

    const replacement = maskValue(original, type, level);
    result = result.slice(0, s) + replacement + result.slice(e);
  }

  return result;
};