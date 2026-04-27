import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Wand2, FileBarChart2, CheckCircle2, Loader2 } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { cn } from "@/lib/utils";

const steps = [
  { icon: Search, title: "Detecting PII", desc: "Scanning fields with transformer model · 40+ categories" },
  { icon: Wand2, title: "Masking", desc: "Applying medium-privacy strategy across detected fields" },
  { icon: FileBarChart2, title: "Generating report", desc: "Calculating utility score and audit trail" },
];

export default function Processing() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          clearInterval(interval);
          return 100;
        }
        return p + 2;
      });
    }, 90);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (progress >= 33 && step < 1) setStep(1);
    if (progress >= 66 && step < 2) setStep(2);
    if (progress >= 100) {
      const t = setTimeout(() => navigate("/result/f-1042"), 700);
      return () => clearTimeout(t);
    }
  }, [progress, step, navigate]);

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto py-8">
        <div className="text-center mb-10 animate-fade-in">
          <p className="text-xs font-mono uppercase tracking-widest text-primary">Pipeline running</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Processing customers_q4_2025.csv</h1>
          <p className="mt-2 text-muted-foreground">48,210 records · estimated 4 seconds remaining</p>
        </div>

        {/* Pipeline */}
        <div className="glass-strong rounded-3xl p-8 relative overflow-hidden">
          <div className="absolute inset-0 cyber-grid opacity-20" />
          <div className="relative space-y-4">
            {steps.map((s, i) => {
              const Icon = s.icon;
              const active = i === step;
              const done = i < step || progress >= 100;
              return (
                <div
                  key={s.title}
                  className={cn(
                    "flex items-center gap-4 p-4 rounded-2xl border transition-all",
                    active && "border-primary/50 bg-primary/5 shadow-glow-primary",
                    done && !active && "border-primary/20 bg-primary/[0.03]",
                    !active && !done && "border-border/40 bg-muted/20 opacity-60"
                  )}
                >
                  <div className={cn(
                    "relative h-12 w-12 rounded-xl flex items-center justify-center border",
                    active && "bg-primary/15 border-primary/40 text-primary",
                    done && !active && "bg-primary/10 border-primary/30 text-primary",
                    !active && !done && "bg-muted border-border text-muted-foreground"
                  )}>
                    {active && <span className="absolute inset-0 rounded-xl border border-primary animate-pulse-ring" />}
                    {done && !active ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : active ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Icon className="h-5 w-5" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold">{s.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{s.desc}</p>
                  </div>
                  <div className="text-xs font-mono text-muted-foreground">
                    {done && !active ? "DONE" : active ? "RUNNING" : "QUEUED"}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Progress bar */}
          <div className="mt-8 relative">
            <div className="flex items-center justify-between text-xs font-mono text-muted-foreground mb-2">
              <span>Overall progress</span>
              <span className="text-primary">{progress}%</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-gradient-primary rounded-full transition-all duration-150 shadow-glow-primary"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>

        <p className="text-center mt-6 text-xs font-mono text-muted-foreground">
          🔒 Data is processed in-memory and discarded after the report is ready.
        </p>
      </div>
    </DashboardLayout>
  );
}
