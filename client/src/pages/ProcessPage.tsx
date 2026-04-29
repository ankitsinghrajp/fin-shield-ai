import { useCallback, useRef, useState, useMemo } from "react";
import {
  Upload, FileText, X, Loader2, ChevronDown, ChevronUp,
  Download, Shield, Database, BarChart3, AlertTriangle,
  Search, Copy, Check, Table2, Braces, Clock, Eye, EyeOff,
  Zap,
} from "lucide-react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useProcessDatasetMutation } from "@/redux/api/api";
import toast from "react-hot-toast";

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
  low: { label: "Low", desc: "Minimal masking, most fields retained", color: "text-green-400 border-green-400/30 bg-green-400/10" },
  medium: { label: "Medium", desc: "Balanced — partial masking on sensitive fields", color: "text-yellow-400 border-yellow-400/30 bg-yellow-400/10" },
  high: { label: "High", desc: "Maximum privacy — heavy redaction", color: "text-red-400 border-red-400/30 bg-red-400/10" },
};

const RISK_COLORS: Record<string, string> = {
  low: "text-green-400 bg-green-400/10 border-green-400/30",
  medium: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30",
  high: "text-red-400 bg-red-400/10 border-red-400/30",
};
const CHART_COLORS = ["#6366f1", "#8b5cf6", "#a78bfa", "#c4b5fd"];

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
    ...data.map(r =>
      keys.map(k => `"${String(r[k] ?? "").replace(/"/g, '""')}"`).join(",")
    ),
  ];
  const blob = new Blob([rows.join("\n")], { type: "text/csv" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "masked_data.csv"; a.click();
}
function downloadJSON(data: Record<string, unknown>[]) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "masked_data.json"; a.click();
}
function downloadXLSX(data: Record<string, unknown>[]) {
  // Simple CSV with .xlsx extension for demo; real impl would use SheetJS
  downloadCSV(data);
  toast("XLSX download: install SheetJS for native XLSX support", { icon: "ℹ️" });
}

// ═══════════════════════════════════════════════════════════════════════════════
// UPLOAD SECTION
// ═══════════════════════════════════════════════════════════════════════════════

function UploadSection({
  onResult, onProcessStart,
}: {
  onResult: (d: PipelineData, elapsed: number) => void;
  onProcessStart: () => void;
}) {
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
    <section className="min-h-[80vh] flex flex-col items-center justify-center px-4 py-20 relative">
      {/* Background glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/10 blur-[120px]" />
        <div className="absolute top-2/3 left-1/4 w-[300px] h-[300px] rounded-full bg-secondary/8 blur-[80px]" />
      </div>

      <div className="relative z-10 w-full max-w-2xl flex flex-col items-center text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-mono mb-6 animate-fade-in">
          <Shield className="h-3 w-3" />
          Privacy-first · In-memory processing · Zero storage
        </div>

        {/* Headline */}
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-3 animate-fade-in" style={{ animationDelay: "0.1s" }}>
          Data Privacy{" "}
          <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            Engine
          </span>
        </h1>
        <p className="text-muted-foreground text-lg mb-10 animate-fade-in" style={{ animationDelay: "0.15s" }}>
          Upload your dataset and instantly detect &amp; mask sensitive information
        </p>

        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={cn(
            "w-full rounded-2xl border-2 border-dashed transition-all duration-300 glass animate-fade-in-up",
            dragOver ? "border-primary bg-primary/5 shadow-glow-primary scale-[1.01]"
              : "border-border/60 hover:border-primary/50"
          )}
          style={{ animationDelay: "0.2s" }}
        >
          {!file ? (
            <div className="flex flex-col items-center py-14 px-6">
              <div className="relative mb-5">
                <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full" />
                <div className="relative p-5 rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 border border-primary/30">
                  <Upload className="h-9 w-9 text-primary" />
                </div>
              </div>
              <h3 className="text-xl font-semibold mb-1">Drop your dataset here</h3>
              <p className="text-sm text-muted-foreground mb-1">or click to browse your files</p>
              <div className="flex gap-2 mt-3 mb-5">
                {["CSV", "JSON", "XLSX"].map(t => (
                  <span key={t} className="text-xs px-2.5 py-1 rounded-md border border-border/50 bg-muted/30 font-mono text-muted-foreground">
                    {t}
                  </span>
                ))}
              </div>
              <label>
                <input type="file" className="hidden" onChange={onPick} accept=".csv,.json,.xlsx" />
                <span className="inline-flex items-center justify-center gap-2 rounded-xl text-sm font-semibold px-6 py-3 bg-gradient-primary text-primary-foreground btn-glow cursor-pointer shadow-glow-primary transition-transform hover:scale-105">
                  <Upload className="h-4 w-4" /> Browse files
                </span>
              </label>
            </div>
          ) : (
            <div className="p-6 flex flex-col gap-4">
              {/* File info */}
              <div className="flex items-center gap-4 p-4 rounded-xl bg-primary/5 border border-primary/20">
                <div className="p-3 rounded-xl bg-primary/10 border border-primary/30 shrink-0">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="font-semibold truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {(file.size / 1024 / 1024).toFixed(2)} MB ·{" "}
                    {file.name.split(".").pop()?.toUpperCase()} · Ready to process
                  </p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setFile(null)} disabled={isLoading} className="shrink-0">
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Masking level + action */}
              <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                {/* Level picker */}
                <div className="relative flex-1">
                  <button
                    type="button"
                    onClick={() => setLevelOpen(v => !v)}
                    disabled={isLoading}
                    className="w-full flex items-center justify-between gap-2 px-4 py-3 rounded-xl border border-border/60 bg-background/60 text-sm font-medium hover:border-primary/50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className={cn("w-2 h-2 rounded-full", {
                        "bg-green-400": maskingLevel === "low",
                        "bg-yellow-400": maskingLevel === "medium",
                        "bg-red-400": maskingLevel === "high",
                      })} />
                      <span className="capitalize">Masking: {maskingLevel}</span>
                    </div>
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  </button>
                  {levelOpen && (
                    <div className="absolute left-0 right-0 mt-1 z-30 rounded-xl border border-border/60 bg-background/95 backdrop-blur shadow-xl overflow-hidden">
                      {(["low", "medium", "high"] as MaskingLevel[]).map(lvl => (
                        <button key={lvl} type="button"
                          onClick={() => { setMaskingLevel(lvl); setLevelOpen(false); }}
                          className={cn("w-full text-left px-4 py-3 text-sm hover:bg-muted/50 transition-colors flex items-center gap-3",
                            maskingLevel === lvl && "bg-primary/10")}
                        >
                          <span className={cn("w-2 h-2 rounded-full shrink-0", {
                            "bg-green-400": lvl === "low",
                            "bg-yellow-400": lvl === "medium",
                            "bg-red-400": lvl === "high",
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

                {/* Process button */}
                <Button
                  onClick={handleProcess}
                  disabled={isLoading}
                  className="bg-gradient-primary text-primary-foreground btn-glow shadow-glow-primary px-8 py-3 h-auto font-semibold text-sm rounded-xl transition-transform hover:scale-105 shrink-0"
                >
                  {isLoading
                    ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Analyzing dataset…</>
                    : <><Zap className="h-4 w-4 mr-2" />Process Data</>}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Processing loader overlay feel */}
        {isLoading && (
          <div className="mt-6 flex flex-col items-center gap-3 animate-fade-in">
            <div className="flex gap-1.5">
              {["ingestion", "detection", "masking", "reporting"].map((step, i) => (
                <div key={step} className="flex items-center gap-1.5">
                  <div className="h-1.5 w-16 rounded-full bg-primary/20 overflow-hidden">
                    <div className="h-full bg-primary rounded-full animate-pulse" style={{ animationDelay: `${i * 0.2}s` }} />
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground capitalize">{step}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground font-mono animate-pulse">Running PII detection pipeline…</p>
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
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [explanationsOpen, setExplanationsOpen] = useState(false);
  const [copiedRow, setCopiedRow] = useState<number | null>(null);
  const [hiddenCols, setHiddenCols] = useState<string[]>([]);

  const { report, result, runId, maskingLevel } = data;
  const risk = report.riskScore.level.toLowerCase();
  const allCols = result.length > 0 ? Object.keys(result[0]) : [];

  // Search filter
  const filtered = useMemo(() => {
    if (!search.trim()) return result;
    const q = search.toLowerCase();
    return result.filter(row =>
      Object.values(row).some(v => String(v ?? "").toLowerCase().includes(q))
    );
  }, [result, search]);

  const totalPages = Math.ceil(filtered.length / pageSize);
  const pageData = filtered.slice(page * pageSize, (page + 1) * pageSize);

  // Chart data
  const breakdown = report.breakdown;
  const pieData = [
    { name: "Direct PII", value: Object.values(breakdown.directPII).reduce((a, b) => a + b, 0) },
    { name: "Sensitive PII", value: Object.values(breakdown.sensitivePII).reduce((a, b) => a + b, 0) },
    { name: "Quasi-ID", value: Object.values(breakdown.quasiIdentifiers).reduce((a, b) => a + b, 0) },
  ].filter(d => d.value > 0);

  const barData = [
    ...Object.entries(breakdown.directPII).map(([k, v]) => ({ field: k, count: v, type: "Direct" })),
    ...Object.entries(breakdown.sensitivePII).map(([k, v]) => ({ field: k, count: v, type: "Sensitive" })),
    ...Object.entries(breakdown.quasiIdentifiers).map(([k, v]) => ({ field: k, count: v, type: "Quasi" })),
  ];

  function copyRow(row: Record<string, unknown>, idx: number) {
    navigator.clipboard.writeText(JSON.stringify(row, null, 2));
    setCopiedRow(idx);
    setTimeout(() => setCopiedRow(null), 1500);
  }

  function toggleCol(col: string) {
    setHiddenCols(prev =>
      prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]
    );
  }

  const visibleCols = allCols.filter(c => !hiddenCols.includes(c));

  return (
    <div className="max-w-7xl mx-auto px-4 py-10 space-y-8 animate-fade-in-up">

      {/* ── Header bar ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs font-mono text-muted-foreground">Run #{runId}</span>
            <span className="text-xs font-mono text-muted-foreground">·</span>
            <span className="text-xs font-mono text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" /> Completed in {elapsed.toFixed(2)}s ⚡
            </span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Pipeline Results</h2>
        </div>
        <Button variant="outline" size="sm" onClick={onReset} className="border-border/60 hover:border-primary/50">
          <Upload className="h-3.5 w-3.5 mr-1.5" /> Process another file
        </Button>
      </div>

      {/* ── Stats cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "Records",
            value: report.records.toLocaleString(),
            sub: `${report.totalFields} total fields`,
            icon: Database,
            accent: "text-primary",
            bg: "from-primary/10 to-primary/5 border-primary/20",
          },
          {
            label: "PII Detected",
            value: `${report.piiPercent}%`,
            sub: `${report.piiFields} PII fields`,
            icon: Shield,
            accent: "text-secondary",
            bg: "from-secondary/10 to-secondary/5 border-secondary/20",
          },
          {
            label: "Data Utility",
            value: `${report.utilityPercent}%`,
            sub: "utility retained",
            icon: BarChart3,
            accent: "text-indigo-400",
            bg: "from-indigo-500/10 to-indigo-500/5 border-indigo-500/20",
          },
          {
            label: "Risk Level",
            value: report.riskScore.level.toUpperCase(),
            sub: `Score: ${report.riskScore.score.toFixed(2)}`,
            icon: AlertTriangle,
            accent: risk === "low" ? "text-green-400" : risk === "medium" ? "text-yellow-400" : "text-red-400",
            bg: risk === "low"
              ? "from-green-400/10 to-green-400/5 border-green-400/20"
              : risk === "medium"
              ? "from-yellow-400/10 to-yellow-400/5 border-yellow-400/20"
              : "from-red-400/10 to-red-400/5 border-red-400/20",
          },
        ].map(({ label, value, sub, icon: Icon, accent, bg }) => (
          <div key={label} className={cn("glass rounded-2xl p-5 border bg-gradient-to-br", bg)}>
            <div className="flex items-start justify-between mb-3">
              <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">{label}</p>
              <Icon className={cn("h-4 w-4", accent)} />
            </div>
            <p className={cn("text-2xl font-bold font-mono", accent)}>{value}</p>
            <p className="text-xs text-muted-foreground mt-1">{sub}</p>
          </div>
        ))}
      </div>

      {/* ── Charts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Pie */}
        <div className="glass rounded-2xl p-6 border border-border/40">
          <h3 className="text-sm font-semibold mb-4 text-muted-foreground uppercase tracking-wider font-mono">PII Distribution</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={90}
                paddingAngle={3} dataKey="value" label={({ name, percent }) =>
                  `${name} ${(percent * 100).toFixed(0)}%`}
                labelLine={false}>
                {pieData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: "8px", fontSize: "12px" }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-3 mt-2 justify-center">
            {pieData.map((d, i) => (
              <div key={d.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: CHART_COLORS[i] }} />
                {d.name}: {d.value}
              </div>
            ))}
          </div>
        </div>

        {/* Bar */}
        <div className="glass rounded-2xl p-6 border border-border/40">
          <h3 className="text-sm font-semibold mb-4 text-muted-foreground uppercase tracking-wider font-mono">Fields by Category</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={barData} layout="vertical" margin={{ left: 10, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="field" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={80} />
              <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: "8px", fontSize: "12px" }} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {barData.map((entry, i) => (
                  <Cell key={i} fill={
                    entry.type === "Direct" ? "#6366f1"
                      : entry.type === "Sensitive" ? "#8b5cf6"
                      : "#a78bfa"
                  } />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Masked data table ── */}
      <div className="glass rounded-2xl border border-border/40 overflow-hidden">
        {/* Table toolbar */}
        <div className="px-5 py-4 border-b border-border/40 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <h3 className="text-sm font-semibold">Masked Data Preview</h3>
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            {/* Search */}
            <div className="relative flex-1 sm:flex-none">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(0); }}
                placeholder="Search records…"
                className="pl-8 pr-3 py-2 text-xs rounded-lg border border-border/60 bg-background/60 w-full sm:w-48 focus:outline-none focus:border-primary/50 transition-colors"
              />
            </div>

            {/* View toggle */}
            <div className="flex rounded-lg border border-border/60 overflow-hidden">
              <button onClick={() => setViewMode("table")}
                className={cn("px-3 py-2 text-xs flex items-center gap-1.5 transition-colors",
                  viewMode === "table" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-muted/30")}>
                <Table2 className="h-3.5 w-3.5" /> Table
              </button>
              <button onClick={() => setViewMode("json")}
                className={cn("px-3 py-2 text-xs flex items-center gap-1.5 border-l border-border/60 transition-colors",
                  viewMode === "json" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-muted/30")}>
                <Braces className="h-3.5 w-3.5" /> JSON
              </button>
            </div>

            {/* Page size */}
            <select
              value={pageSize}
              onChange={e => { setPageSize(Number(e.target.value)); setPage(0); }}
              className="px-3 py-2 text-xs rounded-lg border border-border/60 bg-background/60 focus:outline-none focus:border-primary/50 cursor-pointer"
            >
              {[10, 25, 50].map(n => <option key={n} value={n}>{n} rows</option>)}
            </select>
          </div>
        </div>

        {/* Column toggle */}
        <div className="px-5 py-2.5 border-b border-border/30 flex flex-wrap gap-1.5">
          <span className="text-[11px] font-mono text-muted-foreground mr-1 self-center">Columns:</span>
          {allCols.map(col => (
            <button key={col} onClick={() => toggleCol(col)}
              className={cn("inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded border transition-colors",
                hiddenCols.includes(col)
                  ? "border-border/40 text-muted-foreground/50 bg-transparent"
                  : "border-primary/30 text-primary bg-primary/10")}>
              {hiddenCols.includes(col) ? <EyeOff className="h-2.5 w-2.5" /> : <Eye className="h-2.5 w-2.5" />}
              {col}
            </button>
          ))}
        </div>

        {/* JSON view */}
        {viewMode === "json" ? (
          <div className="overflow-auto max-h-[500px] p-5">
            <pre className="text-xs font-mono text-muted-foreground leading-relaxed">
              {JSON.stringify(pageData, null, 2)}
            </pre>
          </div>
        ) : (
          /* Table view */
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/40 text-left font-mono uppercase tracking-wider text-muted-foreground sticky top-0 bg-card/80 backdrop-blur">
                  <th className="px-4 py-3 w-10 font-medium">#</th>
                  {visibleCols.map(col => (
                    <th key={col} className="px-4 py-3 font-medium whitespace-nowrap">{col}</th>
                  ))}
                  <th className="px-4 py-3 font-medium text-right">Copy</th>
                </tr>
              </thead>
              <tbody>
                {pageData.map((row, i) => (
                  <tr key={i} className={cn(
                    "border-b border-border/20 last:border-0 transition-colors",
                    i % 2 === 0 ? "bg-transparent" : "bg-muted/10",
                    "hover:bg-primary/5"
                  )}>
                    <td className="px-4 py-3 text-muted-foreground/50 font-mono">
                      {page * pageSize + i + 1}
                    </td>
                    {visibleCols.map(col => (
                      <td key={col} className="px-4 py-3 font-mono text-muted-foreground whitespace-nowrap">
                        {String(row[col] ?? "—")}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => copyRow(row, i)}
                        className="p-1.5 rounded-md hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors">
                        {copiedRow === i ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <div className="px-5 py-3 border-t border-border/40 flex items-center justify-between">
          <span className="text-xs text-muted-foreground font-mono">
            {filtered.length} records · Page {page + 1} of {Math.max(1, totalPages)}
          </span>
          <div className="flex gap-1.5">
            <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs border-border/50"
              onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>
              ← Prev
            </Button>
            <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs border-border/50"
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>
              Next →
            </Button>
          </div>
        </div>
      </div>

      {/* ── Download ── */}
      <div className="glass rounded-2xl p-6 border border-border/40">
        <h3 className="text-sm font-semibold mb-1">Download Masked Data</h3>
        <p className="text-xs text-muted-foreground mb-4">Export your privacy-protected dataset</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { label: "Download CSV", icon: Download, onClick: () => downloadCSV(result), accent: "hover:border-primary/60 hover:text-primary hover:bg-primary/5" },
            { label: "Download JSON", icon: Braces, onClick: () => downloadJSON(result), accent: "hover:border-secondary/60 hover:text-secondary hover:bg-secondary/5" },
            { label: "Download XLSX", icon: Table2, onClick: () => downloadXLSX(result), accent: "hover:border-indigo-400/60 hover:text-indigo-400 hover:bg-indigo-400/5" },
          ].map(({ label, icon: Icon, onClick, accent }) => (
            <button key={label} onClick={onClick}
              className={cn(
                "flex items-center justify-center gap-2.5 px-5 py-3.5 rounded-xl border border-border/50 text-muted-foreground text-sm font-medium transition-all duration-200 hover:scale-[1.02]",
                accent
              )}>
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Explanations panel ── */}
      <div className="glass rounded-2xl border border-border/40 overflow-hidden">
        <button
          onClick={() => setExplanationsOpen(v => !v)}
          className="w-full flex items-center justify-between px-6 py-4 hover:bg-muted/20 transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <Shield className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">How your data was masked</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-mono">
              {Object.keys(report.explanations).length} fields
            </span>
          </div>
          {explanationsOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </button>

        {explanationsOpen && (
          <div className="px-6 pb-5 border-t border-border/30 pt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 animate-fade-in">
            {Object.entries(report.explanations).map(([field, note]) => (
              <div key={field} className="flex gap-3 p-3 rounded-xl bg-muted/20 border border-border/30">
                <div className="mt-0.5 h-5 w-5 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                  <Shield className="h-3 w-3 text-primary" />
                </div>
                <div>
                  <p className="text-xs font-semibold font-mono text-primary capitalize mb-0.5">{field}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{note}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Risk reason */}
        <div className="px-6 py-3 border-t border-border/30 flex items-center gap-3">
          <span className={cn("text-xs px-2.5 py-1 rounded-lg border font-mono font-medium capitalize", RISK_COLORS[risk] ?? "text-muted-foreground")}>
            {report.riskScore.level} risk · {report.riskScore.score.toFixed(2)}
          </span>
          <span className="text-xs text-muted-foreground">{report.riskScore.reason}</span>
        </div>
      </div>

      {/* Pipeline meta */}
      <div className="flex flex-wrap gap-2 text-[11px] font-mono text-muted-foreground/60 justify-end">
        <span>pipeline v{report.pipeline.version}</span>
        <span>·</span>
        <span>masking: {maskingLevel}</span>
        <span>·</span>
        <span>input: {report.pipeline.inputType}</span>
        <span>·</span>
        <span>steps: {report.pipeline.steps.join(" → ")}</span>
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
      {!result ? (
        <UploadSection onResult={handleResult} onProcessStart={() => setProcessing(true)} />
      ) : (
        <ResultDashboard data={result} elapsed={elapsed} onReset={handleReset} />
      )}
      {/* suppress unused */}
      {processing && <></>}
    </div>
  );
}