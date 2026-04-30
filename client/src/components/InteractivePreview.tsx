import React, { useState } from 'react'

const InteractivePreview = () => {
      const [previewMode, setPreviewMode] = useState<"raw" | "masked">("raw");

      function GlowOrbs() {
        return (
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
            <div className="absolute top-[-10%] left-[10%] w-[500px] h-[500px] rounded-full bg-primary/15 blur-[130px]" />
            <div className="absolute top-[20%] right-[-5%] w-[400px] h-[400px] rounded-full bg-secondary/12 blur-[120px]" />
            <div className="absolute bottom-[10%] left-[30%] w-[350px] h-[350px] rounded-full bg-violet-500/8 blur-[100px]" />
          </div>
        );
      }
      
  return (
   <section className="relative py-16 sm:py-24 px-4">
        <GlowOrbs />

        <div className="relative z-10 max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">

            {/* Left copy */}
            <div className="flex flex-col gap-4 sm:gap-5">
              <SectionLabel>Live Preview</SectionLabel>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight">
                See masking in action — <span className="text-primary">before you commit</span>
              </h2>
              <p className="text-sm sm:text-base text-gray-500 leading-relaxed">
                Switch between Low, Medium, and High masking levels. Watch how PrivacyGuard balances privacy with data utility in real time — no signup, no upload required.
              </p>

              <ul className="space-y-2.5">
                {[
                  { label: "Low masking", desc: "Partial masks, useful for internal analytics", color: "text-emerald-400" },
                  { label: "Medium masking", desc: "Balanced — great for LLM training datasets", color: "text-amber-400" },
                  { label: "High masking",  desc: "Full redaction, regulatory & compliance use", color: "text-red-400" },
                ].map(({ label, desc, color }) => (
                  <li key={label} className="flex items-start gap-2.5 text-sm">
                    <CheckCircle2 className={cn("h-4 w-4 shrink-0 mt-0.5", color)} />
                    <span>
                      <span className={cn("font-semibold", color)}>{label}</span>
                      <span className="text-gray-500"> — {desc}</span>
                    </span>
                  </li>
                ))}
              </ul>

              <Link
                to="/process"
                className="self-start inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-primary to-emerald-400 text-black text-sm font-semibold hover:opacity-90 transition-all hover:scale-105 shadow-[0_0_20px_rgba(16,185,129,0.3)]"
              >
                Upload your own data <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            {/* Right — interactive card */}
            <div className="rounded-2xl border border-white/8 overflow-hidden" style={{ background: "#0d1117" }}>
              <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-white/6">
                <div className="flex items-center gap-1.5 text-[11px] font-mono text-gray-600">
                  <span className="h-2 w-2 rounded-full bg-red-500/60" />
                  <span className="h-2 w-2 rounded-full bg-amber-500/60" />
                  <span className="h-2 w-2 rounded-full bg-emerald-500/60" />
                  <span className="ml-2">live_demo.json</span>
                </div>
                <span className="text-[9px] font-mono px-2 py-0.5 rounded-full border border-primary/30 bg-primary/8 text-primary">LIVE</span>
              </div>

              {/* Mode toggle */}
              <div className="flex border-b border-white/6">
                {(["raw", "masked"] as const).map(m => (
                  <button
                    key={m}
                    onClick={() => setPreviewMode(m)}
                    className={cn(
                      "flex-1 py-2.5 text-xs font-mono capitalize transition-colors",
                      previewMode === m
                        ? "bg-primary/10 text-primary border-b border-primary"
                        : "text-gray-600 hover:text-gray-400"
                    )}
                  >
                    {m === "raw" ? "🔍 Before" : "🔒 After"}
                  </button>
                ))}
              </div>

              <div className="p-4 sm:p-5 min-h-[130px]">
                <PIIHighlighter tokens={sampleTokens} mode={previewMode} strategy={previewStrategy} />
              </div>

              <div className="border-t border-white/6 px-4 sm:px-5 py-3 flex items-center justify-between gap-3">
                <span className="text-[10px] text-gray-600 font-mono">Masking level:</span>
                <div className="flex gap-1">
                  {(["low", "medium", "high"] as const).map(lvl => (
                    <button
                      key={lvl}
                      onClick={() => setPreviewStrategy(lvl)}
                      className={cn(
                        "text-[10px] px-2.5 py-1 rounded-lg font-mono capitalize border transition-all",
                        previewStrategy === lvl
                          ? lvl === "low"
                            ? "bg-emerald-400/15 border-emerald-400/40 text-emerald-400"
                            : lvl === "medium"
                            ? "bg-amber-400/15 border-amber-400/40 text-amber-400"
                            : "bg-red-400/15 border-red-400/40 text-red-400"
                          : "border-white/8 text-gray-600 hover:border-white/15 hover:text-gray-400"
                      )}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
  )
}

export default InteractivePreview