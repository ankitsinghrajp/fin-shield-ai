import { asyncHandler } from "../utils/asyncHandler.js";
import { APIResponse }  from "../utils/APIResponse.js";
import { APIError }     from "../utils/APIError.js";
import { parseFile }    from "../utils/fileParser.js";
import { detectAndMaskPII } from "../utils/piiEngine.js";   // ← uses the FULL engine
import fs from "fs";

const VALID_MASKING_LEVELS = ["low", "medium", "high"];

/**
 * Safely delete the temp upload, even if pipeline fails.
 */
const safeUnlink = (filePath) => {
    try {
        if (filePath && fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    } catch (err) {
        // Non-fatal — log and move on
        console.warn(`[pipeline] Failed to delete temp file: ${filePath}`, err.message);
    }
};

const processPipeline = asyncHandler(async (req, res) => {
    const file = req.file;

    // ── 1. Validate file ─────────────────────────────────────────────────
    if (!file) {
        throw new APIError(400, "No file uploaded. Please attach a file with field name 'file'.");
    }

    // ── 2. Validate masking level ─────────────────────────────────────────
    let { maskingLevel = "medium" } = req.body;
    maskingLevel = maskingLevel.trim().toLowerCase();

    if (!VALID_MASKING_LEVELS.includes(maskingLevel)) {
        safeUnlink(file.path);
        throw new APIError(
            400,
            `Invalid masking level: "${maskingLevel}". Must be one of: ${VALID_MASKING_LEVELS.join(", ")}.`
        );
    }

    // ── 3. Parse the file ────────────────────────────────────────────────
    let parsedData;
    try {
        parsedData = await parseFile(file.path, file.originalname);
    } catch (err) {
        safeUnlink(file.path);
        throw new APIError(422, `File parsing failed: ${err.message}`);
    }

    // ── 4. Run full PII pipeline ─────────────────────────────────────────
    let result, report;
    try {
        ({ result, report } = detectAndMaskPII(parsedData, maskingLevel));
    } catch (err) {
        safeUnlink(file.path);
        throw new APIError(500, `PII processing failed: ${err.message}`);
    }

    // ── 5. Clean up temp file ────────────────────────────────────────────
    safeUnlink(file.path);

    // ── 6. Respond ───────────────────────────────────────────────────────
    return res.status(200).json(
        new APIResponse(
            200,
            {
                runId:        Date.now().toString(),
                maskingLevel,
                recordCount:  result.length,
                result,
                report,
            },
            "Data masking pipeline completed successfully"
        )
    );
});

export { processPipeline };