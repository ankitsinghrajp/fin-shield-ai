import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Shield, Database, BarChart3, AlertTriangle,
  Download, Braces, Table2, Copy, Check, Clock, Search,
  ChevronDown, ChevronUp, Eye, EyeOff, GitBranch,
  CheckCircle, FileStack, Layers, Zap, RefreshCw,
} from "lucide-react";
import { useState, useMemo } from "react";
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
  pipeline: { steps: string[]; inputType: string; version: string };
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

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

const CustomTooltip = ({ active, payload, label }: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#080c12", border: "1px solid #1a2030", borderRadius: 10, padding: "8px 14px", fontSize: 11 }}>
      {label && <p style={{ color: "#4b5563", marginBottom: 4, fontFamily: "monospace", letterSpacing: "0.05em" }}>{label}</p>}
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color, fontFamily: "monospace" }}>{p.name}: <strong>{p.value}</strong></p>
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

// ─── Type Bar ────────────────────────────────────────────────────────────────

function TypeBar({ label, count, max, color, icon }: { label: string; count: number; max: number; color: string; icon: string }) {
  const pct = max > 0 ? (count / max) * 100 : 0;
  return (
    <div className="p-4 rounded-xl border border-white/[0.05] bg-white/[0.02]">
      <div className="flex items-center gap-2.5 mb-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0" style={{ background: `${color}18` }}>
          {icon}
        </div>
        <div>
          <p className="text-[11px] text-gray-500 font-medium tracking-wide">{label}</p>
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

// ─── Skeleton ────────────────────────────────────────────────────────────────

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

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export default function RunDetailPage() {
  const { runId } = useParams<{ runId: string }>();
  const navigate = useNavigate();

  const { data: response, isLoading, isFetching, refetch } = useGetRunByIdQuery(runId);

  const run: Run | undefined = response?.data?.run;

  // ── local state ──
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [viewMode, setViewMode] = useState<"table" | "json">("table");
  const [explanationsOpen, setExplanationsOpen] = useState(false);
  const [copiedRow, setCopiedRow] = useState<number | null>(null);
  const [hiddenCols, setHiddenCols] = useState<string[]>([]);
  const [colPanelOpen, setColPanelOpen] = useState(false);

  // ── derived ──
  const report = run?.report;
  const maskedData: Record<string, unknown>[] = run?.maskedData ?? [];
  const allCols = maskedData.length > 0 ? Object.keys(maskedData[0]) : [];
  const visibleCols = allCols.filter(c => !hiddenCols.includes(c));

  const utilityScore = report ? parseFloat(report.utilityPercent) : 0;
  const piiPercent   = report ? parseFloat(report.piiPercent) : 0;
  const risk = (report?.riskScore?.level ?? "low").toLowerCase();

  const directPII        = report?.breakdown?.directPII        ?? {};
  const sensitivePII     = report?.breakdown?.sensitivePII     ?? {};
  const quasiIdentifiers = report?.breakdown?.quasiIdentifiers ?? {};

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

  function copyRow(row: Record<string, unknown>, idx: number) {
    navigator.clipboard.writeText(JSON.stringify(row, null, 2));
    setCopiedRow(idx); setTimeout(() => setCopiedRow(null), 1500);
  }

  // ── card base class ──
  const card = "rounded-2xl border border-white/[0.06] bg-[#090d14]/90 backdrop-blur-xl";

  // ── Loading state ──
  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="max-w-7xl mx-auto space-y-5 animate-pulse">
          <div className="flex items-center gap-3 mb-6">
            <Skeleton className="h-8 w-8 rounded-xl" />
            <Skeleton className="h-6 w-48" />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
        <div className="flex flex-col items-center justify-center h-64 text-center">
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
      <div className="max-w-7xl mx-auto space-y-5 pb-10">

        {/* ── Top nav bar ── */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-2">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/dashboard")}
              className="p-2 rounded-xl border border-white/10 text-gray-400 hover:text-white hover:border-white/20 transition-all hover:bg-white/[0.04]"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-[10px] font-mono uppercase tracking-widest text-primary">Run detail</p>
                <span className="text-gray-700">·</span>
                <p className="text-[10px] font-mono text-gray-600">{run._id.slice(-8).toUpperCase()}</p>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight truncate max-w-[300px] sm:max-w-none">{run.fileName}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            {/* Masking badge */}
            <span className={cn("text-xs font-mono px-3 py-1.5 rounded-xl border capitalize font-semibold", MASKING_COLORS[run.maskingLevel] ?? "text-gray-400 border-white/10")}>
              {run.maskingLevel} masking
            </span>
            <Button variant="ghost" size="icon" onClick={() => refetch()} disabled={isFetching}
              className="rounded-xl border border-white/10 hover:border-primary/40 hover:bg-primary/5 h-8 w-8">
              <RefreshCw className={cn("h-3.5 w-3.5 text-gray-400", isFetching && "animate-spin text-primary")} />
            </Button>
          </div>
        </div>

        {/* ── Meta bar ── */}
        <div className={cn(card, "px-4 sm:px-6 py-3 flex flex-wrap items-center gap-x-5 gap-y-2")}>
          <div className="flex items-center gap-1.5 text-xs font-mono text-gray-500">
            <FileStack className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span>{run.fileType}</span>
            <span className="text-gray-700">·</span>
            <span>{formatBytes(run.fileSize)}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-mono text-gray-500">
            <Clock className="h-3.5 w-3.5 shrink-0" />
            <span>{formatDate(run.createdAt)}</span>
            <span className="text-gray-700">·</span>
            <span>{timeAgo(run.createdAt)}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-mono text-gray-500">
            <Layers className="h-3.5 w-3.5 shrink-0" />
            <PipelineSteps steps={report.pipeline.steps} />
          </div>
          <div className="ml-auto flex items-center gap-1.5 text-[10px] font-mono text-gray-700">
            <span>v{report.pipeline.version}</span>
            <span>·</span>
            <span>{report.pipeline.inputType}</span>
          </div>
        </div>

        {/* ── KPI row ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Records",      value: run.recordsProcessed.toLocaleString(), color: "#a78bfa", icon: Database  },
            { label: "Fields Masked", value: run.fieldsMasked.toLocaleString(),    color: "#f97316", icon: Shield    },
            { label: "PII Detected", value: `${run.piiDetectedPercentage}%`,       color: "#fb7185", icon: AlertTriangle },
            { label: "Utility Score", value: `${run.dataUtilityScore.toFixed(1)}`, color: "#10b981", icon: Zap       },
          ].map(({ label, value, color, icon: Icon }) => (
            <div key={label} className={cn(card, "p-4 flex items-center gap-3")}>
              <div className="p-2.5 rounded-xl shrink-0" style={{ background: `${color}12`, border: `1px solid ${color}22` }}>
                <Icon className="h-4 w-4" style={{ color }} />
              </div>
              <div>
                <p className="text-2xl font-bold font-mono leading-none" style={{ color }}>{value}</p>
                <p className="text-[11px] text-gray-600 mt-0.5 tracking-wide">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Row 2: Area + Quality ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-4">

          {/* Area chart */}
          <div className={cn(card, "p-4 sm:p-5")}>
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="h-4 w-4 text-emerald-400" />
              <h3 className="text-sm font-semibold tracking-tight">Field Detection Trend</h3>
            </div>
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

          {/* Quality gauge */}
          <div className={cn(card, "p-4 sm:p-5 flex flex-col")}>
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle className="h-4 w-4 text-amber-400" />
              <h3 className="text-sm font-semibold tracking-tight">Utility Score</h3>
            </div>
            <div className="flex-1 flex items-center justify-center py-2">
              <QualityGauge score={utilityScore} />
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <StatPill label="Records"   value={report.records.toLocaleString()} color="#a78bfa" />
              <StatPill label="PII Fields" value={String(report.piiFields)}       color="#f97316" />
              <StatPill label="PII %"     value={`${piiPercent.toFixed(1)}%`}     color="#fb7185" />
              <StatPill label="Utility %"  value={`${utilityScore.toFixed(1)}%`}  color="#10b981" />
            </div>
          </div>
        </div>

        {/* ── Row 3: Bar + Donut ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4">

          {/* Bar */}
          <div className={cn(card, "p-4 sm:p-5")}>
            <div className="flex items-center gap-2 mb-4">
              <GitBranch className="h-4 w-4 text-violet-400" />
              <h3 className="text-sm font-semibold tracking-tight">Fields by Category</h3>
            </div>
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

          {/* Donut */}
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
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: DONUT_COLORS[i] }} />
                    <span className="text-gray-400">{d.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
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
              <p className="text-[10px] text-gray-600 mt-1.5 leading-relaxed">{report.riskScore.reason}</p>
            </div>
          </div>
        </div>

        {/* ── Row 4: PII type bars ── */}
        <div className={cn(card, "p-4 sm:p-5")}>
          <div className="flex items-center gap-2 mb-4">
            <Shield className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold tracking-tight">PII by Type</h3>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <TypeBar label="Direct PII"        count={typeCounts.Direct}    max={maxType}            color="#fb7185" icon="🛡️" />
            <TypeBar label="Sensitive PII"     count={typeCounts.Sensitive} max={maxType}            color="#f97316" icon="🔥" />
            <TypeBar label="Quasi-Identifiers" count={typeCounts.Quasi}     max={maxType}            color="#60a5fa" icon="⚡" />
            <TypeBar label="Total Fields"      count={report.totalFields}   max={report.totalFields} color="#10b981" icon="🗄️" />
          </div>
        </div>

        {/* ── Row 5: Masked Data Table ── */}
        <div className={cn(card, "overflow-hidden")}>

          {/* Toolbar */}
          <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-white/[0.05] flex flex-col gap-2 sm:gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-emerald-400" />
                <h3 className="text-sm font-semibold tracking-tight">Masked Data</h3>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-white/[0.04] text-gray-500 border border-white/[0.05]">
                  {maskedData.length} rows
                </span>
              </div>
              <div className="flex rounded-lg border border-white/10 overflow-hidden text-[10px] sm:text-xs">
                {(["table", "json"] as const).map(mode => (
                  <button key={mode} onClick={() => setViewMode(mode)}
                    className={cn("px-2.5 sm:px-3 py-2 flex items-center gap-1 sm:gap-1.5 transition-colors",
                      viewMode === mode ? "bg-primary/20 text-primary" : "text-gray-500 hover:bg-white/5",
                      mode === "json" && "border-l border-white/10")}>
                    {mode === "table" ? <Table2 className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> : <Braces className="h-3 w-3 sm:h-3.5 sm:w-3.5" />}
                    <span className="hidden xs:inline capitalize">{mode}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2 items-center">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-600" />
                <input value={search} onChange={e => { setSearch(e.target.value); setPage(0); }}
                  placeholder="Search records…"
                  className="pl-8 pr-3 py-2 text-xs rounded-lg border border-white/[0.08] bg-white/[0.025] w-full focus:outline-none focus:border-primary/40 transition-colors text-gray-300 placeholder:text-gray-700" />
              </div>
              <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(0); }}
                className="px-2 sm:px-3 py-2 text-xs rounded-lg border border-white/[0.08] bg-white/[0.025] focus:outline-none text-gray-400 cursor-pointer shrink-0">
                {[10, 25, 50].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>

          {/* Column toggle */}
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
                <button key={col} onClick={() => setHiddenCols(prev => prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col])}
                  className={cn("inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border transition-colors",
                    hiddenCols.includes(col) ? "border-white/[0.05] text-gray-700" : "border-primary/25 text-primary bg-primary/8")}>
                  {hiddenCols.includes(col) ? <EyeOff className="h-2.5 w-2.5" /> : <Eye className="h-2.5 w-2.5" />}
                  {col}
                </button>
              ))}
            </div>
          </div>

          {viewMode === "json" ? (
            <div className="overflow-auto max-h-[400px] p-4 sm:p-5">
              <pre className="text-[10px] sm:text-xs font-mono text-gray-500 leading-relaxed">
                {JSON.stringify(pageData, null, 2)}
              </pre>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[500px]">
                <thead>
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
                        <td key={col} className="px-4 sm:px-5 py-3 font-mono text-gray-400 whitespace-nowrap">{String(row[col] ?? "—")}</td>
                      ))}
                      <td className="px-4 sm:px-5 py-3 text-right">
                        <button onClick={() => copyRow(row, i)}
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

          {/* Pagination */}
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
        </div>

        {/* ── Download ── */}
        <div className={cn(card, "p-4 sm:p-5")}>
          <h3 className="text-sm font-semibold tracking-tight mb-0.5">Export Masked Data</h3>
          <p className="text-xs text-gray-600 mb-4">Download your privacy-protected dataset in your preferred format</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {[
              { label: "Download CSV",  icon: Download, onClick: () => downloadCSV(maskedData),  color: "#10b981", desc: "Comma-separated values" },
              { label: "Download JSON", icon: Braces,   onClick: () => downloadJSON(maskedData), color: "#8b5cf6", desc: "Structured JSON format" },
            ].map(({ label, icon: Icon, onClick, color, desc }) => (
              <button key={label} onClick={onClick}
                className="flex items-center gap-3 px-4 py-3.5 rounded-xl border border-white/[0.07] text-left hover:border-white/[0.14] hover:bg-white/[0.03] transition-all group">
                <div className="p-2.5 rounded-xl shrink-0" style={{ background: `${color}10`, border: `1px solid ${color}20` }}>
                  <Icon className="h-4 w-4" style={{ color }} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-300 group-hover:text-white transition-colors">{label}</p>
                  <p className="text-[10px] text-gray-600">{desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ── Explanations ── */}
        <div className={cn(card, "overflow-hidden")}>
          <button onClick={() => setExplanationsOpen(v => !v)}
            className="w-full flex items-center justify-between px-4 sm:px-6 py-4 hover:bg-white/[0.02] transition-colors">
            <div className="flex items-center gap-2.5">
              <Shield className="h-4 w-4 text-primary shrink-0" />
              <span className="text-sm font-semibold tracking-tight">Masking Explanations</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20 font-mono">
                {Object.keys(report.explanations).length} fields
              </span>
            </div>
            {explanationsOpen
              ? <ChevronUp className="h-4 w-4 text-gray-600" />
              : <ChevronDown className="h-4 w-4 text-gray-600" />}
          </button>

          {explanationsOpen && (
            <div className="px-4 sm:px-6 pb-5 border-t border-white/[0.05] pt-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {Object.entries(report.explanations).map(([field, note]) => (
                <div key={field} className="flex gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                  <div className="mt-0.5 h-5 w-5 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                    <Shield className="h-3 w-3 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold font-mono text-primary capitalize mb-0.5">{field}</p>
                    <p className="text-[11px] text-gray-500 leading-relaxed">{note}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="px-4 sm:px-6 py-3 border-t border-white/[0.04] flex flex-wrap items-center gap-2.5">
            <span className={cn("text-[10px] px-2.5 py-1 rounded-lg border font-mono font-semibold capitalize", RISK_COLORS[risk] ?? "text-gray-500")}>
              {report.riskScore.level} risk · {report.riskScore.score.toFixed(2)}
            </span>
            <span className="text-[10px] text-gray-600">{report.riskScore.reason}</span>
          </div>
        </div>

        {/* ── Utility note ── */}
        <div className="text-[10px] font-mono text-gray-700 px-1 leading-relaxed">
          {report.utilityNote}
        </div>

      </div>
    </DashboardLayout>
  );
}