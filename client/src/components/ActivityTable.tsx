import { useState } from "react";
import { ArrowUpRight, CheckCircle2, ChevronDown, ChevronUp, Shield, GitBranch } from "lucide-react";
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getRiskStyle(level: string): { text: string; bg: string; border: string; dot: string } {
  const l = level.toLowerCase();
  if (l === "low") return { text: "text-blue-400", bg: "bg-blue-400/10", border: "border-blue-400/20", dot: "#60a5fa" };
  if (l === "medium") return { text: "text-amber-400", bg: "bg-amber-400/10", border: "border-amber-400/20", dot: "#f59e0b" };
  return { text: "text-orange-400", bg: "bg-orange-400/10", border: "border-orange-400/20", dot: "#f97316" };
}

function SeverityDot({ level }: { level: string }) {
  const s = getRiskStyle(level);
  return <span className="inline-block w-2 h-2 rounded-full mr-1.5 shrink-0" style={{ background: s.dot }} />;
}

const cardBase = "rounded-2xl border border-white/5 bg-[#0d1117]/80 backdrop-blur";

// ─── Mobile card ──────────────────────────────────────────────────────────────

function RunCard({ run }: { run: RunEntry }) {
  const [expanded, setExpanded] = useState(false);
  const risk = run.riskLevel.toLowerCase();
  const s = getRiskStyle(risk);
  const breakdown = run.data.report.breakdown;
  const totalPiiFields = [
    ...Object.values(breakdown.directPII),
    ...Object.values(breakdown.sensitivePII),
    ...Object.values(breakdown.quasiIdentifiers),
  ].reduce((a, b) => a + b, 0);

  return (
    <div className={cn(cardBase, "overflow-hidden")}>
      <button onClick={() => setExpanded(v => !v)} className="w-full text-left p-4 hover:bg-white/[0.03] transition-colors">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5 min-w-0">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="font-medium text-sm truncate text-gray-200">{run.fileName}</p>
              <p className="text-[10px] font-mono text-gray-600 mt-0.5">{run.runId}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={cn("inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium border capitalize", s.text, s.bg, s.border)}>
              <SeverityDot level={risk} />{run.riskLevel}
            </span>
            {expanded ? <ChevronUp className="h-3.5 w-3.5 text-gray-600" /> : <ChevronDown className="h-3.5 w-3.5 text-gray-600" />}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          {[
            { label: "Records", value: run.recordCount.toLocaleString(), accent: "text-gray-200" },
            { label: "PII", value: `${run.piiPercent}%`, accent: "text-orange-400" },
            { label: "Utility", value: `${run.utilityPercent}%`, accent: "text-emerald-400" },
          ].map(({ label, value, accent }) => (
            <div key={label} className="rounded-lg bg-white/[0.03] border border-white/5 px-2 py-1.5">
              <p className="text-[9px] font-mono uppercase text-gray-600">{label}</p>
              <p className={cn("text-sm font-bold font-mono mt-0.5", accent)}>{value}</p>
            </div>
          ))}
        </div>

        <div className="mt-2.5 flex items-center justify-between">
          <span className="text-[10px] font-mono text-gray-600">
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/5 text-gray-500">{run.maskingLevel}</span>
          </span>
          <span className="text-[10px] font-mono text-gray-600">{run.timestamp}</span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-white/5 p-4 space-y-3 animate-fade-in">
          {/* PII Breakdown */}
          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
            <p className="text-[10px] font-mono uppercase tracking-widest text-gray-600 mb-2.5">
              PII Breakdown ({totalPiiFields} fields)
            </p>
            <div className="space-y-2">
              {[
                { label: "Direct PII", items: breakdown.directPII, color: "text-orange-400 bg-orange-400/10 border-orange-400/20" },
                { label: "Sensitive PII", items: breakdown.sensitivePII, color: "text-amber-400 bg-amber-400/10 border-amber-400/20" },
                { label: "Quasi-identifiers", items: breakdown.quasiIdentifiers, color: "text-blue-400 bg-blue-400/10 border-blue-400/20" },
              ].map(({ label, items, color }) => (
                Object.keys(items).length > 0 && (
                  <div key={label}>
                    <p className="text-[10px] font-medium text-gray-500 mb-1">{label}</p>
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(items).map(([k, v]) => (
                        <span key={k} className={cn("text-[10px] px-1.5 py-0.5 rounded-md border font-mono", color)}>
                          {k}: {v}
                        </span>
                      ))}
                    </div>
                  </div>
                )
              ))}
            </div>
          </div>

          {/* Risk */}
          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
            <p className="text-[10px] font-mono uppercase tracking-widest text-gray-600 mb-2">Risk Assessment</p>
            <div className="flex items-center gap-3 mb-2">
              <span className={cn("text-sm font-bold capitalize px-3 py-1 rounded-lg border", s.text, s.bg, s.border)}>
                {run.data.report.riskScore.level}
              </span>
              <span className="text-xl font-bold font-mono text-gray-200">{run.data.report.riskScore.score.toFixed(2)}</span>
            </div>
            <p className="text-xs text-gray-500">{run.data.report.riskScore.reason}</p>
          </div>

          {/* Masking Notes */}
          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
            <p className="text-[10px] font-mono uppercase tracking-widest text-gray-600 mb-2">Masking Notes</p>
            <ul className="space-y-1">
              {Object.entries(run.data.report.explanations).slice(0, 6).map(([field, note]) => (
                <li key={field} className="text-xs flex gap-1.5">
                  <span className="font-mono text-primary shrink-0">{field}:</span>
                  <span className="text-gray-500">{note}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Preview */}
          {run.data.result.length > 0 && (
            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 overflow-x-auto">
              <p className="text-[10px] font-mono uppercase tracking-widest text-gray-600 mb-2">Masked Preview (5 records)</p>
              <table className="w-full text-[10px] font-mono min-w-[400px]">
                <thead>
                  <tr className="border-b border-white/5 text-gray-600">
                    {Object.keys(run.data.result[0]).map((col) => (
                      <th key={col} className="px-2 py-1.5 text-left whitespace-nowrap font-medium uppercase tracking-wider">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {run.data.result.slice(0, 5).map((row, i) => (
                    <tr key={i} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition">
                      {Object.values(row).map((val, j) => (
                        <td key={j} className="px-2 py-1.5 whitespace-nowrap text-gray-400">{String(val ?? "—")}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export const ActivityTable = ({ runs, showAll = false }: Props) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const visible = showAll ? runs : runs.slice(0, 5);

  return (
    <>
      {/* ── Mobile: card list ── */}
      <div className="flex flex-col gap-3 md:hidden">
        {visible.map((run) => <RunCard key={run.runId} run={run} />)}
      </div>

      {/* ── Desktop: table ── */}
      <div className={cn("hidden md:block", cardBase, "overflow-hidden")}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 text-left">
                {["Repository", "Branch", "Status", "Records", "PII %", "Utility", "Risk", "Masking", "Date", ""].map((h) => (
                  <th key={h} className="px-5 py-3.5 font-mono text-[10px] uppercase tracking-widest text-gray-600 font-medium whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((run) => {
                const isExpanded = expandedId === run.runId;
                const risk = run.riskLevel.toLowerCase();
                const s = getRiskStyle(risk);
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
                      className={cn("border-b border-white/[0.04] last:border-0 hover:bg-white/[0.03] transition cursor-pointer", isExpanded && "bg-white/[0.03]")}
                      onClick={() => setExpandedId(isExpanded ? null : run.runId)}
                    >
                      {/* Repository */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <GitBranch className="h-3.5 w-3.5 text-gray-600 shrink-0" />
                          <div className="min-w-0">
                            <p className="font-semibold truncate max-w-[160px] text-gray-200">{run.fileName}</p>
                            <p className="text-[10px] text-gray-600 font-mono">{run.runId}</p>
                          </div>
                        </div>
                      </td>

                      {/* Branch */}
                      <td className="px-5 py-4">
                        <span className="text-xs font-mono text-gray-500 bg-white/[0.04] border border-white/5 px-2 py-0.5 rounded">main</span>
                      </td>

                      {/* Status */}
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-2.5 py-1 rounded-lg">
                          <CheckCircle2 className="h-3 w-3" /> done
                        </span>
                      </td>

                      {/* Records */}
                      <td className="px-5 py-4 font-mono text-gray-300">{run.recordCount.toLocaleString()}</td>

                      {/* PII % */}
                      <td className="px-5 py-4">
                        <span className="font-mono font-bold text-orange-400">{run.piiPercent}%</span>
                      </td>

                      {/* Utility */}
                      <td className="px-5 py-4">
                        <span className="font-mono font-bold text-emerald-400">{run.utilityPercent}%</span>
                      </td>

                      {/* Risk */}
                      <td className="px-5 py-4">
                        <span className={cn("inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium border capitalize", s.text, s.bg, s.border)}>
                          <SeverityDot level={risk} />{run.riskLevel}
                        </span>
                      </td>

                      {/* Masking */}
                      <td className="px-5 py-4">
                        <span className="text-xs font-mono capitalize text-gray-500 bg-white/[0.04] border border-white/5 px-2 py-0.5 rounded">{run.maskingLevel}</span>
                      </td>

                      {/* Date */}
                      <td className="px-5 py-4 text-gray-600 font-mono text-xs whitespace-nowrap">{run.timestamp}</td>

                      {/* Expand */}
                      <td className="px-5 py-4 text-right">
                        <Button variant="ghost" size="sm" className="hover:text-primary text-xs text-gray-600 h-7">
                          {isExpanded ? <><ChevronUp className="h-3.5 w-3.5 mr-1" />Collapse</> : <><ArrowUpRight className="h-3.5 w-3.5 mr-1" />View</>}
                        </Button>
                      </td>
                    </tr>

                    {/* Expanded row */}
                    {isExpanded && (
                      <tr key={`${run.runId}-expanded`} className="border-b border-white/5 bg-white/[0.01]">
                        <td colSpan={10} className="px-5 py-5">
                          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

                            {/* PII Breakdown */}
                            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                              <p className="text-xs font-mono uppercase tracking-widest text-gray-600 mb-3">
                                PII Breakdown ({totalPiiFields} fields)
                              </p>
                              <div className="space-y-2.5">
                                {[
                                  { label: "Direct PII", items: breakdown.directPII, color: "text-orange-400 bg-orange-400/10 border-orange-400/20" },
                                  { label: "Sensitive PII", items: breakdown.sensitivePII, color: "text-amber-400 bg-amber-400/10 border-amber-400/20" },
                                  { label: "Quasi-identifiers", items: breakdown.quasiIdentifiers, color: "text-blue-400 bg-blue-400/10 border-blue-400/20" },
                                ].map(({ label, items, color }) => (
                                  Object.keys(items).length > 0 && (
                                    <div key={label}>
                                      <p className="text-[11px] font-medium text-gray-500 mb-1">{label}</p>
                                      <div className="flex flex-wrap gap-1.5">
                                        {Object.entries(items).map(([k, v]) => (
                                          <span key={k} className={cn("text-xs px-2 py-0.5 rounded-md border font-mono", color)}>
                                            {k}: {v}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  )
                                ))}
                              </div>
                            </div>

                            {/* Risk */}
                            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                              <p className="text-xs font-mono uppercase tracking-widest text-gray-600 mb-3">Risk Assessment</p>
                              <div className="flex items-center gap-3 mb-3">
                                <span className={cn("text-sm font-bold capitalize px-3 py-1 rounded-lg border", s.text, s.bg, s.border)}>
                                  {run.data.report.riskScore.level}
                                </span>
                                <span className="text-2xl font-bold font-mono text-gray-200">
                                  {run.data.report.riskScore.score.toFixed(2)}
                                </span>
                              </div>
                              <p className="text-xs text-gray-500 leading-relaxed">{run.data.report.riskScore.reason}</p>
                            </div>

                            {/* Masking Notes */}
                            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                              <p className="text-xs font-mono uppercase tracking-widest text-gray-600 mb-3">
                                Masking Notes
                              </p>
                              <ul className="space-y-1.5">
                                {Object.entries(run.data.report.explanations).slice(0, 6).map(([field, note]) => (
                                  <li key={field} className="text-xs flex gap-1.5">
                                    <Shield className="h-3 w-3 text-primary shrink-0 mt-0.5" />
                                    <span className="font-mono text-primary mr-1">{field}:</span>
                                    <span className="text-gray-500">{note}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>

                          {/* Preview table */}
                          {run.data.result.length > 0 && (
                            <div className="mt-4 rounded-xl border border-white/5 bg-white/[0.02] p-4 overflow-x-auto">
                              <p className="text-xs font-mono uppercase tracking-widest text-gray-600 mb-3">
                                Masked Data Preview (first 5 records)
                              </p>
                              <table className="w-full text-xs font-mono">
                                <thead>
                                  <tr className="border-b border-white/5 text-gray-600">
                                    {Object.keys(run.data.result[0]).map((col) => (
                                      <th key={col} className="px-3 py-2 text-left whitespace-nowrap font-medium uppercase tracking-wider text-[10px]">{col}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {run.data.result.slice(0, 5).map((row, i) => (
                                    <tr key={i} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.03] transition">
                                      {Object.values(row).map((val, j) => (
                                        <td key={j} className="px-3 py-2 whitespace-nowrap text-gray-400">{String(val ?? "—")}</td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
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
    </>
  );
};