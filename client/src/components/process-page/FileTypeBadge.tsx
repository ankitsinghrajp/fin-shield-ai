import { FILE_TYPE_META } from "./utils/constants";
import type { SupportedExt } from "../../types/process-page";

interface Props { ext: SupportedExt }

export function FileTypeBadge({ ext }: Props) {
  const meta = FILE_TYPE_META[ext];
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] sm:text-xs px-2.5 py-1 rounded-md border font-mono font-medium"
      style={{ color: meta.color, borderColor: `${meta.color}40`, background: `${meta.color}12` }}
    >
      <span>{meta.icon}</span>{meta.label}
    </span>
  );
}