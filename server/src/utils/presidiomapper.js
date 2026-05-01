/**
 * presidioMapper.js — v6.1
 *
 * Changes vs v6.0:
 *
 *   FIX-CC-PARTIAL  Presidio sometimes emits a CC span covering only the last
 *                   digit group (e.g. "1111"). The v6.0 guard skipped those
 *                   spans entirely, leaving the raw digits unmasked → output
 *                   was "[REDACTED] 1111". Fix: instead of `continue`, replace
 *                   short CC spans with "****" in-place so nothing leaks.
 *
 *   FIX-LABEL-PHRASE  LABEL_WORDS matched single words only. Multi-word labels
 *                   like "Card Number" (Presidio fires PERSON on whole phrase)
 *                   were not caught. Fix: isLabelPhrase() checks that every
 *                   space-separated token in the span is a known label word.
 *
 * All other fixes from v6.0 are retained unchanged.
 */

// ─── Label words that Presidio mis-fires PERSON on ───────────────────────────
// If the entire span text matches one of these (case-insensitive), it's a field
// label — never PII. Skip it unconditionally.
const LABEL_WORDS = new Set([
  "email","name","user","phone","mobile","address","pincode","aadhaar","pan",
  "account","card","cvv","expiry","expiration","location","city","ip","gender",
  "dob","birth","company","customer","client","ref","id","number","amount",
  "reason","status","session","cache","order","transaction","retrying",
]);

/**
 * Returns true when every whitespace-separated token in the span is a known
 * label word. Catches multi-word phrases like "Card Number", "Account Number",
 * "Customer Id", etc. that Presidio mis-tags as PERSON.
 */
const isLabelPhrase = (spanText) =>
  spanText.trim().split(/\s+/).every(w => LABEL_WORDS.has(w.toLowerCase().replace(/[^a-z]/g, "")));

// ─── Non-PII system-reference guard ──────────────────────────────────────────
// Checks the span value AND the surrounding context window.
const NON_PII_PREFIX_RE    = /^(TXN|ORD|REF|INV|SESS|TRANS|TID|RID|USR|CUST|REQID|MSGID|BATCHID)[_\-]/i;
const NON_PII_CONTEXT_RE   = /(TXN|ORD|REF|INV|SESS|TRANS|TID|RID|USR|CUST|REQID|MSGID|BATCHID)[_\-]\S*$/i;

const isNonPIIToken = (text, spanStart, spanValue) => {
  if (NON_PII_PREFIX_RE.test(spanValue)) return true;
  // Check if the digit string is part of a non-PII token in context
  const contextBefore = text.slice(Math.max(0, spanStart - 12), spanStart);
  if (NON_PII_CONTEXT_RE.test(contextBefore + spanValue)) return true;
  return false;
};

// ─── Regex fallbacks (priority=10) ───────────────────────────────────────────
const REGEX_FALLBACKS = [
  // Aadhaar: 4-4-4 digit groups with mandatory space or dash separators
  { re: /\b\d{4}[\s\-]\d{4}[\s\-]\d{4}\b/,               type: "aadhaar",     priority: 10 },
  // Indian PAN
  { re: /\b[A-Z]{5}[0-9]{4}[A-Z]\b/,                      type: "pan",         priority: 10 },
  // Indian 6-digit pincode (not embedded in longer number)
  { re: /(?<!\d)[1-9]\d{5}(?!\d)/,                         type: "pincode",     priority: 10 },
  // Credit card: all 4 groups of 4 digits with mandatory separator
  { re: /\b\d{4}[\s\-]\d{4}[\s\-]\d{4}[\s\-]\d{4}\b/,    type: "creditcard",  priority: 10 },
  // IFSC
  { re: /\b[A-Z]{4}0[A-Z0-9]{6}\b/,                       type: "ifsc",        priority: 10 },
  // Street address
  { re: /\d+[A-Z]?\s+[\w\s]{2,40}(?:Street|St|Road|Rd|Avenue|Ave|Lane|Ln|Nagar|Colony|Marg|Chowk|Block|Sector|Phase|Layout|Enclave|Vihar|Bagh|Puram|Ganj|Bazaar|Way|Drive|Dr|Court|Ct|Place|Pl|Close|Crescent|Row|Gardens?|Park|Square|Hills?|View|Heights?|Towers?|Apartments?|Flats?|Residency|Complex|Compound)\b/i,
                                                            type: "address",     priority: 10 },
  // CVV value — capture group 1 is the digit
  { re: /(?:CVV|CVC|CVN|CSC)[:\s]+(\d{3,4})/i,            type: "cvv_line",    priority: 10 },
  // Expiry value
  { re: /(?:Expiry|Expiration|Exp|Valid(?:\s+Thru)?)[:\s]+(\d{1,2}\/\d{2,4})/i, type: "expiry_line", priority: 10 },
];

// ─── Type normaliser ──────────────────────────────────────────────────────────
export const normaliseType = (entity_type = "") => {
  const KNOWN = ["aadhaar","pan","pincode","ifsc","creditcard","account","phone",
                 "email","ip","name","city","date","national_id","ssn","passport",
                 "address","cvv","expiry","cvv_line","expiry_line"];
  if (KNOWN.includes(entity_type)) return entity_type;

  const t = entity_type.toLowerCase();
  if (t === "email_address"  || t.includes("email"))        return "email";
  if (t === "phone_number"   || t.includes("phone"))        return "phone";
  if (t === "ip_address"     || t === "ip")                 return "ip";
  if (t === "person"         || t === "per")                return "name";
  if (t === "credit_card"    || t.includes("credit_card"))  return "creditcard";
  if (t.includes("aadhaar")  || t === "in_aadhaar")         return "aadhaar";
  if (t === "in_pan"         || t === "pan")                return "pan";
  if (t.includes("passport"))                               return "passport";
  if (t === "us_ssn"         || t === "ssn")                return "ssn";
  if (t === "us_bank_number" || t.includes("bank_number")
                             || t.includes("account"))      return "account";
  if (t.includes("driver_license") || t.includes("nhs"))   return "national_id";
  if (t === "location"       || t === "gpe")                return "city";
  if (t === "date_time"      || t.includes("date_time"))    return "datetime_skip";
  if (t.includes("date"))                                   return "date";
  if (t.includes("nrp")      || t.includes("nationality"))  return "name";
  if (t === "url"            || t.includes("url"))          return "url_skip";
  return t;
};

// ─── Per-type masking ─────────────────────────────────────────────────────────
export const maskValue = (str, type, level = "medium") => {
  if (str == null || str === "") return str;
  const s = String(str).trim();
  if (!s) return str;

  if (level === "high") return "[REDACTED]";
  if (level === "low") {
    const vis = Math.max(1, Math.min(3, Math.floor(s.length / 4)));
    return s.slice(0, vis) + "*".repeat(Math.max(1, s.length - vis));
  }

  switch (type) {
    case "email": {
      const at = s.indexOf("@");
      if (at < 1) return "[REDACTED]";
      const local = s.slice(0, at), domain = s.slice(at + 1);
      if (local.length <= 2) return `${local}@${domain}`;
      return `${local.slice(0, 2)}${"*".repeat(local.length - 2)}@${domain}`;
    }
    case "phone": {
      const d = s.replace(/\D/g, "");
      if (d.length < 6) return "[MASKED]";
      const core = d.length > 10 ? d.slice(-10) : d;
      return `${core.slice(0, 2)}XXXX${core.slice(-4)}`;
    }
    case "ip": {
      const parts = s.split(".");
      if (parts.length === 4) return `${parts[0]}.${parts[1]}.XXX.XXX`;
      return "[MASKED]";
    }
    case "name": {
      const h = s.split("").reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) & 0xffff, 0);
      return `User_${(h % 9000) + 1000}`;
    }
    case "creditcard": {
      const d = s.replace(/\D/g, "");
      // Need at least 13 digits to reliably extract last4
      if (d.length < 13) return "****-****-****-****";
      return `****-****-****-${d.slice(-4)}`;
    }
    case "aadhaar":
    case "pan":
    case "passport":
    case "ssn":
    case "national_id":
    case "cvv":
    case "cvv_line":
      return "[REDACTED]";
    case "address":
      return "[ADDRESS REDACTED]";
    case "account": {
      const d = s.replace(/\D/g, "");
      if (d.length < 4) return "****";
      return `****${d.slice(-4)}`;
    }
    case "date": {
      const m = s.match(/\b(19|20)\d{2}\b/);
      return m ? m[0] : "[REDACTED]";
    }
    case "expiry":
    case "expiry_line": {
      const m = s.match(/^(\d{1,2})([\/-])(\d{2,4})$/);
      if (m) return `XX${m[2]}${m[3]}`;
      return "[REDACTED]";
    }
    case "pincode": {
      const d = s.replace(/\D/g, "");
      return d.length >= 2 ? `${d.slice(0, 2)}XXXX` : "XXXXXX";
    }
    case "ifsc":
      return s.length >= 4 ? `${s.slice(0, 4)}XXXXXXX` : "[MASKED]";
    case "city":
    case "datetime_skip":
    case "url_skip":
      return s;
    default:
      return "[MASKED]";
  }
};

// ─── Guards ───────────────────────────────────────────────────────────────────
const LOG_TS_RE = /^\[?\d{4}[-/]\d{2}[-/]\d{2}[\sT]\d{2}:\d{2}:\d{2}/;
const isLogTimestamp = (text, start) =>
  LOG_TS_RE.test(text.slice(Math.max(0, start - 1), start + 26));

const LABEL_RE = /[A-Za-z][A-Za-z0-9 _]*:\s*$/;
const trimLabel = (origText, start, end) => {
  const before = origText.slice(0, start);
  if (!LABEL_RE.test(before)) return { start, end };
  const colon = before.lastIndexOf(":");
  if (colon < 0) return { start, end };
  let s = colon + 1;
  while (s < origText.length && origText[s] === " ") s++;
  if (s >= end) return null;
  return { start: s, end };
};

// Contained-span elimination
const CONTAINER_TYPES = new Set(["email", "creditcard", "phone", "address"]);
const removeContainedSpans = (entities) => {
  const norm = entities.map(e => ({ ...e, _type: normaliseType(e.entity_type) }));
  const containers = norm.filter(e => CONTAINER_TYPES.has(e._type));
  return norm.filter(e => {
    if (CONTAINER_TYPES.has(e._type)) return true;
    return !containers.some(c => c.start <= e.start && c.end >= e.end && c !== e);
  });
};

// CVV/expiry line: resolve to value sub-span only
const resolveValueSpan = (text, entity) => {
  const type = normaliseType(entity.entity_type);
  if (type !== "cvv_line" && type !== "expiry_line") return entity;
  const pattern = type === "cvv_line"
    ? /(?:CVV|CVC|CVN|CSC)[:\s]+(\d{3,4})/i
    : /(?:Expiry|Expiration|Exp|Valid(?:\s+Thru)?)[:\s]+(\d{1,2}\/\d{2,4})/i;
  const slice = text.slice(entity.start, entity.end);
  const m = pattern.exec(slice);
  if (!m) return entity;
  const valueStart = entity.start + m.index + (m[0].length - m[1].length);
  return { ...entity, start: valueStart, end: valueStart + m[1].length };
};

// ─── Exports ──────────────────────────────────────────────────────────────────

export const mapPresidioToPII = (_text, entities) => {
  const pii = {};
  entities.forEach((e, i) => {
    const type = normaliseType(e.entity_type);
    if (["datetime_skip","city","url_skip"].includes(type)) return;
    pii[`presidio_field_${i}`] = type === "cvv_line" ? "cvv"
                                : type === "expiry_line" ? "expiry"
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

    // Skip non-masking types
    if (["datetime_skip","city","url_skip"].includes(type)) continue;
    if (isLogTimestamp(text, entity.start)) continue;
    if (entity.end - entity.start < 1) continue;

    // FIX-LABEL-PHRASE + FIX-EMAIL: skip single label words AND multi-word
    // label phrases (e.g. "Card Number", "Account Number") that Presidio
    // mis-tags as PERSON.
    const rawSpan = text.slice(entity.start, entity.end).trim();
    if (LABEL_WORDS.has(rawSpan.toLowerCase()) || isLabelPhrase(rawSpan)) continue;

    // FIX-TXN: check non-PII token against context window
    if (isNonPIIToken(text, entity.start, rawSpan)) continue;

    // FIX-CC-PARTIAL: Presidio sometimes emits a CC span covering only a
    // partial digit group (e.g. just "1111"). The old code used `continue`
    // which left the raw digits unmasked. Instead, replace the short span
    // with "****" so nothing leaks, then move on.
    if (type === "creditcard" && rawSpan.replace(/\D/g, "").length < 13) {
      result = result.slice(0, entity.start) + "****" + result.slice(entity.end);
      continue;
    }

    // Trim label prefix using original text
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