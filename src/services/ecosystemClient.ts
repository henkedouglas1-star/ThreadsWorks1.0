import { auth } from "../firebase";

async function getBearerHeaders(): Promise<Record<string, string>> {
  const user = auth?.currentUser;
  if (!user) {
    throw new Error("Please sign in to use ContentPaysUs workspace tools.");
  }
  const token = await user.getIdToken();
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`
  };
}

export async function ecosystemFetch<T = any>(
  path: string,
  options: { method?: "GET" | "POST" | "PUT" | "DELETE"; body?: unknown } = {}
): Promise<T> {
  const headers = await getBearerHeaders();
  const res = await fetch(path, {
    method: options.method || "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || `Request failed (${res.status})`);
  }
  return data as T;
}

function triggerDownload(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function safeSlug(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "contentpaysus-export"
  );
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function exportStructuredAsset(
  format: "md" | "txt" | "html" | "json" | "csv",
  title: string,
  sections: Array<{ label: string; value: string }>,
  meta?: { appId?: string; provenance?: string }
) {
  const slug = safeSlug(title);
  if (format === "json") {
    triggerDownload(
      `${slug}.json`,
      JSON.stringify({ title, meta, sections, exportedAt: new Date().toISOString() }, null, 2),
      "application/json;charset=utf-8"
    );
    return;
  }

  if (format === "csv") {
    const rows = [
      ["Section", "Content"],
      ...sections.map((s) => [s.label, s.value])
    ]
      .map((cols) => cols.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    triggerDownload(`${slug}.csv`, rows, "text/csv;charset=utf-8");
    return;
  }

  if (format === "txt") {
    const body = [
      title.toUpperCase(),
      meta?.provenance ? `Provenance: ${meta.provenance}` : "",
      "=".repeat(60),
      "",
      ...sections.flatMap((s) => [`[${s.label}]`, s.value, ""])
    ]
      .filter((line) => line !== undefined)
      .join("\n");
    triggerDownload(`${slug}.txt`, body, "text/plain;charset=utf-8");
    return;
  }

  if (format === "html") {
    const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; max-width: 820px; margin: 40px auto; padding: 0 24px; color: #0f172a; line-height: 1.6; }
    h1 { font-size: 28px; margin-bottom: 6px; }
    .meta { font-size: 12px; color: #475569; margin-bottom: 28px; }
    section { margin-bottom: 24px; padding: 18px; border: 1px solid #e2e8f0; border-radius: 10px; background: #f8fafc; }
    h2 { font-size: 15px; text-transform: uppercase; letter-spacing: 0.05em; color: #4338ca; margin: 0 0 10px; }
    pre { white-space: pre-wrap; font-family: inherit; margin: 0; }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <div class="meta">Exported from ContentPaysUs${meta?.appId ? ` · ${escapeHtml(meta.appId)}` : ""}${meta?.provenance ? ` · ${escapeHtml(meta.provenance)}` : ""}</div>
  ${sections
    .map(
      (s) =>
        `<section><h2>${escapeHtml(s.label)}</h2><pre>${escapeHtml(s.value)}</pre></section>`
    )
    .join("\n")}
</body>
</html>`;
    triggerDownload(`${slug}.html`, html, "text/html;charset=utf-8");
    return;
  }

  // Default: Markdown (.md)
  const md = [
    `# ${title}`,
    meta?.provenance ? `> Provenance: \`${meta.provenance}\`` : "",
    "",
    ...sections.flatMap((s) => [`## ${s.label}`, "", s.value, ""])
  ].join("\n");
  triggerDownload(`${slug}.md`, md, "text/markdown;charset=utf-8");
}

export function exportInvoiceHtml(invoice: {
  invoiceNumber: string;
  clientName: string;
  description: string;
  amountCents: number;
  createdAt: string;
  issuerName?: string;
}) {
  const formatted = `$${(invoice.amountCents / 100).toFixed(2)}`;
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Invoice ${escapeHtml(invoice.invoiceNumber)}</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; max-width: 720px; margin: 48px auto; padding: 0 24px; color: #0f172a; }
    .header { display: flex; justify-content: space-between; border-bottom: 2px solid #0f172a; padding-bottom: 16px; margin-bottom: 28px; }
    table { width: 100%; border-collapse: collapse; margin-top: 24px; }
    th, td { text-align: left; padding: 12px; border-bottom: 1px solid #e2e8f0; }
    .total { font-size: 20px; font-weight: 700; text-align: right; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>INVOICE</h1>
      <div>${escapeHtml(invoice.issuerName || "ContentPaysUs Creator")}</div>
    </div>
    <div>
      <div><strong>No:</strong> ${escapeHtml(invoice.invoiceNumber)}</div>
      <div><strong>Date:</strong> ${escapeHtml(invoice.createdAt.slice(0, 10))}</div>
    </div>
  </div>
  <p><strong>Bill To:</strong> ${escapeHtml(invoice.clientName || "Client")}</p>
  <table>
    <thead><tr><th>Description</th><th>Amount (USD)</th></tr></thead>
    <tbody><tr><td>${escapeHtml(invoice.description)}</td><td>${formatted}</td></tr></tbody>
  </table>
  <div class="total">Total Due: ${formatted}</div>
</body>
</html>`;
  triggerDownload(`${safeSlug(invoice.invoiceNumber || "invoice")}.html`, html, "text/html;charset=utf-8");
}
