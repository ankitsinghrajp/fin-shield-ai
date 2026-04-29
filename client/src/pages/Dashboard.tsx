import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { StatsCard } from "@/components/StatsCard";
import {
  FileStack,
  Database,
  ShieldAlert,
  Gauge,
  ArrowRight,
  Layers,
  RefreshCw,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGetDashboardDataQuery } from "@/redux/api/api";
import { cn } from "@/lib/utils";

/* ─── tiny helpers ──────────────────────────────────────────── */
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

/* ─── skeleton card ──────────────────────────────────────────── */
const SkeletonCard = () => (
  <div className="glass rounded-2xl p-5 relative overflow-hidden animate-pulse">
    <div className="h-3 w-24 rounded-full bg-muted/40 mb-4" />
    <div className="h-8 w-16 rounded-full bg-muted/40 mb-2" />
    <div className="h-2 w-20 rounded-full bg-muted/30" />
  </div>
);

/* ─── run row ────────────────────────────────────────────────── */
interface RunRowProps {
  run: {
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
  };
  index: number;
}

const maskingLevelColor: Record<string, string> = {
  low: "text-primary bg-primary/10 border-primary/20",
  medium: "text-warning bg-warning/10 border-warning/20",
  high: "text-destructive bg-destructive/10 border-destructive/20",
};

const RunRow = ({ run, index }: RunRowProps) => (
  <div
    className="glass rounded-xl px-5 py-4 grid grid-cols-2 md:grid-cols-5 gap-3 items-center
               hover:border-primary/30 transition-all duration-300 group"
    style={{ animationDelay: `${index * 60}ms` }}
  >
    {/* file */}
    <div className="col-span-2 md:col-span-1 flex items-center gap-3 min-w-0">
      <div className="p-2 rounded-lg bg-primary/10 border border-primary/20 shrink-0">
        <FileStack className="h-4 w-4 text-primary" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold truncate">{run.fileName}</p>
        <p className="text-xs text-muted-foreground">
          {formatBytes(run.fileSize)}
        </p>
      </div>
    </div>

    {/* records */}
    <div className="hidden md:block text-center">
      <p className="text-sm font-bold">{run.recordsProcessed.toLocaleString()}</p>
      <p className="text-xs text-muted-foreground">records</p>
    </div>

    {/* pii */}
    <div className="hidden md:block text-center">
      <p className="text-sm font-bold text-warning">{run.piiDetectedPercentage}%</p>
      <p className="text-xs text-muted-foreground">PII detected</p>
    </div>

    {/* utility */}
    <div className="hidden md:block text-center">
      <div className="flex flex-col items-center gap-1">
        <p className="text-sm font-bold text-primary">{run.dataUtilityScore.toFixed(1)}</p>
        {/* mini bar */}
        <div className="w-16 h-1.5 rounded-full bg-muted/40 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary to-secondary transition-all duration-700"
            style={{ width: `${run.dataUtilityScore}%` }}
          />
        </div>
      </div>
    </div>

    {/* level + time */}
    <div className="flex flex-col items-end gap-1">
      <span
        className={cn(
          "text-xs font-mono px-2 py-0.5 rounded-full border capitalize",
          maskingLevelColor[run.maskingLevel] ?? "text-muted-foreground bg-muted/10 border-muted/20"
        )}
      >
        {run.maskingLevel}
      </span>
      <span className="text-xs text-muted-foreground flex items-center gap-1">
        <Clock className="h-3 w-3" />
        {timeAgo(run.createdAt)}
      </span>
    </div>
  </div>
);

/* ─── main page ──────────────────────────────────────────────── */
export default function Dashboard() {
  const navigate = useNavigate();

  const {
    data: response,
    isLoading,
    isFetching,
    refetch,
  } = useGetDashboardDataQuery(undefined, {
    refetchOnMountOrArgChange: true, // re-fetches every time page mounts / reloads
  });

  const stats = response?.data?.stats;
  const runs: RunRowProps["run"][] = response?.data?.runs ?? [];

  return (
    <DashboardLayout>
      {/* ── header ── */}
      <div className="flex flex-col gap-2 mb-8 animate-fade-in">
        <p className="text-xs font-mono uppercase tracking-widest text-primary">
          Workspace overview
        </p>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Privacy Pipeline</h1>
            <p className="text-muted-foreground mt-1">
              Detect and mask PII in your datasets with one click.
            </p>
          </div>

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

        {/* latest-run banner */}
        {stats?.latestRun && (
          <div
            className="mt-1 inline-flex items-center gap-2 text-xs text-muted-foreground
                          font-mono px-3 py-1 rounded-full border border-border/40 bg-muted/10 w-fit
                          animate-fade-in"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            Last run {timeAgo(stats.latestRun)}
          </div>
        )}
      </div>

      {/* ── stats grid ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8 animate-fade-in-up">
        {isLoading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          <>
            <StatsCard
              label="Total runs"
              value={stats ? String(stats.totalRuns) : "—"}
              delta={
                stats?.totalRuns
                  ? `${stats.totalRuns} run${stats.totalRuns !== 1 ? "s" : ""} completed`
                  : "No runs yet"
              }
              trend={stats?.totalRuns ? "up" : undefined}
              icon={FileStack}
              accent="primary"
            />
            <StatsCard
              label="Records processed"
              value={stats ? stats.totalRecordsProcessed.toLocaleString() : "—"}
              delta={
                stats?.totalRecordsProcessed
                  ? `${stats.totalFieldsMasked.toLocaleString()} fields masked`
                  : "Upload a file to begin"
              }
              trend={stats?.totalRecordsProcessed ? "up" : undefined}
              icon={Database}
              accent="secondary"
            />
            <StatsCard
              label="Avg PII detected"
              value={stats ? `${stats.averagePiiPercentage}%` : "—"}
              delta={stats ? "avg across all runs" : "No data yet"}
              icon={ShieldAlert}
              accent="warning"
            />
            <StatsCard
              label="Avg utility score"
              value={stats ? `${stats.averageUtilityScore.toFixed(1)}` : "—"}
              delta={stats ? "utility retained" : "No data yet"}
              trend={stats?.averageUtilityScore ? "up" : undefined}
              icon={Gauge}
              accent="primary"
            />
          </>
        )}
      </div>

      {/* ── fields masked highlight ── */}
      {!isLoading && stats && stats.totalFieldsMasked > 0 && (
        <div
          className="mb-8 glass rounded-2xl p-5 border border-primary/20
                       bg-gradient-to-r from-primary/5 via-transparent to-secondary/5
                       flex flex-wrap items-center justify-between gap-4 animate-fade-in"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 border border-primary/20">
              <Layers className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                Total fields masked
              </p>
              <p className="text-2xl font-bold tracking-tight">
                {stats.totalFieldsMasked.toLocaleString()}
              </p>
            </div>
          </div>
          {/* progress bar across the card */}
          <div className="flex-1 min-w-[120px] max-w-xs">
            <div className="flex justify-between text-xs text-muted-foreground mb-1 font-mono">
              <span>utility retained</span>
              <span>{stats.averageUtilityScore.toFixed(1)}%</span>
            </div>
            <div className="h-2 rounded-full bg-muted/30 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary to-secondary
                              transition-all duration-1000 ease-out"
                style={{ width: `${Math.min(stats.averageUtilityScore, 100)}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── CTA ── */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">New upload</h2>
          <span className="text-xs font-mono text-muted-foreground">
            CSV · JSON · XLSX only
          </span>
        </div>
        <div
          onClick={() => navigate("/process")}
          className="glass rounded-2xl border-2 border-dashed border-border/60
                       hover:border-primary/50 transition-all cursor-pointer p-10
                       flex flex-col items-center text-center group"
        >
          <div className="relative mb-4">
            <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full" />
            <div className="relative p-4 rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 border border-primary/30">
              <FileStack className="h-7 w-7 text-primary" />
            </div>
          </div>
          <h3 className="text-lg font-semibold mb-1">Open Privacy Engine</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Upload a CSV, JSON, or XLSX file and get masked data instantly
          </p>
          <Button className="bg-gradient-primary text-primary-foreground btn-glow shadow-glow-primary gap-2 group-hover:scale-105 transition-transform">
            Go to processor <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </section>

      {/* ── recent activity ── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Recent activity</h2>
          <span className="text-xs font-mono text-muted-foreground">
            {isLoading ? "—" : `${runs.length} run${runs.length !== 1 ? "s" : ""}`}
          </span>
        </div>

        {isLoading ? (
          <div className="flex flex-col gap-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="glass rounded-xl h-16 animate-pulse"
                style={{ animationDelay: `${i * 80}ms` }}
              />
            ))}
          </div>
        ) : runs.length === 0 ? (
          <div className="glass rounded-2xl p-10 text-center text-muted-foreground text-sm">
            No runs yet — process a file to see activity here.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {/* column headers – desktop only */}
            <div className="hidden md:grid grid-cols-5 px-5 text-xs font-mono uppercase tracking-wider text-muted-foreground/60">
              <span>File</span>
              <span className="text-center">Records</span>
              <span className="text-center">PII</span>
              <span className="text-center">Utility</span>
              <span className="text-right">Level / Time</span>
            </div>

            {runs.map((run, i) => (
              <RunRow key={run._id} run={run} index={i} />
            ))}
          </div>
        )}
      </section>
    </DashboardLayout>
  );
}