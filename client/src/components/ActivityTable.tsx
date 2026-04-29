import { useState } from "react";
import { ArrowUpRight, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface RunEntry {
  runId: string;
  fileName: string;
  recordCount: number;
  piiPercent: string;
  utilityPercent: string;
  maskingLevel: string;
  riskLevel: string;
  timestamp: string;
  data: {
    result: Record<string, unknown>[];
    report: {
      breakdown: {
        directPII: Record<string, number>;
        sensitivePII: Record<string, number>;
        quasiIdentifiers: Record<string, number>;
      };
      riskScore: { level: string; score: number; reason: string };
      explanations: Record<string, string>;
    };
  };
}

interface Props {
  runs: RunEntry[];
  showAll?: boolean;
}

// ─── Risk badge ───────────────────────────────────────────────────────────────

const riskClass: Record<string, string> = {
  low: "text-primary bg-primary/10 border-primary/30",
  medium: "text-secondary bg-secondary/10 border-secondary/30",
  high: "text-destructive bg-destructive/10 border-destructive/30",
};

// ─── Component ────────────────────────────────────────────────────────────────

export const ActivityTable = ({ runs, showAll = false }: Props) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const visible = showAll ? runs : runs.slice(0, 5);

  return (
    <div className="glass rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/50 text-left text-xs font-mono uppercase tracking-wider text-muted-foreground">
              <th className="px-5 py-3 font-medium">File</th>
              <th className="px-5 py-3 font-medium">Records</th>
              <th className="px-5 py-3 font-medium">PII %</th>
              <th className="px-5 py-3 font-medium">Utility</th>
              <th className="px-5 py-3 font-medium">Risk</th>
              <th className="px-5 py-3 font-medium">Masking</th>
              <th className="px-5 py-3 font-medium">Date</th>
              <th className="px-5 py-3 font-medium text-right">Details</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((run) => {
              const isExpanded = expandedId === run.runId;
              const risk = run.riskLevel.toLowerCase();
              const breakdown = run.data.report.breakdown;
              const totalPiiFields = [
                ...Object.values(breakdown.directPII),
                ...Object.values(breakdown.sensitivePII),
                ...Object.values(breakdown.quasiIdentifiers),
              ].reduce((a, b) => a + b, 0);

              return (
                <>
                  <tr
                    key={run.runId}
                    className={cn(
                      "border-b border-border/30 last:border-0 hover:bg-muted/30 transition cursor-pointer",
                      isExpanded && "bg-muted/20"
                    )}
                    onClick={() => setExpandedId(isExpanded ? null : run.runId)}
                  >
                    {/* File */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                        <div className="min-w-0">
                          <p className="font-medium truncate max-w-[160px]">{run.fileName}</p>
                          <p className="text-xs text-muted-foreground font-mono">{run.runId}</p>
                        </div>
                      </div>
                    </td>

                    {/* Records */}
                    <td className="px-5 py-4 font-mono">{run.recordCount.toLocaleString()}</td>

                    {/* PII % */}
                    <td className="px-5 py-4">
                      <span className="font-mono text-secondary">{run.piiPercent}%</span>
                    </td>

                    {/* Utility */}
                    <td className="px-5 py-4">
                      <span className="font-mono text-primary">{run.utilityPercent}%</span>
                    </td>

                    {/* Risk */}
                    <td className="px-5 py-4">
                      <span
                        className={cn(
                          "inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border capitalize",
                          riskClass[risk] ?? "text-muted-foreground bg-muted/20 border-border/40"
                        )}
                      >
                        {run.riskLevel}
                      </span>
                    </td>

                    {/* Masking */}
                    <td className="px-5 py-4">
                      <span className="text-xs font-mono capitalize text-muted-foreground">
                        {run.maskingLevel}
                      </span>
                    </td>

                    {/* Date */}
                    <td className="px-5 py-4 text-muted-foreground font-mono text-xs">
                      {run.timestamp}
                    </td>

                    {/* Expand */}
                    <td className="px-5 py-4 text-right">
                      <Button variant="ghost" size="sm" className="hover:text-primary">
                        {isExpanded ? (
                          <>
                            Collapse <ChevronUp className="ml-1 h-3 w-3" />
                          </>
                        ) : (
                          <>
                            View <ArrowUpRight className="ml-1 h-3 w-3" />
                          </>
                        )}
                      </Button>
                    </td>
                  </tr>

                  {/* ── Expanded detail row ── */}
                  {isExpanded && (
                    <tr key={`${run.runId}-expanded`} className="border-b border-border/30 bg-muted/10">
                      <td colSpan={8} className="px-5 py-5">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                          {/* PII Breakdown */}
                          <div className="rounded-xl border border-border/40 bg-background/60 p-4">
                            <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">
                              PII Breakdown ({totalPiiFields} fields)
                            </p>
                            <div className="space-y-2">
                              {[
                                { label: "Direct PII", items: breakdown.directPII },
                                { label: "Sensitive PII", items: breakdown.sensitivePII },
                                { label: "Quasi-identifiers", items: breakdown.quasiIdentifiers },
                              ].map(({ label, items }) => (
                                <div key={label}>
                                  <p className="text-[11px] font-medium text-muted-foreground mb-1">{label}</p>
                                  <div className="flex flex-wrap gap-1.5">
                                    {Object.entries(items).map(([k, v]) => (
                                      <span
                                        key={k}
                                        className="text-xs px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20 text-primary font-mono"
                                      >
                                        {k}: {v}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Risk & Score */}
                          <div className="rounded-xl border border-border/40 bg-background/60 p-4">
                            <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">
                              Risk Assessment
                            </p>
                            <div className="flex items-center gap-3 mb-2">
                              <span
                                className={cn(
                                  "text-sm font-bold capitalize px-3 py-1 rounded-lg border",
                                  riskClass[risk] ?? "text-muted-foreground"
                                )}
                              >
                                {run.data.report.riskScore.level}
                              </span>
                              <span className="text-2xl font-bold font-mono">
                                {run.data.report.riskScore.score.toFixed(2)}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {run.data.report.riskScore.reason}
                            </p>
                          </div>

                          {/* Masking Explanations */}
                          <div className="rounded-xl border border-border/40 bg-background/60 p-4">
                            <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">
                              Masking Notes
                            </p>
                            <ul className="space-y-1.5">
                              {Object.entries(run.data.report.explanations)
                                .slice(0, 6)
                                .map(([field, note]) => (
                                  <li key={field} className="text-xs">
                                    <span className="font-mono text-primary mr-1">{field}:</span>
                                    <span className="text-muted-foreground">{note}</span>
                                  </li>
                                ))}
                            </ul>
                          </div>
                        </div>

                        {/* Masked Data Preview */}
                        <div className="mt-4 rounded-xl border border-border/40 bg-background/60 p-4 overflow-x-auto">
                          <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">
                            Masked Data Preview (first 5 records)
                          </p>
                          {run.data.result.length > 0 ? (
                            <table className="w-full text-xs font-mono">
                              <thead>
                                <tr className="border-b border-border/40 text-muted-foreground">
                                  {Object.keys(run.data.result[0]).map((col) => (
                                    <th key={col} className="px-3 py-1.5 text-left whitespace-nowrap font-medium">
                                      {col}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {run.data.result.slice(0, 5).map((row, i) => (
                                  <tr
                                    key={i}
                                    className="border-b border-border/20 last:border-0 hover:bg-muted/20 transition"
                                  >
                                    {Object.values(row).map((val, j) => (
                                      <td
                                        key={j}
                                        className="px-3 py-1.5 whitespace-nowrap text-muted-foreground"
                                      >
                                        {String(val ?? "—")}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          ) : (
                            <p className="text-muted-foreground">No records to display.</p>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};