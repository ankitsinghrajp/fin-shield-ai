import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Shield, Database, BarChart3, AlertTriangle,
  Download, Braces, Table2, Copy, Check, Clock, Search,
  ChevronDown, ChevronUp, Eye, EyeOff, GitBranch,
  CheckCircle, FileStack, Layers, Zap, RefreshCw,
  ScrollText, FileText, FileCode2, FileType2,
} from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
  AreaChart, Area,
} from "recharts";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useGetRunByIdQuery } from "@/redux/api/api";
import { DashboardLayout } from "@/components/DashboardLayout";

// ─── Types ────────────────────────────────────────────────────────────────────

interface RiskScore { level: string; score: number; reason: string }
interface Report {
  records: number; totalFields: number; piiFields: number;
  piiPercent: string; utilityPercent: string;
  breakdown: {
    directPII?: Record<string, number>;
    sensitivePII?: Record<string, number>;
    quasiIdentifiers?: Record<string, number>;
  };
  maskingLevel: string; utilityNote: string;
  explanations: Record<string, string>;
  riskScore: RiskScore;
  pipeline: { steps: string[]; inputType: string; version: string; detector?: string };
}

interface Run {
  _id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  recordsProcessed: number;
  piiDetectedPercentage: number;
  fieldsMasked: number;
  dataUtilityScore: number;
  maskingLevel: string;
  maskedData: Record<string, unknown>[];
  report: Report;
  createdAt: string;
}

type ViewMode = "document" | "table" | "json";

// ─── Constants ────────────────────────────────────────────────────────────────

const DONUT_COLORS = ["#f97316", "#facc15", "#fb7185", "#60a5fa"];
const RISK_COLORS: Record<string, string> = {
  low:    "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
  medium: "text-amber-400 bg-amber-400/10 border-amber-400/30",
  high:   "text-red-400 bg-red-400/10 border-red-400/30",
};
const MASKING_COLORS: Record<string, string> = {
  low:    "text-emerald-400 border-emerald-400/30 bg-emerald-400/8",
  medium: "text-amber-400 border-amber-400/30 bg-amber-400/8",
  high:   "text-red-400 border-red-400/30 bg-red-400/8",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function sumValues(obj: Record<string, unknown>): number {
  return Object.values(obj).reduce<number>((a, v) => a + (Number(v) || 0), 0);
}

/**
 * Strips keys that are "[object Object]", empty strings, or look like
 * serialisation artefacts. If a bad key carries a numeric value, we
 * re-bucket it under "other" so the count is never silently lost.
 */
function sanitizeBreakdown(obj: Record<string, number> | undefined): Record<string, number> {
  if (!obj) return {};
  const BAD_KEY = /^\[object\s+Object\]$/i;
  const cleaned: Record<string, number> = {};
  let orphaned = 0;
  for (const [k, v] of Object.entries(obj)) {
    const num = Number(v) || 0;
    if (!k || BAD_KEY.test(k)) {
      orphaned += num;
    } else {
      cleaned[k] = (cleaned[k] ?? 0) + num;
    }
  }
  if (orphaned > 0) cleaned["other"] = (cleaned["other"] ?? 0) + orphaned;
  return cleaned;
}

/**
 * Same sanitisation for the explanations map — drops "[object Object]" keys
 * and replaces them with a generic "other" entry.
 */
function sanitizeExplanations(obj: Record<string, string>): Record<string, string> {
  const BAD_KEY = /^\[object\s+Object\]$/i;
  const cleaned: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (!k || BAD_KEY.test(k)) {
      if (!cleaned["other"]) cleaned["other"] = v; // keep first occurrence
    } else {
      cleaned[k] = v;
    }
  }
  return cleaned;
}

// ─── Download helpers ─────────────────────────────────────────────────────────

function downloadCSV(data: Record<string, unknown>[]) {
  if (!data.length) return;
  const keys = Object.keys(data[0]);
  const rows = [
    keys.map(k => `"${k.replace(/"/g, '""')}"`).join(","),
    ...data.map(r => keys.map(k => `"${String(r[k] ?? "").replace(/"/g, '""')}"`).join(",")),
  ];
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([rows.join("\n")], { type: "text/csv" }));
  a.download = "masked_data.csv"; a.click();
}

function downloadJSON(data: Record<string, unknown>[]) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  a.download = "masked_data.json"; a.click();
}

function downloadTXT(data: Record<string, unknown>[]) {
  const lines = data.map(r => {
    if ("content" in r) return String(r.content ?? "");
    return Object.entries(r).map(([k, v]) => `${k}: ${v}`).join(" | ");
  });
  const blob = new Blob([lines.join("\n")], { type: "text/plain" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = "masked_data.txt"; a.click();
}

function downloadDocx(data: Record<string, unknown>[], runId: string, maskingLevel: string) {
  const lines = data.map(r => {
    if ("content" in r) return String(r.content ?? "");
    return Object.entries(r).map(([k, v]) => `${k}: ${v}`).join("\n");
  });

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

  const allParagraphs: string[] = [];
  lines.forEach(line => {
    const parts = line.split("\n");
    parts.forEach(part => { if (part.trim()) allParagraphs.push(part); });
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
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <div class="logo">
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
      const isSectionHeader = /^SECTION\s+\d+/i.test(para) || /^[A-Z\s\d:—-]{8,}$/.test(para.trim());
      if (isSectionHeader) return `<div class="section-header">${escHtml(para)}</div>`;
      const kvMatch = para.match(/^([^:]{2,40}):\s(.+)$/);
      if (kvMatch) return `<div class="field-row"><span class="field-key">${escHtml(kvMatch[1])}:</span><span class="field-val">${highlightMasks(kvMatch[2])}</span></div>`;
      const isLog = /^\[?\d{4}-\d{2}-\d{2}/.test(para);
      return `<div class="line-item">${isLog ? '<span style="color:#60a5fa;font-size:11px;font-family:monospace;margin-right:8px;">LOG</span>' : `<span class="line-num">${i + 1}</span>`}${highlightMasks(para)}</div>`;
    }).join("")}
  </div>
  <div class="footer">Generated by FinShield AI · Privacy Pipeline v4.6 · All sensitive fields masked per policy</div>
</div>
</body>
</html>`;

  const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `masked_document_${runId}.html`;
  a.click();
}

// ─── Mask token highlighter ────────────────────────────────────────────────────

type Segment =
  | { type: "redacted"; text: string }
  | { type: "partial-star"; text: string }
  | { type: "partial-x"; text: string }
  | { type: "pseudonym"; text: string }
  | { type: "plain"; text: string };

function tokeniseContent(content: string): Segment[] {
  const patterns: [RegExp, Segment["type"]][] = [
    [/\[REDACTED\]|\[MASKED\]|\[ADDRESS REDACTED\]/g, "redacted"],
    [/\*{2,}[\d\w-]*/g, "partial-star"],
    [/[A-Z]{2,}X{3,}[\w]*/g, "partial-x"],
    [/XX+[\w/]*/g, "partial-x"],
    [/User_\d+/g, "pseudonym"],
    [/CUST_\d+/g, "pseudonym"],
  ];

  type Match = { start: number; end: number; segType: Segment["type"]; text: string };
  const matches: Match[] = [];

  patterns.forEach(([re, segType]) => {
    let m: RegExpExecArray | null;
    const regex = new RegExp(re.source, "g");
    while ((m = regex.exec(content)) !== null) {
      matches.push({ start: m.index, end: m.index + m[0].length, segType, text: m[0] });
    }
  });

  matches.sort((a, b) => a.start - b.start);
  const clean: Match[] = [];
  let cursor = 0;
  for (const m of matches) {
    if (m.start >= cursor) { clean.push(m); cursor = m.end; }
  }

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

// ─── Mask Legend ──────────────────────────────────────────────────────────────

function MaskLegend() {
  const items = [
    { label: "[REDACTED]", bg: "bg-red-500/10",    text: "text-red-400",    border: "border-red-500/20",    desc: "Fully removed" },
    { label: "****1234",   bg: "bg-amber-400/10",  text: "text-amber-300",  border: "border-amber-400/20",  desc: "Partially masked" },
    { label: "SBINXXXX",   bg: "bg-blue-500/10",   text: "text-blue-300",   border: "border-blue-400/20",   desc: "Pattern replaced" },
    { label: "User_4162",  bg: "bg-purple-500/10", text: "text-purple-300", border: "border-purple-400/20", desc: "Pseudonymised" },
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

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

const CustomTooltip = ({ active, payload, label }: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#080c12] border border-[#1a2030] rounded-xl px-3 py-2 text-[11px] shadow-2xl">
      {label && <p className="text-gray-500 mb-1 font-mono tracking-wide">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="font-mono" style={{ color: p.color }}>{p.name}: <strong>{p.value}</strong></p>
      ))}
    </div>
  );
};

// ─── Semicircle Gauge ─────────────────────────────────────────────────────────

function QualityGauge({ score }: { score: number }) {
  const circumference = Math.PI * 54;
  const offset = circumference * (1 - Math.min(score, 100) / 100);
  const color = score >= 70 ? "#10b981" : score >= 40 ? "#f59e0b" : "#f87171";
  const label = score >= 70 ? "Excellent" : score >= 40 ? "Moderate" : "High Risk";
  return (
    <div className="flex flex-col items-center">
      <svg width={140} height={82} viewBox="0 0 140 82">
        <path d="M 13 70 A 57 57 0 0 1 127 70" fill="none" stroke="#111820" strokeWidth={9} strokeLinecap="round" />
        <path d="M 13 70 A 57 57 0 0 1 127 70" fill="none" stroke={color} strokeWidth={9} strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.34,1.56,0.64,1), stroke 0.4s ease" }} />
      </svg>
      <div className="text-center -mt-5">
        <p className="text-3xl font-bold font-mono tracking-tight" style={{ color }}>{score.toFixed(1)}%</p>
        <p className="text-[10px] tracking-widest uppercase text-gray-600 mt-0.5 font-mono">{label}</p>
      </div>
    </div>
  );
}

// ─── Stat Pill ────────────────────────────────────────────────────────────────

function StatPill({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-2.5 text-center flex flex-col gap-0.5">
      <p className="text-xl font-bold font-mono" style={{ color }}>{value}</p>
      <p className="text-[10px] text-gray-600 tracking-wider uppercase font-mono">{label}</p>
    </div>
  );
}

// ─── Type Bar ─────────────────────────────────────────────────────────────────

function TypeBar({ label, count, max, color, icon }: { label: string; count: number; max: number; color: string; icon: string }) {
  const pct = max > 0 ? (count / max) * 100 : 0;
  return (
    <div className="p-4 rounded-xl border border-white/[0.05] bg-white/[0.02]">
      <div className="flex items-center gap-2.5 mb-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0" style={{ background: `${color}18` }}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-[11px] text-gray-500 font-medium tracking-wide truncate">{label}</p>
          <p className="text-2xl font-bold font-mono leading-none" style={{ color }}>{count}</p>
        </div>
      </div>
      <div className="h-1 rounded-full bg-white/[0.05] overflow-hidden">
        <div className="h-full rounded-full transition-all duration-1000"
          style={{ width: `${pct}%`, background: color }} />
      </div>
      <p className="text-[10px] text-gray-700 mt-1.5 font-mono">{pct.toFixed(0)}% of max</p>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return <div className={cn("rounded-xl bg-white/[0.04] animate-pulse", className)} />;
}

// ─── Pipeline Steps ───────────────────────────────────────────────────────────

function PipelineSteps({ steps }: { steps: string[] }) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {steps.map((step, i) => (
        <div key={step} className="flex items-center gap-1">
          <span className="text-[10px] font-mono px-2 py-1 rounded-md border border-emerald-500/20 bg-emerald-500/8 text-emerald-400 capitalize tracking-wide">
            {step}
          </span>
          {i < steps.length - 1 && <span className="text-gray-700 text-xs">→</span>}
        </div>
      ))}
    </div>
  );
}

// ─── Document View ────────────────────────────────────────────────────────────

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
      out.push({ lineNum, rawText: text, isSectionHeader, isLogEntry, isKeyValue: !!kvMatch, key: kvMatch?.[1], value: kvMatch?.[2] });
    }
  }
  return out;
}

function DocumentView({ result, onCopy }: {
  result: Record<string, unknown>[];
  onCopy: (text: string, idx: number) => void;
}) {
  const lines = useMemo(() => parseDocumentLines(result), [result]);

  if (lines.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center px-4">
        <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mb-3">
          <ScrollText className="h-5 w-5 text-gray-600" />
        </div>
        <p className="text-sm font-medium text-gray-500">No document content</p>
        <p className="text-xs text-gray-700 mt-1">This run has no line-based content to display</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-white/[0.04]">
      {lines.map((line, i) => {
        if (line.isSectionHeader) {
          return (
            <div key={i} className="px-4 sm:px-5 py-3 bg-gradient-to-r from-white/[0.04] to-transparent flex items-center gap-3">
              <div className="h-px flex-1 bg-gradient-to-r from-primary/30 to-transparent" />
              <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-primary/80 shrink-0">{line.rawText}</span>
              <div className="h-px flex-1 bg-gradient-to-l from-primary/30 to-transparent" />
            </div>
          );
        }
        if (line.isLogEntry) {
          return (
            <div key={i} className="px-4 sm:px-5 py-2.5 flex items-start gap-3 hover:bg-blue-500/[0.04] transition-colors group">
              <div className="shrink-0 flex items-center gap-1.5 mt-0.5">
                <span className="text-[9px] font-mono text-gray-700 tabular-nums w-5 text-right">{line.lineNum}</span>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-blue-500/10 text-blue-400 border border-blue-400/20 shrink-0">LOG</span>
              </div>
              <div className="flex-1 text-[11px] font-mono text-gray-400 break-all leading-relaxed min-w-0">
                <MaskedInline content={line.rawText} />
              </div>
              <button onClick={() => onCopy(line.rawText, i)} className="shrink-0 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-white/10 text-gray-600 hover:text-gray-300 transition-all">
                <Copy className="h-3 w-3" />
              </button>
            </div>
          );
        }
        if (line.isKeyValue && line.key && line.value) {
          const hasMasked = /\[REDACTED\]|\*{2,}|XXXX|User_/.test(line.value);
          return (
            <div key={i} className={cn("px-4 sm:px-5 py-2 flex items-start gap-2 transition-colors group", hasMasked ? "hover:bg-amber-400/[0.03]" : "hover:bg-white/[0.02]")}>
              <span className="text-[9px] font-mono text-gray-700 tabular-nums mt-1 w-5 text-right shrink-0">{line.lineNum}</span>
              <div className="flex-1 grid grid-cols-[minmax(100px,150px)_1fr] gap-x-3 items-start min-w-0">
                <span className="text-[11px] font-medium text-gray-500 truncate pt-0.5">{line.key}:</span>
                <span className="text-[11px] font-mono break-all leading-relaxed min-w-0"><MaskedInline content={line.value} /></span>
              </div>
              {hasMasked && <Shield className="h-3 w-3 text-amber-400/50 shrink-0 mt-0.5" />}
              <button onClick={() => onCopy(`${line.key}: ${line.value}`, i)} className="shrink-0 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-white/10 text-gray-600 hover:text-gray-300 transition-all">
                <Copy className="h-3 w-3" />
              </button>
            </div>
          );
        }
        return (
          <div key={i} className="px-4 sm:px-5 py-2 flex items-start gap-3 hover:bg-white/[0.02] transition-colors group">
            <span className="text-[9px] font-mono text-gray-700 tabular-nums mt-0.5 w-5 text-right shrink-0">{line.lineNum}</span>
            <div className="flex-1 text-[11px] text-gray-400 break-all leading-relaxed min-w-0"><MaskedInline content={line.rawText} /></div>
            <button onClick={() => onCopy(line.rawText, i)} className="shrink-0 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-white/10 text-gray-600 hover:text-gray-300 transition-all">
              <Copy className="h-3 w-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ icon: Icon, title, desc }: { icon: React.ElementType; title: string; desc: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-4">
      <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mb-3">
        <Icon className="h-5 w-5 text-gray-600" />
      </div>
      <p className="text-sm font-medium text-gray-500">{title}</p>
      <p className="text-xs text-gray-700 mt-1">{desc}</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export default function RunDetailPage() {
  const { runId } = useParams<{ runId: string }>();
  const navigate = useNavigate();

  const { data: response, isLoading, isFetching, refetch } = useGetRunByIdQuery(runId);
  const run: Run | undefined = response?.data?.run;

  // ── Determine view type from data ──
  const maskedData: Record<string, unknown>[] = run?.maskedData ?? [];
  const report = run?.report;

  const inputType = report?.pipeline?.inputType ?? "tabular";
  const isDocumentType = inputType === "log" || inputType === "text";
  const isLineBased = maskedData.length > 0 && "line" in maskedData[0] && "content" in maskedData[0];

  // ── FIX: Compute correct default view mode based on data type ──
  const getDefaultViewMode = (): ViewMode => {
    if (isLineBased || isDocumentType) return "document";
    return "table";
  };

  const [viewMode, setViewMode] = useState<ViewMode>("table"); // safe initial, corrected in effect
  const [viewModeInitialized, setViewModeInitialized] = useState(false);

  // Once run data loads, set the correct default view mode
  useEffect(() => {
    if (run && !viewModeInitialized) {
      setViewMode(getDefaultViewMode());
      setViewModeInitialized(true);
    }
  }, [run, viewModeInitialized]);

  // ── local state ──
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [explanationsOpen, setExplanationsOpen] = useState(false);
  const [copiedRow, setCopiedRow] = useState<number | null>(null);
  const [hiddenCols, setHiddenCols] = useState<string[]>([]);
  const [colPanelOpen, setColPanelOpen] = useState(false);

  // ── derived ──
  const allCols = maskedData.length > 0 ? Object.keys(maskedData[0]) : [];
  const visibleCols = allCols.filter(c => !hiddenCols.includes(c));

  const utilityScore = report ? parseFloat(report.utilityPercent) : 0;
  const piiPercent   = report ? parseFloat(report.piiPercent) : 0;
  const risk = (report?.riskScore?.level ?? "low").toLowerCase();

  const inputTypeLabel = inputType === "log" ? "TXT / LOG" : inputType === "text" ? "Plain Text" : inputType.toUpperCase();
  const inputTypeColor = inputType === "log" ? "#60a5fa" : inputType === "text" ? "#f97316" : "#10b981";

  const directPII        = sanitizeBreakdown(report?.breakdown?.directPII);
  const sensitivePII     = sanitizeBreakdown(report?.breakdown?.sensitivePII);
  const quasiIdentifiers = sanitizeBreakdown(report?.breakdown?.quasiIdentifiers);

  const typeCounts = {
    Direct:    sumValues(directPII),
    Sensitive: sumValues(sensitivePII),
    Quasi:     sumValues(quasiIdentifiers),
  };
  const maxType = Math.max(...Object.values(typeCounts), 1);

  const donutData = [
    { name: "Direct PII",    value: typeCounts.Direct    },
    { name: "Sensitive PII", value: typeCounts.Sensitive },
    { name: "Quasi-ID",      value: typeCounts.Quasi     },
  ].filter(d => d.value > 0);
  const totalPii = donutData.reduce((a, b) => a + b.value, 0);

  const barData = [
    ...Object.entries(directPII).map(([k, v])        => ({ field: k, count: Number(v) || 0, type: "Direct"    })),
    ...Object.entries(sensitivePII).map(([k, v])     => ({ field: k, count: Number(v) || 0, type: "Sensitive" })),
    ...Object.entries(quasiIdentifiers).map(([k, v]) => ({ field: k, count: Number(v) || 0, type: "Quasi"     })),
  ];

  const trendData = useMemo(() => {
    if (!report) return [];
    return Array.from({ length: 12 }, (_, i) => ({
      pt: `T${i + 1}`,
      total: Math.round(report.records * (0.6 + 0.4 * Math.sin(i / 3) * Math.random())),
      pii:   Math.round(report.piiFields * (0.5 + 0.5 * Math.cos(i / 3) * Math.random())),
    }));
  }, [report?.records, report?.piiFields]);

  const filtered = useMemo(() => {
    if (!search.trim()) return maskedData;
    const q = search.toLowerCase();
    return maskedData.filter(row => Object.values(row).some(v => String(v ?? "").toLowerCase().includes(q)));
  }, [maskedData, search]);

  const totalPages = Math.ceil(filtered.length / pageSize);
  const pageData   = filtered.slice(page * pageSize, (page + 1) * pageSize);

  function copyRow(text: string, idx: number) {
    navigator.clipboard.writeText(text);
    setCopiedRow(idx);
    setTimeout(() => setCopiedRow(null), 1500);
  }

  function copyRowObj(row: Record<string, unknown>, idx: number) {
    copyRow(JSON.stringify(row, null, 2), idx);
  }

  // ── view tabs — built from data type so always correct ──
  const viewTabs: { mode: ViewMode; label: string; icon: React.ElementType }[] = isLineBased ? [
    { mode: "document", label: "Document", icon: ScrollText },
    { mode: "table",    label: "Table",    icon: Table2 },
    { mode: "json",     label: "JSON",     icon: Braces },
  ] : [
    { mode: "table", label: "Table", icon: Table2 },
    { mode: "json",  label: "JSON",  icon: Braces },
  ];

  // Ensure current viewMode is valid for available tabs
  const validModes = viewTabs.map(t => t.mode);
  const activeViewMode = validModes.includes(viewMode) ? viewMode : validModes[0];

  // ── download options ──
  const downloadOptions = isDocumentType || isLineBased ? [
    { label: "Download TXT",      icon: FileCode2, onClick: () => downloadTXT(maskedData),                                         color: "#60a5fa", desc: "Plain text format" },
    { label: "Download JSON",     icon: Braces,    onClick: () => downloadJSON(maskedData),                                        color: "#8b5cf6", desc: "Structured JSON format" },
    { label: "Download Document", icon: FileText,  onClick: () => run && downloadDocx(maskedData, run._id, run.maskingLevel),      color: "#f97316", desc: "HTML / Word document" },
  ] : [
    { label: "Download CSV",  icon: Download, onClick: () => downloadCSV(maskedData),  color: "#10b981", desc: "Comma-separated values" },
    { label: "Download JSON", icon: Braces,   onClick: () => downloadJSON(maskedData), color: "#8b5cf6", desc: "Structured JSON format" },
  ];

  // ── card base class ──
  const card = "rounded-2xl border border-white/[0.06] bg-[#090d14]/90 backdrop-blur-xl";

  // ── Loading state ──
  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="max-w-7xl mx-auto space-y-5 animate-pulse px-4 sm:px-0">
          <div className="flex items-center gap-3 mb-6">
            <Skeleton className="h-8 w-8 rounded-xl" />
            <Skeleton className="h-6 w-48" />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
          </div>
          <Skeleton className="h-80" />
        </div>
      </DashboardLayout>
    );
  }

  if (!run || !report) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-64 text-center px-4">
          <AlertTriangle className="h-10 w-10 text-amber-400 mb-3" />
          <p className="text-lg font-semibold">Run not found</p>
          <p className="text-sm text-muted-foreground mt-1 mb-5">This run may have been deleted or the ID is invalid.</p>
          <Button variant="outline" onClick={() => navigate("/dashboard")} className="border-white/10">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Dashboard
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-4 pb-10 px-0">

        {/* ── Top nav bar ── */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-1">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => navigate("/dashboard")}
              className="p-2 rounded-xl border border-white/10 text-gray-400 hover:text-white hover:border-white/20 transition-all hover:bg-white/[0.04] shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-[10px] font-mono uppercase tracking-widest text-primary shrink-0">Run detail</p>
                <span className="text-gray-700">·</span>
                <p className="text-[10px] font-mono text-gray-600 truncate">{run._id.slice(-8).toUpperCase()}</p>
              </div>
              <h1 className="text-lg sm:text-2xl font-bold tracking-tight truncate">{run.fileName}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            <span className={cn("text-xs font-mono px-3 py-1.5 rounded-xl border capitalize font-semibold whitespace-nowrap", MASKING_COLORS[run.maskingLevel] ?? "text-gray-400 border-white/10")}>
              {run.maskingLevel} masking
            </span>
            <Button variant="ghost" size="icon" onClick={() => refetch()} disabled={isFetching}
              className="rounded-xl border border-white/10 hover:border-primary/40 hover:bg-primary/5 h-8 w-8 shrink-0">
              <RefreshCw className={cn("h-3.5 w-3.5 text-gray-400", isFetching && "animate-spin text-primary")} />
            </Button>
          </div>
        </div>

        {/* ── Meta bar ── */}
        <div className={cn(card, "px-4 sm:px-5 py-3 flex flex-wrap items-center gap-x-4 gap-y-2 overflow-hidden")}>
          <div className="flex items-center gap-1.5 text-xs font-mono text-gray-500 min-w-0">
            <FileStack className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span className="truncate">{run.fileType}</span>
            <span className="text-gray-700 shrink-0">·</span>
            <span className="shrink-0">{formatBytes(run.fileSize)}</span>
            <span className="text-gray-700 shrink-0">·</span>
            <span className="px-1.5 py-0.5 rounded-md border font-mono text-[10px] shrink-0"
              style={{ color: inputTypeColor, borderColor: `${inputTypeColor}40`, background: `${inputTypeColor}12` }}>
              {inputTypeLabel}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-mono text-gray-500">
            <Clock className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden sm:inline">{formatDate(run.createdAt)}</span>
            <span className="sm:hidden">{timeAgo(run.createdAt)}</span>
            <span className="hidden sm:inline text-gray-700">·</span>
            <span className="hidden sm:inline">{timeAgo(run.createdAt)}</span>
          </div>
          <div className="hidden md:flex items-center gap-1.5 text-xs font-mono text-gray-500 min-w-0 overflow-hidden">
            <Layers className="h-3.5 w-3.5 shrink-0" />
            <div className="min-w-0 overflow-hidden">
              <PipelineSteps steps={report.pipeline.steps} />
            </div>
          </div>
          <div className="ml-auto flex items-center gap-1.5 text-[10px] font-mono text-gray-700 shrink-0">
            <span>v{report.pipeline.version}</span>
            <span>·</span>
            <span>{report.pipeline.inputType}</span>
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
                PII spans detected and masked inline — switch to <strong className="text-blue-300/80">Document</strong> view for a rich, formatted preview with colour-coded masking.
              </p>
            </div>
            <div className="hidden lg:flex flex-col gap-1 shrink-0">
              <MaskLegend />
            </div>
          </div>
        )}

        {/* ── KPI row ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Records",       value: run.recordsProcessed.toLocaleString(), color: "#a78bfa", icon: Database      },
            { label: "Fields Masked", value: run.fieldsMasked.toLocaleString(),     color: "#f97316", icon: Shield        },
            { label: "PII Detected",  value: `${run.piiDetectedPercentage}%`,       color: "#fb7185", icon: AlertTriangle },
            { label: "Utility Score", value: `${run.dataUtilityScore.toFixed(1)}`,  color: "#10b981", icon: Zap           },
          ].map(({ label, value, color, icon: Icon }) => (
            <div key={label} className={cn(card, "p-3.5 sm:p-4 flex items-center gap-3")}>
              <div className="p-2 sm:p-2.5 rounded-xl shrink-0" style={{ background: `${color}12`, border: `1px solid ${color}22` }}>
                <Icon className="h-4 w-4" style={{ color }} />
              </div>
              <div className="min-w-0">
                <p className="text-xl sm:text-2xl font-bold font-mono leading-none truncate" style={{ color }}>{value}</p>
                <p className="text-[10px] sm:text-[11px] text-gray-600 mt-0.5 tracking-wide truncate">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Row 2: Area + Quality ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-4">
          <div className={cn(card, "p-4 sm:p-5 min-w-0")}>
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="h-4 w-4 text-emerald-400 shrink-0" />
              <h3 className="text-sm font-semibold tracking-tight">Field Detection Trend</h3>
            </div>
            <div className="w-full overflow-hidden">
              <ResponsiveContainer width="100%" height={190}>
                <AreaChart data={trendData} margin={{ top: 0, right: 0, bottom: 0, left: -22 }}>
                  <defs>
                    <linearGradient id="rG1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="rG2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#f97316" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#111820" vertical={false} />
                  <XAxis dataKey="pt" tick={{ fontSize: 10, fill: "#374151" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#374151" }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="total" name="Total" stroke="#10b981" strokeWidth={2}
                    fill="url(#rG1)" dot={false} activeDot={{ r: 3, fill: "#10b981" }} />
                  <Area type="monotone" dataKey="pii"   name="PII"   stroke="#f97316" strokeWidth={2}
                    fill="url(#rG2)" dot={false} activeDot={{ r: 3, fill: "#f97316" }} />
                  <Legend iconType="circle" iconSize={6} wrapperStyle={{ fontSize: 11, paddingTop: 10, color: "#6b7280" }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className={cn(card, "p-4 sm:p-5 flex flex-col")}>
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle className="h-4 w-4 text-amber-400" />
              <h3 className="text-sm font-semibold tracking-tight">Utility Score</h3>
            </div>
            <div className="flex-1 flex items-center justify-center py-2">
              <QualityGauge score={utilityScore} />
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <StatPill label="Records"    value={report.records.toLocaleString()} color="#a78bfa" />
              <StatPill label="PII Fields" value={String(report.piiFields)}        color="#f97316" />
              <StatPill label="PII %"      value={`${piiPercent.toFixed(1)}%`}     color="#fb7185" />
              <StatPill label="Utility %"  value={`${utilityScore.toFixed(1)}%`}   color="#10b981" />
            </div>
          </div>
        </div>

        {/* ── Row 3: Bar + Donut ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4">
          <div className={cn(card, "p-4 sm:p-5 min-w-0")}>
            <div className="flex items-center gap-2 mb-4">
              <GitBranch className="h-4 w-4 text-violet-400 shrink-0" />
              <h3 className="text-sm font-semibold tracking-tight">Fields by Category</h3>
            </div>
            <div className="w-full overflow-hidden">
              <ResponsiveContainer width="100%" height={190}>
                <BarChart data={barData} margin={{ top: 0, right: 4, bottom: 0, left: -12 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#111820" vertical={false} />
                  <XAxis dataKey="field" tick={{ fontSize: 10, fill: "#4b5563" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#4b5563" }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" name="Count" radius={[5, 5, 0, 0]}>
                    {barData.map((e, i) => (
                      <Cell key={i} fill={e.type === "Direct" ? "#f97316" : e.type === "Sensitive" ? "#facc15" : "#60a5fa"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className={cn(card, "p-4 sm:p-5")}>
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
              <h3 className="text-sm font-semibold tracking-tight">PII Breakdown</h3>
            </div>
            <div className="flex items-center justify-center">
              <ResponsiveContainer width="100%" height={150}>
                <PieChart>
                  <Pie data={donutData} cx="50%" cy="50%" innerRadius={46} outerRadius={68}
                    paddingAngle={2} dataKey="value" strokeWidth={0}>
                    {donutData.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />)}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2">
              {donutData.map((d, i) => (
                <div key={d.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: DONUT_COLORS[i] }} />
                    <span className="text-gray-400 truncate">{d.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="font-mono font-bold" style={{ color: DONUT_COLORS[i] }}>{d.value}</span>
                    <span className="text-gray-600 font-mono text-[10px]">
                      ({totalPii > 0 ? ((d.value / totalPii) * 100).toFixed(1) : "0.0"}%)
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-white/[0.05]">
              <span className={cn("text-[10px] px-2 py-1 rounded-lg border font-mono font-semibold capitalize", RISK_COLORS[risk] ?? "text-gray-500")}>
                Risk: {report.riskScore.level} · {report.riskScore.score.toFixed(2)}
              </span>
              <p className="text-[10px] text-gray-600 mt-1.5 leading-relaxed line-clamp-3">{report.riskScore.reason}</p>
            </div>
          </div>
        </div>

        {/* ── Row 4: PII type bars ── */}
        <div className={cn(card, "p-4 sm:p-5")}>
          <div className="flex items-center gap-2 mb-4">
            <Shield className="h-4 w-4 text-primary shrink-0" />
            <h3 className="text-sm font-semibold tracking-tight">PII by Type</h3>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <TypeBar label="Direct PII"        count={typeCounts.Direct}    max={maxType}            color="#fb7185" icon="🛡️" />
            <TypeBar label="Sensitive PII"     count={typeCounts.Sensitive} max={maxType}            color="#f97316" icon="🔥" />
            <TypeBar label="Quasi-Identifiers" count={typeCounts.Quasi}     max={maxType}            color="#60a5fa" icon="⚡" />
            <TypeBar label="Total Fields"      count={report.totalFields}   max={report.totalFields} color="#10b981" icon="🗄️" />
          </div>
        </div>

        {/* ── Row 5: Masked Data Table / Document View ── */}
        <div className={cn(card, "overflow-hidden")}>

          {/* Toolbar */}
          <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-white/[0.05] flex flex-col gap-2 sm:gap-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                <Database className="h-4 w-4 text-emerald-400 shrink-0" />
                <h3 className="text-sm font-semibold tracking-tight">Masked Data</h3>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-white/[0.04] text-gray-500 border border-white/[0.05] shrink-0">
                  {maskedData.length} rows
                </span>
                {isLineBased && (
                  <span className="text-[10px] px-2 py-0.5 rounded-md border border-blue-400/30 bg-blue-400/10 text-blue-400 font-mono shrink-0 hidden sm:inline">
                    line-by-line
                  </span>
                )}
              </div>

              {/* View mode tabs */}
              <div className="flex rounded-lg border border-white/10 overflow-hidden shrink-0">
                {viewTabs.map(({ mode, label, icon: Icon }) => (
                  <button key={mode}
                    onClick={() => setViewMode(mode)}
                    className={cn(
                      "px-2.5 sm:px-3 py-2 text-[10px] sm:text-xs flex items-center gap-1 sm:gap-1.5 transition-colors border-l border-white/10 first:border-l-0 whitespace-nowrap",
                      activeViewMode === mode ? "bg-primary/20 text-primary" : "text-gray-500 hover:bg-white/5 hover:text-gray-300"
                    )}>
                    <Icon className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0" />
                    <span className="hidden sm:inline">{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Search + page size — hidden in document mode */}
            {activeViewMode !== "document" && (
              <div className="flex gap-2 items-center">
                <div className="relative flex-1 min-w-0">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-600 pointer-events-none" />
                  <input value={search} onChange={e => { setSearch(e.target.value); setPage(0); }}
                    placeholder="Search records…"
                    className="pl-8 pr-3 py-2 text-xs rounded-lg border border-white/[0.08] bg-white/[0.025] w-full focus:outline-none focus:border-primary/40 transition-colors text-gray-300 placeholder:text-gray-700" />
                </div>
                <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(0); }}
                  className="px-2 sm:px-3 py-2 text-xs rounded-lg border border-white/[0.08] bg-[#090d14] focus:outline-none text-gray-400 cursor-pointer shrink-0">
                  {[10, 25, 50].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            )}

            {/* Mask legend in document mode */}
            {activeViewMode === "document" && (
              <div className="flex items-start gap-2 flex-wrap">
                <span className="text-[10px] text-gray-600 font-mono shrink-0 mt-0.5">Legend:</span>
                <MaskLegend />
              </div>
            )}
          </div>

          {/* Column toggle for tabular non-line-based */}
          {activeViewMode === "table" && !isLineBased && allCols.length > 0 && (
            <div className="px-4 sm:px-5 py-2 border-b border-white/[0.04] flex flex-col gap-1.5">
              <button onClick={() => setColPanelOpen(v => !v)}
                className="sm:hidden flex items-center gap-1.5 text-[11px] font-mono text-gray-600">
                <Eye className="h-3 w-3" />
                Columns ({allCols.length - hiddenCols.length}/{allCols.length})
                {colPanelOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>
              <div className={cn("flex flex-wrap gap-1.5", !colPanelOpen && "hidden sm:flex")}>
                <span className="text-[10px] font-mono text-gray-700 mr-1 self-center hidden sm:inline">Cols:</span>
                {allCols.map(col => (
                  <button key={col}
                    onClick={() => setHiddenCols(prev => prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col])}
                    className={cn("inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border transition-colors",
                      hiddenCols.includes(col) ? "border-white/[0.05] text-gray-700" : "border-primary/25 text-primary bg-primary/8")}>
                    {hiddenCols.includes(col) ? <EyeOff className="h-2.5 w-2.5" /> : <Eye className="h-2.5 w-2.5" />}
                    {col}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Document View ── */}
          {activeViewMode === "document" ? (
            maskedData.length === 0 ? (
              <EmptyState icon={ScrollText} title="No document data" desc="No line-based content was found for this run." />
            ) : (
              <div className="overflow-auto max-h-[600px]">
                <DocumentView result={maskedData} onCopy={copyRow} />
              </div>
            )

          /* ── JSON View ── */
          ) : activeViewMode === "json" ? (
            maskedData.length === 0 ? (
              <EmptyState icon={Braces} title="No data" desc="No masked records are available for this run." />
            ) : (
              <div className="overflow-auto max-h-[400px] p-4 sm:p-5">
                <pre className="text-[10px] sm:text-xs font-mono text-gray-500 leading-relaxed whitespace-pre-wrap break-all">
                  {JSON.stringify(pageData, null, 2)}
                </pre>
              </div>
            )

          /* ── Line-based Table View ── */
          ) : isLineBased ? (
            maskedData.length === 0 ? (
              <EmptyState icon={Table2} title="No records" desc="No masked records found." />
            ) : (
              <div className="overflow-auto max-h-[500px]">
                <table className="w-full text-xs min-w-[400px]">
                  <thead className="sticky top-0 z-10 bg-[#090d14]">
                    <tr className="border-b border-white/[0.05] text-left">
                      <th className="px-4 sm:px-5 py-3 w-14 font-mono text-[10px] uppercase tracking-widest text-gray-700">Line</th>
                      <th className="px-4 sm:px-5 py-3 font-mono text-[10px] uppercase tracking-widest text-gray-700">Content</th>
                      <th className="px-4 sm:px-5 py-3 w-12 text-right font-mono text-[10px] uppercase tracking-widest text-gray-700">Copy</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageData.map((row, i) => {
                      const lineNum = Number(row.line ?? (page * pageSize + i + 1));
                      const content = String(row.content ?? "");
                      const hasMasked = /\[REDACTED\]|\[MASKED\]|\[ADDRESS REDACTED\]|\*+|XXXX|User_/.test(content);
                      return (
                        <tr key={i} className={cn("border-b border-white/[0.03] last:border-0 transition-colors",
                          hasMasked ? "hover:bg-amber-400/5" : "hover:bg-white/[0.025]")}>
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
            )

          /* ── Standard Tabular View ── */
          ) : maskedData.length === 0 ? (
            <EmptyState icon={Database} title="No records" desc="No masked records were found for this run." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[500px]">
                <thead className="sticky top-0 z-10 bg-[#090d14]">
                  <tr className="border-b border-white/[0.05] text-left">
                    <th className="px-4 sm:px-5 py-3 w-10 font-mono text-[10px] uppercase tracking-widest text-gray-700">#</th>
                    {visibleCols.map(col => (
                      <th key={col} className="px-4 sm:px-5 py-3 font-mono text-[10px] uppercase tracking-widest text-gray-700 whitespace-nowrap">{col}</th>
                    ))}
                    <th className="px-4 sm:px-5 py-3 text-right font-mono text-[10px] uppercase tracking-widest text-gray-700">Copy</th>
                  </tr>
                </thead>
                <tbody>
                  {pageData.map((row, i) => (
                    <tr key={i} className="border-b border-white/[0.03] last:border-0 hover:bg-white/[0.025] transition-colors">
                      <td className="px-4 sm:px-5 py-3 text-gray-700 font-mono">{page * pageSize + i + 1}</td>
                      {visibleCols.map(col => (
                        <td key={col} className="px-4 sm:px-5 py-3 font-mono text-gray-400 whitespace-nowrap max-w-[200px] truncate">{String(row[col] ?? "—")}</td>
                      ))}
                      <td className="px-4 sm:px-5 py-3 text-right">
                        <button onClick={() => copyRowObj(row, i)}
                          className="p-1.5 rounded-md hover:bg-primary/10 text-gray-600 hover:text-primary transition-colors">
                          {copiedRow === i ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination — hidden in document mode */}
          {activeViewMode !== "document" && maskedData.length > 0 && (
            <div className="px-4 sm:px-5 py-3 border-t border-white/[0.05] flex items-center justify-between gap-2">
              <span className="text-[10px] sm:text-xs text-gray-600 font-mono">
                {filtered.length} records · page {page + 1} / {Math.max(1, totalPages)}
              </span>
              <div className="flex gap-1.5">
                <Button size="sm" variant="outline" onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0} className="h-7 px-2.5 text-[10px] border-white/10 hover:border-white/20">← Prev</Button>
                <Button size="sm" variant="outline" onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1} className="h-7 px-2.5 text-[10px] border-white/10 hover:border-white/20">Next →</Button>
              </div>
            </div>
          )}
        </div>

        {/* ── Download ── */}
        <div className={cn(card, "p-4 sm:p-5")}>
          <h3 className="text-sm font-semibold tracking-tight mb-0.5">Export Masked Data</h3>
          <p className="text-xs text-gray-600 mb-4">Download your privacy-protected dataset in your preferred format</p>
          <div className={cn("grid gap-2.5", downloadOptions.length === 3 ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-1 sm:grid-cols-2")}>
            {downloadOptions.map(({ label, icon: Icon, onClick, color, desc }) => (
              <button key={label} onClick={onClick}
                className="flex items-center gap-3 px-4 py-3.5 rounded-xl border border-white/[0.07] text-left hover:border-white/[0.14] hover:bg-white/[0.03] transition-all group">
                <div className="p-2.5 rounded-xl shrink-0" style={{ background: `${color}10`, border: `1px solid ${color}20` }}>
                  <Icon className="h-4 w-4" style={{ color }} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-gray-300 group-hover:text-white transition-colors truncate">{label}</p>
                  <p className="text-[10px] text-gray-600 truncate">{desc}</p>
                </div>
              </button>
            ))}
          </div>
          {(isDocumentType || isLineBased) && (
            <p className="text-[10px] text-gray-700 mt-2.5 font-mono">
              📄 "Download Document" exports a richly formatted HTML file — open directly in Microsoft Word, LibreOffice, or any browser.
            </p>
          )}
        </div>

        {/* ── Explanations ── */}
        <div className={cn(card, "overflow-hidden")}>
          <button onClick={() => setExplanationsOpen(v => !v)}
            className="w-full flex items-center justify-between px-4 sm:px-6 py-4 hover:bg-white/[0.02] transition-colors">
            <div className="flex items-center gap-2.5 min-w-0">
              <Shield className="h-4 w-4 text-primary shrink-0" />
              <span className="text-sm font-semibold tracking-tight">Masking Explanations</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20 font-mono shrink-0">
                {Object.keys(report.explanations).length} fields
              </span>
            </div>
            {explanationsOpen
              ? <ChevronUp className="h-4 w-4 text-gray-600 shrink-0" />
              : <ChevronDown className="h-4 w-4 text-gray-600 shrink-0" />}
          </button>

          {explanationsOpen && (
            <div className="px-4 sm:px-6 pb-5 border-t border-white/[0.05] pt-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {Object.entries(sanitizeExplanations(report.explanations)).map(([field, note]) => (
                <div key={field} className="flex gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                  <div className="mt-0.5 h-5 w-5 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                    <Shield className="h-3 w-3 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold font-mono text-primary capitalize mb-0.5 truncate">{field}</p>
                    <p className="text-[11px] text-gray-500 leading-relaxed">{note}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="px-4 sm:px-6 py-3 border-t border-white/[0.04] flex flex-wrap items-center gap-2.5">
            <span className={cn("text-[10px] px-2.5 py-1 rounded-lg border font-mono font-semibold capitalize shrink-0", RISK_COLORS[risk] ?? "text-gray-500")}>
              {report.riskScore.level} risk · {report.riskScore.score.toFixed(2)}
            </span>
            <span className="text-[10px] text-gray-600 leading-relaxed">{report.riskScore.reason}</span>
          </div>
        </div>

        {/* ── Utility note + pipeline meta ── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-1">
          <p className="text-[10px] font-mono text-gray-700 leading-relaxed">{report.utilityNote}</p>
          <div className="flex flex-wrap gap-1.5 text-[9px] sm:text-[10px] font-mono text-gray-700 shrink-0">
            <span>v{report.pipeline.version}</span>
            <span>·</span>
            <span>masking: {run.maskingLevel}</span>
            <span>·</span>
            <span>input: {report.pipeline.inputType}</span>
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
}