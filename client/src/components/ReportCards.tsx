import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ReportCard {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  accent?: "primary" | "secondary" | "warning";
}

const accentMap = {
  primary: "from-primary/15 to-transparent text-primary border-primary/30",
  secondary: "from-secondary/15 to-transparent text-secondary border-secondary/30",
  warning: "from-warning/15 to-transparent text-warning border-warning/30",
};

export const ReportCards = ({ cards }: { cards: ReportCard[] }) => {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <div key={c.label} className={cn("glass rounded-2xl p-5 border bg-gradient-to-br", accentMap[c.accent ?? "primary"])}>
            <div className="flex items-center justify-between">
              <Icon className="h-5 w-5" />
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{c.label}</span>
            </div>
            <p className="mt-3 text-2xl font-bold text-foreground">{c.value}</p>
            {c.hint && <p className="mt-1 text-xs text-muted-foreground">{c.hint}</p>}
          </div>
        );
      })}
    </div>
  );
};
