import fs from "fs";
import path from "path";
import csv from "csv-parser";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const XLSX = require("xlsx");

// mammoth is a pure-ESM / CJS compatible package for reading .docx files.
// Install once: npm install mammoth
let mammoth;
try {
    mammoth = require("mammoth");
} catch (_) {
    mammoth = null;
}

const MAX_FILE_SIZE_MB = 50;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

// ─── File type detection ───────────────────────────────────────────────────
export const getFileType = (fileName) => {
    if (!fileName || typeof fileName !== "string") return "unknown";
    const ext = path.extname(fileName).replace(".", "").toLowerCase();
    const SUPPORTED = ["json", "csv", "txt", "log", "xlsx", "docx"];
    return SUPPORTED.includes(ext) ? ext : "unknown";
};

// ─── Guard: size check ────────────────────────────────────────────────────
const checkFileSize = (filePath) => {
    const stats = fs.statSync(filePath);
    if (stats.size === 0) throw new Error("Uploaded file is empty.");
    if (stats.size > MAX_FILE_SIZE_BYTES) {
        throw new Error(`File exceeds maximum allowed size of ${MAX_FILE_SIZE_MB}MB.`);
    }
};

// ─── JSON parser ──────────────────────────────────────────────────────────
const parseJSON = (filePath) => {
    const raw = fs.readFileSync(filePath, "utf-8").trim();
    if (!raw) throw new Error("JSON file is empty.");
    let parsed;
    try { parsed = JSON.parse(raw); }
    catch (e) { throw new Error(`Invalid JSON: ${e.message}`); }
    if (Array.isArray(parsed)) {
        if (parsed.length === 0) throw new Error("JSON array is empty.");
        return parsed;
    }
    if (parsed && typeof parsed === "object") return [parsed];
    return [{ content: String(parsed) }];
};

// ─── CSV parser ───────────────────────────────────────────────────────────
const parseCSV = (filePath) => {
    return new Promise((resolve, reject) => {
        const results = [];
        fs.createReadStream(filePath, { encoding: "utf-8" })
            .pipe(csv({ mapHeaders: ({ header }) => header.trim(), skipEmptyLines: true }))
            .on("data", (row) => {
                const cleaned = {};
                let hasValue = false;
                for (const [k, v] of Object.entries(row)) {
                    const val = typeof v === "string" ? v.trim() : v;
                    cleaned[k] = val;
                    if (val !== "" && val != null) hasValue = true;
                }
                if (hasValue) results.push(cleaned);
            })
            .on("end", () => {
                if (results.length === 0) reject(new Error("CSV file has no data rows."));
                else resolve(results);
            })
            .on("error", (err) => reject(new Error(`CSV parse error: ${err.message}`)));
    });
};

// ─── TXT / LOG parser ─────────────────────────────────────────────────────
/**
 * Converts a plain-text / log file into the {line, content} shape that
 * the PII engine's isUnstructured() check expects.
 *
 * Rules:
 *   1. If the file looks like JSON, delegate to parseJSON.
 *   2. Otherwise split on newlines, trim each line, drop blank lines.
 *   3. Every non-blank line becomes { line: N, content: "..." }.
 */
const parseTXTorLOG = (filePath) => {
    const text = fs.readFileSync(filePath, "utf-8").trim();
    if (!text) throw new Error("File is empty.");

    // Delegate JSON-embedded content
    const firstChar = text[0];
    if (firstChar === "{" || firstChar === "[") {
        try { return parseJSON(filePath); } catch (_) { /* fall through */ }
    }

    const lines = text.split(/\r?\n/);
    const records = [];
    let lineNum = 0;

    for (const raw of lines) {
        const trimmed = raw.trim();
        if (!trimmed) continue;
        lineNum++;
        records.push({ line: lineNum, content: trimmed });
    }

    if (records.length === 0) throw new Error("File contains no readable lines.");
    return records;
};

// ─── XLSX parser ──────────────────────────────────────────────────────────
const parseXLSX = (filePath) => {
    try {
        const workbook = XLSX.readFile(filePath);
        const allSheets = [];
        for (const sheetName of workbook.SheetNames) {
            const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" });
            rows.forEach(row => allSheets.push({ _sheet: sheetName, ...row }));
        }
        if (allSheets.length === 0) throw new Error("XLSX file contains no data.");
        return allSheets;
    } catch (e) {
        throw new Error(`XLSX parse error: ${e.message}`);
    }
};

// ─── DOCX parser ──────────────────────────────────────────────────────────
/**
 * Reads a .docx file and converts it to the same {line, content} shape
 * as parseTXTorLOG so the unstructured PII pipeline handles it identically.
 *
 * ROOT CAUSE FIX (v2.1):
 *   mammoth.extractRawText() can produce "squished" output where multiple
 *   KV pairs are concatenated on one line without separators, e.g.:
 *
 *     "Name: AnkitEmail: ankit@example.com"
 *     "SECTION 1] USER LOGSUserID=USR_78231"
 *
 *   Previously this was returned as ONE record with content = the whole blob.
 *   The PII engine then saw 1 record with 1 field → totalFields=1, but could
 *   detect many PII entities → piiPercent > 100% (mathematically impossible).
 *   KV masking also failed because applyKeyValueMasking() only handles one
 *   KV pair per line.
 *
 *   Fix (three steps):
 *     1. normalizeSquishedText() (from presidioMapper v8.1) inserts \n before
 *        every known field label, SECTION header, and log timestamp — turning
 *        squished blobs into properly separated lines.
 *     2. fixBrokenCamelTransitions() handles mammoth joining paragraphs without
 *        spaces (e.g. "SECTION 1]UserID=" → "SECTION 1]\nUserID=").
 *     3. Split on \n, trim, filter blanks → one {line, content} record per line.
 *
 *   Result: each KV pair gets its own record. totalFields and piiFields are
 *   now mathematically consistent (piiPercent ≤ 100% is possible).
 */

/**
 * Known field labels — must stay in sync with presidioMapper.KNOWN_FIELD_LABELS.
 * Listed longest-first so multi-word labels are matched before sub-words.
 */
const KNOWN_FIELD_LABELS_DOCX = [
    // Multi-word (longest first)
    "Card Holder Name", "Card Number", "Account Number", "IP Address", "IFSC Code",
    "Date of Birth",
    // Single-word
    "Name", "Email", "Phone", "Address", "Pincode",
    "CustomerID", "PAN", "Aadhaar", "IP",
    "Expiry", "CVV", "User", "SessionID", "Reason",
    "TransactionID", "Order_ref", "Amount", "Status", "Product",
    "DOB", "OTP", "Token", "Session",
];

const _sortedLabels = [...KNOWN_FIELD_LABELS_DOCX].sort((a, b) => b.length - a.length);
const _escRE = (s) => s.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");

// Insert \n before each known field label that doesn't already start on a new line.
const LABEL_SPLIT_RE_DOCX = new RegExp(
    "(?<!\n)(" + _sortedLabels.map(_escRE).join("|") + ")(?=\\s*[=:])",
    "g"
);

/**
 * Inline squish-normaliser (mirrors presidioMapper.normalizeSquishedText).
 * We duplicate it here so fileParser.js has no import dependency on the
 * business-logic layer — keeping the two layers properly separated.
 */
const normalizeSquishedDocxText = (text) => {
    // 1. Insert \n before known field labels that are not already line-initial.
    let out = text.replace(LABEL_SPLIT_RE_DOCX, "\n$1");
    // 2. Insert \n before SECTION headers.
    out = out.replace(/(?<!\n)(SECTION\s+\d)/gi, "\n$1");
    // 3. Insert \n before log timestamps  [YYYY-MM-DD
    out = out.replace(/(?<!\n)(\[\d{4}-\d{2}-\d{2})/g, "\n$1");
    // 4. Fix closing bracket immediately followed by an uppercase word
    //    e.g. "SECTION 1]UserID=" → "SECTION 1]\nUserID="
    out = out.replace(/(\])([A-Z][a-zA-Z0-9])/g, "$1\n$2");
    // 5. Fix camelCase transitions at paragraph joins
    //    e.g. "logsUserID" → "logs\nUserID"
    out = out.replace(/([a-z])([A-Z][a-z])/g, "$1\n$2");
    return out.trim();
};

const parseDOCX = async (filePath) => {
    if (!mammoth) {
        throw new Error(
            "DOCX support requires the 'mammoth' package. " +
            "Run: npm install mammoth"
        );
    }

    let rawText;
    try {
        const result = await mammoth.extractRawText({ path: filePath });
        rawText = result.value;
        if (result.messages?.length) {
            result.messages.forEach(m => {
                if (m.type === "warning") {
                    console.warn(`[parseDOCX] mammoth warning: ${m.message}`);
                }
            });
        }
    } catch (e) {
        throw new Error(`DOCX parse error: ${e.message}`);
    }

    if (!rawText || !rawText.trim()) {
        throw new Error("DOCX file contains no readable text.");
    }

    // ── FIX: normalise squished paragraphs before splitting ──────────────────
    const normalizedText = normalizeSquishedDocxText(rawText);

    // ── Split into individual lines → one record per line ────────────────────
    const lines = normalizedText.split(/\r?\n/);
    const records = [];
    let lineNum = 0;

    for (const raw of lines) {
        const trimmed = raw.trim();
        if (!trimmed) continue;
        lineNum++;
        records.push({ line: lineNum, content: trimmed });
    }

    console.log(`[parseDOCX] Extracted ${lineNum} lines from docx (mammoth raw → normalized → split).`);

    if (records.length === 0) {
        throw new Error("DOCX file contains no readable lines after extraction.");
    }

    return records;
};

// ─── Main dispatcher ──────────────────────────────────────────────────────
export const parseFile = async (filePath, fileName) => {
    if (!fs.existsSync(filePath)) throw new Error(`File not found: ${filePath}`);
    checkFileSize(filePath);

    const type = getFileType(fileName);
    switch (type) {
        case "json":  return parseJSON(filePath);
        case "csv":   return await parseCSV(filePath);
        case "txt":
        case "log":   return parseTXTorLOG(filePath);
        case "xlsx":  return parseXLSX(filePath);
        case "docx":  return await parseDOCX(filePath);
        default:
            throw new Error(
                `Unsupported file type: "${path.extname(fileName)}". ` +
                `Supported formats: json, csv, txt, log, xlsx, docx`
            );
    }
};