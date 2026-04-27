import { Token, PIIType, Strategy, maskToken } from "@/lib/mockData";
import { cn } from "@/lib/utils";

const piiClass: Record<PIIType, string> = {
  name: "pii-chip pii-name",
  email: "pii-chip pii-email",
  phone: "pii-chip pii-phone",
  id: "pii-chip pii-id",
  address: "pii-chip pii-address",
};

interface Props {
  tokens: Token[];
  mode: "raw" | "masked";
  strategy?: Strategy;
}

export const PIIHighlighter = ({ tokens, mode, strategy = "medium" }: Props) => {
  return (
    <div className="font-mono text-sm leading-7 text-foreground/90 whitespace-pre-wrap break-words">
      {tokens.map((t, i) => {
        if (typeof t === "string") return <span key={i}>{t}</span>;
        if (mode === "raw") {
          return (
            <span key={i} className={cn(piiClass[t.type])} title={`Detected: ${t.type.toUpperCase()}`}>
              {t.text}
            </span>
          );
        }
        return (
          <span key={i} className="masked-glow" title={`${t.type} → ${strategy} masking`}>
            {maskToken(t, strategy)}
          </span>
        );
      })}
    </div>
  );
};
