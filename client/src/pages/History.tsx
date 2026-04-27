import { useMemo, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { ActivityTable } from "@/components/ActivityTable";
import { recentFiles } from "@/lib/mockData";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

const types = ["all", "csv", "json", "jsonl", "parquet"] as const;
type FileType = (typeof types)[number];

export default function History() {
  const [query, setQuery] = useState("");
  const [type, setType] = useState<FileType>("all");
  const [date, setDate] = useState("");

  const filtered = useMemo(() => {
    return recentFiles.filter((f) => {
      const matchesQuery = f.name.toLowerCase().includes(query.toLowerCase());
      const matchesType = type === "all" || f.name.toLowerCase().endsWith(`.${type}`);
      const matchesDate = !date || f.date >= date;
      return matchesQuery && matchesType && matchesDate;
    });
  }, [query, type, date]);

  return (
    <DashboardLayout>
      <div className="mb-6 animate-fade-in">
        <p className="text-xs font-mono uppercase tracking-widest text-primary">All runs</p>
        <h1 className="text-3xl font-bold tracking-tight">Processing history</h1>
        <p className="text-muted-foreground mt-1">Audit every file processed by your pipeline.</p>
      </div>

      <div className="glass rounded-2xl p-4 mb-4 flex flex-col lg:flex-row gap-3 lg:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by file name…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9 bg-muted/40 border-border/60"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {types.map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-mono uppercase tracking-wider border transition",
                type === t
                  ? "bg-primary/15 border-primary/40 text-primary"
                  : "bg-muted/40 border-border/50 text-muted-foreground hover:text-foreground"
              )}
            >
              {t}
            </button>
          ))}
        </div>
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-auto bg-muted/40 border-border/60 font-mono text-xs"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center text-muted-foreground">
          No runs match these filters.
        </div>
      ) : (
        <ActivityTable files={filtered} showAll />
      )}
    </DashboardLayout>
  );
}
