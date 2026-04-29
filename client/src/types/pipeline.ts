// src/types/pipeline.ts
// Shared types for the PII masking pipeline

export interface RiskScore {
  level: string;
  score: number;
  reason: string;
}

export interface Report {
  records: number;
  totalFields: number;
  piiFields: number;
  piiPercent: string;
  utilityPercent: string;
  breakdown: {
    directPII: Record<string, number>;
    sensitivePII: Record<string, number>;
    quasiIdentifiers: Record<string, number>;
  };
  maskingLevel: string;
  utilityNote: string;
  explanations: Record<string, string>;
  riskScore: RiskScore;
  pipeline: {
    steps: string[];
    inputType: string;
    version: string;
  };
}

export interface PipelineData {
  runId: string;
  maskingLevel: string;
  recordCount: number;
  result: Record<string, unknown>[];
  report: Report;
}

export interface RunEntry {
  runId: string;
  fileName: string;
  recordCount: number;
  piiPercent: string;
  utilityPercent: string;
  maskingLevel: string;
  riskLevel: string;
  timestamp: string;
  data: {
    result: Record<string, unknown>[];
    report: {
      breakdown: {
        directPII: Record<string, number>;
        sensitivePII: Record<string, number>;
        quasiIdentifiers: Record<string, number>;
      };
      riskScore: RiskScore;
      explanations: Record<string, string>;
    };
  };
}