import { useCallback, useState } from "react";
import { Upload, FileText, X, Loader2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useProcessDatasetMutation } from "@/redux/api/api";
import toast from "react-hot-toast";

const ACCEPTED_TYPES: Record<string, string> = {
  "text/csv": "CSV",
  "application/json": "JSON",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "XLSX",
};

const ACCEPTED_EXTENSIONS = [".csv", ".json", ".xlsx"];

const MASKING_LEVELS = ["low", "medium", "high"] as const;
type MaskingLevel = (typeof MASKING_LEVELS)[number];

const maskingInfo: Record<MaskingLevel, string> = {
  low: "Minimal masking — most fields retained",
  medium: "Balanced — partial masking on sensitive fields",
  high: "Maximum privacy — heavy redaction",
};

interface UploadBoxProps {
  compact?: boolean;
  onResult?: (data: unknown) => void;
}

function isValidFile(f: File): boolean {
  if (ACCEPTED_TYPES[f.type]) return true;
  const ext = "." + f.name.split(".").pop()?.toLowerCase();
  return ACCEPTED_EXTENSIONS.includes(ext);
}

export const UploadBox = ({ compact = false, onResult }: UploadBoxProps) => {
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [maskingLevel, setMaskingLevel] = useState<MaskingLevel>("medium");
  const [levelOpen, setLevelOpen] = useState(false);
  const navigate = useNavigate();
  const [processDataset, { isLoading }] = useProcessDatasetMutation();

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (!f) return;
    if (!isValidFile(f)) {
      toast.error("Only CSV, JSON, and XLSX files are accepted.");
      return;
    }
    setFile(f);
  }, []);

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!isValidFile(f)) {
      toast.error("Only CSV, JSON, and XLSX files are accepted.");
      return;
    }
    setFile(f);
  };

  const startProcessing = async () => {
    if (!file) return;
    try {
      const result = await processDataset({ file, level: maskingLevel }).unwrap();
      if (onResult) {
        onResult(result);
      } else {
        navigate("/result", { state: { result } });
      }
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "data" in err
          ? (err as { data?: { message?: string } }).data?.message
          : "Processing failed. Please try again.";
      toast.error(message ?? "Processing failed. Please try again.");
    }
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
      className={cn(
        "relative rounded-2xl border-2 border-dashed transition-all glass",
        dragOver
          ? "border-primary bg-primary/5 shadow-glow-primary"
          : "border-border/60 hover:border-primary/50",
        compact ? "p-6" : "p-10"
      )}
    >
      {!file ? (
        <div className="flex flex-col items-center text-center">
          <div className="relative mb-4">
            <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full" />
            <div className="relative p-4 rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 border border-primary/30">
              <Upload className="h-7 w-7 text-primary" />
            </div>
          </div>
          <h3 className={cn("font-semibold", compact ? "text-base" : "text-lg")}>
            Drop your dataset here
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            CSV, JSON, XLSX — up to 1 GB
          </p>
          <label className="mt-4">
            <input
              type="file"
              className="hidden"
              onChange={onPick}
              accept=".csv,.json,.xlsx"
            />
            <span className="inline-flex items-center justify-center rounded-md text-sm font-medium px-4 py-2 bg-gradient-primary text-primary-foreground btn-glow cursor-pointer shadow-glow-primary">
              Browse files
            </span>
          </label>
          <p className="mt-3 text-[11px] font-mono text-muted-foreground">
            🔒 Processed in-memory · never stored
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {/* File row */}
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-primary/10 border border-primary/30">
              <FileText className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{file.name}</p>
              <p className="text-xs text-muted-foreground">
                {(file.size / 1024 / 1024).toFixed(2)} MB · ready to process
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setFile(null)}
              disabled={isLoading}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Masking level + submit row */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Masking level dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setLevelOpen((v) => !v)}
                disabled={isLoading}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border/60 bg-background/60 text-sm font-medium hover:border-primary/50 transition-colors"
              >
                <span className="capitalize">{maskingLevel}</span>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
              {levelOpen && (
                <div className="absolute left-0 mt-1 z-20 w-64 rounded-xl border border-border/60 bg-background/95 backdrop-blur shadow-lg overflow-hidden">
                  {MASKING_LEVELS.map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => {
                        setMaskingLevel(lvl);
                        setLevelOpen(false);
                      }}
                      className={cn(
                        "w-full text-left px-4 py-3 text-sm hover:bg-muted/50 transition-colors",
                        maskingLevel === lvl && "bg-primary/10 text-primary"
                      )}
                    >
                      <p className="font-medium capitalize">{lvl}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{maskingInfo[lvl]}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <Button
              onClick={startProcessing}
              disabled={isLoading}
              className="bg-gradient-primary text-primary-foreground btn-glow shadow-glow-primary ml-auto"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Processing…
                </>
              ) : (
                "Start processing"
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};