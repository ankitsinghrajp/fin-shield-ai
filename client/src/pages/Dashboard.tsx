import { DashboardLayout } from "@/components/DashboardLayout";
import { StatsCard } from "@/components/StatsCard";
import { UploadBox } from "@/components/UploadBox";
import { ActivityTable } from "@/components/ActivityTable";
import { recentFiles } from "@/lib/mockData";
import { FileStack, Database, ShieldAlert, Gauge } from "lucide-react";

export default function Dashboard() {
  return (
    <DashboardLayout>
      <div className="flex flex-col gap-2 mb-8 animate-fade-in">
        <p className="text-xs font-mono uppercase tracking-widest text-primary">Workspace overview</p>
        <h1 className="text-3xl font-bold tracking-tight">Welcome back, Alex</h1>
        <p className="text-muted-foreground">Here's what's happening with your privacy pipeline this month.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8 animate-fade-in-up">
        <StatsCard label="Files processed" value="284" delta="+18% vs last month" trend="up" icon={FileStack} accent="primary" />
        <StatsCard label="Records processed" value="2.4M" delta="+412k this month" trend="up" icon={Database} accent="secondary" />
        <StatsCard label="PII detected" value="47%" delta="avg across files" icon={ShieldAlert} accent="warning" />
        <StatsCard label="Data utility score" value="89.2" delta="+2.1 since v2.4" trend="up" icon={Gauge} accent="primary" />
      </div>

      {/* Upload */}
      <section id="upload" className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">New upload</h2>
          <span className="text-xs font-mono text-muted-foreground">3.2 GB / 10 GB used</span>
        </div>
        <UploadBox />
      </section>

      {/* Recent activity */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Recent activity</h2>
          <span className="text-xs font-mono text-muted-foreground">{recentFiles.length} runs</span>
        </div>
        <ActivityTable files={recentFiles.slice(0, 5)} />
      </section>
    </DashboardLayout>
  );
}
