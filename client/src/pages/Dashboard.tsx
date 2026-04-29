import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { StatsCard } from "@/components/StatsCard";
import { ActivityTable } from "@/components/ActivityTable";
import { FileStack, Database, ShieldAlert, Gauge, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { RunEntry } from "@/types/pipeline";

export default function Dashboard() {
  const navigate = useNavigate();
  // In a real app, hydrate this from a global store or context that ProcessPage writes to
  const [runs] = useState<RunEntry[]>([]);

  const totalRuns = runs.length;
  const totalRecords = runs.reduce((s, r) => s + r.recordCount, 0);
  const avgPii =
    totalRuns > 0
      ? (runs.reduce((s, r) => s + parseFloat(r.piiPercent), 0) / totalRuns).toFixed(1)
      : null;
  const avgUtility =
    totalRuns > 0
      ? (runs.reduce((s, r) => s + parseFloat(r.utilityPercent), 0) / totalRuns).toFixed(1)
      : null;

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-2 mb-8 animate-fade-in">
        <p className="text-xs font-mono uppercase tracking-widest text-primary">Workspace overview</p>
        <h1 className="text-3xl font-bold tracking-tight">Privacy Pipeline</h1>
        <p className="text-muted-foreground">
          Detect and mask PII in your datasets with one click.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8 animate-fade-in-up">
        <StatsCard
          label="Runs this session"
          value={totalRuns === 0 ? "—" : String(totalRuns)}
          delta={totalRuns === 0 ? "No runs yet" : `${totalRuns} run${totalRuns > 1 ? "s" : ""}`}
          trend={totalRuns > 0 ? "up" : undefined}
          icon={FileStack}
          accent="primary"
        />
        <StatsCard
          label="Records processed"
          value={totalRecords === 0 ? "—" : totalRecords.toLocaleString()}
          delta={totalRecords === 0 ? "Upload a file to begin" : "across all runs"}
          trend={totalRecords > 0 ? "up" : undefined}
          icon={Database}
          accent="secondary"
        />
        <StatsCard
          label="Avg PII detected"
          value={avgPii ? `${avgPii}%` : "—"}
          delta={avgPii ? "avg across runs" : "No data yet"}
          icon={ShieldAlert}
          accent="warning"
        />
        <StatsCard
          label="Avg utility score"
          value={avgUtility ?? "—"}
          delta={avgUtility ? "utility retained" : "No data yet"}
          trend={avgUtility ? "up" : undefined}
          icon={Gauge}
          accent="primary"
        />
      </div>

      {/* CTA */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">New upload</h2>
          <span className="text-xs font-mono text-muted-foreground">CSV · JSON · XLSX only</span>
        </div>
        <div
          onClick={() => navigate("/process")}
          className="glass rounded-2xl border-2 border-dashed border-border/60 hover:border-primary/50 transition-all cursor-pointer p-10 flex flex-col items-center text-center group"
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

      {/* Recent activity */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Recent activity</h2>
          <span className="text-xs font-mono text-muted-foreground">
            {totalRuns} run{totalRuns !== 1 ? "s" : ""}
          </span>
        </div>
        {totalRuns === 0 ? (
          <div className="glass rounded-2xl p-10 text-center text-muted-foreground text-sm">
            No runs yet — process a file to see activity here.
          </div>
        ) : (
          <ActivityTable runs={runs} />
        )}
      </section>
    </DashboardLayout>
  );
}