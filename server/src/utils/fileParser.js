import fs from "fs";
import path from "path";
import csv from "csv-parser";
import mammoth from "mammoth";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");

const MAX_FILE_SIZE_MB = 50;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

// ─── File type detection ───────────────────────────────────────────────────

export const getFileType = (fileName) => {
    if (!fileName || typeof fileName !== "string") return "unknown";
    const ext = path.extname(fileName).replace(".", "").toLowerCase();
    const SUPPORTED = ["json", "csv", "txt", "pdf", "docx", "xlsx"];
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

// ─── Parsers ──────────────────────────────────────────────────────────────

const parseJSON = (filePath) => {
    const raw = fs.readFileSync(filePath, "utf-8").trim();
    if (!raw) throw new Error("JSON file is empty.");

    let parsed;
    try {
        parsed = JSON.parse(raw);
    } catch (e) {
        throw new Error(`Invalid JSON: ${e.message}`);
    }

    // Normalise: always return array of objects
    if (Array.isArray(parsed)) {
        if (parsed.length === 0) throw new Error("JSON array is empty.");
        return parsed;
    }

    if (parsed && typeof parsed === "object") {
        // Single object → wrap in array
        return [parsed];
    }

    // Primitive (string, number) → wrap in content object
    return [{ content: parsed }];
};

const parseCSV = (filePath) => {
    return new Promise((resolve, reject) => {
        const results = [];
        let rowCount = 0;

        fs.createReadStream(filePath, { encoding: "utf-8" })
            .pipe(csv({
                mapHeaders: ({ header }) => header.trim(), // strip whitespace from headers
                skipEmptyLines: true,
            }))
            .on("data", (row) => {
                // Strip whitespace from values, skip entirely empty rows
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

const parseTXT = (filePath) => {
    const text = fs.readFileSync(filePath, "utf-8").trim();
    if (!text) throw new Error("TXT file is empty.");

    // If it looks like JSON, parse it
    if (text.startsWith("{") || text.startsWith("[")) {
        try { return parseJSON(filePath); } catch (_) { /* fall through */ }
    }

    // Split into lines, each line becomes a record
    const lines = text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);

    return lines.map((line, idx) => ({ line: idx + 1, content: line }));
};

const parsePDF = async (filePath) => {
    let buffer;
    try {
        buffer = fs.readFileSync(filePath);
    } catch (e) {
        throw new Error(`Could not read PDF file: ${e.message}`);
    }

    let data;
    try {
        data = await pdfParse(buffer);
    } catch (e) {
        throw new Error(`PDF parse error: ${e.message}`);
    }

    const text = data.text?.trim();
    if (!text) throw new Error("PDF contains no extractable text.");

    // Split into paragraphs for better PII detection granularity
    const paragraphs = text
        .split(/\n{2,}/)
        .map((p) => p.replace(/\s+/g, " ").trim())
        .filter(Boolean);

    return paragraphs.map((p, idx) => ({ page: idx + 1, content: p }));
};

const parseDOCX = async (filePath) => {
    let result;
    try {
        result = await mammoth.extractRawText({ path: filePath });
    } catch (e) {
        throw new Error(`DOCX parse error: ${e.message}`);
    }

    const text = result.value?.trim();
    if (!text) throw new Error("DOCX contains no extractable text.");

    const paragraphs = text
        .split(/\n{2,}/)
        .map((p) => p.replace(/\s+/g, " ").trim())
        .filter(Boolean);

    return paragraphs.map((p, idx) => ({ paragraph: idx + 1, content: p }));
};

const parseXLSX = async (filePath) => {
    // Dynamically import xlsx so it's optional if not installed
    let xlsx;
    try {
        xlsx = await import("xlsx");
    } catch {
        throw new Error("xlsx package not installed. Run: npm install xlsx");
    }

    const workbook = xlsx.readFile(filePath);
    const allSheets = [];

    for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const rows = xlsx.utils.sheet_to_json(sheet, { defval: "" });
        rows.forEach((row) => {
            allSheets.push({ _sheet: sheetName, ...row });
        });
    }

    if (allSheets.length === 0) throw new Error("XLSX file contains no data.");
    return allSheets;
};

// ─── Main ─────────────────────────────────────────────────────────────────

export const parseFile = async (filePath, fileName) => {
    // Guard: file must exist and be readable
    if (!fs.existsSync(filePath)) {
        throw new Error(`File not found at path: ${filePath}`);
    }

    checkFileSize(filePath);

    const type = getFileType(fileName);

    switch (type) {
        case "json":  return parseJSON(filePath);
        case "csv":   return await parseCSV(filePath);
        case "txt":   return parseTXT(filePath);
        case "pdf":   return await parsePDF(filePath);
        case "docx":  return await parseDOCX(filePath);
        case "xlsx":  return await parseXLSX(filePath);
        default:
            throw new Error(
                `Unsupported file type: "${path.extname(fileName)}". ` +
                `Supported: json, csv, txt, pdf, docx, xlsx`
            );
    }
};