import fs from "fs";
import path from "path";
import csv from "csv-parser";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const XLSX = require("xlsx");

const MAX_FILE_SIZE_MB = 50;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

// ─── File type detection ───────────────────────────────────────────────────
export const getFileType = (fileName) => {
    if (!fileName || typeof fileName !== "string") return "unknown";
    const ext = path.extname(fileName).replace(".", "").toLowerCase();
    const SUPPORTED = ["json", "csv", "txt", "log", "xlsx"];
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
 *      The `content` field is the RAW line — no stripping of labels,
 *      no pre-processing — so the masking engine sees the full text and
 *      can use character offsets correctly.
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
        if (!trimmed) continue; // skip blank/separator lines
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
        default:
            throw new Error(
                `Unsupported file type: "${path.extname(fileName)}". ` +
                `Supported formats: json, csv, txt, log, xlsx`
            );
    }
};