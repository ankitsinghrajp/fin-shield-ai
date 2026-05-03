import { tokeniseContent } from "./utils/tokenizer";

interface Props { content: string }

export function MaskedInline({ content }: Props) {
  const segments = tokeniseContent(content);
  return (
    <>
      {segments.map((seg, i) => {
        if (seg.type === "redacted") {
          return (
            <span key={i} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-red-500/10 text-red-400 border border-red-500/20 mx-0.5 whitespace-nowrap">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
              {seg.text}
            </span>
          );
        }
        if (seg.type === "partial-star") {
          return (
            <span key={i} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-amber-400/10 text-amber-300 border border-amber-400/20 mx-0.5">
              {seg.text}
            </span>
          );
        }
        if (seg.type === "partial-x") {
          return (
            <span key={i} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-blue-500/10 text-blue-300 border border-blue-400/20 mx-0.5">
              {seg.text}
            </span>
          );
        }
        if (seg.type === "pseudonym") {
          return (
            <span key={i} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-purple-500/10 text-purple-300 border border-purple-400/20 mx-0.5">
              {seg.text}
            </span>
          );
        }
        return <span key={i} className="text-gray-300">{seg.text}</span>;
      })}
    </>
  );
}