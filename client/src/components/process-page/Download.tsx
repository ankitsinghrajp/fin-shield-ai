import toast from "react-hot-toast";

export function downloadCSV(data: Record<string, unknown>[]) {
  if (!data.length) return;
  const keys = Object.keys(data[0]);
  const rows = [
    keys.map(k => `"${k.replace(/"/g, '""')}"`).join(","),
    ...data.map(r => keys.map(k => `"${String(r[k] ?? "").replace(/"/g, '""')}"`).join(",")),
  ];
  const blob = new Blob([rows.join("\n")], { type: "text/csv" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "masked_data.csv"; a.click();
}

export function downloadJSON(data: Record<string, unknown>[]) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "masked_data.json"; a.click();
}

export function downloadTXT(data: Record<string, unknown>[]) {
  const lines = data.map(r => {
    if ("content" in r) return String(r.content ?? "");
    return Object.entries(r).map(([k, v]) => `${k}: ${v}`).join(" | ");
  });
  const blob = new Blob([lines.join("\n")], { type: "text/plain" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "masked_data.txt"; a.click();
}

export function downloadXLSX(data: Record<string, unknown>[]) {
  downloadCSV(data);
  toast("XLSX download: install SheetJS for native XLSX support", { icon: "ℹ️" });
}

export function downloadDocx(data: Record<string, unknown>[], runId: string, maskingLevel: string) {
  const lines = data.map(r => {
    if ("content" in r) return String(r.content ?? "");
    return Object.entries(r).map(([k, v]) => `${k}: ${v}`).join("\n");
  });

  const escHtml = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const highlightMasks = (line: string): string => {
    const escaped = escHtml(line);
    return escaped
      .replace(/(\[REDACTED\]|\[MASKED\]|\[ADDRESS REDACTED\])/g,
        '<span style="background:#fff3cd;color:#856404;padding:1px 4px;border-radius:3px;font-weight:600;">$1</span>')
      .replace(/(\*{2,}[\d\w]*)/g,
        '<span style="background:#fde8d8;color:#c0392b;padding:1px 3px;border-radius:3px;font-family:monospace;">$1</span>')
      .replace(/(XX+[\w/]*)/g,
        '<span style="background:#e8f4fd;color:#1a5276;padding:1px 3px;border-radius:3px;font-family:monospace;">$1</span>');
  };

  const allParagraphs: string[] = [];
  lines.forEach(line => {
    const parts = line.split("\n");
    parts.forEach(part => { if (part.trim()) allParagraphs.push(part); });
  });

  const now = new Date().toLocaleString();

  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Masked Document — Run ${runId}</title>
<style>
  body { font-family: 'Calibri', 'Segoe UI', sans-serif; margin: 0; padding: 0; background: #f9fafb; }
  .page { max-width: 800px; margin: 40px auto; background: #fff; padding: 60px 72px; box-shadow: 0 2px 24px rgba(0,0,0,0.08); border-radius: 8px; }
  .header { border-bottom: 3px solid #1a1a2e; padding-bottom: 24px; margin-bottom: 32px; }
  .logo { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }
  .logo-icon { width: 36px; height: 36px; background: linear-gradient(135deg,#0f3460,#16213e); border-radius: 8px; display: flex; align-items: center; justify-content: center; }
  .logo-text { font-size: 18px; font-weight: 700; color: #1a1a2e; letter-spacing: -0.5px; }
  .doc-title { font-size: 26px; font-weight: 700; color: #1a1a2e; margin: 0 0 6px; }
  .meta-row { display: flex; gap: 24px; flex-wrap: wrap; margin-top: 12px; }
  .meta-item { font-size: 11px; color: #6b7280; }
  .meta-item strong { color: #374151; font-weight: 600; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 20px; font-size: 11px; font-weight: 600; }
  .badge-high { background: #fee2e2; color: #991b1b; }
  .badge-medium { background: #fef3c7; color: #92400e; }
  .badge-low { background: #d1fae5; color: #065f46; }
  .section-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.2px; color: #9ca3af; margin: 32px 0 12px; }
  .content-block { background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 6px; padding: 20px 24px; }
  .line-item { padding: 5px 0; border-bottom: 1px solid #f3f4f6; font-size: 13px; color: #374151; line-height: 1.6; }
  .line-item:last-child { border-bottom: none; }
  .line-num { color: #d1d5db; font-size: 11px; font-family: monospace; margin-right: 12px; min-width: 30px; display: inline-block; }
  .section-header { font-size: 14px; font-weight: 700; color: #1a1a2e; margin: 20px 0 4px; padding: 6px 0; border-bottom: 2px solid #e5e7eb; }
  .field-row { display: flex; gap: 12px; padding: 4px 0; font-size: 13px; }
  .field-key { color: #6b7280; min-width: 140px; font-weight: 500; }
  .field-val { color: #111827; flex: 1; }
  .footer { margin-top: 48px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 11px; color: #9ca3af; }
  @media print { body { background: #fff; } .page { box-shadow: none; margin: 0; padding: 40px; } }
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <div class="logo">
      <div class="logo-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        </svg>
      </div>
      <span class="logo-text">FinShield AI</span>
    </div>
    <h1 class="doc-title">Privacy-Masked Document</h1>
    <div class="meta-row">
      <div class="meta-item"><strong>Run ID:</strong> ${runId}</div>
      <div class="meta-item"><strong>Generated:</strong> ${now}</div>
      <div class="meta-item"><strong>Masking Level:</strong> <span class="badge badge-${maskingLevel}">${maskingLevel.toUpperCase()}</span></div>
      <div class="meta-item"><strong>Records:</strong> ${data.length}</div>
    </div>
  </div>

  <div class="section-title">📄 Masked Document Content</div>
  <div class="content-block">
    ${allParagraphs.map((para, i) => {
      const isSectionHeader = /^SECTION\s+\d+/i.test(para) || /^[A-Z\s\d:—-]{8,}$/.test(para.trim());
      if (isSectionHeader) {
        return `<div class="section-header">${escHtml(para)}</div>`;
      }
      const kvMatch = para.match(/^([^:]{2,40}):\s(.+)$/);
      if (kvMatch) {
        return `<div class="field-row">
          <span class="field-key">${escHtml(kvMatch[1])}:</span>
          <span class="field-val">${highlightMasks(kvMatch[2])}</span>
        </div>`;
      }
      const isLog = /^\[?\d{4}-\d{2}-\d{2}/.test(para);
      return `<div class="line-item">
        ${isLog ? '<span style="color:#60a5fa;font-size:11px;font-family:monospace;margin-right:8px;">LOG</span>' : `<span class="line-num">${i + 1}</span>`}
        ${highlightMasks(para)}
      </div>`;
    }).join("")}
  </div>

  <div class="footer">
    Generated by FinShield AI · Privacy Pipeline v4.6 · All sensitive fields masked per policy
  </div>
</div>
</body>
</html>`;

  const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `masked_document_${runId}.html`;
  a.click();
  toast.success("Document downloaded — open in Word or browser", { icon: "📄" });
}