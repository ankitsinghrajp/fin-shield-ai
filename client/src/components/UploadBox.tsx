import { useCallback, useState } from "react";
import { Upload, FileText, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface UploadBoxProps {
  compact?: boolean;
}

export const UploadBox = ({ compact = false }: UploadBoxProps) => {
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) setFile(f);
  }, []);

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  };

  const startProcessing = () => {
    setSubmitting(true);
    setTimeout(() => navigate("/processing"), 400);
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
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
            CSV, JSON, JSONL, Parquet — up to 1 GB
          </p>
          <label className="mt-4">
            <input type="file" className="hidden" onChange={onPick} accept=".csv,.json,.jsonl,.parquet,.txt" />
            <span className="inline-flex items-center justify-center rounded-md text-sm font-medium px-4 py-2 bg-gradient-primary text-primary-foreground btn-glow cursor-pointer shadow-glow-primary">
              Browse files
            </span>
          </label>
          <p className="mt-3 text-[11px] font-mono text-muted-foreground">
            🔒 Processed in-memory · never stored
          </p>
        </div>
      ) : (
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
          <Button variant="ghost" size="icon" onClick={() => setFile(null)} disabled={submitting}>
            <X className="h-4 w-4" />
          </Button>
          <Button
            onClick={startProcessing}
            disabled={submitting}
            className="bg-gradient-primary text-primary-foreground btn-glow shadow-glow-primary"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Start processing"}
          </Button>
        </div>
      )}
    </div>
  );
};
