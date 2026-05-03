import { useMemo } from "react";
import { Shield, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { MaskedInline } from "./MaskedInline";
import { parseDocumentLines } from "./utils/tokenizer";

interface Props {
  result: Record<string, unknown>[];
  onCopy: (text: string, idx: number) => void;
}

export function DocumentView({ result, onCopy }: Props) {
  const lines = useMemo(() => parseDocumentLines(result), [result]);

  return (
    <div className="divide-y divide-white/[0.04]">
      {lines.map((line, i) => {
        if (line.isSectionHeader) {
          return (
            <div key={i} className="px-5 py-3 bg-gradient-to-r from-white/[0.04] to-transparent flex items-center gap-3 group">
              <div className="h-px flex-1 bg-gradient-to-r from-primary/30 to-transparent" />
              <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-primary/80 shrink-0">
                {line.rawText}
              </span>
              <div className="h-px flex-1 bg-gradient-to-l from-primary/30 to-transparent" />
            </div>
          );
        }

        if (line.isLogEntry) {
          return (
            <div key={i} className="px-5 py-2.5 flex items-start gap-3 hover:bg-blue-500/[0.04] transition-colors group">
              <div className="shrink-0 flex items-center gap-1.5 mt-0.5">
                <span className="text-[9px] font-mono text-gray-700 tabular-nums w-5 text-right">{line.lineNum}</span>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-blue-500/10 text-blue-400 border border-blue-400/20 shrink-0">LOG</span>
              </div>
              <div className="flex-1 text-[11px] font-mono text-gray-400 break-all leading-relaxed">
                <MaskedInline content={line.rawText} />
              </div>
              <button
                onClick={() => onCopy(line.rawText, i)}
                className="shrink-0 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-white/10 text-gray-600 hover:text-gray-300 transition-all"
              >
                <Copy className="h-3 w-3" />
              </button>
            </div>
          );
        }

        if (line.isKeyValue && line.key && line.value) {
          const hasMasked = /\[REDACTED\]|\*{2,}|XXXX|User_/.test(line.value);
          return (
            <div
              key={i}
              className={cn(
                "px-5 py-2 flex items-start gap-2 transition-colors group",
                hasMasked ? "hover:bg-amber-400/[0.03]" : "hover:bg-white/[0.02]"
              )}
            >
              <span className="text-[9px] font-mono text-gray-700 tabular-nums mt-1 w-5 text-right shrink-0">{line.lineNum}</span>
              <div className="flex-1 grid grid-cols-[minmax(120px,160px)_1fr] gap-x-3 items-start min-w-0">
                <span className="text-[11px] font-medium text-gray-500 truncate pt-0.5">{line.key}:</span>
                <span className="text-[11px] font-mono break-all leading-relaxed">
                  <MaskedInline content={line.value} />
                </span>
              </div>
              {hasMasked && (
                <Shield className="h-3 w-3 text-amber-400/50 shrink-0 mt-0.5" />
              )}
              <button
                onClick={() => onCopy(`${line.key}: ${line.value}`, i)}
                className="shrink-0 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-white/10 text-gray-600 hover:text-gray-300 transition-all"
              >
                <Copy className="h-3 w-3" />
              </button>
            </div>
          );
        }

        // Generic line
        return (
          <div key={i} className="px-5 py-2 flex items-start gap-3 hover:bg-white/[0.02] transition-colors group">
            <span className="text-[9px] font-mono text-gray-700 tabular-nums mt-0.5 w-5 text-right shrink-0">{line.lineNum}</span>
            <div className="flex-1 text-[11px] text-gray-400 break-all leading-relaxed">
              <MaskedInline content={line.rawText} />
            </div>
            <button
              onClick={() => onCopy(line.rawText, i)}
              className="shrink-0 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-white/10 text-gray-600 hover:text-gray-300 transition-all"
            >
              <Copy className="h-3 w-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}