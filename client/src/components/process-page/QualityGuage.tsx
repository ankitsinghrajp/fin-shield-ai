interface Props { score: number; label: string }

export function QualityGauge({ score, label }: Props) {
  const circumference = Math.PI * 54;
  const offset = circumference * (1 - score / 100);
  const color = score >= 70 ? "#10b981" : score >= 40 ? "#f59e0b" : "#f87171";
  return (
    <div className="flex flex-col items-center justify-center">
      <svg width={140} height={80} viewBox="0 0 140 80">
        <path d="M 14 70 A 56 56 0 0 1 126 70" fill="none" stroke="#1e2530" strokeWidth={8} strokeLinecap="round" />
        <path
          d="M 14 70 A 56 56 0 0 1 126 70"
          fill="none"
          stroke={color}
          strokeWidth={8}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1s ease, stroke 0.3s ease" }}
        />
      </svg>
      <div className="text-center -mt-6">
        <p className="text-3xl font-bold font-mono" style={{ color }}>{score.toFixed(1)}%</p>
        <p className="text-xs text-gray-500 mt-0.5">{label}</p>
      </div>
    </div>
  );
}