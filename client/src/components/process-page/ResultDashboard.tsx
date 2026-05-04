import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Upload, FileText, ChevronDown, ChevronUp,
  Download, Shield, Database, BarChart3, AlertTriangle,
  Search, Copy, Check, Table2, Braces, Clock, Eye, EyeOff,
  GitBranch, CheckCircle, LayoutDashboard, ArrowRight,
  Sparkles, FileType2, FileCode2, ScrollText,
} from "lucide-react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
  AreaChart, Area,
} from "recharts";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DONUT_COLORS, RISK_COLORS } from "./utils/constants";
import { downloadCSV, downloadJSON, downloadTXT, downloadXLSX, downloadDocx } from "./Download";
import { CustomTooltip } from "./CustomToolTip";
import { QualityGauge } from "./QualityGuage";
import { TypeBar } from "./TypeBar";
import { MaskLegend } from "./MaskLegend";
import { MaskedInline } from "./MaskedInline";
import { DocumentView } from "./DocumentView";
import type { PipelineData, ViewMode } from "../../types/process-page";

interface Props {
  data: PipelineData;
  elapsed: number;
  onReset: () => void;
}

// ─── Sanitization helpers ─────────────────────────────────────────────────────

const BAD_KEY_RE = /^\[object\s+Object\]$/i;

/**
 * Strips keys that are "[object Object]", empty strings, or other
 * serialisation artefacts from a breakdown map.
 * Any numeric value carried by a bad key is re-bucketed under "other"
 * so the count is never silently lost.
 */
function sanitizeBreakdown(
  obj: Record<string, number> | undefined
): Record<string, number> {
  if (!obj) return {};
  const cleaned: Record<string, number> = {};
  let orphaned = 0;
  for (const [k, v] of Object.entries(obj)) {
    const num = Number(v) || 0;
    if (!k || BAD_KEY_RE.test(k)) {
      orphaned += num;
    } else {
      cleaned[k] = (cleaned[k] ?? 0) + num;
    }
  }
  if (orphaned > 0) cleaned["other"] = (cleaned["other"] ?? 0) + orphaned;
  return cleaned;
}

/**
 * Same treatment for the explanations map — removes "[object Object]" keys
 * and merges them under a single "other" entry.
 */
function sanitizeExplanations(
  obj: Record<string, string>
): Record<string, string> {
  const cleaned: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (!k || BAD_KEY_RE.test(k)) {
      if (!cleaned["other"]) cleaned["other"] = v; // keep first occurrence
    } else {
      cleaned[k] = v;
    }
  }
  return cleaned;
}

const sumValues = (obj: Record<string, number>): number =>
  Object.values(obj).reduce((acc, v) => acc + (Number(v) || 0), 0);

// ─────────────────────────────────────────────────────────────────────────────

export function ResultDashboard({ data, elapsed, onReset }: Props) {
  const navigate = useNavigate();

  const { report, result, runId, maskingLevel } = data;

  const isLineBased = result.length > 0 && "line" in result[0] && "content" in result[0];
  const inputType = report.pipeline?.inputType ?? "tabular";
  const isDocumentType = inputType === "log" || inputType === "text";

  const [viewMode, setViewMode] = useState<ViewMode>(() => isLineBased ? "document" : "table");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [explanationsOpen, setExplanationsOpen] = useState(false);
  const [copiedRow, setCopiedRow] = useState<number | null>(null);
  const [hiddenCols, setHiddenCols] = useState<string[]>([]);
  const [colPanelOpen, setColPanelOpen] = useState(false);

  const risk = report.riskScore.level.toLowerCase();
  const allCols = result.length > 0 ? Object.keys(result[0]) : [];

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

  // ── Sanitize breakdown data before any use ──────────────────────────────────
  const rawBreakdown = report.breakdown ?? {};
  const directPII        = sanitizeBreakdown(rawBreakdown.directPII);
  const sensitivePII     = sanitizeBreakdown(rawBreakdown.sensitivePII);
  const quasiIdentifiers = sanitizeBreakdown(rawBreakdown.quasiIdentifiers);
  const cleanExplanations = sanitizeExplanations(report.explanations ?? {});
  // ───────────────────────────────────────────────────────────────────────────

  const utilityScore = parseFloat(report.utilityPercent);
  const piiPercent = parseFloat(report.piiPercent);
  const qualityLabel = utilityScore >= 70 ? "Good shape" : utilityScore >= 40 ? "Needs work" : "High risk";

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
    const steps = 12;
    return Array.from({ length: steps }, (_, i) => ({
      date: `T ${i + 1}`,
      total: Math.round(report.records * (0.6 + 0.4 * Math.sin(i / 3) * Math.random())),
      pii:   Math.round(report.piiFields * (0.5 + 0.5 * Math.cos(i / 3) * Math.random())),
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

  const viewTabs: { mode: ViewMode; label: string; icon: React.ElementType }[] = isLineBased ? [
    { mode: "document", label: "Document", icon: ScrollText },
    { mode: "table",    label: "Table",    icon: Table2 },
    { mode: "json",     label: "JSON",     icon: Braces },
  ] : [
    { mode: "table", label: "Table", icon: Table2 },
    { mode: "json",  label: "JSON",  icon: Braces },
  ];

  const downloadOptions = isDocumentType || isLineBased ? [
    { label: "Download TXT",      icon: FileCode2, onClick: () => downloadTXT(result),                          color: "#60a5fa" },
    { label: "Download JSON",     icon: Braces,    onClick: () => downloadJSON(result),                         color: "#8b5cf6" },
    { label: "Download Document", icon: FileText,  onClick: () => downloadDocx(result, runId, maskingLevel),    color: "#f97316" },
  ] : [
    { label: "Download CSV",  icon: Download, onClick: () => downloadCSV(result),  color: "#10b981" },
    { label: "Download JSON", icon: Braces,   onClick: () => downloadJSON(result), color: "#8b5cf6" },
    { label: "Download XLSX", icon: Table2,   onClick: () => downloadXLSX(result), color: "#60a5fa" },
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
            <span
              className="text-[10px] px-2 py-0.5 rounded-md border font-mono font-medium"
              style={{ color: inputTypeColor, borderColor: `${inputTypeColor}40`, background: `${inputTypeColor}12` }}
            >
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
          <button
            onClick={() => navigate("/dashboard")}
            className={cn(
              "inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold",
              "bg-gradient-primary text-primary-foreground btn-glow shadow-glow-primary",
              "transition-transform hover:scale-105 active:scale-95 whitespace-nowrap"
            )}
          >
            <LayoutDashboard className="h-4 w-4 shrink-0" />View Dashboard<Sparkles className="h-3.5 w-3.5 shrink-0 opacity-70" />
          </button>
          <Button
            variant="outline"
            size="sm"
            onClick={onReset}
            className="border-white/10 hover:border-primary/50 text-xs sm:text-sm h-auto py-2.5 px-4 rounded-xl"
          >
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
                  <stop offset="5%"  stopColor="#10b981" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="piiGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#f97316" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2530" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#4b5563" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#4b5563" }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="total" name="Total Fields" stroke="#10b981" strokeWidth={2} fill="url(#totalGrad)" dot={false} activeDot={{ r: 4, fill: "#10b981" }} />
              <Area type="monotone" dataKey="pii"   name="PII Fields"   stroke="#f97316" strokeWidth={2} fill="url(#piiGrad)"   dot={false} activeDot={{ r: 4, fill: "#f97316" }} />
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
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: DONUT_COLORS[i] }} />
                  <span className="text-gray-400 truncate">{d.name}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
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
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <Database className="h-4 w-4 text-emerald-400 shrink-0" />
              <h3 className="text-sm font-semibold">Masked Data Preview</h3>
              {isLineBased && (
                <span className="text-[10px] px-2 py-0.5 rounded-md border border-blue-400/30 bg-blue-400/10 text-blue-400 font-mono hidden sm:inline">
                  line-by-line
                </span>
              )}
            </div>
            <div className="flex rounded-lg border border-white/10 overflow-hidden shrink-0">
              {viewTabs.map(({ mode, label, icon: Icon }) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={cn(
                    "px-2.5 sm:px-3 py-2 text-[10px] sm:text-xs flex items-center gap-1 sm:gap-1.5 transition-colors border-l border-white/10 first:border-l-0 whitespace-nowrap",
                    viewMode === mode
                      ? "bg-primary/20 text-primary"
                      : "text-gray-500 hover:bg-white/5 hover:text-gray-300"
                  )}
                >
                  <Icon className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0" />
                  <span className="hidden sm:inline">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {viewMode !== "document" && (
            <div className="flex gap-2 items-center">
              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-600 pointer-events-none" />
                <input
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(0); }}
                  placeholder="Search records…"
                  className="pl-8 pr-3 py-2 text-xs rounded-lg border border-white/10 bg-white/[0.03] w-full focus:outline-none focus:border-primary/50 transition-colors text-gray-300 placeholder:text-gray-600"
                />
              </div>
              <select
                value={pageSize}
                onChange={e => { setPageSize(Number(e.target.value)); setPage(0); }}
                className="px-2 sm:px-3 py-2 text-xs rounded-lg border border-white/10 bg-[#0d1117] focus:outline-none focus:border-primary/50 cursor-pointer shrink-0 text-gray-300"
              >
                {[10, 25, 50].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          )}

          {viewMode === "document" && (
            <div className="flex items-start gap-2 flex-wrap">
              <span className="text-[10px] text-gray-600 font-mono shrink-0 mt-0.5">Legend:</span>
              <MaskLegend />
            </div>
          )}
        </div>

        {/* Column toggle for tabular non-line-based */}
        {viewMode === "table" && !isLineBased && allCols.length > 0 && (
          <div className="px-4 sm:px-5 py-2 border-b border-white/[0.04]">
            <button
              onClick={() => setColPanelOpen(v => !v)}
              className="sm:hidden flex items-center gap-1.5 text-[11px] font-mono text-gray-600 mb-1"
            >
              <Eye className="h-3 w-3" />Columns ({allCols.length - hiddenCols.length}/{allCols.length})
              {colPanelOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
            <div className={cn("flex flex-wrap gap-1.5", !colPanelOpen && "hidden sm:flex")}>
              <span className="text-[11px] font-mono text-gray-600 mr-1 self-center hidden sm:inline">Columns:</span>
              {allCols.map(col => (
                <button
                  key={col}
                  onClick={() => toggleCol(col)}
                  className={cn(
                    "inline-flex items-center gap-1 text-[10px] sm:text-[11px] px-1.5 sm:px-2 py-0.5 rounded border transition-colors",
                    hiddenCols.includes(col)
                      ? "border-white/5 text-gray-600 bg-transparent"
                      : "border-primary/30 text-primary bg-primary/10"
                  )}
                >
                  {hiddenCols.includes(col) ? <EyeOff className="h-2.5 w-2.5" /> : <Eye className="h-2.5 w-2.5" />}{col}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Document View ── */}
        {viewMode === "document" ? (
          <div className="overflow-auto max-h-[600px]">
            <DocumentView result={result} onCopy={copyRow} />
          </div>

        /* ── JSON View ── */
        ) : viewMode === "json" ? (
          <div className="overflow-auto max-h-[400px] sm:max-h-[500px] p-3 sm:p-5">
            <pre className="text-[10px] sm:text-xs font-mono text-gray-500 leading-relaxed whitespace-pre-wrap break-all">
              {JSON.stringify(pageData, null, 2)}
            </pre>
          </div>

        /* ── Line table view for TXT/DOCX ── */
        ) : isLineBased ? (
          <div className="overflow-auto max-h-[500px]">
            <table className="w-full text-xs min-w-[400px]">
              <thead className="sticky top-0 z-10 bg-[#0d1117]">
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
                    <tr
                      key={i}
                      className={cn(
                        "border-b border-white/[0.04] last:border-0 transition-colors",
                        hasMasked ? "hover:bg-amber-400/5" : "hover:bg-white/[0.03]"
                      )}
                    >
                      <td className="px-4 sm:px-5 py-3 font-mono text-gray-600 text-[10px] align-top tabular-nums">{lineNum}</td>
                      <td className="px-4 sm:px-5 py-3 font-mono text-gray-300 break-all leading-relaxed">
                        <MaskedInline content={content} />
                      </td>
                      <td className="px-4 sm:px-5 py-3 text-right align-top">
                        <button
                          onClick={() => copyRowObj(row, i)}
                          className="p-1.5 rounded-md hover:bg-primary/10 text-gray-600 hover:text-primary transition-colors"
                        >
                          {copiedRow === i ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

        /* ── Standard tabular view ── */
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[500px]">
              <thead className="sticky top-0 z-10 bg-[#0d1117]">
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
                      <td key={col} className="px-4 sm:px-5 py-3 font-mono text-gray-400 whitespace-nowrap max-w-[180px] truncate">{String(row[col] ?? "—")}</td>
                    ))}
                    <td className="px-4 sm:px-5 py-3 text-right">
                      <button
                        onClick={() => copyRowObj(row, i)}
                        className="p-1.5 rounded-md hover:bg-primary/10 text-gray-600 hover:text-primary transition-colors"
                      >
                        {copiedRow === i ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
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
            <button
              key={label}
              onClick={onClick}
              className="flex items-center justify-center gap-2 sm:gap-2.5 px-4 sm:px-5 py-3 sm:py-3.5 rounded-xl border border-white/10 text-gray-400 text-xs sm:text-sm font-medium transition-all hover:scale-[1.02] hover:border-white/20 hover:bg-white/[0.04] active:scale-[0.98]"
            >
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
        <button
          onClick={() => navigate("/dashboard")}
          className={cn(
            "inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold shrink-0 w-full sm:w-auto justify-center",
            "bg-gradient-primary text-primary-foreground btn-glow shadow-glow-primary transition-transform hover:scale-105 active:scale-95"
          )}
        >
          <LayoutDashboard className="h-4 w-4" />Go to Dashboard<ArrowRight className="h-4 w-4" />
        </button>
      </div>

      {/* ── Explanations panel ── */}
      <div className={cn(cardBase, "overflow-hidden")}>
        <button
          onClick={() => setExplanationsOpen(v => !v)}
          className="w-full flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 hover:bg-white/[0.03] transition-colors"
        >
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <Shield className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary shrink-0" />
            <span className="text-xs sm:text-sm font-semibold text-left">How your data was masked</span>
            <span className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-mono shrink-0">
              {Object.keys(cleanExplanations).length}
            </span>
          </div>
          {explanationsOpen
            ? <ChevronUp className="h-4 w-4 text-gray-600 shrink-0" />
            : <ChevronDown className="h-4 w-4 text-gray-600 shrink-0" />}
        </button>

        {explanationsOpen && (
          <div className="px-4 sm:px-6 pb-4 sm:pb-5 border-t border-white/5 pt-3 sm:pt-4 grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 animate-fade-in">
            {Object.entries(cleanExplanations).map(([field, note]) => (
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