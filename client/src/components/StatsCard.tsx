import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatsCardProps {
  label: string;
  value: string;
  delta?: string;
  trend?: "up" | "down" | "neutral";
  icon: LucideIcon;
  accent?: "primary" | "secondary" | "warning";
}

const accentMap = {
  primary: "from-primary/20 to-primary/5 text-primary",
  secondary: "from-secondary/20 to-secondary/5 text-secondary",
  warning: "from-warning/20 to-warning/5 text-warning",
};

export const StatsCard = ({ label, value, delta, trend = "neutral", icon: Icon, accent = "primary" }: StatsCardProps) => {
  return (
    <div className="glass rounded-2xl p-5 relative overflow-hidden group hover:border-primary/40 transition">
      <div className={cn("absolute -top-10 -right-10 h-32 w-32 rounded-full blur-2xl opacity-40 bg-gradient-to-br", accentMap[accent])} />
      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight">{value}</p>
          {delta && (
            <p className={cn(
              "mt-1 text-xs font-medium",
              trend === "up" && "text-primary",
              trend === "down" && "text-destructive",
              trend === "neutral" && "text-muted-foreground"
            )}>
              {delta}
            </p>
          )}
        </div>
        <div className={cn("p-2.5 rounded-xl bg-gradient-to-br border border-border/60", accentMap[accent])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
};
