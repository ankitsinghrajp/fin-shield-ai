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
    // ❌ Removed "docx" from supported types
    const SUPPORTED = ["json", "csv", "txt", "xlsx"];
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
    try {
        parsed = JSON.parse(raw);
    } catch (e) {
        throw new Error(`Invalid JSON: ${e.message}`);
    }

    if (Array.isArray(parsed)) {
        if (parsed.length === 0) throw new Error("JSON array is empty.");
        return parsed;
    }
    if (parsed && typeof parsed === "object") return [parsed];
    return [{ content: parsed }];
};

// ─── CSV parser ───────────────────────────────────────────────────────────
const parseCSV = (filePath) => {
    return new Promise((resolve, reject) => {
        const results = [];
        let rowCount = 0;

        fs.createReadStream(filePath, { encoding: "utf-8" })
            .pipe(csv({
                mapHeaders: ({ header }) => header.trim(),
                skipEmptyLines: true,
            }))
            .on("data", (row) => {
                const cleaned = {};
                let hasValue = false;
                for (const [k, v] of Object.entries(row)) {
                    const val = typeof v === "string" ? v.trim() : v;
                    cleaned[k] = val;
                    if (val !== "" && val !== null && val !== undefined) hasValue = true;
                }
                if (hasValue) {
                    results.push(cleaned);
                    rowCount++;
                }
            })
            .on("end", () => {
                if (rowCount === 0) reject(new Error("CSV file has no data rows."));
                else resolve(results);
            })
            .on("error", (err) => reject(new Error(`CSV parse error: ${err.message}`)));
    });
};

// ─── TXT parser ───────────────────────────────────────────────────────────
const parseTXT = (filePath) => {
    const text = fs.readFileSync(filePath, "utf-8").trim();
    if (!text) throw new Error("TXT file is empty.");

    if (text.startsWith("{") || text.startsWith("[")) {
        try { return parseJSON(filePath); } catch (_) { /* fall through */ }
    }

    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    return lines.map((line, idx) => ({ line: idx + 1, content: line }));
};

// ─── XLSX parser ──────────────────────────────────────────────────────────
const parseXLSX = (filePath) => {
    try {
        const workbook = XLSX.readFile(filePath);
        const allSheets = [];
        for (const sheetName of workbook.SheetNames) {
            const sheet = workbook.Sheets[sheetName];
            const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
            rows.forEach((row) => allSheets.push({ _sheet: sheetName, ...row }));
        }
        if (allSheets.length === 0) throw new Error("XLSX file contains no data.");
        return allSheets;
    } catch (e) {
        throw new Error(`XLSX parse error: ${e.message}`);
    }
};

// ─── Main dispatcher ──────────────────────────────────────────────────────
export const parseFile = async (filePath, fileName) => {
    if (!fs.existsSync(filePath)) {
        throw new Error(`File not found at path: ${filePath}`);
    }
    checkFileSize(filePath);

    const type = getFileType(fileName);
    switch (type) {
        case "json":  return parseJSON(filePath);
        case "csv":   return await parseCSV(filePath);
        case "txt":   return parseTXT(filePath);
        case "xlsx":  return parseXLSX(filePath);
        default:
            throw new Error(
                `Unsupported file type: "${path.extname(fileName)}". ` +
                `Supported: json, csv, txt, xlsx`
            );
    }
};