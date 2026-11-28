// Presentation only: never mutate stored AI output or execute embedded HTML.
export type InlinePart = { kind: "text" | "strong" | "em" | "code"; text: string };
export type ReportBlock =
  | { kind: "heading"; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "code"; text: string }
  | { kind: "list"; ordered: boolean; items: string[] }
  | { kind: "table"; headers: string[]; rows: string[][] };

export function parseInline(text: string): InlinePart[] {
  const result: InlinePart[] = [];
  const pattern = /\`([^\`\n]+)\`|\*\*([^*\n]+)\*\*|__([^_\n]+)__|\*([^*\n]+)\*/g;
  let cursor = 0;
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > cursor) result.push({ kind: "text", text: text.slice(cursor, index) });
    result.push({ kind: match[1] !== undefined ? "code" : match[4] !== undefined ? "em" : "strong", text: match[1] ?? match[2] ?? match[3] ?? match[4] });
    cursor = index + match[0].length;
  }
  if (cursor < text.length) result.push({ kind: "text", text: text.slice(cursor) });
  return result;
}

const heading = /^\s{0,3}#{1,6}\s+(.+)$/;
const bullet = /^\s*[-*+]\s+(.+)$/;
const numbered = /^\s*\d+[.)]\s+(.+)$/;
const cells = (line: string) => line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map(c => c.trim());
const separator = (line: string) => line.includes("|") && cells(line).every(c => /^:?-{3,}:?$/.test(c));

export function parseReport(text: string): ReportBlock[] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const blocks: ReportBlock[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    if (/^\s*```/.test(line)) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) code.push(lines[i++]);
      if (i < lines.length) i++;
      blocks.push({ kind: "code", text: code.join("\n") });
      continue;
    }
    const h = line.match(heading);
    if (h) { blocks.push({ kind: "heading", text: h[1] }); i++; continue; }
    if (line.includes("|") && i + 1 < lines.length && separator(lines[i + 1]) && cells(line).length === cells(lines[i + 1]).length) {
      const headers = cells(line);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && lines[i].includes("|") && cells(lines[i]).length === headers.length) rows.push(cells(lines[i++]));
      blocks.push({ kind: "table", headers, rows });
      continue;
    }
    const listPattern = numbered.test(line) ? numbered : bullet;
    if (listPattern.test(line)) {
      const items: string[] = [];
      while (i < lines.length) {
        const m = lines[i].match(listPattern);
        if (!m) break;
        items.push(m[1]); i++;
      }
      blocks.push({ kind: "list", ordered: listPattern === numbered, items });
      continue;
    }
    blocks.push({ kind: "paragraph", text: line });
    i++;
  }
  return blocks;
}

export function escapeReportHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export function reportToHtml(text: string): string {
  const inline = (value: string) => parseInline(value).map(p => {
    const escaped = escapeReportHtml(p.text);
    return p.kind === "strong" ? "<strong>" + escaped + "</strong>" : p.kind === "em" ? "<em>" + escaped + "</em>" : p.kind === "code" ? "<code>" + escaped + "</code>" : escaped;
  }).join("");
  return parseReport(text).map(b => {
    switch (b.kind) {
      case "heading": return "<h3>" + inline(b.text) + "</h3>";
      case "paragraph": return "<p>" + inline(b.text) + "</p>";
      case "code": return "<pre>" + escapeReportHtml(b.text) + "</pre>";
      case "list": { const tag = b.ordered ? "ol" : "ul"; return "<" + tag + ">" + b.items.map(item => "<li>" + inline(item) + "</li>").join("") + "</" + tag + ">"; }
      case "table": return "<table><thead><tr>" + b.headers.map(h => "<th>" + inline(h) + "</th>").join("") + "</tr></thead><tbody>" + b.rows.map(row => "<tr>" + row.map(c => "<td>" + inline(c) + "</td>").join("") + "</tr>").join("") + "</tbody></table>";
    }
  }).join("\n");
}
