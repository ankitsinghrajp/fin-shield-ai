interface Props {
  label: string;
  count: number;
  max: number;
  color: string;
  icon: string;
}

export function TypeBar({ label, count, max, color, icon }: Props) {
  const pct = max > 0 ? (count / max) * 100 : 0;
  return (
    <div className="p-4 rounded-xl border border-white/5 bg-white/[0.03]">
      <div className="flex items-center gap-2.5 mb-2">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center text-base"
          style={{ background: `${color}20` }}
        >
          {icon}
        </div>
        <div>
          <p className="text-xs text-gray-400 font-medium">{label}</p>
          <p className="text-xl font-bold font-mono" style={{ color }}>{count}</p>
        </div>
      </div>
      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <p className="text-[10px] text-gray-600 mt-1 font-mono">{pct.toFixed(0)}% of max</p>
    </div>
  );
}