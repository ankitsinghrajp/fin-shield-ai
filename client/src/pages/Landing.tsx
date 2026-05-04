import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight, ShieldCheck, Sparkles, Wand2, FileBarChart2,
  Lock, Server, Building2, Upload, Search, EyeOff, FileText,
  AlertTriangle, Zap, Database, BarChart2, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/Navbar";
import { PIIHighlighter } from "@/components/PIIHighlighter";
import { sampleTokens } from "@/lib/mockData";
import Footer from "@/components/Footer";

// ─── DATA ────────────────────────────────────────────────────────────────────

const problems = [
  {
    icon: "🔓",
    title: "Real data contains sensitive information",
    desc: "Financial datasets include PAN, Aadhaar, card numbers, and more — fields that cannot be exposed during model training or testing.",
  },
  {
    icon: "📉",
    title: "Removing data reduces model quality",
    desc: "Deleting sensitive columns strips away patterns and distributions that models depend on. You lose utility along with privacy.",
  },
  {
    icon: "🐢",
    title: "Manual anonymization is slow and error-prone",
    desc: "Doing this by hand — regex, scripts, spreadsheet formulas — is tedious, inconsistent, and hard to audit or reproduce.",
  },
];

const pipelineSteps = [
  { icon: Upload,   num: "01", label: "Raw Data",        sub: "CSV · JSON · Logs · Text" },
  { icon: Search,   num: "02", label: "Detect",          sub: "Rules + NLP scan" },
  { icon: Wand2,    num: "03", label: "Mask & Transform", sub: "Redact · Token · Hash" },
  { icon: FileText, num: "04", label: "Safe Output",     sub: "Model-ready dataset" },
];

const solFeatures = [
  { icon: "🧠", title: "Hybrid detection",            desc: "Combines rule-based patterns and NLP for higher coverage across structured and free-text fields." },
  { icon: "🎭", title: "Multiple masking techniques", desc: "Redaction, tokenization, partial masking, or hashing — pick per field or let the pipeline decide." },
  { icon: "📊", title: "Utility-preserving transforms", desc: "Non-sensitive fields and statistical structure stay intact so your models still learn what they need." },
  { icon: "📋", title: "Masking report per run",      desc: "Field-level breakdown showing what was detected, what was masked, and what was preserved." },
];

const demoDatasets = [
  {
    label: "Customer Record",
    raw: [
      { k: "customer_id",  v: "CUST_2891" },
      { k: "full_name",    v: "Priya Sharma",          pii: "NAME" },
      { k: "pan_number",   v: "DKRPS7823G",            pii: "PAN" },
      { k: "aadhaar",      v: "7712 3341 9988",         pii: "UID" },
      { k: "mobile",       v: "+91-9876543210",         pii: "PHONE" },
      { k: "email",        v: "priya@finapp.in",        pii: "EMAIL" },
      { k: "card_no",      v: "5425 2334 3010 9903",    pii: "CARD" },
      { k: "ip_address",   v: "192.168.10.45",          pii: "IP" },
      { k: "account_type", v: "SAVINGS" },
      { k: "balance",      v: "₹1,24,500" },
      { k: "city",         v: "Bangalore" },
      { k: "risk_score",   v: "0.22" },
    ],
    masked: [
      { k: "customer_id",  v: "CUST_2891" },
      { k: "full_name",    v: "Priya Sharma" },
      { k: "pan_number",   v: "PAN_[d4f9a2]",           mask: "HASHED" },
      { k: "aadhaar",      v: "**** **** 9988",           mask: "PARTIAL" },
      { k: "mobile",       v: "+91-*****43210",          mask: "PARTIAL" },
      { k: "email",        v: "p***@f******.in",         mask: "REDACT" },
      { k: "card_no",      v: "**** **** **** 9903",      mask: "LAST4" },
      { k: "ip_address",   v: "192.168.xxx.xxx",         mask: "REDACT" },
      { k: "account_type", v: "SAVINGS" },
      { k: "balance",      v: "₹1,24,500" },
      { k: "city",         v: "Bangalore" },
      { k: "risk_score",   v: "0.22" },
    ],
    summary: "8 sensitive fields detected · 8 masked · Non-PII fields preserved",
  },
  {
    label: "Transaction Log",
    raw: [
      { k: "timestamp", v: "2024-03-15 14:22:11" },
      { k: "user_id",   v: "USR_44201" },
      { k: "phone",     v: "+91-9988776655",  pii: "PHONE" },
      { k: "amount",    v: "₹8,750" },
      { k: "upi_id",    v: "mehta@paytm",     pii: "UPI" },
      { k: "ip",        v: "10.0.0.132",      pii: "IP" },
      { k: "merchant",  v: "Swiggy" },
      { k: "status",    v: "SUCCESS" },
      { k: "notes",     v: "Payment by Aditya Mehta", pii: "NAME" },
    ],
    masked: [
      { k: "timestamp", v: "2024-03-15 14:22:11" },
      { k: "user_id",   v: "USR_44201" },
      { k: "phone",     v: "+91-*****6655",   mask: "PARTIAL" },
      { k: "amount",    v: "₹8,750" },
      { k: "upi_id",    v: "****@paytm",      mask: "REDACT" },
      { k: "ip",        v: "10.0.xxx.xxx",    mask: "REDACT" },
      { k: "merchant",  v: "Swiggy" },
      { k: "status",    v: "SUCCESS" },
      { k: "notes",     v: "Payment by [REDACTED]", mask: "REDACT" },
    ],
    summary: "5 sensitive fields detected · 5 masked · Amounts & metadata preserved",
  },
  {
    label: "KYC Document",
    raw: [
      { k: "doc_type",  v: "KYC Form" },
      { k: "applicant", v: "Sunita Verma",         pii: "NAME" },
      { k: "dob",       v: "1992-07-14",            pii: "DOB" },
      { k: "pan",       v: "GVPRS4412K",            pii: "PAN" },
      { k: "aadhaar",   v: "3312 4421 8890",        pii: "UID" },
      { k: "address",   v: "42 MG Road, Pune 411001", pii: "ADDRESS" },
      { k: "employer",  v: "ICICI Bank" },
      { k: "income",    v: "₹9.6L/yr" },
      { k: "email",     v: "sunita.v@icici.com",    pii: "EMAIL" },
    ],
    masked: [
      { k: "doc_type",  v: "KYC Form" },
      { k: "applicant", v: "Sunita Verma" },
      { k: "dob",       v: "1992-**-**",            mask: "PARTIAL" },
      { k: "pan",       v: "PAN_[f1c3d8]",          mask: "HASHED" },
      { k: "aadhaar",   v: "**** **** 8890",         mask: "PARTIAL" },
      { k: "address",   v: "**, Pune 411001",        mask: "REDACT" },
      { k: "employer",  v: "ICICI Bank" },
      { k: "income",    v: "₹9.6L/yr" },
      { k: "email",     v: "s****@****.com",         mask: "REDACT" },
    ],
    summary: "6 sensitive fields detected · 6 masked · Employer & income preserved",
  },
];

const features = [
  { icon: "📂", title: "Multiple file formats",       desc: "Accepts CSV, JSON, newline-delimited logs, and plain text. Drop your export and go." },
  { icon: "🇮🇳", title: "India-first PII coverage",   desc: "Detects PAN, Aadhaar, Indian mobile numbers, UPI handles, and GST numbers out of the box." },
  { icon: "🧩", title: "Structured & unstructured",   desc: "Works on clean tabular data and messy free-text fields, transaction narratives, and log lines." },
  { icon: "📄", title: "Masking report",              desc: "Every run generates a field-level report with detection stats, masking methods, and utility scores." },
  { icon: "⚡", title: "Fast processing",             desc: "Designed for batch processing of thousands of rows. Get results quickly without long waits." },
  { icon: "🎛️", title: "Simple, clean UI",            desc: "Upload → detect → mask → download. No configuration headaches. Accessible to non-engineers." },
];

const metrics = [
  { id: "m-detection",  target: 94,  suffix: "%", label: "Sensitive fields detected" },
  { id: "m-masked",     target: 100, suffix: "%", label: "Fields successfully masked" },
  { id: "m-utility",    target: 87,  suffix: "%", label: "Data utility score preserved" },
  { id: "m-intact",     target: 100, suffix: "%", label: "Non-PII fields kept intact" },
];

const progressBars = [
  { label: "PAN Number Detection",  target: 96,  color: "var(--color-primary, #00FF94)" },
  { label: "Aadhaar Detection",     target: 91,  color: "var(--color-primary, #00FF94)" },
  { label: "Phone & Email",         target: 98,  color: "var(--color-primary, #00FF94)" },
  { label: "Credit Card Numbers",   target: 99,  color: "var(--color-primary, #00FF94)" },
  { label: "Data Utility Retained", target: 87,  color: "#3B82F6" },
];

const othersItems = [
  "Basic regex masking only",
  "No structure or context awareness",
  "Limited to a few field types",
  "No utility scoring or reporting",
  "Not tuned for Indian PII formats",
  "Handles structured data only",
];

const oursItems = [
  { strong: "Hybrid detection", rest: " — rules + NLP for higher coverage" },
  { strong: "Context-aware masking", rest: " — field semantics inform strategy" },
  { strong: "PAN, Aadhaar, UPI, GST", rest: " and more, out of the box" },
  { strong: "Utility scoring", rest: " per run with full field breakdown" },
  { strong: "India-first", rest: " PII patterns built in from the start" },
  { strong: "Structured + unstructured", rest: " data in the same pipeline" },
];

const trustItems = [
  { icon: Server,    title: "No data stored",         desc: "Datasets are processed in-memory and discarded immediately after the report is generated." },
  { icon: Lock,      title: "Secure processing",      desc: "End-to-end encryption and isolated compute for every processing run." },
  { icon: Building2, title: "Fintech-focused design", desc: "Built around Indian financial data patterns — PAN, Aadhaar, UPI — not generic western PII." },
];

// ─── HOOKS ───────────────────────────────────────────────────────────────────

function useFadeUp() {
  useEffect(() => {
    const els = document.querySelectorAll(".fs-fade-up");
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add("fs-visible"); }),
      { threshold: 0.1 }
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);
}

function useCountUp(ref, target, suffix, duration = 1400) {
  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        obs.disconnect();
        let start = 0;
        const steps = 60;
        const inc = target / steps;
        const iv = setInterval(() => {
          start = Math.min(start + inc, target);
          el.textContent = Math.round(start) + suffix;
          if (start >= target) clearInterval(iv);
        }, duration / steps);
      },
      { threshold: 0.4 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [ref, target, suffix, duration]);
}

// ─── SMALL COMPONENTS ─────────────────────────────────────────────────────────

function SectionTag({ children }) {
  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass border border-primary/30 text-xs font-mono mb-4">
      <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
      <span className="text-primary uppercase tracking-widest">{children}</span>
    </div>
  );
}

function MetricCard({ target, suffix, label }) {
  const ref = useRef(null);
  useCountUp(ref, target, suffix);
  return (
    <div className="glass rounded-2xl p-6 text-center border border-primary/20 bg-primary/5">
      <div
        ref={ref}
        className="font-bold text-5xl text-primary mb-2"
        style={{ fontFamily: "'Syne', sans-serif", lineHeight: 1 }}
      >
        0{suffix}
      </div>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

function ProgressRow({ label, target, color }) {
  const barRef = useRef(null);
  const valRef = useRef(null);

  useEffect(() => {
    if (!barRef.current) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        obs.disconnect();
        let cur = 0;
        const iv = setInterval(() => {
          cur = Math.min(cur + target / 60, target);
          if (barRef.current) barRef.current.style.width = cur + "%";
          if (valRef.current) valRef.current.textContent = Math.round(cur) + "%";
          if (cur >= target) clearInterval(iv);
        }, 1300 / 60);
      },
      { threshold: 0.3 }
    );
    obs.observe(barRef.current.parentElement);
    return () => obs.disconnect();
  }, [target]);

  return (
    <div className="mb-5 last:mb-0">
      <div className="flex justify-between mb-2 text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span ref={valRef} className="font-mono font-medium" style={{ color }}>0%</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
        <div
          ref={barRef}
          className="h-full rounded-full transition-none"
          style={{ width: "0%", background: `linear-gradient(90deg, ${color}, #22D3EE)` }}
        />
      </div>
    </div>
  );
}

// ─── DEMO SECTION ─────────────────────────────────────────────────────────────

function LiveDemo() {
  const [activeTab, setActiveTab] = useState(0);
  const ds = demoDatasets[activeTab];

  return (
    <div className="mt-14 rounded-2xl overflow-hidden glass border border-primary/25 fs-fade-up">
      {/* tabs */}
      <div className="flex border-b border-border/40 overflow-x-auto">
        {demoDatasets.map((d, i) => (
          <button
            key={d.label}
            onClick={() => setActiveTab(i)}
            className={`px-5 py-3.5 text-sm font-medium whitespace-nowrap transition-colors relative ${
              activeTab === i
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
            style={{ background: "transparent", border: "none", cursor: "pointer" }}
          >
            {d.label}
            {activeTab === i && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
        ))}
      </div>

      {/* columns */}
      <div className="grid grid-cols-1 md:grid-cols-2">
        {/* RAW */}
        <div className="p-5 border-b md:border-b-0 md:border-r border-border/40">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60 mb-4">
            🔴 Raw Dataset
          </p>
          {ds.raw.map((row) => (
            <div
              key={row.k}
              className="flex items-center justify-between px-3 py-2 rounded-md mb-1.5 hover:bg-white/[0.02] transition-colors"
              style={{ background: "rgba(255,255,255,0.015)" }}
            >
              <span className="font-mono text-xs text-muted-foreground/60">{row.k}</span>
              <span className="font-mono text-xs flex items-center gap-1.5">
                <span style={{ color: row.pii ? "#f87171" : undefined }}>{row.v}</span>
                {row.pii && (
                  <span
                    className="text-[9px] px-1 py-0.5 rounded"
                    style={{ background: "rgba(239,68,68,.12)", color: "#f87171", border: "1px solid rgba(239,68,68,.2)" }}
                  >
                    {row.pii}
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>

        {/* MASKED */}
        <div className="p-5">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60 mb-4">
            🟢 Masked Output
          </p>
          {ds.masked.map((row) => (
            <div
              key={row.k}
              className="flex items-center justify-between px-3 py-2 rounded-md mb-1.5 hover:bg-white/[0.02] transition-colors"
              style={{ background: "rgba(255,255,255,0.015)" }}
            >
              <span className="font-mono text-xs text-muted-foreground/60">{row.k}</span>
              <span className="font-mono text-xs flex items-center gap-1.5">
                <span style={{ color: row.mask ? "var(--color-primary, #00FF94)" : undefined }}>{row.v}</span>
                {row.mask && (
                  <span
                    className="text-[9px] px-1 py-0.5 rounded"
                    style={{ background: "rgba(0,255,148,.08)", color: "var(--color-primary, #00FF94)", border: "1px solid rgba(0,255,148,.2)" }}
                  >
                    {row.mask}
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* footer bar */}
      <div
        className="px-5 py-4 border-t border-border/40 flex flex-wrap items-center justify-between gap-3"
        style={{ background: "rgba(0,0,0,.15)" }}
      >
        <p className="text-sm text-muted-foreground">{ds.summary}</p>
        <Button asChild size="sm" className="bg-gradient-primary text-primary-foreground btn-glow">
          <Link to="/process">Try with your dataset <ArrowRight className="ml-1.5 h-3.5 w-3.5" /></Link>
        </Button>
      </div>
    </div>
  );
}

// ─── HERO PREVIEW ─────────────────────────────────────────────────────────────

const heroRaw = [
  { k: "pan",     v: "ABCPM1234R",         pii: true },
  { k: "aadhaar", v: "8821 4432 9901",      pii: true },
  { k: "phone",   v: "+91 98765 43210",     pii: true },
  { k: "email",   v: "rohan@gmail.com",     pii: true },
  { k: "city",    v: "Mumbai" },
  { k: "txn_amt", v: "₹42,500" },
];

const heroMasked = [
  { k: "pan",     v: "PAN_[HASH:a3f2]",     masked: true },
  { k: "aadhaar", v: "**** **** 9901",        masked: true },
  { k: "phone",   v: "+91 ***** 43210",      masked: true },
  { k: "email",   v: "r***@g***.com",        masked: true },
  { k: "city",    v: "Mumbai" },
  { k: "txn_amt", v: "₹42,500" },
];

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export default function Landing() {
  useFadeUp();

  return (
    <>
      {/* ── global styles injected once ── */}
      <style>{`
        .fs-fade-up { opacity: 0; transform: translateY(28px); transition: opacity .65s ease, transform .65s ease; }
        .fs-fade-up.fs-visible { opacity: 1; transform: none; }
        .fs-delay-1 { transition-delay: .1s; }
        .fs-delay-2 { transition-delay: .2s; }
        .fs-delay-3 { transition-delay: .3s; }
        .scan-line-anim { position: relative; overflow: hidden; }
        .scan-line-anim::after {
          content: '';
          position: absolute;
          left: 0; right: 0;
          height: 2px;
          background: linear-gradient(90deg, transparent, var(--color-primary, #00FF94), transparent);
          animation: scanMove 3s linear infinite;
          top: 0;
        }
        @keyframes scanMove { 0% { top: 0; } 100% { top: 100%; } }
        .fs-pipe-arrow { color: var(--muted-foreground); opacity: .4; }
        @media (max-width: 640px) { .fs-pipe-arrow { display: none; } }
      `}</style>

      <div className="min-h-screen flex flex-col">
        <Navbar />

        {/* ════════════════════════════════════════════════════
            HERO
        ════════════════════════════════════════════════════ */}
        <section className="relative overflow-hidden pt-24 pb-24 lg:pt-40 lg:pb-32">
          {/* bg layers */}
          <div className="absolute inset-0 cyber-grid opacity-50" />
          <div className="absolute inset-0 bg-gradient-glow" />
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 h-80 w-[44rem] bg-primary/15 blur-[130px] rounded-full" />
          <div className="absolute top-1/2 right-1/4 h-64 w-96 bg-secondary/15 blur-[110px] rounded-full" />

          <div className="container relative z-10 max-w-6xl">
            <div className="flex flex-col items-center text-center fs-fade-up">
              {/* badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass border border-primary/30 text-xs font-mono">
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                <span className="text-primary">Privacy Pipeline for Fintech AI Training</span>
              </div>

              {/* headline */}
              <h1 className="mt-6 text-4xl sm:text-5xl lg:text-[3.75rem] font-bold tracking-tight max-w-4xl leading-[1.08]">
                <span className="text-gradient-hero">Train AI on Real Fintech Data</span>
                <br />
                <span className="text-foreground"> Without Exposing Sensitive Information</span>
              </h1>

              <p className="mt-6 text-lg text-muted-foreground max-w-2xl leading-relaxed">
                Automatically detect and mask sensitive fields like PAN, Aadhaar, phone numbers,
                and emails — while preserving data utility for AI training.
              </p>

              {/* CTAs */}
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <Button asChild size="lg" className="bg-gradient-primary text-primary-foreground btn-glow shadow-glow-primary">
                  <Link to="/process">
                    Start Processing <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="border-border/60 hover:border-primary/50 hover:bg-primary/5">
                  <Link to="/dashboard">Go To Dashboard</Link>
                </Button>
              </div>

              {/* trust pills */}
              <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                {["PAN Numbers", "Aadhaar", "Phone & Email", "Credit Cards", "IP Addresses", "UPI Handles"].map((label) => (
                  <span
                    key={label}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono border"
                    style={{
                      background: "rgba(0,255,148,.04)",
                      borderColor: "rgba(0,255,148,.18)",
                      color: "var(--muted-foreground)",
                    }}
                  >
                    <ShieldCheck className="h-3 w-3 text-primary" />
                    {label}
                  </span>
                ))}
              </div>
            </div>

            {/* ── animated hero preview ── */}
            <div className="mt-16 max-w-3xl mx-auto fs-fade-up fs-delay-2">
              <div className="glass-strong rounded-2xl overflow-hidden border border-primary/20 scan-line-anim">
                {/* window chrome */}
                <div
                  className="flex items-center justify-between px-4 py-3 border-b border-border/40"
                  style={{ background: "rgba(0,0,0,.2)" }}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-destructive/70" />
                      <span className="h-2.5 w-2.5 rounded-full bg-yellow-400/70" />
                      <span className="h-2.5 w-2.5 rounded-full bg-primary/70" />
                    </div>
                    <span className="font-mono text-xs text-muted-foreground">fintech_customers_q3.csv</span>
                  </div>
                  <span
                    className="font-mono text-[10px] px-2 py-0.5 rounded border text-primary"
                    style={{ background: "rgba(0,255,148,.08)", borderColor: "rgba(0,255,148,.25)" }}
                  >
                    LIVE SCAN
                  </span>
                </div>

                {/* two-col preview */}
                <div className="grid grid-cols-1 sm:grid-cols-2">
                  {/* raw */}
                  <div className="p-5 border-b sm:border-b-0 sm:border-r border-border/40">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50 mb-3 flex items-center gap-2">
                      Raw
                      <span
                        className="text-[9px] px-1.5 py-0.5 rounded"
                        style={{ background: "rgba(239,68,68,.12)", color: "#f87171", border: "1px solid rgba(239,68,68,.2)" }}
                      >
                        SENSITIVE
                      </span>
                    </p>
                    {heroRaw.map((r) => (
                      <div key={r.k} className="font-mono text-xs mb-2 flex items-center gap-2">
                        <span className="text-muted-foreground/50 w-16 flex-shrink-0">{r.k}:</span>
                        <span style={{ color: r.pii ? "#f87171" : undefined }}>{r.v}</span>
                        {r.pii && (
                          <span
                            className="text-[9px] px-1 rounded"
                            style={{ background: "rgba(239,68,68,.12)", color: "#f87171" }}
                          >
                            PII
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                  {/* masked */}
                  <div className="p-5">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50 mb-3 flex items-center gap-2">
                      After masking
                      <span
                        className="text-[9px] px-1.5 py-0.5 rounded"
                        style={{ background: "rgba(0,255,148,.08)", color: "var(--color-primary,#00FF94)", border: "1px solid rgba(0,255,148,.2)" }}
                      >
                        SAFE
                      </span>
                    </p>
                    {heroMasked.map((r) => (
                      <div key={r.k} className="font-mono text-xs mb-2 flex items-center gap-2">
                        <span className="text-muted-foreground/50 w-16 flex-shrink-0">{r.k}:</span>
                        <span style={{ color: r.masked ? "var(--color-primary,#00FF94)" : undefined }}>{r.v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════
            PROBLEM
        ════════════════════════════════════════════════════ */}
        <section id="problem" className="py-24 border-t border-border/40">
          <div className="container max-w-6xl">
            <div className="fs-fade-up">
              <SectionTag>The Problem</SectionTag>
              <h2 className="text-3xl lg:text-4xl font-bold tracking-tight mb-4">
                Fintech AI faces a{" "}
                <span style={{ color: "#f87171" }}>data dilemma</span>
              </h2>
              <p className="text-muted-foreground text-lg max-w-xl">
                Building AI on financial data is powerful — but raw data carries risks that can't be ignored.
              </p>
            </div>

            <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {problems.map((p, i) => (
                <div
                  key={p.title}
                  className={`glass rounded-2xl p-6 hover:border-destructive/30 transition-all fs-fade-up fs-delay-${i + 1}`}
                >
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center text-xl mb-4"
                    style={{ background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.15)" }}
                  >
                    {p.icon}
                  </div>
                  <h3 className="font-semibold text-base mb-2">{p.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{p.desc}</p>
                </div>
              ))}
            </div>

            <div
              className="mt-10 rounded-2xl p-6 text-center fs-fade-up"
              style={{ border: "1px solid rgba(59,130,246,.2)", background: "rgba(59,130,246,.04)" }}
            >
              <p className="text-base text-muted-foreground">
                <strong className="text-foreground">Using real data safely is still a challenge.</strong>{" "}
                FinShield AI is built to close this gap.
              </p>
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════
            SOLUTION / HOW IT WORKS
        ════════════════════════════════════════════════════ */}
        <section id="how" className="relative py-24 border-y border-border/40 bg-card/30">
          <div className="absolute inset-0 cyber-grid opacity-25" />
          <div className="container relative z-10 max-w-6xl">
            <div className="fs-fade-up">
              <SectionTag>Pipeline</SectionTag>
              <h2 className="text-3xl lg:text-4xl font-bold tracking-tight mb-4">A simple privacy pipeline</h2>
              <p className="text-muted-foreground text-lg max-w-xl">
                Four steps from raw, sensitive data to a clean, model-ready dataset.
              </p>
            </div>

            {/* pipeline steps */}
            <div className="mt-12 flex flex-wrap items-center justify-center gap-2 fs-fade-up">
              {pipelineSteps.map((s, i) => {
                const Icon = s.icon;
                return (
                  <div key={s.label} className="flex items-center gap-2">
                    <div
                      className={`glass rounded-xl p-5 text-center min-w-[130px] transition hover:border-primary/40 ${
                        i === 1 || i === 2 ? "border-primary/25 bg-primary/5" : ""
                      }`}
                    >
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3"
                        style={{
                          background: "linear-gradient(135deg,rgba(0,255,148,.15),rgba(59,130,246,.12))",
                          border: "1px solid rgba(0,255,148,.2)",
                        }}
                      >
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <p className="font-mono text-[10px] text-muted-foreground/60 uppercase tracking-widest mb-1">
                        Step {s.num}
                      </p>
                      <p className="font-semibold text-sm">{s.label}</p>
                      <p className="text-xs text-muted-foreground mt-1">{s.sub}</p>
                    </div>
                    {i < pipelineSteps.length - 1 && (
                      <ArrowRight className="fs-pipe-arrow h-4 w-4 flex-shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>

            {/* solution features */}
            <div className="mt-12 grid sm:grid-cols-2 gap-4">
              {solFeatures.map((f, i) => (
                <div
                  key={f.title}
                  className={`glass rounded-xl p-5 flex items-start gap-4 hover:border-primary/35 transition fs-fade-up fs-delay-${i + 1}`}
                >
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 text-base"
                    style={{ background: "rgba(0,255,148,.06)", border: "1px solid rgba(0,255,148,.18)" }}
                  >
                    {f.icon}
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm mb-1">{f.title}</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════
            LIVE DEMO
        ════════════════════════════════════════════════════ */}
        <section id="demo" className="py-24 border-b border-border/40">
          <div className="container max-w-6xl">
            <div className="fs-fade-up">
              <SectionTag>Interactive Demo</SectionTag>
              <h2 className="text-3xl lg:text-4xl font-bold tracking-tight mb-4">See it in action</h2>
              <p className="text-muted-foreground text-lg max-w-xl">
                Sample fintech records before and after processing. Switch between dataset types to explore.
              </p>
            </div>
            <LiveDemo />
          </div>
        </section>

        {/* ════════════════════════════════════════════════════
            FEATURES GRID
        ════════════════════════════════════════════════════ */}
        <section id="features" className="py-24 border-b border-border/40">
          <div className="container max-w-6xl">
            <div className="text-center max-w-2xl mx-auto fs-fade-up">
              <SectionTag>Capabilities</SectionTag>
              <h2 className="text-3xl lg:text-4xl font-bold tracking-tight mb-4">Everything in the pipeline</h2>
              <p className="text-muted-foreground">
                Built specifically for fintech data patterns, not just generic PII.
              </p>
            </div>

            <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {features.map((f, i) => (
                <div
                  key={f.title}
                  className={`glass rounded-2xl p-6 hover:border-primary/35 transition-all relative overflow-hidden group fs-fade-up fs-delay-${(i % 3) + 1}`}
                >
                  <div className="absolute -top-10 -right-10 h-32 w-32 rounded-full bg-primary/5 blur-2xl group-hover:bg-primary/10 transition" />
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center text-xl mb-4 relative"
                    style={{ background: "rgba(0,255,148,.06)", border: "1px solid rgba(0,255,148,.18)" }}
                  >
                    {f.icon}
                  </div>
                  <h3 className="font-semibold text-base mb-2 relative">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed relative">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════
            METRICS
        ════════════════════════════════════════════════════ */}
        <section
          id="metrics"
          className="py-24 border-b border-border/40"
          style={{ background: "linear-gradient(180deg,transparent,rgba(0,255,148,.025),transparent)" }}
        >
          <div className="container max-w-6xl">
            <div className="text-center max-w-2xl mx-auto fs-fade-up">
              <SectionTag>Masking Results</SectionTag>
              <h2 className="text-3xl lg:text-4xl font-bold tracking-tight mb-4">What the pipeline delivers</h2>
              <p className="text-muted-foreground">
                Typical results on a sample fintech dataset with mixed structured and unstructured fields.
              </p>
            </div>

            {/* metric cards */}
            <div className="mt-12 grid grid-cols-2 lg:grid-cols-4 gap-4 fs-fade-up">
              {metrics.map((m) => (
                <MetricCard key={m.id} target={m.target} suffix={m.suffix} label={m.label} />
              ))}
            </div>

            {/* progress bars */}
            <div className="mt-8 glass rounded-2xl p-6 lg:p-8 fs-fade-up">
              {progressBars.map((p) => (
                <ProgressRow key={p.label} label={p.label} target={p.target} color={p.color} />
              ))}
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════
            COMPARISON
        ════════════════════════════════════════════════════ */}
        <section id="compare" className="py-24 border-b border-border/40">
          <div className="container max-w-6xl">
            <div className="fs-fade-up">
              <SectionTag>Why FinShield</SectionTag>
              <h2 className="text-3xl lg:text-4xl font-bold tracking-tight mb-4">Purpose-built for fintech privacy</h2>
              <p className="text-muted-foreground text-lg max-w-xl">
                Most tools do basic masking. FinShield AI is designed around the realities of Indian financial data.
              </p>
            </div>

            <div className="mt-12 grid md:grid-cols-2 gap-5">
              {/* Others */}
              <div className="glass rounded-2xl p-7 fs-fade-up fs-delay-1">
                <h3 className="font-bold text-lg mb-6 flex items-center gap-3">
                  Generic tools
                  <span
                    className="text-xs px-2 py-0.5 rounded font-mono"
                    style={{ background: "rgba(100,116,139,.12)", color: "#64748b" }}
                  >
                    Others
                  </span>
                </h3>
                {othersItems.map((item) => (
                  <div key={item} className="flex items-start gap-3 py-2.5 border-b border-border/30 last:border-0">
                    <span className="text-destructive/70 mt-0.5 flex-shrink-0">✗</span>
                    <span className="text-sm text-muted-foreground">{item}</span>
                  </div>
                ))}
              </div>

              {/* Ours */}
              <div
                className="glass rounded-2xl p-7 fs-fade-up fs-delay-2"
                style={{ borderColor: "rgba(0,255,148,.2)", background: "linear-gradient(135deg,rgba(0,255,148,.06),transparent)" }}
              >
                <h3 className="font-bold text-lg mb-6 flex items-center gap-3">
                  FinShield AI
                  <span
                    className="text-xs px-2 py-0.5 rounded font-mono"
                    style={{ background: "rgba(0,255,148,.1)", color: "var(--color-primary,#00FF94)" }}
                  >
                    Our approach
                  </span>
                </h3>
                {oursItems.map((item) => (
                  <div key={item.strong} className="flex items-start gap-3 py-2.5 border-b border-border/30 last:border-0">
                    <span className="text-primary mt-0.5 flex-shrink-0">✓</span>
                    <span className="text-sm text-muted-foreground">
                      <strong className="text-foreground">{item.strong}</strong>
                      {item.rest}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════
            TRUST
        ════════════════════════════════════════════════════ */}
        <section id="trust" className="py-24 border-b border-border/40">
          <div className="container max-w-6xl">
            <div className="text-center max-w-2xl mx-auto fs-fade-up">
              <SectionTag>Trust</SectionTag>
              <h2 className="text-3xl lg:text-4xl font-bold tracking-tight mb-4">
                Built for teams that can't get privacy wrong
              </h2>
            </div>
            <div className="mt-12 grid sm:grid-cols-3 gap-5">
              {trustItems.map((t, i) => {
                const Icon = t.icon;
                return (
                  <div key={t.title} className={`glass rounded-2xl p-6 fs-fade-up fs-delay-${i + 1}`}>
                    <div className="inline-flex p-3 rounded-xl bg-primary/10 border border-primary/30 text-primary mb-4">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="font-semibold mb-2">{t.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{t.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════
            FINAL CTA
        ════════════════════════════════════════════════════ */}
        <section className="py-24">
          <div className="container max-w-6xl">
            <div className="glass-strong rounded-3xl p-10 lg:p-16 text-center relative overflow-hidden fs-fade-up">
              <div className="absolute inset-0 bg-gradient-glow opacity-50" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-primary/10 blur-[100px] rounded-full" />
              <div className="relative">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass border border-primary/30 text-xs font-mono mb-6">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                  <span className="text-primary">Ready to try it?</span>
                </div>
                <h2 className="text-3xl lg:text-5xl font-bold tracking-tight mb-4">
                  Start masking your data<br />for safer AI experiments
                </h2>
                <p className="text-muted-foreground text-lg max-w-lg mx-auto mb-8">
                  Upload a dataset, see what gets detected, and download a clean masked version — no account required to explore.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <Button asChild size="lg" className="bg-gradient-primary text-primary-foreground btn-glow shadow-glow-primary">
                    <Link to="/process">
                      Try FinShield <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                  <Button asChild size="lg" variant="outline" className="border-border/60 hover:border-primary/50 hover:bg-primary/5">
                    <Link to="/dashboard">Go To Dashboard</Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <Footer />
      </div>
    </>
  );
}