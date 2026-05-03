
export interface RiskScore { level: string; score: number; reason: string }
export interface Report {
  records: number; totalFields: number; piiFields: number;
  piiPercent: string; utilityPercent: string;
  breakdown: {
    directPII: Record<string, number>;
    sensitivePII: Record<string, number>;
    quasiIdentifiers: Record<string, number>;
  };
  maskingLevel: string; utilityNote: string;
  explanations: Record<string, string>;
  riskScore: RiskScore;
  pipeline: { steps: string[]; inputType: string; version: string; detector?: string };
}
export interface PipelineData {
  runId: string; maskingLevel: string; recordCount: number;
  result: Record<string, unknown>[]; report: Report;
}

export type MaskingLevel = "low" | "medium" | "high";
export type ViewMode = "table" | "json" | "document";

export interface DisplayLine {
  lineNum: number;
  rawText: string;
  isSectionHeader: boolean;
  isLogEntry: boolean;
  isKeyValue: boolean;
  key?: string;
  value?: string;
}

export type Segment =
  | { type: "redacted"; text: string }
  | { type: "partial-star"; text: string }
  | { type: "partial-x"; text: string }
  | { type: "pseudonym"; text: string }
  | { type: "plain"; text: string };