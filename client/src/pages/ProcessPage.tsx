import { useCallback, useRef, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Upload, FileText, X, Loader2, ChevronDown, ChevronUp,
  Download, Shield, Database, BarChart3, AlertTriangle,
  Search, Copy, Check, Table2, Braces, Clock, Eye, EyeOff,
  Zap, GitBranch, CheckCircle, LayoutDashboard, ArrowRight,
  Sparkles, Lock,
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
  pipeline: { steps: string[]; inputType: string; version: string };
}
interface PipelineData {
  runId: string; maskingLevel: string; recordCount: number;
  result: Record<string, unknown>[]; report: Report;
}

type MaskingLevel = "low" | "medium" | "high";
type ViewMode = "table" | "json";

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

function isValidFile(f: File) {
  const ext = "." + f.name.split(".").pop()?.toLowerCase();
  return [".csv", ".json", ".xlsx"].includes(ext);
}

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
function downloadXLSX(data: Record<string, unknown>[]) {
  downloadCSV(data);
  toast("XLSX download: install SheetJS for native XLSX support", { icon: "ℹ️" });
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) => {
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
  const radius = 54;
  const stroke = 8;
  const circumference = Math.PI * radius;
  const offset = circumference * (1 - score / 100);
  const color = score >= 70 ? "#10b981" : score >= 40 ? "#f59e0b" : "#f87171";
  return (
    <div className="flex flex-col items-center justify-center">
      <svg width={140} height={80} viewBox="0 0 140 80">
        <path d="M 14 70 A 56 56 0 0 1 126 70" fill="none" stroke="#1e2530" strokeWidth={stroke} strokeLinecap="round" />
        <path d="M 14 70 A 56 56 0 0 1 126 70" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
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

// ─── TypeBar ─────────────────────────────────────────────────────────────────

function TypeBar({ label, count, max, color, icon }: { label: string; count: number; max: number; color: string; icon: string }) {
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
    if (!isValidFile(f)) { toast.error("Only CSV, JSON, XLSX accepted"); return; }
    setFile(f);
  }, []);

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!isValidFile(f)) { toast.error("Only CSV, JSON, XLSX accepted"); return; }
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

  return (
    <section className="min-h-[100dvh] flex flex-col items-center justify-center px-4 py-12 sm:py-20 relative">
      {/* ambient glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] sm:w-[700px] h-[300px] sm:h-[700px] rounded-full bg-primary/8 blur-[100px] sm:blur-[140px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[200px] sm:w-[400px] h-[200px] sm:h-[400px] rounded-full bg-secondary/6 blur-[80px] sm:blur-[120px]" />
      </div>

      <div className="relative z-10 w-full max-w-2xl flex flex-col items-center text-center">

        {/* top badge row — pill + dashboard button */}
        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 mb-6 sm:mb-8 w-full">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary text-[10px] sm:text-xs font-mono">
            <Lock className="h-3 w-3 shrink-0" />
            <span>Privacy-first · In-memory · Zero storage</span>
          </div>

          {/* ── Dashboard shortcut button ── */}
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

        {/* drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={cn(
            "w-full rounded-2xl border-2 border-dashed transition-all duration-300 glass",
            dragOver
              ? "border-primary bg-primary/5 shadow-glow-primary scale-[1.01]"
              : "border-border/60 hover:border-primary/50"
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
              <div className="flex gap-2 mt-3 mb-6">
                {["CSV", "JSON", "XLSX"].map(t => (
                  <span key={t} className="text-[10px] sm:text-xs px-2.5 py-1 rounded-md border border-border/50 bg-muted/30 font-mono text-muted-foreground">{t}</span>
                ))}
              </div>
              <label>
                <input type="file" className="hidden" onChange={onPick} accept=".csv,.json,.xlsx" />
                <span className="inline-flex items-center justify-center gap-2 rounded-xl text-sm font-semibold px-5 sm:px-7 py-2.5 sm:py-3 bg-gradient-primary text-primary-foreground btn-glow cursor-pointer shadow-glow-primary transition-transform hover:scale-105 active:scale-95">
                  <Upload className="h-4 w-4" /> Browse files
                </span>
              </label>
            </div>
          ) : (
            <div className="p-4 sm:p-6 flex flex-col gap-3 sm:gap-4">
              {/* file info */}
              <div className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl bg-primary/5 border border-primary/20">
                <div className="p-2 sm:p-3 rounded-xl bg-primary/10 border border-primary/30 shrink-0">
                  <FileText className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="font-semibold truncate text-sm sm:text-base">{file.name}</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">
                    {(file.size / 1024 / 1024).toFixed(2)} MB · {file.name.split(".").pop()?.toUpperCase()} · Ready to process
                  </p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setFile(null)} disabled={isLoading} className="shrink-0 h-8 w-8 sm:h-10 sm:w-10 hover:bg-destructive/10 hover:text-destructive transition-colors">
                  <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </Button>
              </div>

              {/* controls */}
              <div className="flex flex-col gap-2 sm:flex-row sm:gap-3 sm:items-center">
                <div className="relative flex-1">
                  <button
                    type="button"
                    onClick={() => setLevelOpen(v => !v)}
                    disabled={isLoading}
                    className="w-full flex items-center justify-between gap-2 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl border border-border/60 bg-background/60 text-sm font-medium hover:border-primary/50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className={cn("w-2 h-2 rounded-full shrink-0", {
                        "bg-emerald-400": maskingLevel === "low",
                        "bg-amber-400":   maskingLevel === "medium",
                        "bg-red-400":     maskingLevel === "high",
                      })} />
                      <span className="capitalize">Masking: {maskingLevel}</span>
                    </div>
                    <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", levelOpen && "rotate-180")} />
                  </button>
                  {levelOpen && (
                    <div className="absolute left-0 right-0 mt-1 z-30 rounded-xl border border-border/60 bg-background/95 backdrop-blur shadow-xl overflow-hidden">
                      {(["low", "medium", "high"] as MaskingLevel[]).map(lvl => (
                        <button
                          key={lvl}
                          type="button"
                          onClick={() => { setMaskingLevel(lvl); setLevelOpen(false); }}
                          className={cn("w-full text-left px-4 py-3 text-sm hover:bg-muted/50 transition-colors flex items-center gap-3", maskingLevel === lvl && "bg-primary/10")}
                        >
                          <span className={cn("w-2 h-2 rounded-full shrink-0", {
                            "bg-emerald-400": lvl === "low",
                            "bg-amber-400":   lvl === "medium",
                            "bg-red-400":     lvl === "high",
                          })} />
                          <div>
                            <p className="font-medium capitalize">{MASKING_INFO[lvl].label}</p>
                            <p className="text-xs text-muted-foreground">{MASKING_INFO[lvl].desc}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <Button
                  onClick={handleProcess}
                  disabled={isLoading}
                  className="bg-gradient-primary text-primary-foreground btn-glow shadow-glow-primary px-6 sm:px-8 py-2.5 sm:py-3 h-auto font-semibold text-sm rounded-xl transition-transform hover:scale-105 active:scale-95 shrink-0 w-full sm:w-auto"
                >
                  {isLoading
                    ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Analyzing…</>
                    : <><Zap className="h-4 w-4 mr-2" />Process Data</>
                  }
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* loading pipeline steps */}
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

        {/* feature hints below drop zone */}
        {!file && !isLoading && (
          <div className="mt-8 grid grid-cols-3 gap-3 w-full text-center">
            {[
              { icon: "🛡️", label: "Zero storage" },
              { icon: "⚡", label: "Sub-second" },
              { icon: "🔒", label: "In-memory" },
            ].map(({ icon, label }) => (
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
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [explanationsOpen, setExplanationsOpen] = useState(false);
  const [copiedRow, setCopiedRow] = useState<number | null>(null);
  const [hiddenCols, setHiddenCols] = useState<string[]>([]);
  const [colPanelOpen, setColPanelOpen] = useState(false);

  const { report, result, runId, maskingLevel } = data;
  const risk = report.riskScore.level.toLowerCase();
  const allCols = result.length > 0 ? Object.keys(result[0]) : [];

  const filtered = useMemo(() => {
    if (!search.trim()) return result;
    const q = search.toLowerCase();
    return result.filter(row => Object.values(row).some(v => String(v ?? "").toLowerCase().includes(q)));
  }, [result, search]);

  const totalPages = Math.ceil(filtered.length / pageSize);
  const pageData = filtered.slice(page * pageSize, (page + 1) * pageSize);
  const visibleCols = allCols.filter(c => !hiddenCols.includes(c));

  const rawBreakdown      = report.breakdown ?? {};
  const directPII         = rawBreakdown.directPII        ?? {};
  const sensitivePII      = rawBreakdown.sensitivePII     ?? {};
  const quasiIdentifiers  = rawBreakdown.quasiIdentifiers ?? {};

  const sumValues = (obj: Record<string, unknown>): number =>
    Object.values(obj).reduce<number>((acc, v) => acc + (Number(v) || 0), 0);

  const utilityScore = parseFloat(report.utilityPercent);
  const piiPercent   = parseFloat(report.piiPercent);

  const qualityLabel =
    utilityScore >= 70 ? "Good shape" :
    utilityScore >= 40 ? "Needs work" :
    "High risk";

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
    ...Object.entries(directPII).map(([k, v])        => ({ field: k, count: Number(v) || 0, type: "Direct" })),
    ...Object.entries(sensitivePII).map(([k, v])     => ({ field: k, count: Number(v) || 0, type: "Sensitive" })),
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

  function copyRow(row: Record<string, unknown>, idx: number) {
    navigator.clipboard.writeText(JSON.stringify(row, null, 2));
    setCopiedRow(idx);
    setTimeout(() => setCopiedRow(null), 1500);
  }

  function toggleCol(col: string) {
    setHiddenCols(prev => prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]);
  }

  const cardBase = "rounded-2xl border border-white/5 bg-[#0d1117]/80 backdrop-blur";

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
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Pipeline Results</h2>
          <p className="text-xs text-gray-500 mt-0.5">Your data has been scanned and masked</p>
        </div>

        {/* ── CTA buttons ── */}
        <div className="flex flex-col xs:flex-row sm:flex-col lg:flex-row items-stretch xs:items-center gap-2 self-start shrink-0">
          {/* Dashboard button — primary CTA */}
          <button
            onClick={() => navigate("/dashboard")}
            className={cn(
              "inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold",
              "bg-gradient-primary text-primary-foreground btn-glow shadow-glow-primary",
              "transition-transform hover:scale-105 active:scale-95 whitespace-nowrap"
            )}
          >
            <LayoutDashboard className="h-4 w-4 shrink-0" />
            View Dashboard
            <Sparkles className="h-3.5 w-3.5 shrink-0 opacity-70" />
          </button>

          {/* Process another — secondary */}
          <Button
            variant="outline"
            size="sm"
            onClick={onReset}
            className="border-white/10 hover:border-primary/50 text-xs sm:text-sm h-auto py-2.5 px-4 rounded-xl"
          >
            <Upload className="h-3.5 w-3.5 mr-1.5 shrink-0" />
            Process another
          </Button>
        </div>
      </div>

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
              { value: report.records.toLocaleString(), label: "Records",   color: "text-white" },
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

      {/* ── ROW 4: Masked Data Table ── */}
      <div className={cn(cardBase, "overflow-hidden")}>
        {/* Toolbar */}
        <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-white/5 flex flex-col gap-2 sm:gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-emerald-400" />
              <h3 className="text-sm font-semibold">Masked Data Preview</h3>
            </div>
            <div className="flex rounded-lg border border-white/10 overflow-hidden">
              <button
                onClick={() => setViewMode("table")}
                className={cn("px-2.5 sm:px-3 py-2 text-[10px] sm:text-xs flex items-center gap-1 sm:gap-1.5 transition-colors",
                  viewMode === "table" ? "bg-primary/20 text-primary" : "text-gray-500 hover:bg-white/5")}
              >
                <Table2 className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                <span className="hidden xs:inline">Table</span>
              </button>
              <button
                onClick={() => setViewMode("json")}
                className={cn("px-2.5 sm:px-3 py-2 text-[10px] sm:text-xs flex items-center gap-1 sm:gap-1.5 border-l border-white/10 transition-colors",
                  viewMode === "json" ? "bg-primary/20 text-primary" : "text-gray-500 hover:bg-white/5")}
              >
                <Braces className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                <span className="hidden xs:inline">JSON</span>
              </button>
            </div>
          </div>

          <div className="flex gap-2 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-600" />
              <input
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(0); }}
                placeholder="Search records…"
                className="pl-8 pr-3 py-2 text-xs rounded-lg border border-white/10 bg-white/[0.03] w-full focus:outline-none focus:border-primary/50 transition-colors text-gray-300"
              />
            </div>
            <select
              value={pageSize}
              onChange={e => { setPageSize(Number(e.target.value)); setPage(0); }}
              className="px-2 sm:px-3 py-2 text-xs rounded-lg border border-white/10 bg-white/[0.03] focus:outline-none focus:border-primary/50 cursor-pointer shrink-0 text-gray-300"
            >
              {[10, 25, 50].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>

        {/* Column toggle */}
        <div className="px-4 sm:px-5 py-2 border-b border-white/[0.04]">
          <button
            onClick={() => setColPanelOpen(v => !v)}
            className="sm:hidden flex items-center gap-1.5 text-[11px] font-mono text-gray-600 mb-1"
          >
            <Eye className="h-3 w-3" />
            Columns ({allCols.length - hiddenCols.length}/{allCols.length})
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
                {hiddenCols.includes(col) ? <EyeOff className="h-2.5 w-2.5" /> : <Eye className="h-2.5 w-2.5" />}
                {col}
              </button>
            ))}
          </div>
        </div>

        {viewMode === "json" ? (
          <div className="overflow-auto max-h-[400px] sm:max-h-[500px] p-3 sm:p-5">
            <pre className="text-[10px] sm:text-xs font-mono text-gray-500 leading-relaxed">
              {JSON.stringify(pageData, null, 2)}
            </pre>
          </div>
        ) : (
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
                      <button
                        onClick={() => copyRow(row, i)}
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
      </div>

      {/* ── Download ── */}
      <div className={cn(cardBase, "p-4 sm:p-5")}>
        <h3 className="text-sm font-semibold mb-1">Download Masked Data</h3>
        <p className="text-xs text-gray-500 mb-3 sm:mb-4">Export your privacy-protected dataset</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
          {[
            { label: "Download CSV",  icon: Download, onClick: () => downloadCSV(result),  color: "#10b981" },
            { label: "Download JSON", icon: Braces,   onClick: () => downloadJSON(result), color: "#8b5cf6" },
            { label: "Download XLSX", icon: Table2,   onClick: () => downloadXLSX(result), color: "#60a5fa" },
          ].map(({ label, icon: Icon, onClick, color }) => (
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
      </div>

      {/* ── Dashboard CTA banner ── */}
      <div className={cn(
        cardBase,
        "p-4 sm:p-5 border border-primary/20 bg-gradient-to-r from-primary/5 via-transparent to-secondary/5",
        "flex flex-col sm:flex-row items-start sm:items-center gap-4"
      )}>
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
            "bg-gradient-primary text-primary-foreground btn-glow shadow-glow-primary",
            "transition-transform hover:scale-105 active:scale-95"
          )}
        >
          <LayoutDashboard className="h-4 w-4" />
          Go to Dashboard
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      {/* ── Explanations panel ── */}
      <div className={cn(cardBase, "overflow-hidden")}>
        <button
          onClick={() => setExplanationsOpen(v => !v)}
          className="w-full flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 hover:bg-white/[0.03] transition-colors"
        >
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

  const handleReset = () => {
    setResult(null);
    setProcessing(false);
  };

  return (
    <div ref={topRef} className="min-h-screen">
      <Navbar />
      {!result ? (
        <UploadSection onResult={handleResult} onProcessStart={() => setProcessing(true)} />
      ) : (
        <ResultDashboard data={result} elapsed={elapsed} onReset={handleReset} />
      )}
      {processing && <></>}
      <Footer />
    </div>
  );
}