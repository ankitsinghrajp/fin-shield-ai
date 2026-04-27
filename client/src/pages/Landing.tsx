import { Link } from "react-router-dom";
import { ArrowRight, ShieldCheck, Sparkles, Wand2, FileBarChart2, Lock, Server, Building2, Upload, Search, EyeOff, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/Navbar";
import { PIIHighlighter } from "@/components/PIIHighlighter";
import { sampleTokens } from "@/lib/mockData";

const features = [
  { icon: Search, title: "AI PII Detection", desc: "Transformer models identify 40+ PII categories — names, emails, phones, IDs, addresses — across structured and unstructured data.", accent: "primary" },
  { icon: Wand2, title: "Smart Anonymization", desc: "Choose tokenization, hashing, generalization, or full redaction. Tune utility-vs-privacy with one slider.", accent: "secondary" },
  { icon: FileBarChart2, title: "Data Quality Reports", desc: "Every run ships with utility scores, field-level breakdowns, and exportable audit trails for compliance.", accent: "primary" },
];

const steps = [
  { icon: Upload, label: "Upload", desc: "Drop CSV / JSON / Parquet" },
  { icon: Search, label: "Detect", desc: "AI scans every field" },
  { icon: EyeOff, label: "Mask", desc: "Apply your strategy" },
  { icon: FileText, label: "Report", desc: "Audit & download" },
];

const trust = [
  { icon: Server, title: "No data stored", desc: "Datasets are processed in-memory and discarded immediately after the report is generated." },
  { icon: Lock, title: "Secure processing", desc: "End-to-end encryption, isolated compute, SOC2-aligned infrastructure for every run." },
  { icon: Building2, title: "Fintech-grade privacy", desc: "Designed alongside banks and KYC teams. Defaults that meet GDPR, CCPA, and PCI-DSS." },
];

export default function Landing() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 cyber-grid opacity-60" />
        <div className="absolute inset-0 bg-gradient-glow" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 h-72 w-[40rem] bg-primary/20 blur-[120px] rounded-full" />
        <div className="absolute top-1/2 right-1/4 h-60 w-96 bg-secondary/20 blur-[100px] rounded-full" />

        <div className="container relative z-10 max-w-6xl py-24 lg:py-32">
          <div className="flex flex-col items-center text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass border border-primary/30 text-xs font-mono">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              <span className="text-primary">v2.4 — now with adaptive masking</span>
            </div>

            <h1 className="mt-6 text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight max-w-4xl">
              <span className="text-gradient-hero">AI Privacy Pipeline</span>
              <br />
              for Secure LLM Training
            </h1>

            <p className="mt-6 text-lg text-muted-foreground max-w-2xl">
              Automatically detect, mask, and anonymize sensitive data in seconds.
              Ship safer datasets to your models — without losing utility.
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button asChild size="lg" className="bg-gradient-primary text-primary-foreground btn-glow shadow-glow-primary">
                <Link to="/dashboard">
                  Start Processing <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-border/60 hover:border-primary/50 hover:bg-primary/5">
                <Link to="/result/f-1042">View Demo</Link>
              </Button>
            </div>

            <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground font-mono">
              <span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-primary" /> SOC2-aligned</span>
              <span>·</span>
              <span className="flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5 text-secondary" /> 40+ PII types</span>
            </div>
          </div>

          {/* Live preview of detection */}
          <div className="mt-16 max-w-4xl mx-auto animate-fade-in-up">
            <div className="glass-strong rounded-2xl p-6 lg:p-8 relative scan-line">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
                  <span className="h-2 w-2 rounded-full bg-destructive/70" />
                  <span className="h-2 w-2 rounded-full bg-warning/70" />
                  <span className="h-2 w-2 rounded-full bg-primary/70" />
                  <span className="ml-3">customer_record_001.json</span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/30">
                  LIVE PREVIEW
                </span>
              </div>
              <PIIHighlighter tokens={sampleTokens} mode="raw" />
              <div className="mt-5 pt-5 border-t border-border/40">
                <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">After masking · medium privacy</p>
                <PIIHighlighter tokens={sampleTokens} mode="masked" strategy="medium" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="container max-w-6xl py-24">
        <div className="text-center max-w-2xl mx-auto">
          <p className="text-xs font-mono uppercase tracking-widest text-primary">Capabilities</p>
          <h2 className="mt-3 text-3xl lg:text-4xl font-bold tracking-tight">Everything you need to ship safe data</h2>
          <p className="mt-4 text-muted-foreground">Three layers — detection, transformation, and reporting — composed into one auditable pipeline.</p>
        </div>

        <div className="mt-12 grid md:grid-cols-3 gap-5">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.title} className="glass rounded-2xl p-6 group hover:border-primary/40 transition relative overflow-hidden">
                <div className={`absolute -top-12 -right-12 h-40 w-40 rounded-full blur-3xl opacity-30 ${f.accent === "primary" ? "bg-primary" : "bg-secondary"}`} />
                <div className={`relative inline-flex p-3 rounded-xl border ${f.accent === "primary" ? "bg-primary/10 border-primary/30 text-primary" : "bg-secondary/10 border-secondary/30 text-secondary"}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="relative py-24 border-y border-border/40 bg-card/30">
        <div className="absolute inset-0 cyber-grid opacity-30" />
        <div className="container relative z-10 max-w-6xl">
          <div className="text-center max-w-2xl mx-auto">
            <p className="text-xs font-mono uppercase tracking-widest text-secondary">Pipeline</p>
            <h2 className="mt-3 text-3xl lg:text-4xl font-bold tracking-tight">From raw data to safe dataset in seconds</h2>
          </div>

          <div className="mt-12 grid grid-cols-2 lg:grid-cols-4 gap-4 relative">
            {steps.map((s, i) => {
              const Icon = s.icon;
              return (
                <div key={s.label} className="relative">
                  <div className="glass rounded-2xl p-6 text-center hover:border-primary/40 transition">
                    <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 border border-primary/30">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <p className="mt-4 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Step 0{i + 1}</p>
                    <h3 className="mt-1 font-semibold">{s.label}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">{s.desc}</p>
                  </div>
                  {i < steps.length - 1 && (
                    <ArrowRight className="hidden lg:block absolute top-1/2 -right-3 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* TRUST */}
      <section id="trust" className="container max-w-6xl py-24">
        <div className="text-center max-w-2xl mx-auto">
          <p className="text-xs font-mono uppercase tracking-widest text-primary">Trust</p>
          <h2 className="mt-3 text-3xl lg:text-4xl font-bold tracking-tight">Built for teams that can't get privacy wrong</h2>
        </div>
        <div className="mt-12 grid md:grid-cols-3 gap-5">
          {trust.map((t) => {
            const Icon = t.icon;
            return (
              <div key={t.title} className="glass rounded-2xl p-6">
                <div className="inline-flex p-3 rounded-xl bg-primary/10 border border-primary/30 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-semibold">{t.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{t.desc}</p>
              </div>
            );
          })}
        </div>

        <div className="mt-16 glass-strong rounded-3xl p-8 lg:p-12 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-glow opacity-60" />
          <div className="relative">
            <h3 className="text-2xl lg:text-3xl font-bold">Ready to clean your dataset?</h3>
            <p className="mt-3 text-muted-foreground max-w-xl mx-auto">Try the full pipeline on a sample file — no signup required.</p>
            <Button asChild size="lg" className="mt-6 bg-gradient-primary text-primary-foreground btn-glow shadow-glow-primary">
              <Link to="/dashboard">Open Dashboard <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
          </div>
        </div>
      </section>

      <footer className="border-t border-border/40 py-8">
        <div className="container flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <p>© 2026 PrivacyGuard AI. All rights reserved.</p>
          <p className="font-mono">v2.4.1 · pipeline online</p>
        </div>
      </footer>
    </div>
  );
}
