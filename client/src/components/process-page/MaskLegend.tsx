import { cn } from "@/lib/utils";

export function MaskLegend() {
  const items = [
    { label: "[REDACTED]", bg: "bg-red-500/10",    text: "text-red-400",    border: "border-red-500/20",    desc: "Fully removed" },
    { label: "****1234",   bg: "bg-amber-400/10",  text: "text-amber-300",  border: "border-amber-400/20",  desc: "Partially masked" },
    { label: "SBINXXXX",   bg: "bg-blue-500/10",   text: "text-blue-300",   border: "border-blue-400/20",   desc: "Pattern replaced" },
    { label: "User_4162",  bg: "bg-purple-500/10", text: "text-purple-300", border: "border-purple-400/20", desc: "Pseudonymised" },
  ];
  return (
    <div className="flex flex-wrap gap-2 text-[10px]">
      {items.map(it => (
        <div key={it.label} className="flex items-center gap-1.5">
          <span className={cn("px-1.5 py-0.5 rounded font-mono font-semibold border", it.bg, it.text, it.border)}>{it.label}</span>
          <span className="text-gray-600">{it.desc}</span>
        </div>
      ))}
    </div>
  );
}