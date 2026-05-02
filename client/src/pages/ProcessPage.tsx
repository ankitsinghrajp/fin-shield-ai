import { useCallback, useRef, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Upload, FileText, X, Loader2, ChevronDown, ChevronUp,
  Download, Shield, Database, BarChart3, AlertTriangle,
  Search, Copy, Check, Table2, Braces, Clock, Eye, EyeOff,
  Zap, GitBranch, CheckCircle, LayoutDashboard, ArrowRight,
  Sparkles, Lock, FileType2, FileCode2, ScrollText,
} from "lucide-react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
  AreaChart, Area,
} from "recharts";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useProcessDatasetMutation } from "@/redux/api/api";
import toast from "react-hot-toast";
import { Navbar } from "@/components/Navbar";
import Footer from "@/components/Footer";

// ─── Types ────────────────────────────────────────────────────────────────────

interface RiskScore { level: string; score: number; reason: string }
interface Report {
  records: number; totalFields: number; piiFields: number;
  piiPercent: string; utilityPercent: string;
  breakdown: {
    directPII: Record<string, number>;
    sensitivePII: Record<string, number>;
    quasiIdentifiers: Record<string, number>;
  };
  maskingLevel: string; utilityNote: string;
  explanations: Record<string, string>;
  riskScore: RiskScore;
  pipeline: { steps: string[]; inputType: string; version: string; detector?: string };
}
interface PipelineData {
  runId: string; maskingLevel: string; recordCount: number;
  result: Record<string, unknown>[]; report: Report;
}

type MaskingLevel = "low" | "medium" | "high";
type ViewMode = "table" | "json" | "document";

// ─── Supported file types ─────────────────────────────────────────────────────

const SUPPORTED_EXTENSIONS = [".csv", ".json", ".xlsx", ".txt", ".docx"] as const;
type SupportedExt = typeof SUPPORTED_EXTENSIONS[number];

const FILE_TYPE_META: Record<SupportedExt, { label: string; icon: string; color: string; desc: string }> = {
  ".csv":  { label: "CSV",  icon: "📊", color: "#10b981", desc: "Comma-separated values" },
  ".json": { label: "JSON", icon: "🔧", color: "#8b5cf6", desc: "Structured JSON data" },
  ".xlsx": { label: "XLSX", icon: "📗", color: "#22c55e", desc: "Excel spreadsheet" },
  ".txt":  { label: "TXT",  icon: "📄", color: "#60a5fa", desc: "Plain text / log file" },
  ".docx": { label: "DOCX", icon: "📝", color: "#f97316", desc: "Word document" },
};

function getFileExt(f: File): SupportedExt | null {
  const ext = ("." + f.name.split(".").pop()?.toLowerCase()) as SupportedExt;
  return SUPPORTED_EXTENSIONS.includes(ext) ? ext : null;
}
function isValidFile(f: File) { return getFileExt(f) !== null; }
function getFileIcon(filename: string) {
  const ext = ("." + filename.split(".").pop()?.toLowerCase()) as SupportedExt;
  return FILE_TYPE_META[ext]?.icon ?? "📁";
}
function getFileColor(filename: string) {
  const ext = ("." + filename.split(".").pop()?.toLowerCase()) as SupportedExt;
  return FILE_TYPE_META[ext]?.color ?? "#6b7280";
}

// ─── Masking config ───────────────────────────────────────────────────────────

const MASKING_INFO: Record<MaskingLevel, { label: string; desc: string; color: string }> = {
  low:    { label: "Low",    desc: "Minimal masking, most fields retained",          color: "text-emerald-400 border-emerald-400/30 bg-emerald-400/10" },
  medium: { label: "Medium", desc: "Balanced — partial masking on sensitive fields", color: "text-amber-400 border-amber-400/30 bg-amber-400/10" },
  high:   { label: "High",   desc: "Maximum privacy — heavy redaction",              color: "text-red-400 border-red-400/30 bg-red-400/10" },
};

const RISK_COLORS: Record<string, string> = {
  low:    "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
  medium: "text-amber-400   bg-amber-400/10   border-amber-400/30",
  high:   "text-red-400     bg-red-400/10     border-red-400/30",
};

const DONUT_COLORS = ["#f97316", "#facc15", "#fb7185", "#60a5fa"];

// ─── Download helpers ─────────────────────────────────────────────────────────

function downloadCSV(data: Record<string, unknown>[]) {
  if (!data.length) return;
  const keys = Object.keys(data[0]);
  const rows = [
    keys.map(k => `"${k.replace(/"/g, '""')}"`).join(","),
    ...data.map(r => keys.map(k => `"${String(r[k] ?? "").replace(/"/g, '""')}"`).join(",")),
  ];
  const blob = new Blob([rows.join("\n")], { type: "text/csv" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "masked_data.csv"; a.click();
}

function downloadJSON(data: Record<string, unknown>[]) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "masked_data.json"; a.click();
}

function downloadTXT(data: Record<string, unknown>[]) {
  const lines = data.map(r => {
    if ("content" in r) return String(r.content ?? "");
    return Object.entries(r).map(([k, v]) => `${k}: ${v}`).join(" | ");
  });
  const blob = new Blob([lines.join("\n")], { type: "text/plain" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "masked_data.txt"; a.click();
}

function downloadXLSX(data: Record<string, unknown>[]) {
  downloadCSV(data);
  toast("XLSX download: install SheetJS for native XLSX support", { icon: "ℹ️" });
}

/**
 * Generates a styled HTML document and triggers download as .html
 * (fully compatible without server; opens natively in Word/LibreOffice too)
 */
function downloadDocx(data: Record<string, unknown>[], runId: string, maskingLevel: string) {
  const lines = data.map(r => {
    if ("content" in r) return String(r.content ?? "");
    return Object.entries(r).map(([k, v]) => `${k}: ${v}`).join("\n");
  });

  // Escape HTML and highlight masked tokens for Word-friendly output
  const escHtml = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const highlightMasks = (line: string): string => {
    const escaped = escHtml(line);
    return escaped
      .replace(/(\[REDACTED\]|\[MASKED\]|\[ADDRESS REDACTED\])/g,
        '<span style="background:#fff3cd;color:#856404;padding:1px 4px;border-radius:3px;font-weight:600;">$1</span>')
      .replace(/(\*{2,}[\d\w]*)/g,
        '<span style="background:#fde8d8;color:#c0392b;padding:1px 3px;border-radius:3px;font-family:monospace;">$1</span>')
      .replace(/(XX+[\w/]*)/g,
        '<span style="background:#e8f4fd;color:#1a5276;padding:1px 3px;border-radius:3px;font-family:monospace;">$1</span>');
  };

  // Split multi-line content fields into individual paragraphs
  const allParagraphs: string[] = [];
  lines.forEach(line => {
    const parts = line.split("\n");
    parts.forEach(part => {
      if (part.trim()) allParagraphs.push(part);
    });
  });

  const now = new Date().toLocaleString();

  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Masked Document — Run ${runId}</title>
<style>
  body { font-family: 'Calibri', 'Segoe UI', sans-serif; margin: 0; padding: 0; background: #f9fafb; }
  .page { max-width: 800px; margin: 40px auto; background: #fff; padding: 60px 72px; box-shadow: 0 2px 24px rgba(0,0,0,0.08); border-radius: 8px; }
  .header { border-bottom: 3px solid #1a1a2e; padding-bottom: 24px; margin-bottom: 32px; }
  .logo { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }
  .logo-icon { width: 36px; height: 36px; background: linear-gradient(135deg,#0f3460,#16213e); border-radius: 8px; display: flex; align-items: center; justify-content: center; }
  .logo-text { font-size: 18px; font-weight: 700; color: #1a1a2e; letter-spacing: -0.5px; }
  .doc-title { font-size: 26px; font-weight: 700; color: #1a1a2e; margin: 0 0 6px; }
  .meta-row { display: flex; gap: 24px; flex-wrap: wrap; margin-top: 12px; }
  .meta-item { font-size: 11px; color: #6b7280; }
  .meta-item strong { color: #374151; font-weight: 600; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 20px; font-size: 11px; font-weight: 600; }
  .badge-high { background: #fee2e2; color: #991b1b; }
  .badge-medium { background: #fef3c7; color: #92400e; }
  .badge-low { background: #d1fae5; color: #065f46; }
  .section-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.2px; color: #9ca3af; margin: 32px 0 12px; }
  .content-block { background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 6px; padding: 20px 24px; }
  .line-item { padding: 5px 0; border-bottom: 1px solid #f3f4f6; font-size: 13px; color: #374151; line-height: 1.6; }
  .line-item:last-child { border-bottom: none; }
  .line-num { color: #d1d5db; font-size: 11px; font-family: monospace; margin-right: 12px; min-width: 30px; display: inline-block; }
  .section-header { font-size: 14px; font-weight: 700; color: #1a1a2e; margin: 20px 0 4px; padding: 6px 0; border-bottom: 2px solid #e5e7eb; }
  .field-row { display: flex; gap: 12px; padding: 4px 0; font-size: 13px; }
  .field-key { color: #6b7280; min-width: 140px; font-weight: 500; }
  .field-val { color: #111827; flex: 1; }
  .footer { margin-top: 48px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 11px; color: #9ca3af; }
  @media print { body { background: #fff; } .page { box-shadow: none; margin: 0; padding: 40px; } }
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <div class="logo">
      <div class="logo-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        </svg>
      </div>
      <span class="logo-text">FinShield AI</span>
    </div>
    <h1 class="doc-title">Privacy-Masked Document</h1>
    <div class="meta-row">
      <div class="meta-item"><strong>Run ID:</strong> ${runId}</div>
      <div class="meta-item"><strong>Generated:</strong> ${now}</div>
      <div class="meta-item"><strong>Masking Level:</strong> <span class="badge badge-${maskingLevel}">${maskingLevel.toUpperCase()}</span></div>
      <div class="meta-item"><strong>Records:</strong> ${data.length}</div>
    </div>
  </div>

  <div class="section-title">📄 Masked Document Content</div>
  <div class="content-block">
    ${allParagraphs.map((para, i) => {
      // Detect section headers (all-caps lines or SECTION lines)
      const isSectionHeader = /^SECTION\s+\d+/i.test(para) || /^[A-Z\s\d:—-]{8,}$/.test(para.trim());
      if (isSectionHeader) {
        return `<div class="section-header">${escHtml(para)}</div>`;
      }
      // Detect key: value pairs
      const kvMatch = para.match(/^([^:]{2,40}):\s(.+)$/);
      if (kvMatch) {
        return `<div class="field-row">
          <span class="field-key">${escHtml(kvMatch[1])}:</span>
          <span class="field-val">${highlightMasks(kvMatch[2])}</span>
        </div>`;
      }
      // Log lines (timestamps)
      const isLog = /^\[?\d{4}-\d{2}-\d{2}/.test(para);
      return `<div class="line-item">
        ${isLog ? '<span style="color:#60a5fa;font-size:11px;font-family:monospace;margin-right:8px;">LOG</span>' : `<span class="line-num">${i + 1}</span>`}
        ${highlightMasks(para)}
      </div>`;
    }).join("")}
  </div>

  <div class="footer">
    Generated by FinShield AI · Privacy Pipeline v4.6 · All sensitive fields masked per policy
  </div>
</div>
</body>
</html>`;

  const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `masked_document_${runId}.html`;
  a.click();
  toast.success("Document downloaded — open in Word or browser", { icon: "📄" });
}

// ─── Mask token highlighter (for UI rendering) ────────────────────────────────

/**
 * Splits a string into segments and tags each masked token type for rich rendering.
 */
type Segment =
  | { type: "redacted"; text: string }
  | { type: "partial-star"; text: string }
  | { type: "partial-x"; text: string }
  | { type: "pseudonym"; text: string }
  | { type: "plain"; text: string };

function tokeniseContent(content: string): Segment[] {
  // Order matters: most specific first
  const patterns: [RegExp, Segment["type"]][] = [
    [/\[REDACTED\]|\[MASKED\]|\[ADDRESS REDACTED\]/g, "redacted"],
    [/\*{2,}[\d\w-]*/g, "partial-star"],
    [/[A-Z]{2,}X{3,}[\w]*/g, "partial-x"],
    [/XX+[\w/]*/g, "partial-x"],
    [/User_\d+/g, "pseudonym"],
    [/CUST_\d+/g, "pseudonym"],
  ];

  // Build a flat list of [start, end, type, text]
  type Match = { start: number; end: number; segType: Segment["type"]; text: string };
  const matches: Match[] = [];

  patterns.forEach(([re, segType]) => {
    let m: RegExpExecArray | null;
    const regex = new RegExp(re.source, "g");
    while ((m = regex.exec(content)) !== null) {
      matches.push({ start: m.index, end: m.index + m[0].length, segType, text: m[0] });
    }
  });

  // Sort by start, remove overlaps
  matches.sort((a, b) => a.start - b.start);
  const clean: Match[] = [];
  let cursor = 0;
  for (const m of matches) {
    if (m.start >= cursor) { clean.push(m); cursor = m.end; }
  }

  // Build segments
  const segments: Segment[] = [];
  let pos = 0;
  for (const m of clean) {
    if (m.start > pos) segments.push({ type: "plain", text: content.slice(pos, m.start) });
    segments.push({ type: m.segType, text: m.text });
    pos = m.end;
  }
  if (pos < content.length) segments.push({ type: "plain", text: content.slice(pos) });
  return segments;
}

function MaskedInline({ content }: { content: string }) {
  const segments = tokeniseContent(content);
  return (
    <>
      {segments.map((seg, i) => {
        if (seg.type === "redacted") {
          return (
            <span key={i} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-red-500/10 text-red-400 border border-red-500/20 mx-0.5 whitespace-nowrap">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
              {seg.text}
            </span>
          );
        }
        if (seg.type === "partial-star") {
          return (
            <span key={i} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-amber-400/10 text-amber-300 border border-amber-400/20 mx-0.5">
              {seg.text}
            </span>
          );
        }
        if (seg.type === "partial-x") {
          return (
            <span key={i} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-blue-500/10 text-blue-300 border border-blue-400/20 mx-0.5">
              {seg.text}
            </span>
          );
        }
        if (seg.type === "pseudonym") {
          return (
            <span key={i} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-purple-500/10 text-purple-300 border border-purple-400/20 mx-0.5">
              {seg.text}
            </span>
          );
        }
        return <span key={i} className="text-gray-300">{seg.text}</span>;
      })}
    </>
  );
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

const CustomTooltip = ({ active, payload, label }: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#0f1117", border: "1px solid #1e2530", borderRadius: 8, padding: "8px 14px", fontSize: 12 }}>
      {label && <p style={{ color: "#6b7280", marginBottom: 4, fontFamily: "monospace" }}>{label}</p>}
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color, fontFamily: "monospace" }}>{p.name}: <strong>{p.value}</strong></p>
      ))}
    </div>
  );
};

// ─── Gauge ────────────────────────────────────────────────────────────────────

function QualityGauge({ score, label }: { score: number; label: string }) {
  const circumference = Math.PI * 54;
  const offset = circumference * (1 - score / 100);
  const color = score >= 70 ? "#10b981" : score >= 40 ? "#f59e0b" : "#f87171";
  return (
    <div className="flex flex-col items-center justify-center">
      <svg width={140} height={80} viewBox="0 0 140 80">
        <path d="M 14 70 A 56 56 0 0 1 126 70" fill="none" stroke="#1e2530" strokeWidth={8} strokeLinecap="round" />
        <path d="M 14 70 A 56 56 0 0 1 126 70" fill="none" stroke={color} strokeWidth={8} strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1s ease, stroke 0.3s ease" }} />
      </svg>
      <div className="text-center -mt-6">
        <p className="text-3xl font-bold font-mono" style={{ color }}>{score.toFixed(1)}%</p>
        <p className="text-xs text-gray-500 mt-0.5">{label}</p>
      </div>
    </div>
  );
}

// ─── TypeBar ──────────────────────────────────────────────────────────────────

function TypeBar({ label, count, max, color, icon }: {
  label: string; count: number; max: number; color: string; icon: string;
}) {
  const pct = max > 0 ? (count / max) * 100 : 0;
  return (
    <div className="p-4 rounded-xl border border-white/5 bg-white/[0.03]">
      <div className="flex items-center gap-2.5 mb-2">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base" style={{ background: `${color}20` }}>{icon}</div>
        <div>
          <p className="text-xs text-gray-400 font-medium">{label}</p>
          <p className="text-xl font-bold font-mono" style={{ color }}>{count}</p>
        </div>
      </div>
      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
      </div>
      <p className="text-[10px] text-gray-600 mt-1 font-mono">{pct.toFixed(0)}% of max</p>
    </div>
  );
}

// ─── File type badge pill ─────────────────────────────────────────────────────

function FileTypeBadge({ ext }: { ext: SupportedExt }) {
  const meta = FILE_TYPE_META[ext];
  return (
    <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs px-2.5 py-1 rounded-md border font-mono font-medium"
      style={{ color: meta.color, borderColor: `${meta.color}40`, background: `${meta.color}12` }}>
      <span>{meta.icon}</span>{meta.label}
    </span>
  );
}

// ─── Mask Legend ──────────────────────────────────────────────────────────────

function MaskLegend() {
  const items = [
    { label: "[REDACTED]", bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/20", dot: "bg-red-400", desc: "Fully removed" },
    { label: "****1234",   bg: "bg-amber-400/10", text: "text-amber-300", border: "border-amber-400/20", dot: "bg-amber-400", desc: "Partially masked" },
    { label: "SBINXXXX",   bg: "bg-blue-500/10", text: "text-blue-300", border: "border-blue-400/20", dot: "bg-blue-400", desc: "Pattern replaced" },
    { label: "User_4162",  bg: "bg-purple-500/10", text: "text-purple-300", border: "border-purple-400/20", dot: "bg-purple-400", desc: "Pseudonymised" },
  ];
  return (
    <div className="flex flex-wrap gap-2 text-[10px]">
      {items.map(it => (
        <div key={it.label} className="flex items-center gap-1.5">
          <span className={cn("px-1.5 py-0.5 rounded font-mono font-semibold border", it.bg, it.text, it.border)}>{it.label}</span>
          <span className="text-gray-600">{it.desc}</span>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DOCUMENT VIEW  — premium multi-line document renderer
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Parses all line-based result rows into a flat list of display lines,
 * splitting on `\n` within the `content` field.
 */
interface DisplayLine {
  lineNum: number;
  rawText: string;
  isSectionHeader: boolean;
  isLogEntry: boolean;
  isKeyValue: boolean;
  key?: string;
  value?: string;
}

function parseDocumentLines(result: Record<string, unknown>[]): DisplayLine[] {
  const out: DisplayLine[] = [];
  let lineNum = 0;
  for (const row of result) {
    const content = String(row.content ?? "");
    const subLines = content.split("\n");
    for (const rawLine of subLines) {
      const text = rawLine.trimEnd();
      if (!text) continue;
      lineNum++;
      const isSectionHeader = /^SECTION\s+\d+/i.test(text) || /^[A-Z0-9\s:—\-]{10,}$/.test(text.trim());
      const isLogEntry = /^\[?\d{4}-\d{2}-\d{2}[\sT]/.test(text);
      const kvMatch = !isSectionHeader && !isLogEntry ? text.match(/^([^:]{2,40}):\s(.+)$/) : null;
      out.push({
        lineNum,
        rawText: text,
        isSectionHeader,
        isLogEntry,
        isKeyValue: !!kvMatch,
        key: kvMatch?.[1],
        value: kvMatch?.[2],
      });
    }
  }
  return out;
}

function DocumentView({ result, onCopy }: {
  result: Record<string, unknown>[];
  onCopy: (text: string, idx: number) => void;
  copiedRow: number | null;
}) {
  const lines = useMemo(() => parseDocumentLines(result), [result]);

  return (
    <div className="divide-y divide-white/[0.04]">
      {lines.map((line, i) => {
        if (line.isSectionHeader) {
          return (
            <div key={i} className="px-5 py-3 bg-gradient-to-r from-white/[0.04] to-transparent flex items-center gap-3 group">
              <div className="h-px flex-1 bg-gradient-to-r from-primary/30 to-transparent" />
              <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-primary/80 shrink-0">
                {line.rawText}
              </span>
              <div className="h-px flex-1 bg-gradient-to-l from-primary/30 to-transparent" />
            </div>
          );
        }

        if (line.isLogEntry) {
          return (
            <div key={i} className="px-5 py-2.5 flex items-start gap-3 hover:bg-blue-500/[0.04] transition-colors group">
              <div className="shrink-0 flex items-center gap-1.5 mt-0.5">
                <span className="text-[9px] font-mono text-gray-700 tabular-nums w-5 text-right">{line.lineNum}</span>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-blue-500/10 text-blue-400 border border-blue-400/20 shrink-0">LOG</span>
              </div>
              <div className="flex-1 text-[11px] font-mono text-gray-400 break-all leading-relaxed">
                <MaskedInline content={line.rawText} />
              </div>
              <button
                onClick={() => onCopy(line.rawText, i)}
                className="shrink-0 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-white/10 text-gray-600 hover:text-gray-300 transition-all"
              >
                <Copy className="h-3 w-3" />
              </button>
            </div>
          );
        }

        if (line.isKeyValue && line.key && line.value) {
          const hasMasked = /\[REDACTED\]|\*{2,}|XXXX|User_/.test(line.value);
          return (
            <div key={i} className={cn(
              "px-5 py-2 flex items-start gap-2 transition-colors group",
              hasMasked ? "hover:bg-amber-400/[0.03]" : "hover:bg-white/[0.02]"
            )}>
              <span className="text-[9px] font-mono text-gray-700 tabular-nums mt-1 w-5 text-right shrink-0">{line.lineNum}</span>
              <div className="flex-1 grid grid-cols-[minmax(120px,160px)_1fr] gap-x-3 items-start min-w-0">
                <span className="text-[11px] font-medium text-gray-500 truncate pt-0.5">{line.key}:</span>
                <span className="text-[11px] font-mono break-all leading-relaxed">
                  <MaskedInline content={line.value} />
                </span>
              </div>
              {hasMasked && (
                <Shield className="h-3 w-3 text-amber-400/50 shrink-0 mt-0.5" />
              )}
              <button
                onClick={() => onCopy(`${line.key}: ${line.value}`, i)}
                className="shrink-0 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-white/10 text-gray-600 hover:text-gray-300 transition-all"
              >
                <Copy className="h-3 w-3" />
              </button>
            </div>
          );
        }

        // Generic line
        return (
          <div key={i} className="px-5 py-2 flex items-start gap-3 hover:bg-white/[0.02] transition-colors group">
            <span className="text-[9px] font-mono text-gray-700 tabular-nums mt-0.5 w-5 text-right shrink-0">{line.lineNum}</span>
            <div className="flex-1 text-[11px] text-gray-400 break-all leading-relaxed">
              <MaskedInline content={line.rawText} />
            </div>
            <button
              onClick={() => onCopy(line.rawText, i)}
              className="shrink-0 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-white/10 text-gray-600 hover:text-gray-300 transition-all"
            >
              <Copy className="h-3 w-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// UPLOAD SECTION
// ═══════════════════════════════════════════════════════════════════════════════

function UploadSection({
  onResult,
  onProcessStart,
}: {
  onResult: (d: PipelineData, elapsed: number) => void;
  onProcessStart: () => void;
}) {
  const navigate = useNavigate();
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [maskingLevel, setMaskingLevel] = useState<MaskingLevel>("medium");
  const [levelOpen, setLevelOpen] = useState(false);
  const [processDataset, { isLoading }] = useProcessDatasetMutation();

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (!f) return;
    if (!isValidFile(f)) { toast.error("Supported: CSV, JSON, XLSX, TXT, DOCX"); return; }
    setFile(f);
  }, []);

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!isValidFile(f)) { toast.error("Supported: CSV, JSON, XLSX, TXT, DOCX"); return; }
    setFile(f);
  };

  const handleProcess = async () => {
    if (!file) return;
    onProcessStart();
    const t0 = performance.now();
    try {
      const res = await processDataset({ file, level: maskingLevel }).unwrap() as { data: PipelineData };
      const elapsed = (performance.now() - t0) / 1000;
      onResult(res.data, elapsed);
    } catch (err: unknown) {
      const msg = err && typeof err === "object" && "data" in err
        ? (err as { data?: { message?: string } }).data?.message
        : "Processing failed";
      toast.error(msg ?? "Processing failed");
    }
  };

  const fileExt = file ? getFileExt(file) : null;
  const fileColor = file ? getFileColor(file.name) : "#6b7280";
  const fileIcon = file ? getFileIcon(file.name) : "📁";
  const isUnstructuredType = fileExt === ".txt" || fileExt === ".docx";

  return (
    <section className="min-h-[100dvh] flex flex-col items-center justify-center px-4 py-12 sm:py-20 relative">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] sm:w-[700px] h-[300px] sm:h-[700px] rounded-full bg-primary/8 blur-[100px] sm:blur-[140px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[200px] sm:w-[400px] h-[200px] sm:h-[400px] rounded-full bg-secondary/6 blur-[80px] sm:blur-[120px]" />
      </div>

      <div className="relative z-10 w-full max-w-2xl flex flex-col items-center text-center">
        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 mb-6 sm:mb-8 w-full">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary text-[10px] sm:text-xs font-mono">
            <Lock className="h-3 w-3 shrink-0" />
            <span>Privacy-first · In-memory · Zero storage</span>
          </div>
          <button
            onClick={() => navigate("/dashboard")}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[10px] sm:text-xs font-mono font-medium",
              "border-border/50 bg-muted/20 text-muted-foreground",
              "hover:border-primary/40 hover:bg-primary/10 hover:text-primary",
              "transition-all duration-200 group"
            )}
          >
            <LayoutDashboard className="h-3 w-3 shrink-0 transition-transform group-hover:scale-110" />
            <span>Dashboard</span>
            <ArrowRight className="h-3 w-3 shrink-0 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200" />
          </button>
        </div>

        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-2 sm:mb-3 px-2">
          Data Privacy{" "}
          <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">Engine</span>
        </h1>
        <p className="text-muted-foreground text-sm sm:text-base lg:text-lg mb-8 sm:mb-10 px-4 leading-relaxed max-w-lg">
          Upload your dataset and instantly detect &amp; mask sensitive information with AI precision.
        </p>

        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={cn(
            "w-full rounded-2xl border-2 border-dashed transition-all duration-300 glass",
            dragOver ? "border-primary bg-primary/5 shadow-glow-primary scale-[1.01]" : "border-border/60 hover:border-primary/50"
          )}
        >
          {!file ? (
            <div className="flex flex-col items-center py-10 sm:py-16 px-4 sm:px-6">
              <div className="relative mb-4 sm:mb-6">
                <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full" />
                <div className="relative p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 border border-primary/30">
                  <Upload className="h-7 w-7 sm:h-9 sm:w-9 text-primary" />
                </div>
              </div>
              <h3 className="text-base sm:text-xl font-semibold mb-1">Drop your dataset here</h3>
              <p className="text-xs sm:text-sm text-muted-foreground mb-1">or click to browse your files</p>
              <div className="flex flex-wrap justify-center gap-2 mt-3 mb-6">
                {SUPPORTED_EXTENSIONS.map(ext => <FileTypeBadge key={ext} ext={ext} />)}
              </div>
              <label>
                <input type="file" className="hidden" onChange={onPick} accept=".csv,.json,.xlsx,.txt,.docx" />
                <span className="inline-flex items-center justify-center gap-2 rounded-xl text-sm font-semibold px-5 sm:px-7 py-2.5 sm:py-3 bg-gradient-primary text-primary-foreground btn-glow cursor-pointer shadow-glow-primary transition-transform hover:scale-105 active:scale-95">
                  <Upload className="h-4 w-4" /> Browse files
                </span>
              </label>
            </div>
          ) : (
            <div className="p-4 sm:p-6 flex flex-col gap-3 sm:gap-4">
              <div className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl border"
                style={{ background: `${fileColor}0d`, borderColor: `${fileColor}30` }}>
                <div className="p-2 sm:p-3 rounded-xl border shrink-0 text-2xl flex items-center justify-center w-12 h-12"
                  style={{ background: `${fileColor}1a`, borderColor: `${fileColor}40` }}>
                  {fileIcon}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="font-semibold truncate text-sm sm:text-base">{file.name}</p>
                  <div className="flex items-center flex-wrap gap-2 mt-1">
                    <span className="text-[10px] sm:text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</span>
                    {fileExt && <FileTypeBadge ext={fileExt} />}
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md border font-mono" style={{ color: "#10b981", borderColor: "#10b98130", background: "#10b98112" }}>
                      Ready to process
                    </span>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setFile(null)} disabled={isLoading}
                  className="shrink-0 h-8 w-8 sm:h-10 sm:w-10 hover:bg-destructive/10 hover:text-destructive transition-colors">
                  <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </Button>
              </div>

              {isUnstructuredType && (
                <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl border border-amber-400/20 bg-amber-400/5 text-left">
                  <FileType2 className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-[10px] sm:text-xs text-amber-300/80 leading-relaxed">
                    <span className="font-semibold text-amber-400">
                      {fileExt === ".docx" ? "Word document" : "Plain text / log file"}
                    </span>{" "}
                    — processed line-by-line using the Presidio + regex pipeline.
                    PII detected inline; output shown per line with rich masking highlights in Document view.
                  </p>
                </div>
              )}

              <div className="flex flex-col gap-2 sm:flex-row sm:gap-3 sm:items-center">
                <div className="relative flex-1">
                  <button type="button" onClick={() => setLevelOpen(v => !v)} disabled={isLoading}
                    className="w-full flex items-center justify-between gap-2 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl border border-border/60 bg-background/60 text-sm font-medium hover:border-primary/50 transition-colors">
                    <div className="flex items-center gap-2">
                      <span className={cn("w-2 h-2 rounded-full shrink-0", {
                        "bg-emerald-400": maskingLevel === "low",
                        "bg-amber-400": maskingLevel === "medium",
                        "bg-red-400": maskingLevel === "high",
                      })} />
                      <span className="capitalize">Masking: {maskingLevel}</span>
                    </div>
                    <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", levelOpen && "rotate-180")} />
                  </button>
                  {levelOpen && (
                    <div className="absolute left-0 right-0 mt-1 z-30 rounded-xl border border-border/60 bg-background/95 backdrop-blur shadow-xl overflow-hidden">
                      {(["low", "medium", "high"] as MaskingLevel[]).map(lvl => (
                        <button key={lvl} type="button" onClick={() => { setMaskingLevel(lvl); setLevelOpen(false); }}
                          className={cn("w-full text-left px-4 py-3 text-sm hover:bg-muted/50 transition-colors flex items-center gap-3", maskingLevel === lvl && "bg-primary/10")}>
                          <span className={cn("w-2 h-2 rounded-full shrink-0", { "bg-emerald-400": lvl === "low", "bg-amber-400": lvl === "medium", "bg-red-400": lvl === "high" })} />
                          <div>
                            <p className="font-medium capitalize">{MASKING_INFO[lvl].label}</p>
                            <p className="text-xs text-muted-foreground">{MASKING_INFO[lvl].desc}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <Button onClick={handleProcess} disabled={isLoading}
                  className="bg-gradient-primary text-primary-foreground btn-glow shadow-glow-primary px-6 sm:px-8 py-2.5 sm:py-3 h-auto font-semibold text-sm rounded-xl transition-transform hover:scale-105 active:scale-95 shrink-0 w-full sm:w-auto">
                  {isLoading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Analyzing…</> : <><Zap className="h-4 w-4 mr-2" />Process Data</>}
                </Button>
              </div>
            </div>
          )}
        </div>

        {isLoading && (
          <div className="mt-5 sm:mt-7 flex flex-col items-center gap-3 animate-fade-in w-full px-2">
            <div className="flex flex-wrap justify-center gap-x-3 gap-y-2">
              {["ingestion", "detection", "masking", "reporting"].map((step, i) => (
                <div key={step} className="flex items-center gap-1.5">
                  <div className="h-1.5 w-10 sm:w-16 rounded-full bg-primary/20 overflow-hidden">
                    <div className="h-full bg-primary rounded-full animate-pulse" style={{ animationDelay: `${i * 0.2}s` }} />
                  </div>
                  <span className="text-[9px] sm:text-[10px] font-mono text-muted-foreground capitalize">{step}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground font-mono animate-pulse text-center">Running PII detection pipeline…</p>
          </div>
        )}

        {!file && !isLoading && (
          <div className="mt-8 grid grid-cols-3 gap-3 w-full text-center">
            {[{ icon: "🛡️", label: "Zero storage" }, { icon: "⚡", label: "Sub-second" }, { icon: "🔒", label: "In-memory" }].map(({ icon, label }) => (
              <div key={label} className="flex flex-col items-center gap-1 py-3 px-2 rounded-xl border border-border/30 bg-muted/10">
                <span className="text-lg">{icon}</span>
                <span className="text-[10px] font-mono text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// RESULT DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════

function ResultDashboard({ data, elapsed, onReset }: { data: PipelineData; elapsed: number; onReset: () => void }) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [viewMode, setViewMode] = useState<ViewMode>("document");
  const [explanationsOpen, setExplanationsOpen] = useState(false);
  const [copiedRow, setCopiedRow] = useState<number | null>(null);
  const [hiddenCols, setHiddenCols] = useState<string[]>([]);
  const [colPanelOpen, setColPanelOpen] = useState(false);

  const { report, result, runId, maskingLevel } = data;
  const risk = report.riskScore.level.toLowerCase();
  const allCols = result.length > 0 ? Object.keys(result[0]) : [];

  const isLineBased = result.length > 0 && "line" in result[0] && "content" in result[0];
  const inputType = report.pipeline?.inputType ?? "tabular";
  const isDocumentType = inputType === "log" || inputType === "text";

  const inputTypeLabel = inputType === "log" ? "TXT / LOG" : inputType === "text" ? "Plain Text" : inputType.toUpperCase();
  const inputTypeColor = inputType === "log" ? "#60a5fa" : inputType === "text" ? "#f97316" : "#10b981";

  const filtered = useMemo(() => {
    if (!search.trim()) return result;
    const q = search.toLowerCase();
    return result.filter(row => Object.values(row).some(v => String(v ?? "").toLowerCase().includes(q)));
  }, [result, search]);

  const totalPages = Math.ceil(filtered.length / pageSize);
  const pageData = filtered.slice(page * pageSize, (page + 1) * pageSize);
  const visibleCols = allCols.filter(c => !hiddenCols.includes(c));

  const rawBreakdown = report.breakdown ?? {};
  const directPII = rawBreakdown.directPII ?? {};
  const sensitivePII = rawBreakdown.sensitivePII ?? {};
  const quasiIdentifiers = rawBreakdown.quasiIdentifiers ?? {};

  const sumValues = (obj: Record<string, unknown>): number =>
    Object.values(obj).reduce<number>((acc, v) => acc + (Number(v) || 0), 0);

  const utilityScore = parseFloat(report.utilityPercent);
  const piiPercent = parseFloat(report.piiPercent);
  const qualityLabel = utilityScore >= 70 ? "Good shape" : utilityScore >= 40 ? "Needs work" : "High risk";

  const typeCounts = {
    Direct: sumValues(directPII),
    Sensitive: sumValues(sensitivePII),
    Quasi: sumValues(quasiIdentifiers),
  };
  const maxType = Math.max(...Object.values(typeCounts), 1);

  const donutData = [
    { name: "Direct PII", value: typeCounts.Direct },
    { name: "Sensitive PII", value: typeCounts.Sensitive },
    { name: "Quasi-ID", value: typeCounts.Quasi },
  ].filter(d => d.value > 0);

  const totalPii = donutData.reduce((a, b) => a + b.value, 0);

  const barData = [
    ...Object.entries(directPII).map(([k, v]) => ({ field: k, count: Number(v) || 0, type: "Direct" })),
    ...Object.entries(sensitivePII).map(([k, v]) => ({ field: k, count: Number(v) || 0, type: "Sensitive" })),
    ...Object.entries(quasiIdentifiers).map(([k, v]) => ({ field: k, count: Number(v) || 0, type: "Quasi" })),
  ];

  const trendData = useMemo(() => {
    const steps = 12;
    return Array.from({ length: steps }, (_, i) => ({
      date: `Day ${i + 1}`,
      total: Math.round(report.records * (0.6 + 0.4 * Math.sin(i / 3) * Math.random())),
      pii: Math.round(report.piiFields * (0.5 + 0.5 * Math.cos(i / 3) * Math.random())),
    }));
  }, [report.records, report.piiFields]);

  function copyRow(text: string, idx: number) {
    navigator.clipboard.writeText(text);
    setCopiedRow(idx);
    setTimeout(() => setCopiedRow(null), 1500);
  }

  function copyRowObj(row: Record<string, unknown>, idx: number) {
    copyRow(JSON.stringify(row, null, 2), idx);
  }

  function toggleCol(col: string) {
    setHiddenCols(prev => prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]);
  }

  const cardBase = "rounded-2xl border border-white/5 bg-[#0d1117]/80 backdrop-blur";

  // Download options — include DOCX for document/log types
  const downloadOptions = isDocumentType || isLineBased ? [
    { label: "Download TXT",  icon: FileCode2,  onClick: () => downloadTXT(result),                          color: "#60a5fa" },
    { label: "Download JSON", icon: Braces,     onClick: () => downloadJSON(result),                         color: "#8b5cf6" },
    { label: "Download Document", icon: FileText, onClick: () => downloadDocx(result, runId, maskingLevel),  color: "#f97316" },
  ] : [
    { label: "Download CSV",  icon: Download,  onClick: () => downloadCSV(result),  color: "#10b981" },
    { label: "Download JSON", icon: Braces,    onClick: () => downloadJSON(result), color: "#8b5cf6" },
    { label: "Download XLSX", icon: Table2,    onClick: () => downloadXLSX(result), color: "#60a5fa" },
  ];

  // View mode tabs — show "Document" tab for line-based results
  const viewTabs: { mode: ViewMode; label: string; icon: React.ElementType }[] = isLineBased ? [
    { mode: "document", label: "Document", icon: ScrollText },
    { mode: "table",    label: "Table",    icon: Table2 },
    { mode: "json",     label: "JSON",     icon: Braces },
  ] : [
    { mode: "table", label: "Table", icon: Table2 },
    { mode: "json",  label: "JSON",  icon: Braces },
  ];

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-6 sm:py-10 space-y-5 sm:space-y-6 animate-fade-in-up">

      {/* ── Header ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-1.5">
            <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <span className="text-[10px] sm:text-xs font-mono text-gray-500">Run #{runId}</span>
            <span className="text-gray-700 hidden sm:inline">·</span>
            <span className="text-[10px] sm:text-xs font-mono text-gray-500 flex items-center gap-1">
              <Clock className="h-3 w-3 shrink-0" /> {elapsed.toFixed(2)}s
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-md border font-mono font-medium"
              style={{ color: inputTypeColor, borderColor: `${inputTypeColor}40`, background: `${inputTypeColor}12` }}>
              {inputTypeLabel}
            </span>
            {report.pipeline.detector && (
              <span className="text-[10px] px-2 py-0.5 rounded-md border font-mono text-gray-600 border-white/5 bg-white/[0.03] hidden sm:inline">
                {report.pipeline.detector}
              </span>
            )}
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Pipeline Results</h2>
          <p className="text-xs text-gray-500 mt-0.5">Your data has been scanned and masked</p>
        </div>

        <div className="flex flex-col xs:flex-row sm:flex-col lg:flex-row items-stretch xs:items-center gap-2 self-start shrink-0">
          <button onClick={() => navigate("/dashboard")}
            className={cn(
              "inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold",
              "bg-gradient-primary text-primary-foreground btn-glow shadow-glow-primary",
              "transition-transform hover:scale-105 active:scale-95 whitespace-nowrap"
            )}>
            <LayoutDashboard className="h-4 w-4 shrink-0" />View Dashboard<Sparkles className="h-3.5 w-3.5 shrink-0 opacity-70" />
          </button>
          <Button variant="outline" size="sm" onClick={onReset}
            className="border-white/10 hover:border-primary/50 text-xs sm:text-sm h-auto py-2.5 px-4 rounded-xl">
            <Upload className="h-3.5 w-3.5 mr-1.5 shrink-0" />Process another
          </Button>
        </div>
      </div>

      {/* ── Document pipeline notice ── */}
      {isDocumentType && (
        <div className="flex items-start gap-3 px-4 py-3.5 rounded-xl border border-blue-400/20 bg-blue-400/5">
          <FileType2 className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-blue-300 mb-0.5">Unstructured document pipeline</p>
            <p className="text-[11px] text-blue-300/60 leading-relaxed">
              Processed line-by-line using <span className="font-mono text-blue-300/80">{report.pipeline.detector ?? "Presidio + regex"}</span>.
              PII spans detected and masked inline — switch to <strong className="text-blue-300/80">Document</strong> view below for a rich, formatted preview with colour-coded masking.
            </p>
          </div>
          {/* Quick legend */}
          <div className="hidden lg:flex flex-col gap-1 shrink-0">
            <MaskLegend />
          </div>
        </div>
      )}

      {/* ── ROW 1: Area chart + Quality Gauge ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
        <div className={cn(cardBase, "p-4 sm:p-5")}>
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-4 w-4 text-emerald-400" />
            <h3 className="text-sm font-semibold">Field Detection Trend</h3>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={trendData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="totalGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="piiGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f97316" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2530" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#4b5563" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#4b5563" }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="total" name="Total Fields" stroke="#10b981" strokeWidth={2} fill="url(#totalGrad)" dot={false} activeDot={{ r: 4, fill: "#10b981" }} />
              <Area type="monotone" dataKey="pii" name="PII Fields" stroke="#f97316" strokeWidth={2} fill="url(#piiGrad)" dot={false} activeDot={{ r: 4, fill: "#f97316" }} />
              <Legend iconType="circle" iconSize={6} wrapperStyle={{ fontSize: 11, paddingTop: 12, color: "#9ca3af" }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className={cn(cardBase, "p-4 sm:p-5 flex flex-col")}>
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle className="h-4 w-4 text-amber-400" />
            <h3 className="text-sm font-semibold">Quality Score</h3>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center">
            <QualityGauge score={utilityScore} label={qualityLabel} />
          </div>
          <div className="grid grid-cols-2 gap-2 mt-4">
            {[
              { value: report.records.toLocaleString(), label: "Records",    color: "text-white" },
              { value: String(report.piiFields),        label: "PII Fields", color: "text-orange-400" },
              { value: `${piiPercent.toFixed(1)}%`,    label: "PII %",      color: "text-red-400" },
              { value: `${utilityScore.toFixed(1)}%`,  label: "Utility %",  color: "text-emerald-400" },
            ].map(({ value, label, color }) => (
              <div key={label} className="rounded-xl bg-white/[0.03] border border-white/5 px-3 py-2.5 text-center">
                <p className={cn("text-xl font-bold font-mono", color)}>{value}</p>
                <p className="text-[10px] text-gray-500 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── ROW 2: Bar chart + Donut ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        <div className={cn(cardBase, "p-4 sm:p-5")}>
          <div className="flex items-center gap-2 mb-4">
            <GitBranch className="h-4 w-4 text-emerald-400" />
            <h3 className="text-sm font-semibold">Fields by Category</h3>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={barData} margin={{ top: 0, right: 8, bottom: 0, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2530" vertical={false} />
              <XAxis dataKey="field" tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend iconType="circle" iconSize={6} wrapperStyle={{ fontSize: 11, paddingTop: 12, color: "#9ca3af" }} />
              <Bar dataKey="count" name="Fields" radius={[4, 4, 0, 0]}>
                {barData.map((entry, i) => (
                  <Cell key={i} fill={entry.type === "Direct" ? "#f97316" : entry.type === "Sensitive" ? "#facc15" : "#60a5fa"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className={cn(cardBase, "p-4 sm:p-5")}>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            <h3 className="text-sm font-semibold">By PII Type</h3>
          </div>
          <div className="flex items-center justify-center">
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={donutData} cx="50%" cy="50%" innerRadius={48} outerRadius={72} paddingAngle={2} dataKey="value" strokeWidth={0}>
                  {donutData.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />)}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2 mt-1">
            {donutData.map((d, i) => (
              <div key={d.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: DONUT_COLORS[i] }} />
                  <span className="text-gray-400">{d.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold" style={{ color: DONUT_COLORS[i] }}>{d.value}</span>
                  <span className="text-gray-600 font-mono text-[10px]">
                    ({totalPii > 0 ? ((d.value / totalPii) * 100).toFixed(1) : "0.0"}%)
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-white/5 flex items-center gap-2">
            <span className={cn("text-[10px] px-2 py-1 rounded-lg border font-mono font-medium capitalize", RISK_COLORS[risk] ?? "text-gray-400")}>
              Risk: {report.riskScore.level} · {report.riskScore.score.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* ── ROW 3: PII by Type ── */}
      <div className={cn(cardBase, "p-4 sm:p-5")}>
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="h-4 w-4 text-emerald-400" />
          <h3 className="text-sm font-semibold">PII by Type</h3>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <TypeBar label="Direct PII"        count={typeCounts.Direct}    max={maxType}            color="#f87171" icon="🛡️" />
          <TypeBar label="Sensitive PII"     count={typeCounts.Sensitive} max={maxType}            color="#f97316" icon="🔥" />
          <TypeBar label="Quasi-Identifiers" count={typeCounts.Quasi}     max={maxType}            color="#60a5fa" icon="⚡" />
          <TypeBar label="Total Fields"      count={report.totalFields}   max={report.totalFields} color="#10b981" icon="🗄️" />
        </div>
      </div>

      {/* ── ROW 4: Masked Data Preview ── */}
      <div className={cn(cardBase, "overflow-hidden")}>
        {/* Toolbar */}
        <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-white/5 flex flex-col gap-2 sm:gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-wrap">
              <Database className="h-4 w-4 text-emerald-400 shrink-0" />
              <h3 className="text-sm font-semibold">Masked Data Preview</h3>
              {isLineBased && (
                <span className="text-[10px] px-2 py-0.5 rounded-md border border-blue-400/30 bg-blue-400/10 text-blue-400 font-mono">
                  line-by-line
                </span>
              )}
            </div>
            {/* View mode tabs */}
            <div className="flex rounded-lg border border-white/10 overflow-hidden shrink-0">
              {viewTabs.map(({ mode, label, icon: Icon }) => (
                <button key={mode} onClick={() => setViewMode(mode)}
                  className={cn("px-2.5 sm:px-3 py-2 text-[10px] sm:text-xs flex items-center gap-1 sm:gap-1.5 transition-colors border-l border-white/10 first:border-l-0",
                    viewMode === mode ? "bg-primary/20 text-primary" : "text-gray-500 hover:bg-white/5")}>
                  <Icon className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                  <span className="hidden xs:inline">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Search + page size — hidden in document mode (full doc) */}
          {viewMode !== "document" && (
            <div className="flex gap-2 items-center">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-600" />
                <input value={search} onChange={e => { setSearch(e.target.value); setPage(0); }}
                  placeholder="Search records…"
                  className="pl-8 pr-3 py-2 text-xs rounded-lg border border-white/10 bg-white/[0.03] w-full focus:outline-none focus:border-primary/50 transition-colors text-gray-300" />
              </div>
              <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(0); }}
                className="px-2 sm:px-3 py-2 text-xs rounded-lg border border-white/10 bg-white/[0.03] focus:outline-none focus:border-primary/50 cursor-pointer shrink-0 text-gray-300">
                {[10, 25, 50].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          )}

          {/* Mask legend in document mode */}
          {viewMode === "document" && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-600 font-mono shrink-0">Legend:</span>
              <MaskLegend />
            </div>
          )}
        </div>

        {/* Column toggle for tabular */}
        {viewMode === "table" && !isLineBased && (
          <div className="px-4 sm:px-5 py-2 border-b border-white/[0.04]">
            <button onClick={() => setColPanelOpen(v => !v)}
              className="sm:hidden flex items-center gap-1.5 text-[11px] font-mono text-gray-600 mb-1">
              <Eye className="h-3 w-3" />Columns ({allCols.length - hiddenCols.length}/{allCols.length})
              {colPanelOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
            <div className={cn("flex flex-wrap gap-1.5", !colPanelOpen && "hidden sm:flex")}>
              <span className="text-[11px] font-mono text-gray-600 mr-1 self-center hidden sm:inline">Columns:</span>
              {allCols.map(col => (
                <button key={col} onClick={() => toggleCol(col)}
                  className={cn("inline-flex items-center gap-1 text-[10px] sm:text-[11px] px-1.5 sm:px-2 py-0.5 rounded border transition-colors",
                    hiddenCols.includes(col) ? "border-white/5 text-gray-600 bg-transparent" : "border-primary/30 text-primary bg-primary/10")}>
                  {hiddenCols.includes(col) ? <EyeOff className="h-2.5 w-2.5" /> : <Eye className="h-2.5 w-2.5" />}{col}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Document View ── */}
        {viewMode === "document" ? (
          <div className="overflow-auto max-h-[600px]">
            <DocumentView result={result} onCopy={copyRow} copiedRow={copiedRow} />
          </div>
        ) : viewMode === "json" ? (
          <div className="overflow-auto max-h-[400px] sm:max-h-[500px] p-3 sm:p-5">
            <pre className="text-[10px] sm:text-xs font-mono text-gray-500 leading-relaxed">
              {JSON.stringify(pageData, null, 2)}
            </pre>
          </div>
        ) : isLineBased ? (
          /* ── Line table view for TXT/DOCX ── */
          <div className="overflow-auto max-h-[500px]">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/5 text-left">
                  <th className="px-4 sm:px-5 py-3 w-14 font-mono text-[10px] uppercase tracking-widest text-gray-600 font-medium">Line</th>
                  <th className="px-4 sm:px-5 py-3 font-mono text-[10px] uppercase tracking-widest text-gray-600 font-medium">Content</th>
                  <th className="px-4 sm:px-5 py-3 w-12 text-right font-mono text-[10px] uppercase tracking-widest text-gray-600 font-medium">Copy</th>
                </tr>
              </thead>
              <tbody>
                {pageData.map((row, i) => {
                  const lineNum = Number(row.line ?? (page * pageSize + i + 1));
                  const content = String(row.content ?? "");
                  const hasMasked = /\[REDACTED\]|\[MASKED\]|\[ADDRESS REDACTED\]|\*+|XXXX|User_/.test(content);
                  return (
                    <tr key={i} className={cn("border-b border-white/[0.04] last:border-0 transition-colors",
                      hasMasked ? "hover:bg-amber-400/5" : "hover:bg-white/[0.03]")}>
                      <td className="px-4 sm:px-5 py-3 font-mono text-gray-600 text-[10px] align-top tabular-nums">{lineNum}</td>
                      <td className="px-4 sm:px-5 py-3 font-mono text-gray-300 break-all leading-relaxed">
                        <MaskedInline content={content} />
                      </td>
                      <td className="px-4 sm:px-5 py-3 text-right align-top">
                        <button onClick={() => copyRowObj(row, i)} className="p-1.5 rounded-md hover:bg-primary/10 text-gray-600 hover:text-primary transition-colors">
                          {copiedRow === i ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* ── Standard tabular view ── */
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[500px]">
              <thead>
                <tr className="border-b border-white/5 text-left">
                  <th className="px-4 sm:px-5 py-3 w-10 font-mono text-[10px] uppercase tracking-widest text-gray-600 font-medium">#</th>
                  {visibleCols.map(col => (
                    <th key={col} className="px-4 sm:px-5 py-3 font-mono text-[10px] uppercase tracking-widest text-gray-600 font-medium whitespace-nowrap">{col}</th>
                  ))}
                  <th className="px-4 sm:px-5 py-3 text-right font-mono text-[10px] uppercase tracking-widest text-gray-600 font-medium">Copy</th>
                </tr>
              </thead>
              <tbody>
                {pageData.map((row, i) => (
                  <tr key={i} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.03] transition-colors">
                    <td className="px-4 sm:px-5 py-3 text-gray-700 font-mono">{page * pageSize + i + 1}</td>
                    {visibleCols.map(col => (
                      <td key={col} className="px-4 sm:px-5 py-3 font-mono text-gray-400 whitespace-nowrap">{String(row[col] ?? "—")}</td>
                    ))}
                    <td className="px-4 sm:px-5 py-3 text-right">
                      <button onClick={() => copyRowObj(row, i)} className="p-1.5 rounded-md hover:bg-primary/10 text-gray-600 hover:text-primary transition-colors">
                        {copiedRow === i ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination — only for non-document views */}
        {viewMode !== "document" && (
          <div className="px-4 sm:px-5 py-3 border-t border-white/5 flex items-center justify-between gap-2">
            <span className="text-[10px] sm:text-xs text-gray-600 font-mono">
              {filtered.length} records · page {page + 1}/{Math.max(1, totalPages)}
            </span>
            <div className="flex gap-1.5">
              <Button size="sm" variant="outline" className="h-7 px-2 sm:px-2.5 text-[10px] sm:text-xs border-white/10"
                onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>← Prev</Button>
              <Button size="sm" variant="outline" className="h-7 px-2 sm:px-2.5 text-[10px] sm:text-xs border-white/10"
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>Next →</Button>
            </div>
          </div>
        )}
      </div>

      {/* ── Download ── */}
      <div className={cn(cardBase, "p-4 sm:p-5")}>
        <h3 className="text-sm font-semibold mb-1">Download Masked Data</h3>
        <p className="text-xs text-gray-500 mb-3 sm:mb-4">Export your privacy-protected dataset in your preferred format</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
          {downloadOptions.map(({ label, icon: Icon, onClick, color }) => (
            <button key={label} onClick={onClick}
              className="flex items-center justify-center gap-2 sm:gap-2.5 px-4 sm:px-5 py-3 sm:py-3.5 rounded-xl border border-white/10 text-gray-400 text-xs sm:text-sm font-medium transition-all hover:scale-[1.02] hover:border-white/20 hover:bg-white/[0.04] active:scale-[0.98]">
              <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" style={{ color }} />
              {label}
            </button>
          ))}
        </div>
        {(isDocumentType || isLineBased) && (
          <p className="text-[10px] text-gray-600 mt-2 font-mono">
            📄 "Download Document" exports a richly formatted HTML file — open directly in Microsoft Word, LibreOffice, or any browser.
          </p>
        )}
      </div>

      {/* ── Dashboard CTA banner ── */}
      <div className={cn(cardBase, "p-4 sm:p-5 border border-primary/20 bg-gradient-to-r from-primary/5 via-transparent to-secondary/5 flex flex-col sm:flex-row items-start sm:items-center gap-4")}>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 border border-primary/20 shrink-0">
            <LayoutDashboard className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold">View your full analytics dashboard</p>
            <p className="text-xs text-gray-500 mt-0.5 truncate">See all runs, trends, and aggregate stats across your pipeline.</p>
          </div>
        </div>
        <button onClick={() => navigate("/dashboard")}
          className={cn("inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold shrink-0 w-full sm:w-auto justify-center bg-gradient-primary text-primary-foreground btn-glow shadow-glow-primary transition-transform hover:scale-105 active:scale-95")}>
          <LayoutDashboard className="h-4 w-4" />Go to Dashboard<ArrowRight className="h-4 w-4" />
        </button>
      </div>

      {/* ── Explanations panel ── */}
      <div className={cn(cardBase, "overflow-hidden")}>
        <button onClick={() => setExplanationsOpen(v => !v)}
          className="w-full flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 hover:bg-white/[0.03] transition-colors">
          <div className="flex items-center gap-2 sm:gap-2.5">
            <Shield className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary shrink-0" />
            <span className="text-xs sm:text-sm font-semibold text-left">How your data was masked</span>
            <span className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-mono shrink-0">
              {Object.keys(report.explanations).length}
            </span>
          </div>
          {explanationsOpen ? <ChevronUp className="h-4 w-4 text-gray-600 shrink-0" /> : <ChevronDown className="h-4 w-4 text-gray-600 shrink-0" />}
        </button>

        {explanationsOpen && (
          <div className="px-4 sm:px-6 pb-4 sm:pb-5 border-t border-white/5 pt-3 sm:pt-4 grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 animate-fade-in">
            {Object.entries(report.explanations).map(([field, note]) => (
              <div key={field} className="flex gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-xl bg-white/[0.03] border border-white/5">
                <div className="mt-0.5 h-5 w-5 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                  <Shield className="h-3 w-3 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-xs font-semibold font-mono text-primary capitalize mb-0.5 truncate">{field}</p>
                  <p className="text-[10px] sm:text-xs text-gray-500 leading-relaxed">{note}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="px-4 sm:px-6 py-3 border-t border-white/5 flex flex-wrap items-center gap-2 sm:gap-3">
          <span className={cn("text-[10px] sm:text-xs px-2 sm:px-2.5 py-1 rounded-lg border font-mono font-medium capitalize shrink-0", RISK_COLORS[risk] ?? "text-gray-400")}>
            {report.riskScore.level} · {report.riskScore.score.toFixed(2)}
          </span>
          <span className="text-[10px] sm:text-xs text-gray-500">{report.riskScore.reason}</span>
        </div>
      </div>

      {/* Pipeline meta */}
      <div className="flex flex-wrap gap-1.5 sm:gap-2 text-[9px] sm:text-[11px] font-mono text-gray-700 justify-end pb-2">
        <span>v{report.pipeline.version}</span>
        <span>·</span>
        <span>masking: {maskingLevel}</span>
        <span>·</span>
        <span>input: {report.pipeline.inputType}</span>
        <span className="hidden sm:inline">·</span>
        <span className="hidden sm:inline">steps: {report.pipeline.steps.join(" → ")}</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export default function ProcessPage() {
  const [result, setResult] = useState<PipelineData | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [processing, setProcessing] = useState(false);
  const topRef = useRef<HTMLDivElement>(null);

  const handleResult = (data: PipelineData, t: number) => {
    setResult(data);
    setElapsed(t);
    setProcessing(false);
    setTimeout(() => topRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  const handleReset = () => { setResult(null); setProcessing(false); };

  return (
    <div ref={topRef} className="min-h-screen">
      <Navbar />
      {!result
        ? <UploadSection onResult={handleResult} onProcessStart={() => setProcessing(true)} />
        : <ResultDashboard data={result} elapsed={elapsed} onReset={handleReset} />
      }
      {processing && <></>}
      <Footer />
    </div>
  );
}