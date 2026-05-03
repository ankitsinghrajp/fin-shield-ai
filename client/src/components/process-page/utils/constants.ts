// ─── Supported extensions (source of truth) ──────────────────────────────────

export const SUPPORTED_EXTENSIONS = [".csv", ".json", ".xlsx", ".txt", ".docx", ".log"] as const;
export type SupportedExt = typeof SUPPORTED_EXTENSIONS[number];

// ─── File type metadata ───────────────────────────────────────────────────────

export const FILE_TYPE_META: Record<SupportedExt, { label: string; icon: string; color: string; desc: string }> = {
  ".csv":  { label: "CSV",  icon: "📊", color: "#10b981", desc: "Comma-separated values" },
  ".json": { label: "JSON", icon: "🔧", color: "#8b5cf6", desc: "Structured JSON data" },
  ".xlsx": { label: "XLSX", icon: "📗", color: "#22c55e", desc: "Excel spreadsheet" },
  ".txt":  { label: "TXT",  icon: "📄", color: "#60a5fa", desc: "Plain text / log file" },
  ".docx": { label: "DOCX", icon: "📝", color: "#f97316", desc: "Word document" },
  ".log":  { label: "LOG",  icon: "📄", color: "#60a5fa", desc: "Log File" },
};

// ─── Masking config ───────────────────────────────────────────────────────────

export const MASKING_INFO: Record<"low" | "medium" | "high", { label: string; desc: string; color: string }> = {
  low:    { label: "Low",    desc: "Minimal masking, most fields retained",          color: "text-emerald-400 border-emerald-400/30 bg-emerald-400/10" },
  medium: { label: "Medium", desc: "Balanced — partial masking on sensitive fields", color: "text-amber-400 border-amber-400/30 bg-amber-400/10" },
  high:   { label: "High",   desc: "Maximum privacy — heavy redaction",              color: "text-red-400 border-red-400/30 bg-red-400/10" },
};

export const RISK_COLORS: Record<string, string> = {
  low:    "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
  medium: "text-amber-400   bg-amber-400/10   border-amber-400/30",
  high:   "text-red-400     bg-red-400/10     border-red-400/30",
};

export const DONUT_COLORS = ["#f97316", "#facc15", "#fb7185", "#60a5fa"];