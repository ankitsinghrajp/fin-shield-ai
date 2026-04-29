import { asyncHandler } from "../utils/asyncHandler.js";
import { APIResponse }  from "../utils/APIResponse.js";
import { APIError }     from "../utils/APIError.js";
import { parseFile }    from "../utils/fileParser.js";
import { detectAndMaskPII } from "../utils/piiEngine.js";
import { PipelineRun }  from "../models/pipelineRun.model.js";
import jwt from "jsonwebtoken";
import { User } from "../models/user.model.js";
import fs from "fs";

const VALID_MASKING_LEVELS = ["low", "medium", "high"];

// ─── Helper: safe unlink ────────────────────────────────────────────────
const safeUnlink = (filePath) => {
    try {
        if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch (err) {
        console.warn(`[pipeline] Failed to delete temp file: ${filePath}`, err.message);
    }
};

// ─── Optional user attachment (does NOT reject if no token) ─────────────
const attachUserIfLoggedIn = async (req) => {
  const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "");

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
      const user = await User.findById(decoded._id).select("-password -refreshToken");
      if (user) req.user = user;
    } catch (err) {
      // Token invalid/expired – just ignore and proceed anonymously
    }
  }
};

// ─── Main pipeline handler ──────────────────────────────────────────────
const processPipeline = asyncHandler(async (req, res) => {
    // ═══════════════════════════════════════════════════════════════════
    // 1. Optional user detection (NO reject on missing token)
    // ═══════════════════════════════════════════════════════════════════
    await attachUserIfLoggedIn(req);

    const file = req.file;

    // ── 2. Validate file ─────────────────────────────────────────────────
    if (!file) {
        throw new APIError(400, "No file uploaded. Please attach a file with field name 'file'.");
    }

    // ── 3. Validate masking level ─────────────────────────────────────────
    let { maskingLevel = "medium" } = req.body;
    maskingLevel = maskingLevel.trim().toLowerCase();
    if (!VALID_MASKING_LEVELS.includes(maskingLevel)) {
        safeUnlink(file.path);
        throw new APIError(
            400,
            `Invalid masking level: "${maskingLevel}". Must be one of: ${VALID_MASKING_LEVELS.join(", ")}.`
        );
    }

    // ── 4. Parse the file ────────────────────────────────────────────────
    let parsedData;
    try {
        parsedData = await parseFile(file.path, file.originalname);
    } catch (err) {
        safeUnlink(file.path);
        throw new APIError(422, `File parsing failed: ${err.message}`);
    }

    // ── 5. Run full PII pipeline ─────────────────────────────────────────
    let result, report;
    try {
        ({ result, report } = await detectAndMaskPII(parsedData, maskingLevel));
    } catch (err) {
        safeUnlink(file.path);
        throw new APIError(500, `PII processing failed: ${err.message}`);
    }

    // ── 6. Clean up temp file ────────────────────────────────────────────
    safeUnlink(file.path);

    // ═══════════════════════════════════════════════════════════════════
    // 7. Save run to DB **ONLY if a user is authenticated**
    // ═══════════════════════════════════════════════════════════════════
    if (req.user) {
        try {
            await PipelineRun.create({
                user: req.user._id,
                fileName: file.originalname,
                fileType: file.mimetype,
                fileSize: file.size,
                recordsProcessed: report.records,
                piiDetectedPercentage: parseFloat(report.piiPercent),
                fieldsMasked: report.piiFields,
                dataUtilityScore: parseFloat(report.utilityPercent),
                maskingLevel: report.maskingLevel,
                maskedData: result,            // full masked array of objects
                report: report,                // entire report object
            });
            console.log(`[pipeline] Run saved for user ${req.user._id}`);
        } catch (dbErr) {
            // Non‑fatal: log but still return the result
            console.error("[pipeline] Failed to save run to DB:", dbErr.message);
        }
    }

    // ── 8. Respond ───────────────────────────────────────────────────────
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

/**
 * GET /api/dashboard
 * Requires valid JWT (use verifyJWT middleware in route)
 * Returns aggregated statistics + paginated runs for the logged‑in user.
 */
const getDashboardData = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  // ─── Query parameters for pagination ────────────────────────────────
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  // Optional filters
  const filter = { user: userId };
  if (req.query.maskingLevel) {
    filter.maskingLevel = req.query.maskingLevel;
  }
  if (req.query.startDate || req.query.endDate) {
    filter.createdAt = {};
    if (req.query.startDate) filter.createdAt.$gte = new Date(req.query.startDate);
    if (req.query.endDate)   filter.createdAt.$lte = new Date(req.query.endDate);
  }

  // ─── Run aggregation for totals & averages ──────────────────────────
  const [stats] = await PipelineRun.aggregate([
    { $match: { user: userId } },
    {
      $group: {
        _id: null,
        totalRuns: { $sum: 1 },
        totalRecordsProcessed: { $sum: "$recordsProcessed" },
        totalFieldsMasked: { $sum: "$fieldsMasked" },
        averageUtilityScore: { $avg: "$dataUtilityScore" },
        averagePiiPercentage: { $avg: "$piiDetectedPercentage" },
        latestRun: { $max: "$createdAt" },
      },
    },
  ]);

  // ─── Fetch paginated runs (without heavy maskedData/report) ─────────
  const runs = await PipelineRun.find(filter)
    .select("-maskedData -report -__v")   // exclude heavy fields from list
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  const totalRunsCount = await PipelineRun.countDocuments(filter);

  return res.status(200).json(
    new APIResponse(200, {
      stats: {
        totalRuns: stats?.totalRuns || 0,
        totalRecordsProcessed: stats?.totalRecordsProcessed || 0,
        totalFieldsMasked: stats?.totalFieldsMasked || 0,
        averageUtilityScore: stats?.averageUtilityScore
          ? parseFloat(stats.averageUtilityScore.toFixed(2))
          : 0,
        averagePiiPercentage: stats?.averagePiiPercentage
          ? parseFloat(stats.averagePiiPercentage.toFixed(2))
          : 0,
        latestRun: stats?.latestRun || null,
      },
      runs,
      pagination: {
        page,
        limit,
        totalRuns: totalRunsCount,
        totalPages: Math.ceil(totalRunsCount / limit),
      },
    }, "Dashboard data fetched successfully")
  );
});

export { processPipeline, getDashboardData };