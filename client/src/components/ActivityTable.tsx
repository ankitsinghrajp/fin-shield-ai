import { Link } from "react-router-dom";
import { ArrowUpRight, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { ProcessedFile } from "@/lib/mockData";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  files: ProcessedFile[];
  showAll?: boolean;
}

const statusConfig = {
  completed: { label: "Completed", icon: CheckCircle2, className: "text-primary bg-primary/10 border-primary/30" },
  processing: { label: "Processing", icon: Loader2, className: "text-secondary bg-secondary/10 border-secondary/30 animate-pulse" },
  failed: { label: "Failed", icon: XCircle, className: "text-destructive bg-destructive/10 border-destructive/30" },
};

export const ActivityTable = ({ files, showAll = false }: Props) => {
  return (
    <div className="glass rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/50 text-left text-xs font-mono uppercase tracking-wider text-muted-foreground">
              <th className="px-5 py-3 font-medium">File</th>
              <th className="px-5 py-3 font-medium">Records</th>
              <th className="px-5 py-3 font-medium">PII %</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Date</th>
              <th className="px-5 py-3 font-medium text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {files.map((f) => {
              const status = statusConfig[f.status];
              const Icon = status.icon;
              return (
                <tr key={f.id} className="border-b border-border/30 last:border-0 hover:bg-muted/30 transition">
                  <td className="px-5 py-4">
                    <p className="font-medium">{f.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{f.size} · {f.id}</p>
                  </td>
                  <td className="px-5 py-4 font-mono">{f.records.toLocaleString()}</td>
                  <td className="px-5 py-4">
                    {f.status === "completed" ? (
                      <span className="font-mono text-secondary">{f.piiPercent}%</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <span className={cn("inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium border", status.className)}>
                      <Icon className={cn("h-3 w-3", f.status === "processing" && "animate-spin")} />
                      {status.label}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-muted-foreground font-mono text-xs">{f.date}</td>
                  <td className="px-5 py-4 text-right">
                    {f.status === "completed" ? (
                      <Button asChild size="sm" variant="ghost" className="hover:text-primary">
                        <Link to={`/result/${f.id}`}>
                          View result <ArrowUpRight className="ml-1 h-3 w-3" />
                        </Link>
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!showAll && (
        <div className="p-3 border-t border-border/40 text-center">
          <Button asChild variant="ghost" size="sm" className="text-muted-foreground hover:text-primary">
            <Link to="/history">View full history →</Link>
          </Button>
        </div>
      )}
    </div>
  );
};
