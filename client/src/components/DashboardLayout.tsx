import { ReactNode } from "react";
import { Navbar } from "./Navbar";
import { Sidebar } from "./Sidebar";

export const DashboardLayout = ({ children }: { children: ReactNode }) => {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <div className="flex flex-1 w-full">
        <Sidebar />
        <main className="flex-1 min-w-0 cyber-grid-fade relative">
          <div className="relative z-10 container max-w-7xl py-8 px-4 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
