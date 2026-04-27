// Shared mock data + types for PrivacyGuard AI (frontend only)
export type PIIType = "name" | "email" | "phone" | "id" | "address";

export interface PIIToken {
  text: string;
  type: PIIType;
}
export type Token = string | PIIToken;

export interface ProcessedFile {
  id: string;
  name: string;
  size: string;
  records: number;
  status: "completed" | "processing" | "failed";
  date: string;
  piiPercent: number;
  utility: number;
}

export const recentFiles: ProcessedFile[] = [
  { id: "f-1042", name: "customers_q4_2025.csv", size: "12.4 MB", records: 48210, status: "completed", date: "2026-04-26", piiPercent: 38, utility: 92 },
  { id: "f-1041", name: "support_tickets.json", size: "4.1 MB", records: 9820, status: "completed", date: "2026-04-25", piiPercent: 52, utility: 87 },
  { id: "f-1040", name: "marketing_leads.csv", size: "2.8 MB", records: 6140, status: "processing", date: "2026-04-25", piiPercent: 0, utility: 0 },
  { id: "f-1039", name: "user_signups.parquet", size: "18.9 MB", records: 71203, status: "completed", date: "2026-04-23", piiPercent: 41, utility: 90 },
  { id: "f-1038", name: "loan_applications.csv", size: "8.2 MB", records: 14002, status: "completed", date: "2026-04-22", piiPercent: 67, utility: 81 },
  { id: "f-1037", name: "chat_logs_train.jsonl", size: "32.1 MB", records: 102441, status: "failed", date: "2026-04-21", piiPercent: 0, utility: 0 },
  { id: "f-1036", name: "kyc_export.csv", size: "5.7 MB", records: 8230, status: "completed", date: "2026-04-19", piiPercent: 74, utility: 78 },
];

// Tokenized sample row used for the "Before vs After" highlighter
export const sampleTokens: Token[] = [
  "Customer ",
  { text: "Sarah Mitchell", type: "name" },
  " (",
  { text: "sarah.mitchell@acme.io", type: "email" },
  ") called from ",
  { text: "+1 (415) 555-0143", type: "phone" },
  " regarding account ",
  { text: "ACC-87412-XQ", type: "id" },
  ". Address on file: ",
  { text: "1242 Market St, San Francisco, CA", type: "address" },
  ". Agent ",
  { text: "David Chen", type: "name" },
  " resolved the issue and emailed ",
  { text: "david.chen@privacyguard.ai", type: "email" },
  " a follow-up at ",
  { text: "+1 (628) 555-0299", type: "phone" },
  ".",
];

export type Strategy = "low" | "medium" | "high";

export function maskToken(token: PIIToken, strategy: Strategy): string {
  const { text, type } = token;
  if (strategy === "low") {
    if (type === "email") {
      const [u, d] = text.split("@");
      return `${u.slice(0, 2)}***@${d}`;
    }
    if (type === "phone") return text.replace(/\d(?=\d{4})/g, "•");
    if (type === "name") return text.split(" ").map((p) => p[0] + "."). join(" ");
    if (type === "id") return text.slice(0, 3) + "•••" + text.slice(-2);
    if (type === "address") return text.split(",")[0] + ", ███";
  }
  if (strategy === "medium") {
    if (type === "email") {
      const [, d] = text.split("@");
      return `███@${d}`;
    }
    if (type === "phone") return "+• (•••) •••-" + text.slice(-2) + "••";
    if (type === "name") return "[NAME]";
    if (type === "id") return "[ID-" + text.slice(-3) + "]";
    if (type === "address") return "[ADDRESS_REDACTED]";
  }
  // high — full anonymization tokens
  const tokens: Record<PIIType, string> = {
    name: "[PERSON_001]",
    email: "[EMAIL_001]",
    phone: "[PHONE_001]",
    id: "[ACCOUNT_001]",
    address: "[ADDRESS_001]",
  };
  return tokens[type];
}

export const fieldBreakdown = [
  { field: "full_name", piiType: "Name", strategy: "Tokenize", count: 48210 },
  { field: "email", piiType: "Email", strategy: "Hash + Domain Keep", count: 47821 },
  { field: "phone_number", piiType: "Phone", strategy: "Partial Mask", count: 39102 },
  { field: "address_line_1", piiType: "Address", strategy: "Generalize", count: 41203 },
  { field: "account_id", piiType: "Identifier", strategy: "Pseudonymize", count: 48210 },
  { field: "ssn", piiType: "Identifier", strategy: "Full Redact", count: 12041 },
];
