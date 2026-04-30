import { NavLink } from "@/components/NavLink";
import { LayoutDashboard, History, Upload, Shield, Settings, FileBarChart2 } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/history", label: "History", icon: History },
];

export const Sidebar = () => {
  return (
    <aside className="hidden lg:flex w-60 shrink-0 flex-col border-r border-border/40 glass min-h-[calc(100vh-4rem)] sticky top-16">
      <div className="p-4 border-b border-border/40">
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-primary/10 border border-primary/20">
          <Shield className="h-4 w-4 text-primary" />
          <span className="text-xs font-mono text-primary">PIPELINE ACTIVE</span>
          <span className="ml-auto h-2 w-2 rounded-full bg-primary animate-pulse" />
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        <p className="px-3 py-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Workspace</p>
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/dashboard"}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-foreground transition group"
              )}
              activeClassName="bg-sidebar-accent text-primary border-l-2 border-primary"
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      <div className="p-3 border-t border-border/40">
        <NavLink
          to="#"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-foreground transition"
        >
          <Settings className="h-4 w-4" />
          Settings
        </NavLink>
        <div className="mt-3 p-3 rounded-lg bg-gradient-to-br from-primary/10 to-secondary/10 border border-primary/20">
          <p className="text-xs font-medium">Free tier</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">3.2 GB / 10 GB used</p>
          <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full w-[32%] bg-gradient-primary rounded-full" />
          </div>
        </div>
      </div>
    </aside>
  );
};
