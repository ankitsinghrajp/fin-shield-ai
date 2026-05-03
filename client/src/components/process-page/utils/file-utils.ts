import { SUPPORTED_EXTENSIONS, FILE_TYPE_META } from "./constants";
import type { SupportedExt } from "../../../types/process-page";

export function getFileExt(f: File): SupportedExt | null {
  const ext = ("." + f.name.split(".").pop()?.toLowerCase()) as SupportedExt;
  return SUPPORTED_EXTENSIONS.includes(ext) ? ext : null;
}

export function isValidFile(f: File) { return getFileExt(f) !== null; }

export function getFileIcon(filename: string) {
  const ext = ("." + filename.split(".").pop()?.toLowerCase()) as SupportedExt;
  return FILE_TYPE_META[ext]?.icon ?? "📁";
}

export function getFileColor(filename: string) {
  const ext = ("." + filename.split(".").pop()?.toLowerCase()) as SupportedExt;
  return FILE_TYPE_META[ext]?.color ?? "#6b7280";
}