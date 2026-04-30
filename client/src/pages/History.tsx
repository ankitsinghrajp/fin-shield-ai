import { useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import {
  FileStack,
  Search,
  Clock,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Database,
  ShieldAlert,
  Gauge,
  Filter,
  X,
  RefreshCw,
  Layers,
  CalendarDays,
  ArrowUpDown,
  SlidersHorizontal,
  FileText,
  FileJson,
  Sheet,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useGetDashboardDataQuery } from "@/redux/api/api";
import { cn } from "@/lib/utils";

/* ─── types ─────────────────────────────────────────────────── */
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
  createdAt: string;
}

type SortKey = "createdAt" | "recordsProcessed" | "piiDetectedPercentage" | "dataUtilityScore" | "fileSize";
type SortDir = "asc" | "desc";
type MaskingFilter = "all" | "low" | "medium" | "high";

/* ─── helpers ────────────────────────────────────────────────── */
function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/* ─── sub-components ─────────────────────────────────────────── */

const maskingColors: Record<string, string> = {
  low: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  medium: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  high: "text-red-400 bg-red-400/10 border-red-400/20",
};

const maskingDot: Record<string, string> = {
  low: "bg-emerald-400",
  medium: "bg-amber-400",
  high: "bg-red-400",
};

const fileTypeIcon = (type: string) => {
  const t = type?.toLowerCase();
  if (t === "json" || t === "jsonl") return <FileJson className="h-4 w-4 text-primary" />;
  if (t === "xlsx" || t === "xls") return <Sheet className="h-4 w-4 text-primary" />;
  return <FileText className="h-4 w-4 text-primary" />;
};

/* Skeleton */
const SkeletonRow = ({ delay }: { delay: number }) => (
  <div
    className="glass rounded-xl h-[68px] animate-pulse"
    style={{ animationDelay: `${delay}ms` }}
  />
);

/* Sort indicator */
const SortIcon = ({ col, current, dir }: { col: SortKey; current: SortKey; dir: SortDir }) => {
  if (col !== current) return <ArrowUpDown className="h-3 w-3 opacity-30" />;
  return dir === "asc"
    ? <ChevronUp className="h-3 w-3 text-primary" />
    : <ChevronDown className="h-3 w-3 text-primary" />;
};

/* Utility bar */
const UtilityBar = ({ score }: { score: number }) => (
  <div className="flex flex-col items-center gap-1">
    <p className="text-sm font-bold text-primary">{score.toFixed(1)}</p>
    <div className="w-16 h-1.5 rounded-full bg-muted/40 overflow-hidden">
      <div
        className="h-full rounded-full bg-gradient-to-r from-primary to-secondary transition-all duration-700"
        style={{ width: `${Math.min(score, 100)}%` }}
      />
    </div>
  </div>
);

/* Run row */
const RunRow = ({
  run,
  index,
  onClick,
  selected,
}: {
  run: Run;
  index: number;
  onClick: () => void;
  selected?: boolean;
}) => (
  <div
    role="button"
    tabIndex={0}
    onClick={onClick}
    onKeyDown={(e) => e.key === "Enter" && onClick()}
    className={cn(
      "glass rounded-xl px-5 py-4 grid grid-cols-2 md:grid-cols-6 gap-3 items-center",
      "hover:border-primary/40 hover:bg-primary/[0.03] transition-all duration-200 group cursor-pointer",
      "focus:outline-none focus:ring-2 focus:ring-primary/40",
      selected && "border-primary/40 bg-primary/[0.04]"
    )}
    style={{
      animation: "fadeSlideUp 0.35s ease both",
      animationDelay: `${index * 45}ms`,
    }}
  >
    {/* File */}
    <div className="col-span-2 md:col-span-1 flex items-center gap-3 min-w-0">
      <div className="p-2 rounded-lg bg-primary/10 border border-primary/20 shrink-0">
        {fileTypeIcon(run.fileType)}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold truncate group-hover:text-primary transition-colors">
          {run.fileName}
        </p>
        <p className="text-xs text-muted-foreground font-mono">
          {formatBytes(run.fileSize)}
        </p>
      </div>
    </div>

    {/* Records */}
    <div className="hidden md:block text-center">
      <p className="text-sm font-bold">{run.recordsProcessed.toLocaleString()}</p>
      <p className="text-xs text-muted-foreground">records</p>
    </div>

    {/* PII */}
    <div className="hidden md:block text-center">
      <p className="text-sm font-bold text-amber-400">{run.piiDetectedPercentage}%</p>
      <p className="text-xs text-muted-foreground">PII</p>
    </div>

    {/* Fields masked */}
    <div className="hidden md:block text-center">
      <p className="text-sm font-bold text-violet-400">{run.fieldsMasked.toLocaleString()}</p>
      <p className="text-xs text-muted-foreground">masked</p>
    </div>

    {/* Utility */}
    <div className="hidden md:block text-center">
      <UtilityBar score={run.dataUtilityScore} />
    </div>

    {/* Level + time + chevron */}
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "text-xs font-mono px-2 py-0.5 rounded-full border capitalize inline-flex items-center gap-1.5",
            maskingColors[run.maskingLevel] ?? "text-muted-foreground bg-muted/10 border-muted/20"
          )}
        >
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              maskingDot[run.maskingLevel] ?? "bg-muted-foreground"
            )}
          />
          {run.maskingLevel}
        </span>
        <ChevronRight className="h-4 w-4 text-primary opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
      </div>
      <span className="text-xs text-muted-foreground font-mono flex items-center gap-1">
        <Clock className="h-3 w-3" />
        {timeAgo(run.createdAt)}
      </span>
    </div>
  </div>
);

/* Summary banner */
const SummaryBanner = ({ runs }: { runs: Run[] }) => {
  if (!runs.length) return null;
  const totalRecords = runs.reduce((s, r) => s + r.recordsProcessed, 0);
  const totalMasked = runs.reduce((s, r) => s + r.fieldsMasked, 0);
  const avgPii = (runs.reduce((s, r) => s + r.piiDetectedPercentage, 0) / runs.length).toFixed(1);
  const avgUtil = (runs.reduce((s, r) => s + r.dataUtilityScore, 0) / runs.length).toFixed(1);

  return (
    <div className="glass rounded-2xl p-4 border border-primary/20 bg-gradient-to-r from-primary/5 via-transparent to-secondary/5 mb-4 grid grid-cols-2 md:grid-cols-4 gap-4 animate-fade-in">
      {[
        { label: "Filtered runs", value: runs.length, icon: FileStack, color: "text-primary" },
        { label: "Total records", value: totalRecords.toLocaleString(), icon: Database, color: "text-secondary" },
        { label: "Avg PII", value: `${avgPii}%`, icon: ShieldAlert, color: "text-amber-400" },
        { label: "Avg utility", value: `${avgUtil}`, icon: Gauge, color: "text-primary" },
      ].map(({ label, value, icon: Icon, color }) => (
        <div key={label} className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 border border-primary/20 shrink-0">
            <Icon className={cn("h-4 w-4", color)} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider">{label}</p>
            <p className={cn("text-lg font-bold", color)}>{value}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

/* Empty state */
const EmptyState = ({ hasFilters, onClear }: { hasFilters: boolean; onClear: () => void }) => (
  <div className="glass rounded-2xl p-16 text-center animate-fade-in">
    <div className="inline-flex p-4 rounded-2xl bg-muted/10 border border-border/30 mb-4">
      <Layers className="h-8 w-8 text-muted-foreground/40" />
    </div>
    <p className="text-muted-foreground text-sm mb-2">
      {hasFilters ? "No runs match these filters." : "No runs yet — process a file to see history here."}
    </p>
    {hasFilters && (
      <Button variant="ghost" size="sm" onClick={onClear} className="text-primary hover:text-primary/80 mt-1">
        <X className="h-3.5 w-3.5 mr-1" /> Clear filters
      </Button>
    )}
  </div>
);

/* Pagination */
const Pagination = ({
  page,
  total,
  perPage,
  onChange,
}: {
  page: number;
  total: number;
  perPage: number;
  onChange: (p: number) => void;
}) => {
  const pages = Math.ceil(total / perPage);
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-2 mt-6">
      <Button
        variant="ghost"
        size="sm"
        disabled={page === 1}
        onClick={() => onChange(page - 1)}
        className="rounded-lg border border-border/50 hover:border-primary/40 disabled:opacity-30"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className={cn(
            "h-8 w-8 rounded-lg text-xs font-mono border transition-all",
            p === page
              ? "bg-primary/15 border-primary/40 text-primary"
              : "border-border/40 text-muted-foreground hover:border-primary/30 hover:text-foreground"
          )}
        >
          {p}
        </button>
      ))}
      <Button
        variant="ghost"
        size="sm"
        disabled={page === pages}
        onClick={() => onChange(page + 1)}
        className="rounded-lg border border-border/50 hover:border-primary/40 disabled:opacity-30"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
};

// Need to import ChevronLeft separately since it wasn't in the original import
import { ChevronLeft } from "lucide-react";

/* ─── constants ──────────────────────────────────────────────── */
const MASKING_LEVELS: MaskingFilter[] = ["all", "low", "medium", "high"];
const PER_PAGE = 10;

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "createdAt", label: "Date" },
  { key: "recordsProcessed", label: "Records" },
  { key: "piiDetectedPercentage", label: "PII %" },
  { key: "dataUtilityScore", label: "Utility" },
  { key: "fileSize", label: "File size" },
];

/* ─── main ───────────────────────────────────────────────────── */
export default function History() {
  const navigate = useNavigate();

  const { data: response, isLoading, isFetching, refetch } = useGetDashboardDataQuery(undefined, {
    refetchOnMountOrArgChange: true,
  });

  const runs: Run[] = response?.data?.runs ?? [];

  /* filter state */
  const [query, setQuery] = useState("");
  const [maskingLevel, setMaskingLevel] = useState<MaskingFilter>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  const handleSort = useCallback(
    (key: SortKey) => {
      if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      else { setSortKey(key); setSortDir("desc"); }
      setPage(1);
    },
    [sortKey]
  );

  const clearFilters = useCallback(() => {
    setQuery("");
    setMaskingLevel("all");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  }, []);

  const hasFilters = query || maskingLevel !== "all" || dateFrom || dateTo;

  /* filtered + sorted */
  const processed = useMemo(() => {
    let list = [...runs];

    if (query) {
      const q = query.toLowerCase();
      list = list.filter((r) => r.fileName.toLowerCase().includes(q));
    }
    if (maskingLevel !== "all") {
      list = list.filter((r) => r.maskingLevel === maskingLevel);
    }
    if (dateFrom) {
      list = list.filter((r) => new Date(r.createdAt) >= new Date(dateFrom));
    }
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      list = list.filter((r) => new Date(r.createdAt) <= to);
    }

    list.sort((a, b) => {
      let av: number, bv: number;
      if (sortKey === "createdAt") {
        av = new Date(a.createdAt).getTime();
        bv = new Date(b.createdAt).getTime();
      } else {
        av = a[sortKey] as number;
        bv = b[sortKey] as number;
      }
      return sortDir === "asc" ? av - bv : bv - av;
    });

    return list;
  }, [runs, query, maskingLevel, dateFrom, dateTo, sortKey, sortDir]);

  const paginated = useMemo(
    () => processed.slice((page - 1) * PER_PAGE, page * PER_PAGE),
    [processed, page]
  );

  return (
    <>
      {/* inject keyframe */}
      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in { animation: fadeSlideUp 0.4s ease both; }
      `}</style>

      <DashboardLayout>
        {/* ── Header ── */}
        <div className="flex flex-col gap-2 mb-8 animate-fade-in">
          <p className="text-xs font-mono uppercase tracking-widest text-primary">All runs</p>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Processing history</h1>
              <p className="text-muted-foreground mt-1">
                Audit every file processed by your pipeline.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {hasFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="text-xs font-mono text-muted-foreground hover:text-red-400 border border-border/40 hover:border-red-400/40 rounded-lg transition-all gap-1.5"
                >
                  <X className="h-3.5 w-3.5" /> Clear filters
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => refetch()}
                disabled={isFetching}
                className="rounded-xl border border-border/60 hover:border-primary/40 hover:bg-primary/5 transition-all"
                title="Refresh"
              >
                <RefreshCw
                  className={cn("h-4 w-4 text-muted-foreground", isFetching && "animate-spin text-primary")}
                />
              </Button>
            </div>
          </div>

          {/* latest run badge */}
          {!isLoading && runs[0] && (
            <div className="inline-flex items-center gap-2 text-xs text-muted-foreground font-mono px-3 py-1 rounded-full border border-border/40 bg-muted/10 w-fit animate-fade-in">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              {runs.length} total run{runs.length !== 1 ? "s" : ""} · last {timeAgo(runs[0].createdAt)}
            </div>
          )}
        </div>

        {/* ── Filters ── */}
        <div className="glass rounded-2xl p-4 mb-4 animate-fade-in" style={{ animationDelay: "60ms" }}>
          {/* top row: search + filter toggle */}
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by file name…"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setPage(1); }}
                className="pl-9 bg-muted/40 border-border/60 font-mono text-sm"
              />
              {query && (
                <button
                  onClick={() => { setQuery(""); setPage(1); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <button
              onClick={() => setShowFilters((v) => !v)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-mono transition-all",
                showFilters
                  ? "bg-primary/15 border-primary/40 text-primary"
                  : "bg-muted/40 border-border/50 text-muted-foreground hover:text-foreground"
              )}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filters
              {hasFilters && (
                <span className="ml-1 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center font-bold">
                  {[query, maskingLevel !== "all", dateFrom, dateTo].filter(Boolean).length}
                </span>
              )}
            </button>
          </div>

          {/* expanded filters */}
          {showFilters && (
            <div className="mt-3 pt-3 border-t border-border/40 flex flex-col sm:flex-row gap-3 sm:items-end flex-wrap animate-fade-in">
              {/* masking level */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                  Masking level
                </label>
                <div className="flex gap-2">
                  {MASKING_LEVELS.map((lvl) => (
                    <button
                      key={lvl}
                      onClick={() => { setMaskingLevel(lvl); setPage(1); }}
                      className={cn(
                        "px-3 py-1.5 rounded-md text-xs font-mono uppercase tracking-wider border transition-all flex items-center gap-1.5",
                        maskingLevel === lvl
                          ? lvl === "all"
                            ? "bg-primary/15 border-primary/40 text-primary"
                            : maskingColors[lvl]
                          : "bg-muted/40 border-border/50 text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {lvl !== "all" && (
                        <span className={cn("h-1.5 w-1.5 rounded-full", maskingDot[lvl])} />
                      )}
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>

              {/* date range */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <CalendarDays className="h-3 w-3" /> Date from
                </label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                  className="w-auto bg-muted/40 border-border/60 font-mono text-xs"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <CalendarDays className="h-3 w-3" /> Date to
                </label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                  className="w-auto bg-muted/40 border-border/60 font-mono text-xs"
                />
              </div>

              {/* sort */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                  Sort by
                </label>
                <div className="flex gap-2 flex-wrap">
                  {SORT_OPTIONS.map(({ key, label }) => (
                    <button
                      key={key}
                      onClick={() => handleSort(key)}
                      className={cn(
                        "px-3 py-1.5 rounded-md text-xs font-mono border transition-all flex items-center gap-1",
                        sortKey === key
                          ? "bg-primary/15 border-primary/40 text-primary"
                          : "bg-muted/40 border-border/50 text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {label}
                      <SortIcon col={key} current={sortKey} dir={sortDir} />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Summary banner ── */}
        {!isLoading && processed.length > 0 && (
          <SummaryBanner runs={processed} />
        )}

        {/* ── Table ── */}
        {isLoading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 6 }, (_, i) => (
              <SkeletonRow key={i} delay={i * 60} />
            ))}
          </div>
        ) : paginated.length === 0 ? (
          <EmptyState hasFilters={!!hasFilters} onClear={clearFilters} />
        ) : (
          <>
            {/* column headers */}
            <div className="hidden md:grid grid-cols-6 px-5 mb-2 text-xs font-mono uppercase tracking-wider text-muted-foreground/50">
              <button
                className="flex items-center gap-1 hover:text-muted-foreground transition-colors text-left"
                onClick={() => handleSort("fileSize")}
              >
                File <SortIcon col="fileSize" current={sortKey} dir={sortDir} />
              </button>
              <button
                className="flex items-center gap-1 justify-center hover:text-muted-foreground transition-colors"
                onClick={() => handleSort("recordsProcessed")}
              >
                Records <SortIcon col="recordsProcessed" current={sortKey} dir={sortDir} />
              </button>
              <button
                className="flex items-center gap-1 justify-center hover:text-muted-foreground transition-colors"
                onClick={() => handleSort("piiDetectedPercentage")}
              >
                PII <SortIcon col="piiDetectedPercentage" current={sortKey} dir={sortDir} />
              </button>
              <span className="text-center">Masked</span>
              <button
                className="flex items-center gap-1 justify-center hover:text-muted-foreground transition-colors"
                onClick={() => handleSort("dataUtilityScore")}
              >
                Utility <SortIcon col="dataUtilityScore" current={sortKey} dir={sortDir} />
              </button>
              <button
                className="flex items-center gap-1 justify-end hover:text-muted-foreground transition-colors"
                onClick={() => handleSort("createdAt")}
              >
                Level / Time <SortIcon col="createdAt" current={sortKey} dir={sortDir} />
              </button>
            </div>

            <div className="flex flex-col gap-3">
              {paginated.map((run, i) => (
                <RunRow
                  key={run._id}
                  run={run}
                  index={i}
                  onClick={() => navigate(`/dashboard/${run._id}`)}
                />
              ))}
            </div>

            {/* pagination */}
            <Pagination
              page={page}
              total={processed.length}
              perPage={PER_PAGE}
              onChange={setPage}
            />

            <p className="text-center text-[11px] font-mono text-muted-foreground/40 mt-4">
              Showing {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, processed.length)} of{" "}
              {processed.length} run{processed.length !== 1 ? "s" : ""} · Click any row to view full details
            </p>
          </>
        )}
      </DashboardLayout>
    </>
  );
}