import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Upload, X, Loader2, ChevronDown, Zap, Lock,
  LayoutDashboard, ArrowRight, FileType2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useProcessDatasetMutation } from "@/redux/api/api";
import toast from "react-hot-toast";
import { SUPPORTED_EXTENSIONS, MASKING_INFO } from "./utils/constants";
import { getFileExt, isValidFile, getFileIcon, getFileColor } from "./utils/file-utils";
import { FileTypeBadge } from "./FileTypeBadge";
import type { MaskingLevel, PipelineData } from "../../types/process-page";

interface Props {
  onResult: (d: PipelineData, elapsed: number) => void;
  onProcessStart: () => void;
}

export function UploadSection({ onResult, onProcessStart }: Props) {
  const navigate = useNavigate();
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [maskingLevel, setMaskingLevel] = useState<MaskingLevel>("medium");
  const [levelOpen, setLevelOpen] = useState(false);
  const [processDataset, { isLoading }] = useProcessDatasetMutation();

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (!f) return;
    if (!isValidFile(f)) { toast.error("Supported: CSV, JSON, XLSX, LOG, TXT, DOCX"); return; }
    setFile(f);
  }, []);

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!isValidFile(f)) { toast.error("Supported: CSV, JSON, XLSX, LOG, TXT, DOCX"); return; }
    setFile(f);
  };

  const handleProcess = async () => {
    if (!file) return;
    onProcessStart();
    const t0 = performance.now();
    try {
      const res = await processDataset({ file, level: maskingLevel }).unwrap() as { data: PipelineData };
      const elapsed = (performance.now() - t0) / 1000;
      onResult(res.data, elapsed);
    } catch (err: unknown) {
      const msg = err && typeof err === "object" && "data" in err
        ? (err as { data?: { message?: string } }).data?.message
        : "Processing failed";
      toast.error(msg ?? "Processing failed");
    }
  };

  const fileExt = file ? getFileExt(file) : null;
  const fileColor = file ? getFileColor(file.name) : "#6b7280";
  const fileIcon = file ? getFileIcon(file.name) : "📁";
  const isUnstructuredType = fileExt === ".txt" || fileExt === ".docx" || fileExt === ".log";

  return (
    <section className="min-h-[100dvh] flex flex-col items-center justify-center px-4 py-12 sm:py-20 relative">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] sm:w-[700px] h-[300px] sm:h-[700px] rounded-full bg-primary/8 blur-[100px] sm:blur-[140px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[200px] sm:w-[400px] h-[200px] sm:h-[400px] rounded-full bg-secondary/6 blur-[80px] sm:blur-[120px]" />
      </div>

      <div className="relative z-10 w-full max-w-2xl flex flex-col items-center text-center">
        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 mb-6 sm:mb-8 w-full">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary text-[10px] sm:text-xs font-mono">
            <Lock className="h-3 w-3 shrink-0" />
            <span>Privacy-first · In-memory · Zero storage</span>
          </div>
          <button
            onClick={() => navigate("/dashboard")}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[10px] sm:text-xs font-mono font-medium",
              "border-border/50 bg-muted/20 text-muted-foreground",
              "hover:border-primary/40 hover:bg-primary/10 hover:text-primary",
              "transition-all duration-200 group"
            )}
          >
            <LayoutDashboard className="h-3 w-3 shrink-0 transition-transform group-hover:scale-110" />
            <span>Dashboard</span>
            <ArrowRight className="h-3 w-3 shrink-0 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200" />
          </button>
        </div>

        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-2 sm:mb-3 px-2">
          Data Privacy{" "}
          <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">Engine</span>
        </h1>
        <p className="text-muted-foreground text-sm sm:text-base lg:text-lg mb-8 sm:mb-10 px-4 leading-relaxed max-w-lg">
          Upload your dataset and instantly detect &amp; mask sensitive information with AI precision.
        </p>

        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={cn(
            "w-full rounded-2xl border-2 border-dashed transition-all duration-300 glass",
            dragOver ? "border-primary bg-primary/5 shadow-glow-primary scale-[1.01]" : "border-border/60 hover:border-primary/50"
          )}
        >
          {!file ? (
            <div className="flex flex-col items-center py-10 sm:py-16 px-4 sm:px-6">
              <div className="relative mb-4 sm:mb-6">
                <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full" />
                <div className="relative p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 border border-primary/30">
                  <Upload className="h-7 w-7 sm:h-9 sm:w-9 text-primary" />
                </div>
              </div>
              <h3 className="text-base sm:text-xl font-semibold mb-1">Drop your dataset here</h3>
              <p className="text-xs sm:text-sm text-muted-foreground mb-1">or click to browse your files</p>
              <div className="flex flex-wrap justify-center gap-2 mt-3 mb-6">
                {SUPPORTED_EXTENSIONS.map(ext => <FileTypeBadge key={ext} ext={ext} />)}
              </div>
              <label>
                <input type="file" className="hidden" onChange={onPick} accept=".csv,.json,.xlsx,.txt,.docx,.log" />
                <span className="inline-flex items-center justify-center gap-2 rounded-xl text-sm font-semibold px-5 sm:px-7 py-2.5 sm:py-3 bg-gradient-primary text-primary-foreground btn-glow cursor-pointer shadow-glow-primary transition-transform hover:scale-105 active:scale-95">
                  <Upload className="h-4 w-4" /> Browse files
                </span>
              </label>
            </div>
          ) : (
            <div className="p-4 sm:p-6 flex flex-col gap-3 sm:gap-4">
              <div
                className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl border"
                style={{ background: `${fileColor}0d`, borderColor: `${fileColor}30` }}
              >
                <div
                  className="p-2 sm:p-3 rounded-xl border shrink-0 text-2xl flex items-center justify-center w-12 h-12"
                  style={{ background: `${fileColor}1a`, borderColor: `${fileColor}40` }}
                >
                  {fileIcon}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="font-semibold truncate text-sm sm:text-base">{file.name}</p>
                  <div className="flex items-center flex-wrap gap-2 mt-1">
                    <span className="text-[10px] sm:text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</span>
                    {fileExt && <FileTypeBadge ext={fileExt} />}
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md border font-mono" style={{ color: "#10b981", borderColor: "#10b98130", background: "#10b98112" }}>
                      Ready to process
                    </span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setFile(null)}
                  disabled={isLoading}
                  className="shrink-0 h-8 w-8 sm:h-10 sm:w-10 hover:bg-destructive/10 hover:text-destructive transition-colors"
                >
                  <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </Button>
              </div>

              {isUnstructuredType && (
                <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl border border-amber-400/20 bg-amber-400/5 text-left">
                  <FileType2 className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-[10px] sm:text-xs text-amber-300/80 leading-relaxed">
                    <span className="font-semibold text-amber-400">
                      {fileExt === ".docx" ? "Word document" : "Plain text / log file"}
                    </span>{" "}
                    — processed line-by-line using the Presidio + regex pipeline.
                    PII detected inline; output shown per line with rich masking highlights in Document view.
                  </p>
                </div>
              )}

              <div className="flex flex-col gap-2 sm:flex-row sm:gap-3 sm:items-center">
                <div className="relative flex-1">
                  <button
                    type="button"
                    onClick={() => setLevelOpen(v => !v)}
                    disabled={isLoading}
                    className="w-full flex items-center justify-between gap-2 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl border border-border/60 bg-background/60 text-sm font-medium hover:border-primary/50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className={cn("w-2 h-2 rounded-full shrink-0", {
                        "bg-emerald-400": maskingLevel === "low",
                        "bg-amber-400":   maskingLevel === "medium",
                        "bg-red-400":     maskingLevel === "high",
                      })} />
                      <span className="capitalize">Masking: {maskingLevel}</span>
                    </div>
                    <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", levelOpen && "rotate-180")} />
                  </button>
                  {levelOpen && (
                    <div className="absolute left-0 right-0 mt-1 z-30 rounded-xl border border-border/60 bg-background/95 backdrop-blur shadow-xl overflow-hidden">
                      {(["low", "medium", "high"] as MaskingLevel[]).map(lvl => (
                        <button
                          key={lvl}
                          type="button"
                          onClick={() => { setMaskingLevel(lvl); setLevelOpen(false); }}
                          className={cn("w-full text-left px-4 py-3 text-sm hover:bg-muted/50 transition-colors flex items-center gap-3", maskingLevel === lvl && "bg-primary/10")}
                        >
                          <span className={cn("w-2 h-2 rounded-full shrink-0", { "bg-emerald-400": lvl === "low", "bg-amber-400": lvl === "medium", "bg-red-400": lvl === "high" })} />
                          <div>
                            <p className="font-medium capitalize">{MASKING_INFO[lvl].label}</p>
                            <p className="text-xs text-muted-foreground">{MASKING_INFO[lvl].desc}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <Button
                  onClick={handleProcess}
                  disabled={isLoading}
                  className="bg-gradient-primary text-primary-foreground btn-glow shadow-glow-primary px-6 sm:px-8 py-2.5 sm:py-3 h-auto font-semibold text-sm rounded-xl transition-transform hover:scale-105 active:scale-95 shrink-0 w-full sm:w-auto"
                >
                  {isLoading
                    ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Analyzing…</>
                    : <><Zap className="h-4 w-4 mr-2" />Process Data</>
                  }
                </Button>
              </div>
            </div>
          )}
        </div>

        {isLoading && (
          <div className="mt-5 sm:mt-7 flex flex-col items-center gap-3 animate-fade-in w-full px-2">
            <div className="flex flex-wrap justify-center gap-x-3 gap-y-2">
              {["ingestion", "detection", "masking", "reporting"].map((step, i) => (
                <div key={step} className="flex items-center gap-1.5">
                  <div className="h-1.5 w-10 sm:w-16 rounded-full bg-primary/20 overflow-hidden">
                    <div className="h-full bg-primary rounded-full animate-pulse" style={{ animationDelay: `${i * 0.2}s` }} />
                  </div>
                  <span className="text-[9px] sm:text-[10px] font-mono text-muted-foreground capitalize">{step}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground font-mono animate-pulse text-center">Running PII detection pipeline…</p>
          </div>
        )}

        {!file && !isLoading && (
          <div className="mt-8 grid grid-cols-3 gap-3 w-full text-center">
            {[{ icon: "🛡️", label: "Zero storage" }, { icon: "⚡", label: "Sub-second" }, { icon: "🔒", label: "In-memory" }].map(({ icon, label }) => (
              <div key={label} className="flex flex-col items-center gap-1 py-3 px-2 rounded-xl border border-border/30 bg-muted/10">
                <span className="text-lg">{icon}</span>
                <span className="text-[10px] font-mono text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}