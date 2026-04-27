import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Brain, Database, ShieldCheck, Gauge, EyeOff, Download, Sparkles } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PIIHighlighter } from "@/components/PIIHighlighter";
import { ReportCards } from "@/components/ReportCards";
import { Button } from "@/components/ui/button";
import { sampleTokens, fieldBreakdown, Strategy } from "@/lib/mockData";
import { cn } from "@/lib/utils";

const strategyInfo: Record<Strategy, { label: string; desc: string; impact: string }> = {
  low: {
    label: "Low privacy",
    desc: "Partial masking — keeps domain hints, initials, and last digits to maximise downstream utility.",
    impact: "Utility 96% · Re-identification risk: medium",
  },
  medium: {
    label: "Medium privacy",
    desc: "Replaces PII with format-preserving tokens. Domain and structure preserved; identifiers removed.",
    impact: "Utility 89% · Re-identification risk: low",
  },
  high: {
    label: "High privacy",
    desc: "Full anonymization. All PII replaced with category-only placeholders ([PERSON], [EMAIL], …).",
    impact: "Utility 78% · Re-identification risk: negligible",
  },
};

const piiLegend = [
  { type: "name", label: "Name", className: "pii-name" },
  { type: "email", label: "Email", className: "pii-email" },
  { type: "phone", label: "Phone", className: "pii-phone" },
  { type: "id", label: "Identifier", className: "pii-id" },
  { type: "address", label: "Address", className: "pii-address" },
];

export default function Result() {
  const { id } = useParams();
  const [strategy, setStrategy] = useState<Strategy>("medium");
  const info = strategyInfo[strategy];

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6 animate-fade-in">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2 text-muted-foreground hover:text-foreground">
            <Link to="/dashboard"><ArrowLeft className="h-4 w-4 mr-1" /> Back</Link>
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">customers_q4_2025.csv</h1>
          <p className="text-muted-foreground mt-1 font-mono text-sm">
            ID: {id} · 48,210 records · processed 2026-04-26
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="border-border/60">
            <Download className="h-4 w-4 mr-2" /> Audit log
          </Button>
          <Button className="bg-gradient-primary text-primary-foreground btn-glow shadow-glow-primary">
            <Download className="h-4 w-4 mr-2" /> Download masked
          </Button>
        </div>
      </div>

      {/* Report cards */}
      <ReportCards
        cards={[
          { label: "Records", value: "48,210", hint: "100% scanned", icon: Database, accent: "primary" },
          { label: "Fields masked", value: "236,612", hint: "across 6 columns", icon: EyeOff, accent: "secondary" },
          { label: "Sensitive removed", value: "98.4%", hint: "of detected PII", icon: ShieldCheck, accent: "primary" },
          { label: "Utility score", value: "89.2", hint: "after masking", icon: Gauge, accent: "warning" },
        ]}
      />

      {/* Strategy control + AI explanation panel */}
      <div className="mt-6 grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="glass-strong rounded-2xl p-5 xl:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs font-mono uppercase tracking-widest text-primary">Masking strategy</p>
              <h3 className="mt-1 font-semibold">Choose your privacy level</h3>
            </div>
            <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary" /> live preview below
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 p-1 rounded-xl bg-muted/40 border border-border/50">
            {(["low", "medium", "high"] as Strategy[]).map((s) => (
              <button
                key={s}
                onClick={() => setStrategy(s)}
                className={cn(
                  "py-2.5 rounded-lg text-sm font-medium transition-all capitalize",
                  strategy === s
                    ? "bg-gradient-primary text-primary-foreground shadow-glow-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                )}
              >
                {s}
              </button>
            ))}
          </div>
          <p className="mt-4 text-sm text-muted-foreground">{info.desc}</p>
          <p className="mt-2 text-xs font-mono text-primary">{info.impact}</p>
        </div>

        {/* AI Explanation panel */}
        <div className="glass-strong rounded-2xl p-5 relative overflow-hidden">
          <div className="absolute -top-12 -right-12 h-40 w-40 rounded-full bg-secondary/20 blur-3xl" />
          <div className="relative">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-secondary/15 border border-secondary/30 text-secondary">
                <Brain className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-mono uppercase tracking-widest text-secondary">AI explanation</p>
                <p className="text-sm font-semibold">Why this was masked</p>
              </div>
            </div>
            <ul className="mt-4 space-y-3 text-sm">
              <li>
                <p className="text-xs font-mono uppercase text-muted-foreground tracking-wider">Detection</p>
                <p className="mt-0.5">Model identified 5 PII categories with avg confidence <span className="text-primary font-mono">0.96</span>.</p>
              </li>
              <li>
                <p className="text-xs font-mono uppercase text-muted-foreground tracking-wider">Strategy used</p>
                <p className="mt-0.5">{info.label} — {info.desc.split(".")[0]}.</p>
              </li>
              <li>
                <p className="text-xs font-mono uppercase text-muted-foreground tracking-wider">Impact on utility</p>
                <p className="mt-0.5 text-muted-foreground">{info.impact}</p>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Before vs After */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Before vs After</h2>
          <div className="flex items-center gap-3 text-xs font-mono">
            {piiLegend.map((p) => (
              <span key={p.type} className={cn("pii-chip", p.className)}>{p.label}</span>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="glass-strong rounded-2xl p-5 relative">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-mono uppercase tracking-widest text-destructive">Raw data — PII detected</p>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-destructive/10 text-destructive border border-destructive/30">
                SENSITIVE
              </span>
            </div>
            <PIIHighlighter tokens={sampleTokens} mode="raw" />
          </div>
          <div className="glass-strong rounded-2xl p-5 relative scan-line">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-mono uppercase tracking-widest text-primary">Masked output · {info.label}</p>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/30">
                SAFE
              </span>
            </div>
            <PIIHighlighter tokens={sampleTokens} mode="masked" strategy={strategy} />
          </div>
        </div>
      </div>

      {/* Field breakdown */}
      <div className="mt-6">
        <h2 className="text-lg font-semibold mb-3">Field breakdown</h2>
        <div className="glass rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 text-left text-xs font-mono uppercase tracking-wider text-muted-foreground">
                <th className="px-5 py-3 font-medium">Field</th>
                <th className="px-5 py-3 font-medium">PII type</th>
                <th className="px-5 py-3 font-medium">Strategy</th>
                <th className="px-5 py-3 font-medium text-right">Count</th>
              </tr>
            </thead>
            <tbody>
              {fieldBreakdown.map((row) => (
                <tr key={row.field} className="border-b border-border/30 last:border-0 hover:bg-muted/30 transition">
                  <td className="px-5 py-4 font-mono">{row.field}</td>
                  <td className="px-5 py-4">
                    <span className="px-2 py-0.5 rounded text-xs bg-secondary/10 text-secondary border border-secondary/30">
                      {row.piiType}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-muted-foreground">{row.strategy}</td>
                  <td className="px-5 py-4 text-right font-mono text-primary">{row.count.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
}
