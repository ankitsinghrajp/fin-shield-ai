#!/usr/bin/env node
/**
 * FinShield PII Masker — standalone v2.1
 * ─────────────────────────────────────────────────────────────────────────────
 * USAGE
 *   node finshield_pii_masker.js <input.(txt|docx)> [output.txt] [--level low|medium|high]
 *
 *   Examples:
 *     node finshield_pii_masker.js finshield_test.docx masked_output.txt
 *     node finshield_pii_masker.js data.txt result.txt --level high
 *     node finshield_pii_masker.js input.txt            # prints to stdout
 *
 *   Default masking level: medium.
 *
 * REQUIRES  Node.js v14+   No npm packages for .txt input.
 *           For .docx input: npm install mammoth  (one-time)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CHANGES vs v2.0
 *
 *   INTEGRATION (v2.1)
 *     All shared logic (KEY_TYPE_MAP, normalizeKey, KV_LINE_RE, parseKVLine,
 *     all per-type masking helpers, maskValue, maskLine, maskDocument,
 *     normalizeSquishedText, KNOWN_FIELD_LABELS) has been MOVED to
 *     presidioMapper.js (v8.1) and is imported from there.
 *
 *     This file is now a thin CLI wrapper — it reads the file, calls
 *     normalizeSquishedText() + maskDocument() from presidioMapper, and
 *     writes / prints the result.  No masking logic lives here anymore.
 *
 *     Benefit: piiEngine.js (unstructured path) and this standalone CLI share
 *     exactly the same masking rules. A fix in presidioMapper is automatically
 *     reflected in both.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * MASKING RULES — medium level (default)
 *
 *   Field type       Example input              → Example output
 *   ───────────────  ─────────────────────────  ─────────────────────────
 *   email            ankit.singh@example.com    → an*********@example.com
 *   phone            +91-9876543210             → 98XXXX3210
 *   name             Ankit Singh                → User_4162
 *   credit card      4111 1111 1111 1111        → ****-****-****-1111
 *   account number   12345678901239             → ****1239
 *   IFSC code        SBIN0001234                → SBINXXXXXXX
 *   IP address       192.168.1.45               → 192.168.XXX.XXX
 *   pincode          400001                     → 40XXXX
 *   expiry           12/28                      → XX/28
 *   aadhaar          1234 5678 9123             → [REDACTED]
 *   PAN              ABCDE1234F                 → [REDACTED]
 *   CVV              123                        → [REDACTED]
 *   OTP / passcode   482910                     → [REDACTED]
 *   session token    9f8d7c6b5a                 → [REDACTED]
 *   address          221B Baker Street, London  → [ADDRESS REDACTED]
 *   DOB              15/08/1990                 → 1990
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

"use strict";
const fs   = require("fs");
const path = require("path");

// ── Import shared masking logic from presidioMapper (ES module) ──────────────
// Node.js <22 requires dynamic import() to load ES modules from CJS.
// We wrap everything in an async main() which is already the pattern used here.

// ═══════════════════════════════════════════════════════════════════════════════
// DOCX READER  (requires: npm install mammoth)
// ═══════════════════════════════════════════════════════════════════════════════
async function readDocx(filePath) {
  let mammoth;
  const candidates = [
    "mammoth",
    path.join(path.dirname(filePath), "node_modules", "mammoth"),
    path.join(process.cwd(), "node_modules", "mammoth"),
    path.join(__dirname, "node_modules", "mammoth"),
  ];
  for (const p of candidates) {
    try { mammoth = require(p); break; } catch { /* try next */ }
  }
  if (!mammoth) {
    console.error(
      "\n❌  mammoth is required to read .docx files.\n" +
      "    Install it once with:  npm install mammoth\n" +
      "    Then re-run this script.\n"
    );
    process.exit(1);
  }
  const result = await mammoth.extractRawText({ path: filePath });
  return result.value;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CLI ENTRY POINT
// ═══════════════════════════════════════════════════════════════════════════════
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    console.log([
      "",
      "  FinShield PII Masker v2.1",
      "",
      "  Usage:",
      "    node finshield_pii_masker.js <input.(txt|docx)> [output.txt] [--level low|medium|high]",
      "",
      "  Examples:",
      "    node finshield_pii_masker.js finshield_test.docx masked.txt",
      "    node finshield_pii_masker.js data.txt result.txt --level high",
      "    node finshield_pii_masker.js input.txt            # prints to stdout",
      "",
      "  Levels:  low = minimal  |  medium = balanced (default)  |  high = full redaction",
      "",
    ].join("\n"));
    process.exit(0);
  }

  // ── Parse arguments ──────────────────────────────────────────────────────
  let inputFile  = null;
  let outputFile = null;
  let level      = "medium";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--level" && args[i + 1]) {
      level = args[++i].toLowerCase();
    } else if (!inputFile) {
      inputFile = args[i];
    } else if (!outputFile) {
      outputFile = args[i];
    }
  }

  if (!["low", "medium", "high"].includes(level)) {
    console.error(`❌  Invalid level "${level}". Use: low | medium | high`);
    process.exit(1);
  }
  if (!inputFile) {
    console.error("❌  No input file specified.");
    process.exit(1);
  }
  if (!fs.existsSync(inputFile)) {
    console.error(`❌  File not found: ${inputFile}`);
    process.exit(1);
  }

  // ── Load shared masking logic from presidioMapper (ES module) ────────────
  // Dynamic import works in Node 12+ for ES modules.
  const {
    normalizeSquishedText,
    maskDocument,
    // Individual helpers re-exported in case callers need them directly
    maskLine,
    maskValue,
    maskEmail,
    maskPhone,
    maskName,
    maskCreditCard,
    maskAccount,
    maskIFSC,
    maskIP,
    maskPincode,
    maskExpiry,
    maskDate,
    normalizeKey,
    parseKVLine,
    KEY_TYPE_MAP,
    KNOWN_FIELD_LABELS,
  } = await import("./presidioMapper.js");

  // ── Read input ────────────────────────────────────────────────────────────
  let rawText;
  const ext = path.extname(inputFile).toLowerCase();

  if (ext === ".docx") {
    process.stderr.write(`📄  Reading docx: ${inputFile}\n`);
    rawText = await readDocx(inputFile);
    // Normalize squished paragraphs into proper lines (INTEGRATION-DOCX)
    rawText = normalizeSquishedText(rawText);
  } else {
    rawText = fs.readFileSync(inputFile, "utf8");
  }

  // ── Mask ──────────────────────────────────────────────────────────────────
  const masked = maskDocument(rawText, level);

  // ── Write or print ────────────────────────────────────────────────────────
  if (outputFile) {
    fs.writeFileSync(outputFile, masked, "utf8");
    process.stderr.write(`✅  Masked output written to: ${outputFile}  (level=${level})\n`);
  } else {
    process.stdout.write(masked + "\n");
  }
}

main().catch(err => { console.error("❌ Fatal:", err.message); process.exit(1); });