import type { Segment } from "../../../types/process-page";

export function tokeniseContent(content: string): Segment[] {
  const patterns: [RegExp, Segment["type"]][] = [
    [/\[REDACTED\]|\[MASKED\]|\[ADDRESS REDACTED\]/g, "redacted"],
    [/\*{2,}[\d\w-]*/g, "partial-star"],
    [/[A-Z]{2,}X{3,}[\w]*/g, "partial-x"],
    [/XX+[\w/]*/g, "partial-x"],
    [/User_\d+/g, "pseudonym"],
    [/CUST_\d+/g, "pseudonym"],
  ];

  type Match = { start: number; end: number; segType: Segment["type"]; text: string };
  const matches: Match[] = [];

  patterns.forEach(([re, segType]) => {
    let m: RegExpExecArray | null;
    const regex = new RegExp(re.source, "g");
    while ((m = regex.exec(content)) !== null) {
      matches.push({ start: m.index, end: m.index + m[0].length, segType, text: m[0] });
    }
  });

  matches.sort((a, b) => a.start - b.start);
  const clean: Match[] = [];
  let cursor = 0;
  for (const m of matches) {
    if (m.start >= cursor) { clean.push(m); cursor = m.end; }
  }

  const segments: Segment[] = [];
  let pos = 0;
  for (const m of clean) {
    if (m.start > pos) segments.push({ type: "plain", text: content.slice(pos, m.start) });
    segments.push({ type: m.segType, text: m.text });
    pos = m.end;
  }
  if (pos < content.length) segments.push({ type: "plain", text: content.slice(pos) });
  return segments;
}

export function parseDocumentLines(result: Record<string, unknown>[]) {
  const out: import("../../../types/process-page").DisplayLine[] = [];
  let lineNum = 0;
  for (const row of result) {
    const content = String(row.content ?? "");
    const subLines = content.split("\n");
    for (const rawLine of subLines) {
      const text = rawLine.trimEnd();
      if (!text) continue;
      lineNum++;
      const isSectionHeader = /^SECTION\s+\d+/i.test(text) || /^[A-Z0-9\s:—\-]{10,}$/.test(text.trim());
      const isLogEntry = /^\[?\d{4}-\d{2}-\d{2}[\sT]/.test(text);
      const kvMatch = !isSectionHeader && !isLogEntry ? text.match(/^([^:]{2,40}):\s(.+)$/) : null;
      out.push({
        lineNum,
        rawText: text,
        isSectionHeader,
        isLogEntry,
        isKeyValue: !!kvMatch,
        key: kvMatch?.[1],
        value: kvMatch?.[2],
      });
    }
  }
  return out;
}