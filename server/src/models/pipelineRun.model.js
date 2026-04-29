import mongoose from "mongoose";

const pipelineRunSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: false,               // optional → anonymous scans allowed
  },

  fileName: String,
  fileType: String,                // renamed from "filetype" for clarity
  fileSize: Number,

  recordsProcessed: Number,
  piiDetectedPercentage: Number,   // e.g. 67.5 (from report.piiPercent)
  fieldsMasked: Number,            // total PII fields masked
  dataUtilityScore: Number,        // e.g. 84.58

  maskingLevel: {
    type: String,
    enum: ["low", "medium", "high"],
    default: "medium",
  },

  maskedData: {
    type: mongoose.Schema.Types.Mixed,   // ✅ corrected syntax
  },

  report: {
    type: mongoose.Schema.Types.Mixed,   // same for report
  },
}, {
  timestamps: true,
});

const PipelineRun = mongoose.models.PipelineRun || mongoose.model("PipelineRun", pipelineRunSchema);

export { PipelineRun };