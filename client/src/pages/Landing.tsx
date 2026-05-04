import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight, ShieldCheck, Wand2, FileBarChart2,
  Lock, Server, Building2, Upload, Search, FileText,
  Zap, BarChart2, ChevronRight, Eye, EyeOff, AlertTriangle,
  Database, Shield, CheckCircle2, XCircle, Activity,
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
  { icon: Upload,   num: "01", label: "Raw Data",        sub: "CSV · JSON · XLSX · TXT · LOG · DOCX" },
  { icon: Search,   num: "02", label: "Detect",          sub: "Syntactic + NLP scan" },
  { icon: Wand2,    num: "03", label: "Mask & Transform", sub: "Redact · Partial · Pattern · Pseudonymise" },
  { icon: FileText, num: "04", label: "Safe Output",     sub: "Model-ready dataset + Report" },
];

const solFeatures = [
  { icon: "🧠", title: "Hybrid detection (syntactic+nlp)",  desc: "Combines rule-based patterns and NLP for higher coverage across structured and free-text fields." },
  { icon: "🎭", title: "4 masking techniques",              desc: "Full redaction, partial masking (****1234), pattern replacement (SBINXXXX), or pseudonymisation (User_4162)." },
  { icon: "📊", title: "Utility-preserving transforms",    desc: "Non-sensitive fields and statistical structure stay intact so your models still learn what they need." },
  { icon: "📋", title: "Field-level masking report",       desc: "Every run shows what was detected, the masking method applied, PII %, utility %, and risk score." },
];

// ── REAL TABULAR DEMO DATA ─────────────────────────────────────────────────────
const tabularDatasets = [
  {
    label: "Customer Records",
    raw: [
      { k: "Name",        v: "Ananya Sharma",           pii: "NAME" },
      { k: "Email",       v: "ananya@example.com",      pii: "EMAIL" },
      { k: "Phone",       v: "+91-9876543210",           pii: "PHONE" },
      { k: "Aadhaar",     v: "8821 4432 9901",           pii: "UID" },
      { k: "PAN",         v: "ABCPM1234R",               pii: "PAN" },
      { k: "Address",     v: "42 MG Road, London",       pii: "ADDRESS" },
      { k: "DOB",         v: "1999-07-14",               pii: "DOB" },
      { k: "IP",          v: "192.168.10.45",            pii: "IP" },
      { k: "CreditCard",  v: "4111-1111-1111-1111",      pii: "CARD" },
      { k: "CVV",         v: "372",                      pii: "CVV" },
      { k: "Company",     v: "RefynAI" },
      { k: "Salary",      v: "1200000" },
    ],
    masked: [
      { k: "Name",        v: "Person_1",                 mask: "PSEUDONYM" },
      { k: "Email",       v: "an*****@example.com",      mask: "PARTIAL" },
      { k: "Phone",       v: "+91-XXXXXXXX",             mask: "PATTERN" },
      { k: "Aadhaar",     v: "[REDACTED]",               mask: "REDACTED" },
      { k: "PAN",         v: "[REDACTED]",               mask: "REDACTED" },
      { k: "Address",     v: "[REDACTED]",               mask: "REDACTED" },
      { k: "DOB",         v: "1999",                     mask: "PARTIAL" },
      { k: "IP",          v: "192.168.X.X",              mask: "PATTERN" },
      { k: "CreditCard",  v: "****-****-1111",           mask: "PARTIAL" },
      { k: "CVV",         v: "[REDACTED]",               mask: "REDACTED" },
      { k: "Company",     v: "RefynAI" },
      { k: "Salary",      v: "1200000" },
    ],
    summary: "10 sensitive fields detected · 10 masked · Company & Salary preserved",
  },
  {
    label: "Transactions",
    raw: [
      { k: "Name",       v: "Riya Mehta",               pii: "NAME" },
      { k: "Email",      v: "riya@gmail.com",            pii: "EMAIL" },
      { k: "Phone",      v: "+91-9988776655",            pii: "PHONE" },
      { k: "Aadhaar",    v: "3312 4421 8890",            pii: "UID" },
      { k: "PAN",        v: "GVPRS4412K",                pii: "PAN" },
      { k: "Address",    v: "15 Park St, Bangalore",     pii: "ADDRESS" },
      { k: "DOB",        v: "2000-03-21",                pii: "DOB" },
      { k: "IP",         v: "10.0.0.132",                pii: "IP" },
      { k: "CreditCard", v: "5200-8282-8210",            pii: "CARD" },
      { k: "CVV",        v: "819",                       pii: "CVV" },
      { k: "Company",    v: "Infosys" },
      { k: "Salary",     v: "800000" },
    ],
    masked: [
      { k: "Name",       v: "Person_2",                  mask: "PSEUDONYM" },
      { k: "Email",      v: "ri*****@gmail.com",         mask: "PARTIAL" },
      { k: "Phone",      v: "+91-XXXXXXXX",              mask: "PATTERN" },
      { k: "Aadhaar",    v: "[REDACTED]",                mask: "REDACTED" },
      { k: "PAN",        v: "[REDACTED]",                mask: "REDACTED" },
      { k: "Address",    v: "[REDACTED]",                mask: "REDACTED" },
      { k: "DOB",        v: "2000",                      mask: "PARTIAL" },
      { k: "IP",         v: "10.0.X.X",                  mask: "PATTERN" },
      { k: "CreditCard", v: "****-****-0004",            mask: "PARTIAL" },
      { k: "CVV",        v: "[REDACTED]",                mask: "REDACTED" },
      { k: "Company",    v: "Infosys" },
      { k: "Salary",     v: "800000" },
    ],
    summary: "10 sensitive fields detected · 10 masked · Company & Salary preserved",
  },
  {
    label: "KYC Dataset",
    raw: [
      { k: "Name",       v: "Rahul Verma",               pii: "NAME" },
      { k: "Email",      v: "rahul@yahoo.com",            pii: "EMAIL" },
      { k: "Phone",      v: "+91-9870001234",             pii: "PHONE" },
      { k: "Aadhaar",    v: "5521 3312 7890",             pii: "UID" },
      { k: "PAN",        v: "DKRPS7823G",                 pii: "PAN" },
      { k: "Address",    v: "7 Civil Lines, Delhi",       pii: "ADDRESS" },
      { k: "DOB",        v: "1995-11-09",                 pii: "DOB" },
      { k: "IP",         v: "172.16.0.9",                 pii: "IP" },
      { k: "CreditCard", v: "3714-496353-98431",          pii: "CARD" },
      { k: "CVV",        v: "123",                        pii: "CVV" },
      { k: "Company",    v: "TCS" },
      { k: "Salary",     v: "950000" },
    ],
    masked: [
      { k: "Name",       v: "Person_3",                   mask: "PSEUDONYM" },
      { k: "Email",      v: "ra*****@yahoo.com",          mask: "PARTIAL" },
      { k: "Phone",      v: "+91-XXXXXXXX",               mask: "PATTERN" },
      { k: "Aadhaar",    v: "[REDACTED]",                 mask: "REDACTED" },
      { k: "PAN",        v: "[REDACTED]",                 mask: "REDACTED" },
      { k: "Address",    v: "[REDACTED]",                 mask: "REDACTED" },
      { k: "DOB",        v: "1995",                       mask: "PARTIAL" },
      { k: "IP",         v: "172.16.X.X",                 mask: "PATTERN" },
      { k: "CreditCard", v: "****-****-0009",             mask: "PARTIAL" },
      { k: "CVV",        v: "[REDACTED]",                 mask: "REDACTED" },
      { k: "Company",    v: "TCS" },
      { k: "Salary",     v: "950000" },
    ],
    summary: "10 sensitive fields detected · 10 masked · Company & Salary preserved",
  },
];

// ── REAL UNSTRUCTURED / DOCUMENT DEMO DATA ─────────────────────────────────────
const unstructuredLines = [
  { num: 1,  type: "section", text: "PII Test Document – Fintech Dataset" },
  { num: 2,  type: "section", text: "--- Personal Information ---" },
  { num: 3,  type: "field",   key: "Name:",         value: "User_4162",                      maskType: "pseudonym" },
  { num: 4,  type: "field",   key: "Email:",         prefix: "an", masked: "*****", suffix: "@example.com", maskType: "partial" },
  { num: 5,  type: "field",   key: "Phone:",         prefix: "+91-", masked: "XXXXXX3210",    maskType: "pattern" },
  { num: 6,  type: "field",   key: "Aadhaar:",       value: "[REDACTED]",                     maskType: "redacted" },
  { num: 7,  type: "field",   key: "PAN:",           value: "[REDACTED]",                     maskType: "redacted" },
  { num: 8,  type: "field",   key: "Address:",       value: "[REDACTED]",                     maskType: "redacted" },
  { num: 9,  type: "field",   key: "DOB:",           value: "1999",                           maskType: "partial-safe" },
  { num: 12, type: "section", text: "--- Financial Information ---" },
  { num: 13, type: "field",   key: "Credit Card:",   value: "****-****-1111",                 maskType: "partial" },
  { num: 14, type: "field",   key: "CVV:",           value: "[REDACTED]",                     maskType: "redacted" },
  { num: 15, type: "field",   key: "Expiry:",        value: "XX/26",                          maskType: "pattern" },
  { num: 16, type: "field",   key: "Account No:",    value: "****3210",                       maskType: "partial" },
  { num: 17, type: "field",   key: "IFSC Code:",     prefix: "HDFC", masked: "XXXXXXX",       maskType: "pattern" },
  { num: 18, type: "field",   key: "Salary:",        value: "[REDACTED]",                     maskType: "redacted" },
  { num: 19, type: "section", text: "--- Employment Details ---" },
  { num: 20, type: "field",   key: "Company:",       value: "RefynAI",                        maskType: "safe" },
  { num: 21, type: "field",   key: "Job Title:",     value: "Software Engineer",              maskType: "safe" },
  { num: 22, type: "section", text: "--- System Logs ---" },
  { num: 23, type: "log",     level: "INFO",  text: "2026-05-03 10:12:01 User login success" },
  { num: 24, type: "log-data", parts: [
      { text: "user=" },
      { text: "User_4162", maskType: "pseudonym" },
      { text: " email=an" },
      { text: "*****", maskType: "partial" },
      { text: "@example.com ip=192.168." },
      { text: "XXX", maskType: "pattern" },
      { text: ".XXX" },
  ]},
  { num: 25, type: "log",     level: "WARN",  text: "2026-05-03 10:13:45 Failed OTP attempt" },
  { num: 26, type: "log-data", parts: [
      { text: "phone=+91-" },
      { text: "XXXXXX6780", maskType: "pattern" },
      { text: " otp=" },
      { text: "[REDACTED]", maskType: "redacted" },
  ]},
  { num: 27, type: "log",     level: "INFO",  text: "2026-05-03 10:15:12 Payment processed" },
  { num: 28, type: "log-data", parts: [
      { text: "card=" },
      { text: "[REDACTED]", maskType: "redacted" },
      { text: "-1111 expiry=" },
      { text: "XX/26", maskType: "pattern" },
      { text: " amount=5000" },
  ]},
  { num: 29, type: "log",     level: "ERROR", text: "2026-05-03 10:16:33 KYC verification failed" },
  { num: 30, type: "log-data", parts: [
      { text: "aadhaar=" },
      { text: "[REDACTED]", maskType: "redacted" },
      { text: " pan=" },
      { text: "[REDACTED]", maskType: "redacted" },
  ]},
];

const features = [
  { icon: "📂", title: "6 file formats supported",      desc: "CSV, JSON, XLSX, TXT, LOG, and DOCX. Drop any fintech export and the pipeline handles ingestion automatically." },
  { icon: "🇮🇳", title: "India-first PII coverage",     desc: "PAN, Aadhaar, Indian mobile numbers, UPI handles, IFSC codes, and GST numbers — detected out of the box." },
  { icon: "🧩", title: "Structured & unstructured",    desc: "Tabular CSV data and messy log files, KYC documents, transaction narratives — same pipeline handles both." },
  { icon: "📄", title: "Masking report per run",       desc: "Every run generates a field-level report: detection stats, masking method, PII %, utility %, and re-ID risk score." },
  { icon: "⚡", title: "Fast processing (< 1s)",       desc: "Batch processing thousands of rows in under a second. Run ID, timing, and mode shown for every job." },
  { icon: "🎛️", title: "3 preview modes",              desc: "Document view with colour-coded legend, Table view with column toggles, and JSON view — switch instantly." },
];

const metrics = [
  { id: "m-detection", target: 92, suffix: "%", label: "PII fields detected" },
  { id: "m-masked",    target: 100, suffix: "%", label: "Fields successfully masked" },
  { id: "m-utility",  target: 61,  suffix: "%", label: "Data utility score" },
  { id: "m-intact",   target: 100, suffix: "%", label: "Non-PII fields kept intact" },
];

const progressBars = [
  { label: "Email Detection",       target: 98, color: "var(--color-primary, #00FF94)" },
  { label: "Phone Number Detection",target: 98, color: "var(--color-primary, #00FF94)" },
  { label: "Aadhaar / PAN",         target: 96, color: "var(--color-primary, #00FF94)" },
  { label: "Credit Card Numbers",   target: 99, color: "var(--color-primary, #00FF94)" },
  { label: "IP Address Detection",  target: 95, color: "var(--color-primary, #00FF94)" },
  { label: "Data Utility Retained", target: 61, color: "#3B82F6" },
];

const othersItems = [
  "Basic regex masking only",
  "No structure or context awareness",
  "Limited to a few field types",
  "No utility scoring or reporting",
  "Not tuned for Indian PII formats",
  "Handles structured data only",
  "No document / log file support",
];

const oursItems = [
  { strong: "Hybrid detection", rest: " — syntactic rules + NLP for higher coverage" },
  { strong: "4 masking strategies", rest: " — redact, partial, pattern-replace, pseudonymise" },
  { strong: "PAN, Aadhaar, UPI, IFSC, GST", rest: " and more, built-in from day one" },
  { strong: "Utility & risk scoring", rest: " per run with full field-level breakdown" },
  { strong: "India-first", rest: " PII patterns built in from the start" },
  { strong: "Structured + unstructured", rest: " — CSV, JSON, XLSX, DOCX, LOG in one pipeline" },
  { strong: "3 preview modes", rest: " — Document · Table · JSON with colour-coded legend" },
];

const trustItems = [
  { icon: Server,    title: "No data stored",         desc: "Datasets are processed in-memory and discarded immediately after the masked output and report are generated." },
  { icon: Lock,      title: "Secure processing",      desc: "End-to-end encryption and isolated compute for every processing run. Run IDs are ephemeral." },
  { icon: Building2, title: "Fintech-focused design", desc: "Built around Indian financial data patterns — PAN, Aadhaar, UPI, IFSC — not generic western PII libraries." },
];

// Masking legend items
const maskingLegend = [
  { label: "[REDACTED]",   desc: "Fully removed",      bg: "rgba(239,68,68,.15)", color: "#f87171",   border: "rgba(239,68,68,.3)" },
  { label: "****1234",     desc: "Partial mask",        bg: "rgba(234,179,8,.15)", color: "#fbbf24",   border: "rgba(234,179,8,.35)" },
  { label: "SBINXXXX",     desc: "Pattern replaced",   bg: "rgba(59,130,246,.15)", color: "#60a5fa",  border: "rgba(59,130,246,.35)" },
  { label: "User_4162",    desc: "Pseudonymised",       bg: "rgba(168,85,247,.15)", color: "#d8b4fe",  border: "rgba(168,85,247,.35)" },
];

// ─── HOOKS ───────────────────────────────────────────────────────────────────

function useFadeUp() {
  useEffect(() => {
    const els = document.querySelectorAll(".fs-fade-up");
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add("fs-visible"); }),
      { threshold: 0.08 }
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
    <div className="glass rounded-2xl p-4 sm:p-6 text-center border border-primary/20 bg-primary/5">
      <div
        ref={ref}
        className="font-bold text-3xl sm:text-5xl text-primary mb-1 sm:mb-2"
        style={{ fontFamily: "'Syne', sans-serif", lineHeight: 1 }}
      >
        0{suffix}
      </div>
      <p className="text-xs sm:text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>{label}</p>
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
    <div className="mb-4 last:mb-0">
      <div className="flex justify-between mb-1.5 text-xs sm:text-sm">
        <span style={{ color: "rgba(255,255,255,0.7)" }}>{label}</span>
        <span ref={valRef} className="font-mono font-medium" style={{ color }}>0%</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
        <div
          ref={barRef}
          className="h-full rounded-full transition-none"
          style={{ width: "0%", background: `linear-gradient(90deg, ${color}, #22D3EE)` }}
        />
      </div>
    </div>
  );
}

// ─── MASK CHIP ────────────────────────────────────────────────────────────────

function MaskChip({ type, children }) {
  const styles = {
    redacted:       { bg: "rgba(239,68,68,.2)",    color: "#fca5a5",  border: "rgba(239,68,68,.4)" },
    partial:        { bg: "rgba(234,179,8,.18)",   color: "#fbbf24",  border: "rgba(234,179,8,.4)" },
    pattern:        { bg: "rgba(59,130,246,.18)",  color: "#93c5fd",  border: "rgba(59,130,246,.4)" },
    pseudonym:      { bg: "rgba(168,85,247,.18)",  color: "#d8b4fe",  border: "rgba(168,85,247,.4)" },
    "partial-safe": { bg: "rgba(148,163,184,.12)", color: "#cbd5e1",  border: "rgba(148,163,184,.3)" },
    safe:           { bg: "transparent",           color: "rgba(255,255,255,0.85)", border: "transparent" },
  };
  const s = styles[type] || styles.safe;
  return (
    <span
      style={{
        background: s.bg,
        color: s.color,
        border: `1px solid ${s.border}`,
        padding: "1px 5px",
        borderRadius: "4px",
        fontFamily: "monospace",
        fontSize: "inherit",
        fontWeight: 500,
        wordBreak: "break-all",
      }}
    >
      {children}
    </span>
  );
}

// ─── TABULAR DEMO ─────────────────────────────────────────────────────────────

function TabularDemo() {
  const [activeTab, setActiveTab] = useState(0);
  const [mobileView, setMobileView] = useState<"raw" | "masked">("raw");
  const ds = tabularDatasets[activeTab];

  return (
    <div className="mt-6 rounded-2xl overflow-hidden border" style={{ background: "rgba(10,15,25,0.8)", borderColor: "rgba(0,255,148,0.25)" }}>
      {/* Dataset tabs */}
      <div className="flex border-b overflow-x-auto" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
        {tabularDatasets.map((d, i) => (
          <button
            key={d.label}
            onClick={() => setActiveTab(i)}
            className="px-3 sm:px-5 py-3 text-xs sm:text-sm font-medium whitespace-nowrap transition-colors relative flex-1 sm:flex-none"
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: activeTab === i ? "#00FF94" : "rgba(255,255,255,0.5)",
            }}
          >
            {d.label}
            {activeTab === i && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: "#00FF94" }} />
            )}
          </button>
        ))}
      </div>

      {/* Mobile toggle: Raw / Masked */}
      <div className="flex md:hidden border-b" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
        {(["raw", "masked"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setMobileView(v)}
            className="flex-1 py-2.5 text-xs font-mono uppercase tracking-widest transition-colors"
            style={{
              background: mobileView === v ? "rgba(0,255,148,0.08)" : "transparent",
              border: "none",
              cursor: "pointer",
              color: mobileView === v ? "#00FF94" : "rgba(255,255,255,0.4)",
              borderBottom: mobileView === v ? "2px solid #00FF94" : "2px solid transparent",
            }}
          >
            {v === "raw" ? "🔴 Raw" : "🟢 Masked"}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2">
        {/* RAW — hidden on mobile when masked view is selected; always visible on desktop */}
        <div
          className="raw-col p-4 sm:p-5 border-b md:border-b-0 md:border-r"
          style={{
            borderColor: "rgba(255,255,255,0.08)",
            display: mobileView === "masked" ? "none" : undefined,
          }}
        >
          <p className="hidden md:flex font-mono text-[10px] uppercase tracking-widest mb-4 items-center gap-2" style={{ color: "rgba(255,255,255,0.4)" }}>
            🔴 Raw Dataset
          </p>
          {ds.raw.map((row) => (
            <div
              key={row.k}
              className="flex items-center justify-between px-2.5 sm:px-3 py-2 rounded-md mb-1.5"
              style={{ background: "rgba(255,255,255,0.03)" }}
            >
              <span className="font-mono text-[11px] sm:text-xs flex-shrink-0 mr-2" style={{ color: "rgba(255,255,255,0.45)", minWidth: "72px" }}>{row.k}</span>
              <span className="font-mono text-[11px] sm:text-xs flex items-center gap-1 flex-wrap justify-end">
                <span style={{ color: row.pii ? "#fca5a5" : "rgba(255,255,255,0.8)", wordBreak: "break-all", textAlign: "right" }}>{row.v}</span>
                {row.pii && (
                  <span
                    className="text-[9px] px-1 py-0.5 rounded flex-shrink-0"
                    style={{ background: "rgba(239,68,68,.15)", color: "#fca5a5", border: "1px solid rgba(239,68,68,.3)" }}
                  >
                    {row.pii}
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>

        {/* MASKED — hidden on mobile when raw view is selected; always visible on desktop */}
        <div
          className="masked-col p-4 sm:p-5"
          style={{ display: mobileView === "raw" ? "none" : undefined }}
        >
          <p className="hidden md:block font-mono text-[10px] uppercase tracking-widest mb-4" style={{ color: "rgba(255,255,255,0.4)" }}>
            🟢 Masked Output
          </p>
          {ds.masked.map((row) => {
            const maskColorMap = {
              REDACTED: "redacted", PARTIAL: "partial",
              PATTERN: "pattern", PSEUDONYM: "pseudonym",
            };
            const chipType = maskColorMap[row.mask] || "safe";
            return (
              <div
                key={row.k}
                className="flex items-center justify-between px-2.5 sm:px-3 py-2 rounded-md mb-1.5"
                style={{ background: "rgba(255,255,255,0.03)" }}
              >
                <span className="font-mono text-[11px] sm:text-xs flex-shrink-0 mr-2" style={{ color: "rgba(255,255,255,0.45)", minWidth: "72px" }}>{row.k}</span>
                <span className="font-mono text-[11px] sm:text-xs flex items-center gap-1 flex-wrap justify-end">
                  {row.mask ? (
                    <MaskChip type={chipType}>{row.v}</MaskChip>
                  ) : (
                    <span style={{ color: "rgba(255,255,255,0.8)" }}>{row.v}</span>
                  )}
                  {row.mask && (
                    <span
                      className="text-[9px] px-1 py-0.5 rounded flex-shrink-0"
                      style={{ background: "rgba(0,255,148,.1)", color: "#00FF94", border: "1px solid rgba(0,255,148,.25)" }}
                    >
                      {row.mask}
                    </span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div
        className="px-4 sm:px-5 py-3 sm:py-4 border-t flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        style={{ background: "rgba(0,0,0,.3)", borderColor: "rgba(255,255,255,0.08)" }}
      >
        <p className="text-xs sm:text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>{ds.summary}</p>
        <Button asChild size="sm" className="bg-gradient-primary text-primary-foreground btn-glow w-full sm:w-auto">
          <Link to="/process">Try with your dataset <ArrowRight className="ml-1.5 h-3.5 w-3.5" /></Link>
        </Button>
      </div>
    </div>
  );
}

// ─── DOCUMENT / LOG DEMO ──────────────────────────────────────────────────────

function DocumentDemo() {
  const logLevelColor = { INFO: "#60a5fa", WARN: "#f59e0b", ERROR: "#f87171" };

  return (
    <div className="mt-6 rounded-2xl overflow-hidden border" style={{ background: "rgba(10,15,25,0.8)", borderColor: "rgba(0,255,148,0.25)" }}>
      {/* header */}
      <div
        className="flex flex-col sm:flex-row sm:items-center justify-between px-4 sm:px-5 py-3 gap-2 border-b"
        style={{ background: "rgba(0,0,0,0.3)", borderColor: "rgba(255,255,255,0.08)" }}
      >
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="font-mono text-[11px] sm:text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>fintech_pii_test.txt</span>
          <span
            className="text-[10px] px-2 py-0.5 rounded font-mono"
            style={{ background: "rgba(59,130,246,.15)", color: "#93c5fd", border: "1px solid rgba(59,130,246,.35)" }}
          >
            line-by-line
          </span>
        </div>
        {/* Legend — wraps nicely on mobile */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {maskingLegend.map((l) => (
            <span
              key={l.label}
              className="inline-flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.5 rounded"
              style={{ background: l.bg, color: l.color, border: `1px solid ${l.border}` }}
            >
              {l.label}
              <span style={{ color: "rgba(255,255,255,.4)", marginLeft: 1 }}>{l.desc}</span>
            </span>
          ))}
        </div>
      </div>

      {/* lines */}
      <div className="p-3 sm:p-4 max-h-[360px] sm:max-h-[420px] overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
        {unstructuredLines.map((line) => {
          if (line.type === "section") {
            return (
              <div key={line.num} className="flex items-center gap-2 sm:gap-3 py-1.5 sm:py-2">
                <span className="font-mono text-[10px] w-5 sm:w-6 flex-shrink-0" style={{ color: "rgba(255,255,255,0.2)" }}>{line.num}</span>
                <span className="font-mono text-[11px] sm:text-xs font-bold" style={{ color: "rgba(255,255,255,0.65)" }}>{line.text}</span>
              </div>
            );
          }
          if (line.type === "field") {
            return (
              <div key={line.num} className="flex items-start gap-2 sm:gap-3 py-1.5 border-b last:border-0" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                <span className="font-mono text-[10px] w-5 sm:w-6 flex-shrink-0 pt-0.5" style={{ color: "rgba(255,255,255,0.2)" }}>{line.num}</span>
                <span className="font-mono text-[11px] sm:text-xs flex-shrink-0" style={{ color: "rgba(255,255,255,0.45)", width: "80px", minWidth: "80px" }}>{line.key}</span>
                <span className="font-mono text-[11px] sm:text-xs flex-wrap">
                  {line.maskType === "safe" ? (
                    <span style={{ color: "rgba(255,255,255,0.85)" }}>{line.value}</span>
                  ) : line.prefix ? (
                    <>
                      <span style={{ color: "rgba(255,255,255,0.85)" }}>{line.prefix}</span>
                      <MaskChip type={line.maskType}>{line.masked}</MaskChip>
                      {line.suffix && <span style={{ color: "rgba(255,255,255,0.85)" }}>{line.suffix}</span>}
                    </>
                  ) : (
                    <MaskChip type={line.maskType}>{line.value}</MaskChip>
                  )}
                </span>
              </div>
            );
          }
          if (line.type === "log") {
            const lvl = line.level;
            return (
              <div key={line.num} className="flex items-start gap-2 sm:gap-3 py-1.5">
                <span className="font-mono text-[10px] w-5 sm:w-6 flex-shrink-0 pt-0.5" style={{ color: "rgba(255,255,255,0.2)" }}>{line.num}</span>
                <span
                  className="text-[9px] font-mono px-1.5 py-0.5 rounded flex-shrink-0"
                  style={{ background: `${logLevelColor[lvl]}20`, color: logLevelColor[lvl], border: `1px solid ${logLevelColor[lvl]}40` }}
                >
                  {lvl}
                </span>
                <span className="font-mono text-[11px] sm:text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>{line.text}</span>
              </div>
            );
          }
          if (line.type === "log-data") {
            return (
              <div key={line.num} className="flex items-start gap-2 py-1 pl-7 sm:pl-14">
                <span className="font-mono text-[11px] sm:text-xs flex-wrap leading-relaxed break-all">
                  {line.parts.map((p, pi) =>
                    p.maskType ? (
                      <MaskChip key={pi} type={p.maskType}>{p.text}</MaskChip>
                    ) : (
                      <span key={pi} style={{ color: "rgba(255,255,255,0.55)" }}>{p.text}</span>
                    )
                  )}
                </span>
              </div>
            );
          }
          return null;
        })}
      </div>

      <div
        className="px-4 sm:px-5 py-3 sm:py-4 border-t flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        style={{ background: "rgba(0,0,0,0.3)", borderColor: "rgba(255,255,255,0.08)" }}
      >
        <p className="text-xs sm:text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>
          45 lines processed · PAN, Aadhaar, phone, card, IP, OTP masked
        </p>
        <Button asChild size="sm" className="bg-gradient-primary text-primary-foreground btn-glow w-full sm:w-auto">
          <Link to="/process">Try with your files <ArrowRight className="ml-1.5 h-3.5 w-3.5" /></Link>
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
  { k: "email",   v: "ananya@example.com",  pii: true },
  { k: "ip",      v: "192.168.10.45",       pii: true },
  { k: "card",    v: "4111-****-****-1111", pii: true },
  { k: "company", v: "RefynAI" },
  { k: "salary",  v: "₹12,00,000" },
];

const heroMasked = [
  { k: "pan",     v: "[REDACTED]",           type: "redacted" },
  { k: "aadhaar", v: "[REDACTED]",           type: "redacted" },
  { k: "phone",   v: "+91-XXXXXXXX",         type: "pattern" },
  { k: "email",   v: "an*****@example.com",  type: "partial" },
  { k: "ip",      v: "192.168.X.X",          type: "pattern" },
  { k: "card",    v: "****-****-****-1111",  type: "partial" },
  { k: "company", v: "RefynAI" },
  { k: "salary",  v: "₹12,00,000" },
];

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export default function Landing() {
  useFadeUp();
  const [demoMode, setDemoMode] = useState("tabular");

  return (
    <>
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

        /* ── FIX: On desktop (md+), always show both raw and masked columns
           regardless of the mobileView toggle state ── */
        @media (min-width: 768px) {
          .raw-col    { display: block !important; }
          .masked-col { display: block !important; }
        }

        /* Mobile: stack demo mode buttons */
        .demo-mode-btn {
          border-radius: 12px;
          padding: 12px;
          text-align: left;
          transition: all 0.2s ease;
          cursor: pointer;
          width: 100%;
        }
        @media (min-width: 640px) {
          .demo-mode-btn {
            flex: 1;
            padding: 16px;
          }
        }
        .demo-mode-btn:hover {
          border-color: rgba(0,255,148,0.2) !important;
        }

        /* Smooth horizontal scroll for trust pills on mobile */
        .trust-pills-scroll {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 0.5rem;
        }
        @media (max-width: 480px) {
          .trust-pills-scroll {
            justify-content: flex-start;
            flex-wrap: nowrap;
            overflow-x: auto;
            padding-bottom: 4px;
            scrollbar-width: none;
          }
          .trust-pills-scroll::-webkit-scrollbar { display: none; }
        }
      `}</style>

      <div className="min-h-screen flex flex-col">
        <Navbar />

        {/* ════ HERO ════ */}
        <section className="relative overflow-hidden pt-20 pb-16 sm:pt-24 sm:pb-24 lg:pt-40 lg:pb-32">
          <div className="absolute inset-0 cyber-grid opacity-50" />
          <div className="absolute inset-0 bg-gradient-glow" />
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 h-80 w-[44rem] bg-primary/15 blur-[130px] rounded-full" />
          <div className="absolute top-1/2 right-1/4 h-64 w-96 bg-secondary/15 blur-[110px] rounded-full" />

          <div className="container relative z-10 max-w-6xl px-4 sm:px-6">
            <div className="flex flex-col items-center text-center fs-fade-up">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass border border-primary/30 text-xs font-mono">
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                <span className="text-primary">Privacy Pipeline for Fintech AI Training</span>
              </div>

              <h1 className="mt-5 sm:mt-6 text-3xl sm:text-5xl lg:text-[3.75rem] font-bold tracking-tight max-w-4xl leading-[1.1]">
                <span className="text-gradient-hero">Train AI on Real Fintech Data</span>
                <br />
                <span className="text-foreground">Without Exposing Sensitive Information</span>
              </h1>

              <p className="mt-4 sm:mt-6 text-base sm:text-lg max-w-2xl leading-relaxed px-2" style={{ color: "rgba(255,255,255,0.65)" }}>
                Automatically detect and mask PAN, Aadhaar, phone numbers, emails, credit cards, and IP addresses
                across CSV, JSON, DOCX, and log files — while preserving data utility for AI training.
              </p>

              <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 w-full sm:w-auto px-4 sm:px-0">
                <Button asChild size="lg" className="bg-gradient-primary text-primary-foreground btn-glow shadow-glow-primary">
                  <Link to="/process">
                    Start Processing <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="border-border/60 hover:border-primary/50 hover:bg-primary/5">
                  <Link to="/dashboard">View Dashboard</Link>
                </Button>
              </div>

              {/* trust pills — scrollable on small mobile */}
              <div className="mt-4 sm:mt-5 w-full max-w-sm sm:max-w-none px-4 sm:px-0">
                <div className="trust-pills-scroll">
                  {["PAN Numbers", "Aadhaar", "Phone & Email", "Credit Cards", "IP Addresses", "UPI Handles", "IFSC Codes"].map((label) => (
                    <span
                      key={label}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono border flex-shrink-0"
                      style={{
                        background: "rgba(0,255,148,.05)",
                        borderColor: "rgba(0,255,148,.2)",
                        color: "rgba(255,255,255,0.65)",
                      }}
                    >
                      <ShieldCheck className="h-3 w-3 text-primary" />
                      {label}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* hero preview */}
            <div className="mt-10 sm:mt-16 max-w-3xl mx-auto fs-fade-up fs-delay-2">
              <div className="rounded-xl sm:rounded-2xl overflow-hidden border scan-line-anim" style={{ background: "rgba(8,12,22,0.95)", borderColor: "rgba(0,255,148,0.2)" }}>
                <div
                  className="flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3 border-b"
                  style={{ background: "rgba(0,0,0,0.4)", borderColor: "rgba(255,255,255,0.07)" }}
                >
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="flex gap-1 sm:gap-1.5">
                      <span className="h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full" style={{ background: "rgba(239,68,68,0.7)" }} />
                      <span className="h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full" style={{ background: "rgba(234,179,8,0.7)" }} />
                      <span className="h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full" style={{ background: "rgba(0,255,148,0.7)" }} />
                    </div>
                    <span className="font-mono text-[10px] sm:text-xs truncate max-w-[120px] sm:max-w-none" style={{ color: "rgba(255,255,255,0.5)" }}>fintech_customers_q3.csv</span>
                  </div>
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <span className="hidden sm:inline font-mono text-[10px] px-2 py-0.5 rounded border" style={{ background: "rgba(59,130,246,.1)", borderColor: "rgba(59,130,246,.3)", color: "#93c5fd" }}>
                      syntactic+nlp
                    </span>
                    <span className="font-mono text-[10px] px-2 py-0.5 rounded border text-primary" style={{ background: "rgba(0,255,148,.1)", borderColor: "rgba(0,255,148,.3)" }}>
                      LIVE SCAN
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2">
                  <div className="p-3 sm:p-5 border-r" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
                    <p className="font-mono text-[9px] sm:text-[10px] uppercase tracking-widest mb-2 sm:mb-3 flex items-center gap-1 sm:gap-2" style={{ color: "rgba(255,255,255,0.35)" }}>
                      Raw
                      <span className="hidden sm:inline text-[9px] px-1.5 py-0.5 rounded" style={{ background: "rgba(239,68,68,.15)", color: "#fca5a5", border: "1px solid rgba(239,68,68,.3)" }}>SENSITIVE</span>
                    </p>
                    {heroRaw.map((r) => (
                      <div key={r.k} className="font-mono text-[10px] sm:text-xs mb-1.5 sm:mb-2">
                        <span className="block" style={{ color: "rgba(255,255,255,0.38)" }}>{r.k}:</span>
                        <span className="flex items-center gap-1 flex-wrap mt-0.5">
                          <span style={{ color: r.pii ? "#fca5a5" : "rgba(255,255,255,0.85)", wordBreak: "break-all" }}>{r.v}</span>
                          {r.pii && <span className="text-[8px] px-1 rounded flex-shrink-0" style={{ background: "rgba(239,68,68,.15)", color: "#fca5a5" }}>PII</span>}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="p-3 sm:p-5">
                    <p className="font-mono text-[9px] sm:text-[10px] uppercase tracking-widest mb-2 sm:mb-3 flex items-center gap-1 sm:gap-2" style={{ color: "rgba(255,255,255,0.35)" }}>
                      Masked
                      <span className="hidden sm:inline text-[9px] px-1.5 py-0.5 rounded" style={{ background: "rgba(0,255,148,.1)", color: "#00FF94", border: "1px solid rgba(0,255,148,.25)" }}>SAFE</span>
                    </p>
                    {heroMasked.map((r) => (
                      <div key={r.k} className="font-mono text-[10px] sm:text-xs mb-1.5 sm:mb-2">
                        <span className="block" style={{ color: "rgba(255,255,255,0.38)" }}>{r.k}:</span>
                        <span className="block mt-0.5">
                          {r.type ? <MaskChip type={r.type}>{r.v}</MaskChip> : <span style={{ color: "rgba(255,255,255,0.85)" }}>{r.v}</span>}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* stats bar — scrollable on mobile */}
                <div
                  className="px-3 sm:px-5 py-2.5 sm:py-3 border-t overflow-x-auto"
                  style={{ background: "rgba(0,0,0,0.3)", borderColor: "rgba(255,255,255,0.07)", scrollbarWidth: "none" }}
                >
                  <div className="flex items-center gap-3 sm:gap-4 whitespace-nowrap">
                    {[
                      { label: "Run #1777913894367", color: "#00FF94" },
                      { label: "0.49s",               color: "rgba(255,255,255,0.5)" },
                      { label: "TABULAR",              color: "#60a5fa" },
                      { label: "92.3% PII detected",  color: "#fbbf24" },
                      { label: "61.5% utility",       color: "rgba(255,255,255,0.5)" },
                    ].map((s) => (
                      <span key={s.label} className="font-mono text-[9px] sm:text-[10px]" style={{ color: s.color }}>{s.label}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ════ PROBLEM ════ */}
        <section id="problem" className="py-16 sm:py-24 border-t border-border/40">
          <div className="container max-w-6xl px-4 sm:px-6">
            <div className="fs-fade-up">
              <SectionTag>The Problem</SectionTag>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight mb-3 sm:mb-4">
                Fintech AI faces a{" "}
                <span style={{ color: "#f87171" }}>data dilemma</span>
              </h2>
              <p className="text-base sm:text-lg max-w-xl" style={{ color: "rgba(255,255,255,0.6)" }}>
                Building AI on financial data is powerful — but raw data carries risks that can't be ignored.
              </p>
            </div>

            <div className="mt-8 sm:mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
              {problems.map((p, i) => (
                <div
                  key={p.title}
                  className={`glass rounded-2xl p-5 sm:p-6 hover:border-destructive/30 transition-all fs-fade-up fs-delay-${i + 1}`}
                >
                  <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center text-xl mb-3 sm:mb-4" style={{ background: "rgba(239,68,68,.1)", border: "1px solid rgba(239,68,68,.2)" }}>
                    {p.icon}
                  </div>
                  <h3 className="font-semibold text-sm sm:text-base mb-2" style={{ color: "rgba(255,255,255,0.9)" }}>{p.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.55)" }}>{p.desc}</p>
                </div>
              ))}
            </div>

            <div className="mt-8 sm:mt-10 rounded-2xl p-5 sm:p-6 text-center fs-fade-up" style={{ border: "1px solid rgba(59,130,246,.25)", background: "rgba(59,130,246,.06)" }}>
              <p className="text-sm sm:text-base" style={{ color: "rgba(255,255,255,0.65)" }}>
                <strong style={{ color: "rgba(255,255,255,0.9)" }}>Using real data safely is still a challenge.</strong>{" "}
                FinShield AI is built to close this gap — for both structured tables and unstructured documents.
              </p>
            </div>
          </div>
        </section>

        {/* ════ SOLUTION / HOW IT WORKS ════ */}
        <section id="how" className="relative py-16 sm:py-24 border-y border-border/40 bg-card/30">
          <div className="absolute inset-0 cyber-grid opacity-25" />
          <div className="container relative z-10 max-w-6xl px-4 sm:px-6">
            <div className="fs-fade-up">
              <SectionTag>Pipeline</SectionTag>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight mb-3 sm:mb-4">A simple privacy pipeline</h2>
              <p className="text-base sm:text-lg max-w-xl" style={{ color: "rgba(255,255,255,0.6)" }}>
                Four steps from raw, sensitive data to a clean, model-ready dataset.
              </p>
            </div>

            {/* Pipeline steps — vertical on mobile, horizontal on desktop */}
            <div className="mt-8 sm:mt-12 fs-fade-up">
              {/* Mobile: vertical stepper */}
              <div className="flex flex-col gap-3 sm:hidden">
                {pipelineSteps.map((s, i) => {
                  const Icon = s.icon;
                  return (
                    <div key={s.label} className="flex items-center gap-4 glass rounded-xl p-4">
                      <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "linear-gradient(135deg,rgba(0,255,148,.15),rgba(59,130,246,.12))", border: "1px solid rgba(0,255,148,.25)" }}>
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-mono text-[10px] uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.38)" }}>Step {s.num}</p>
                        <p className="font-semibold text-sm" style={{ color: "rgba(255,255,255,0.9)" }}>{s.label}</p>
                        <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.5)" }}>{s.sub}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* Desktop: horizontal */}
              <div className="hidden sm:flex flex-wrap items-center justify-center gap-2">
                {pipelineSteps.map((s, i) => {
                  const Icon = s.icon;
                  return (
                    <div key={s.label} className="flex items-center gap-2">
                      <div className={`glass rounded-xl p-5 text-center min-w-[140px] transition hover:border-primary/40 ${i === 1 || i === 2 ? "border-primary/25 bg-primary/5" : ""}`}>
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3" style={{ background: "linear-gradient(135deg,rgba(0,255,148,.15),rgba(59,130,246,.12))", border: "1px solid rgba(0,255,148,.25)" }}>
                          <Icon className="h-5 w-5 text-primary" />
                        </div>
                        <p className="font-mono text-[10px] uppercase tracking-widest mb-1" style={{ color: "rgba(255,255,255,0.38)" }}>Step {s.num}</p>
                        <p className="font-semibold text-sm" style={{ color: "rgba(255,255,255,0.9)" }}>{s.label}</p>
                        <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.5)" }}>{s.sub}</p>
                      </div>
                      {i < pipelineSteps.length - 1 && <ArrowRight className="h-4 w-4 flex-shrink-0" style={{ color: "rgba(255,255,255,0.3)" }} />}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* masking legend explainer */}
            <div className="mt-8 sm:mt-10 glass rounded-2xl p-4 sm:p-6 fs-fade-up">
              <p className="text-sm font-semibold mb-3 sm:mb-4 flex items-center gap-2" style={{ color: "rgba(255,255,255,0.85)" }}>
                <Eye className="h-4 w-4 text-primary" />
                4 masking strategies — applied per field type
              </p>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
                {maskingLegend.map((l) => (
                  <div key={l.label} className="rounded-xl p-3 sm:p-4" style={{ background: l.bg, border: `1px solid ${l.border}` }}>
                    <p className="font-mono text-xs sm:text-sm font-bold mb-1" style={{ color: l.color }}>{l.label}</p>
                    <p className="text-xs mb-1" style={{ color: "rgba(255,255,255,0.6)" }}>{l.desc}</p>
                    <p className="text-[10px] font-mono hidden sm:block" style={{ color: "rgba(255,255,255,0.38)" }}>
                      {l.label === "[REDACTED]" && "PAN, Aadhaar, CVV, Salary"}
                      {l.label === "****1234" && "Card numbers, account no"}
                      {l.label === "SBINXXXX" && "Phone, IP, IFSC, expiry"}
                      {l.label === "User_4162" && "Names, user identifiers"}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 sm:mt-8 grid sm:grid-cols-2 gap-3 sm:gap-4">
              {solFeatures.map((f, i) => (
                <div key={f.title} className={`glass rounded-xl p-4 sm:p-5 flex items-start gap-3 sm:gap-4 hover:border-primary/35 transition fs-fade-up fs-delay-${i + 1}`}>
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center flex-shrink-0 text-base" style={{ background: "rgba(0,255,148,.07)", border: "1px solid rgba(0,255,148,.2)" }}>
                    {f.icon}
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm mb-1" style={{ color: "rgba(255,255,255,0.9)" }}>{f.title}</h4>
                    <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.55)" }}>{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ════ LIVE DEMO ════ */}
        <section id="demo" className="py-16 sm:py-24 border-b border-border/40">
          <div className="container max-w-6xl px-4 sm:px-6">
            <div className="fs-fade-up">
              <SectionTag>Interactive Demo</SectionTag>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight mb-3 sm:mb-4">See it in action</h2>
              <p className="text-base sm:text-lg max-w-xl" style={{ color: "rgba(255,255,255,0.6)" }}>
                Real masking output — switch between structured tabular data and unstructured document/log files.
              </p>
            </div>

            {/* mode toggle — stacked on mobile, side-by-side on sm+ */}
            <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row gap-2 sm:gap-3 fs-fade-up">
              {[
                { id: "tabular",   label: "📊 Structured (CSV / Table)",    sub: "Customer records, transactions, KYC" },
                { id: "document",  label: "📄 Unstructured (DOCX / LOG)",    sub: "Documents, system logs, free text" },
              ].map((m) => {
                const isActive = demoMode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setDemoMode(m.id)}
                    className="demo-mode-btn"
                    style={{
                      background: isActive ? "rgba(0,255,148,.08)" : "rgba(255,255,255,.03)",
                      border: `1px solid ${isActive ? "rgba(0,255,148,.35)" : "rgba(255,255,255,.1)"}`,
                    }}
                  >
                    <p className="text-sm font-semibold mb-0.5" style={{ color: isActive ? "#00FF94" : "rgba(255,255,255,0.85)" }}>{m.label}</p>
                    <p className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>{m.sub}</p>
                  </button>
                );
              })}
            </div>

            <div style={{ display: demoMode === "tabular" ? "block" : "none" }}>
              <TabularDemo />
            </div>
            <div style={{ display: demoMode === "document" ? "block" : "none" }}>
              <DocumentDemo />
            </div>
          </div>
        </section>

        {/* ════ DASHBOARD PREVIEW ════ */}
        <section id="dashboard-preview" className="relative py-16 sm:py-24 border-b border-border/40 bg-card/30">
          <div className="absolute inset-0 cyber-grid opacity-25" />
          <div className="container relative z-10 max-w-6xl px-4 sm:px-6">
            <div className="fs-fade-up">
              <SectionTag>Analytics Dashboard</SectionTag>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight mb-3 sm:mb-4">Full visibility into every run</h2>
              <p className="text-base sm:text-lg max-w-xl" style={{ color: "rgba(255,255,255,0.6)" }}>
                After every pipeline run, see field detection trends, PII breakdown by type, quality score, and re-identification risk.
              </p>
            </div>

            <div className="mt-8 sm:mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-4 fs-fade-up">
              {[
                {
                  icon: Activity, title: "Field Detection Trend",
                  desc: "Line chart of total fields vs PII fields across time segments T1–T12.",
                  badge: "PII trend over time", badgeColor: "#f59e0b",
                },
                {
                  icon: BarChart2, title: "Fields by Category",
                  desc: "Bar chart breaking down email, phone, Aadhaar, PAN, credit card, IP, and other fields.",
                  badge: "Per-type counts", badgeColor: "#60a5fa",
                },
                {
                  icon: Shield, title: "Risk Score",
                  desc: "Re-identification risk score (0–1) shown as Low · Medium · High after every run.",
                  badge: "Low · 0.15 sample", badgeColor: "#00FF94",
                },
                {
                  icon: CheckCircle2, title: "Quality Score",
                  desc: "Gauge showing combined PII masking completeness and data utility retained (0–100%).",
                  badge: "61.5% sample run", badgeColor: "#f59e0b",
                },
                {
                  icon: Database, title: "PII by Type",
                  desc: "Donut chart: Direct PII (names/email) · Sensitive PII (Aadhaar/PAN) · Quasi-IDs (DOB/city).",
                  badge: "3 PII classifications", badgeColor: "#d8b4fe",
                },
                {
                  icon: FileBarChart2, title: "Run History",
                  desc: "Every processing run stored with Run ID, timestamp, record count, and masking mode.",
                  badge: "Audit trail", badgeColor: "#00FF94",
                },
              ].map((card, i) => {
                const Icon = card.icon;
                return (
                  <div key={card.title} className={`glass rounded-2xl p-5 sm:p-6 hover:border-primary/35 transition-all relative overflow-hidden group fs-fade-up fs-delay-${(i % 3) + 1}`}>
                    <div className="absolute -top-10 -right-10 h-32 w-32 rounded-full bg-primary/5 blur-2xl group-hover:bg-primary/10 transition" />
                    <div className="inline-flex p-2 sm:p-2.5 rounded-xl bg-primary/10 border border-primary/30 text-primary mb-3 sm:mb-4 relative">
                      <Icon className="h-4 w-4" />
                    </div>
                    <h3 className="font-semibold text-sm mb-1.5 sm:mb-2 relative" style={{ color: "rgba(255,255,255,0.9)" }}>{card.title}</h3>
                    <p className="text-xs leading-relaxed relative mb-3" style={{ color: "rgba(255,255,255,0.55)" }}>{card.desc}</p>
                    <span
                      className="text-[10px] font-mono px-2 py-0.5 rounded"
                      style={{ background: `${card.badgeColor}20`, color: card.badgeColor, border: `1px solid ${card.badgeColor}40` }}
                    >
                      {card.badge}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 sm:mt-8 text-center fs-fade-up">
              <Button asChild size="lg" className="bg-gradient-primary text-primary-foreground btn-glow w-full sm:w-auto">
                <Link to="/dashboard">Open Dashboard <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
            </div>
          </div>
        </section>

        {/* ════ FEATURES GRID ════ */}
        <section id="features" className="py-16 sm:py-24 border-b border-border/40">
          <div className="container max-w-6xl px-4 sm:px-6">
            <div className="text-center max-w-2xl mx-auto fs-fade-up">
              <SectionTag>Capabilities</SectionTag>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight mb-3 sm:mb-4">Everything in the pipeline</h2>
              <p style={{ color: "rgba(255,255,255,0.6)" }}>
                Built specifically for fintech data patterns, not just generic PII.
              </p>
            </div>

            <div className="mt-8 sm:mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
              {features.map((f, i) => (
                <div key={f.title} className={`glass rounded-2xl p-5 sm:p-6 hover:border-primary/35 transition-all relative overflow-hidden group fs-fade-up fs-delay-${(i % 3) + 1}`}>
                  <div className="absolute -top-10 -right-10 h-32 w-32 rounded-full bg-primary/5 blur-2xl group-hover:bg-primary/10 transition" />
                  <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center text-xl mb-3 sm:mb-4 relative" style={{ background: "rgba(0,255,148,.07)", border: "1px solid rgba(0,255,148,.2)" }}>
                    {f.icon}
                  </div>
                  <h3 className="font-semibold text-sm sm:text-base mb-2 relative" style={{ color: "rgba(255,255,255,0.9)" }}>{f.title}</h3>
                  <p className="text-sm leading-relaxed relative" style={{ color: "rgba(255,255,255,0.55)" }}>{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ════ METRICS ════ */}
        <section
          id="metrics"
          className="py-16 sm:py-24 border-b border-border/40"
          style={{ background: "linear-gradient(180deg,transparent,rgba(0,255,148,.025),transparent)" }}
        >
          <div className="container max-w-6xl px-4 sm:px-6">
            <div className="text-center max-w-2xl mx-auto fs-fade-up">
              <SectionTag>Masking Results</SectionTag>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight mb-3 sm:mb-4">What the pipeline delivers</h2>
              <p style={{ color: "rgba(255,255,255,0.6)" }}>
                Measured on a real sample fintech dataset with mixed structured and unstructured fields.
              </p>
            </div>

            <div className="mt-8 sm:mt-12 grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 fs-fade-up">
              {metrics.map((m) => (
                <MetricCard key={m.id} target={m.target} suffix={m.suffix} label={m.label} />
              ))}
            </div>

            <div className="mt-6 sm:mt-8 glass rounded-2xl p-5 sm:p-6 lg:p-8 fs-fade-up">
              {progressBars.map((p) => (
                <ProgressRow key={p.label} label={p.label} target={p.target} color={p.color} />
              ))}
            </div>
          </div>
        </section>

        {/* ════ COMPARISON ════ */}
        <section id="compare" className="py-16 sm:py-24 border-b border-border/40">
          <div className="container max-w-6xl px-4 sm:px-6">
            <div className="fs-fade-up">
              <SectionTag>Why FinShield</SectionTag>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight mb-3 sm:mb-4">Purpose-built for fintech privacy</h2>
              <p className="text-base sm:text-lg max-w-xl" style={{ color: "rgba(255,255,255,0.6)" }}>
                Most tools do basic masking. FinShield AI is designed around the realities of Indian financial data.
              </p>
            </div>

            <div className="mt-8 sm:mt-12 grid md:grid-cols-2 gap-4 sm:gap-5">
              <div className="glass rounded-2xl p-5 sm:p-7 fs-fade-up fs-delay-1">
                <h3 className="font-bold text-base sm:text-lg mb-4 sm:mb-6 flex items-center gap-2 sm:gap-3" style={{ color: "rgba(255,255,255,0.85)" }}>
                  Generic tools
                  <span className="text-xs px-2 py-0.5 rounded font-mono" style={{ background: "rgba(100,116,139,.18)", color: "#94a3b8" }}>Others</span>
                </h3>
                {othersItems.map((item) => (
                  <div key={item} className="flex items-start gap-2 sm:gap-3 py-2 sm:py-2.5 border-b last:border-0" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
                    <XCircle className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: "rgba(239,68,68,0.7)" }} />
                    <span className="text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>{item}</span>
                  </div>
                ))}
              </div>

              <div className="glass rounded-2xl p-5 sm:p-7 fs-fade-up fs-delay-2" style={{ borderColor: "rgba(0,255,148,.25)", background: "linear-gradient(135deg,rgba(0,255,148,.07),transparent)" }}>
                <h3 className="font-bold text-base sm:text-lg mb-4 sm:mb-6 flex items-center gap-2 sm:gap-3" style={{ color: "rgba(255,255,255,0.85)" }}>
                  FinShield AI
                  <span className="text-xs px-2 py-0.5 rounded font-mono" style={{ background: "rgba(0,255,148,.12)", color: "#00FF94" }}>Our approach</span>
                </h3>
                {oursItems.map((item) => (
                  <div key={item.strong} className="flex items-start gap-2 sm:gap-3 py-2 sm:py-2.5 border-b last:border-0" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
                    <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    <span className="text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>
                      <strong style={{ color: "rgba(255,255,255,0.9)" }}>{item.strong}</strong>
                      {item.rest}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ════ TRUST ════ */}
        <section id="trust" className="py-16 sm:py-24 border-b border-border/40">
          <div className="container max-w-6xl px-4 sm:px-6">
            <div className="text-center max-w-2xl mx-auto fs-fade-up">
              <SectionTag>Trust</SectionTag>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight mb-3 sm:mb-4">
                Built for teams that can't get privacy wrong
              </h2>
            </div>
            <div className="mt-8 sm:mt-12 grid sm:grid-cols-3 gap-4 sm:gap-5">
              {trustItems.map((t, i) => {
                const Icon = t.icon;
                return (
                  <div key={t.title} className={`glass rounded-2xl p-5 sm:p-6 fs-fade-up fs-delay-${i + 1}`}>
                    <div className="inline-flex p-2.5 sm:p-3 rounded-xl bg-primary/10 border border-primary/30 text-primary mb-3 sm:mb-4">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="font-semibold mb-2" style={{ color: "rgba(255,255,255,0.9)" }}>{t.title}</h3>
                    <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.55)" }}>{t.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ════ FINAL CTA ════ */}
        <section className="py-16 sm:py-24">
          <div className="container max-w-6xl px-4 sm:px-6">
            <div className="glass-strong rounded-2xl sm:rounded-3xl p-7 sm:p-10 lg:p-16 text-center relative overflow-hidden fs-fade-up">
              <div className="absolute inset-0 bg-gradient-glow opacity-50" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] sm:w-[500px] h-[200px] sm:h-[300px] bg-primary/10 blur-[100px] rounded-full" />
              <div className="relative">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass border border-primary/30 text-xs font-mono mb-4 sm:mb-6">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                  <span className="text-primary">Ready to try it?</span>
                </div>
                <h2 className="text-2xl sm:text-3xl lg:text-5xl font-bold tracking-tight mb-3 sm:mb-4">
                  Start masking your data<br />for safer AI experiments
                </h2>
                <p className="text-base sm:text-lg max-w-lg mx-auto mb-3 sm:mb-4" style={{ color: "rgba(255,255,255,0.6)" }}>
                  Upload a CSV, JSON, DOCX, or log file. See what gets detected. Download a clean masked version with a full field-level report.
                </p>
                <p className="text-xs sm:text-sm mb-6 sm:mb-8 font-mono" style={{ color: "rgba(255,255,255,0.35)" }}>No account required · Processed in-memory · Never stored</p>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
                  <Button asChild size="lg" className="bg-gradient-primary text-primary-foreground btn-glow shadow-glow-primary">
                    <Link to="/process">
                      Try FinShield <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                  <Button asChild size="lg" variant="outline" className="border-border/60 hover:border-primary/50 hover:bg-primary/5">
                    <Link to="/dashboard">View Dashboard</Link>
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