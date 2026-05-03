interface Props {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}

export function CustomTooltip({ active, payload, label }: Props) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#0f1117", border: "1px solid #1e2530", borderRadius: 8, padding: "8px 14px", fontSize: 12 }}>
      {label && <p style={{ color: "#6b7280", marginBottom: 4, fontFamily: "monospace" }}>{label}</p>}
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color, fontFamily: "monospace" }}>
          {p.name}: <strong>{p.value}</strong>
        </p>
      ))}
    </div>
  );
}