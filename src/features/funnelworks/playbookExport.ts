import type { FunnelPackage, PlaybookPage } from "./types";

/** Browser-native two-page PDF export; no paid service or external dependency. */
function drawPage(page: PlaybookPage, title: string, subtitle: string): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 1240; canvas.height = 1754;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("PDF export is unavailable in this browser.");
  ctx.fillStyle = "#fbfaf8"; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#7c3aed"; ctx.fillRect(80, 80, 110, 8);
  ctx.fillStyle = "#171717"; ctx.font = "bold 52px Arial";
  ctx.fillText(title.slice(0, 42), 80, 175);
  ctx.fillStyle = "#555"; ctx.font = "28px Arial"; ctx.fillText(subtitle.slice(0, 64), 80, 230);
  ctx.fillStyle = "#171717"; ctx.font = "bold 38px Arial"; ctx.fillText(page.sectionTitle.slice(0, 48), 80, 320);

  function wrapped(value: string, x: number, y: number, width: number, lineHeight: number, maxLines: number) {
    const words = value.split(/\s+/);
    const lines: string[] = [];
    let line = "";
    for (const word of words) {
      const next = line ? line + " " + word : word;
      if (ctx.measureText(next).width > width && line) { lines.push(line); line = word; }
      else line = next;
    }
    if (line) lines.push(line);
    for (const item of lines.slice(0, maxLines)) { ctx.fillText(item, x, y); y += lineHeight; }
    return y;
  }

  ctx.fillStyle = "#454545"; ctx.font = "26px Arial";
  let y = wrapped(page.summary, 80, 375, 1070, 38, 5) + 45;
  for (const block of page.blocks.slice(0, 7)) {
    if (y > 1550) break;
    ctx.fillStyle = "#24153e"; ctx.font = "bold 31px Arial";
    y = wrapped(block.heading, 80, y, 1060, 42, 2) + 12;
    ctx.fillStyle = "#454545"; ctx.font = "25px Arial";
    for (const bullet of block.bullets.slice(0, 7)) {
      if (y > 1580) break;
      y = wrapped("• " + bullet, 105, y, 1030, 35, 3) + 8;
    }
    y += 25;
  }
  ctx.fillStyle = "#666"; ctx.font = "22px Arial";
  ctx.fillText("PRODUCTWORKS", 80, 1675);
  ctx.textAlign = "right"; ctx.fillText(page.pageNumber + " / 2", 1150, 1675);
  return canvas;
}

export function generatePlaybookPdfBytes(funnel: FunnelPackage): Uint8Array {
  const pages = funnel.playbook.pages.map(p => drawPage(p, funnel.playbook.title, funnel.playbook.subtitle));
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [0];
  let position = 0;
  const write = (bytes: Uint8Array) => { chunks.push(bytes); position += bytes.length; };
  const ascii = (s: string) => write(enc.encode(s));
  const objects: Array<() => void> = [];
  const pageIds: number[] = [];
  objects.push(() => ascii("<< /Type /Catalog /Pages 2 0 R >>"));
  objects.push(() => ascii("<< /Type /Pages /Kids [" + pageIds.map(n => n + " 0 R").join(" ") + "] /Count 2 >>"));
  for (const canvas of pages) {
    const jpeg = atob(canvas.toDataURL("image/jpeg", 0.88).split(",")[1]);
    const bytes = Uint8Array.from(jpeg, ch => ch.charCodeAt(0));
    const imageId = objects.length + 1;
    const pageId = imageId + 1;
    const streamId = imageId + 2;
    pageIds.push(pageId);
    objects.push(() => {
      ascii("<< /Type /XObject /Subtype /Image /Width 1240 /Height 1754 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length " + bytes.length + " >>\nstream\n");
      write(bytes); ascii("\nendstream");
    });
    objects.push(() => ascii("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /Im" + imageId + " " + imageId + " 0 R >> >> /Contents " + streamId + " 0 R >>"));
    const commands = "q 595 0 0 842 0 0 cm /Im" + imageId + " Do Q";
    objects.push(() => ascii("<< /Length " + enc.encode(commands).length + " >>\nstream\n" + commands + "\nendstream"));
  }
  ascii("%PDF-1.4\n");
  objects.forEach((fn, i) => { offsets.push(position); ascii((i + 1) + " 0 obj\n"); fn(); ascii("\nendobj\n"); });
  const xref = position;
  ascii("xref\n0 " + (objects.length + 1) + "\n0000000000 65535 f \n");
  offsets.slice(1).forEach(n => ascii(String(n).padStart(10, "0") + " 00000 n \n"));
  ascii("trailer\n<< /Size " + (objects.length + 1) + " /Root 1 0 R >>\nstartxref\n" + xref + "\n%%EOF");
  const length = chunks.reduce((n, c) => n + c.length, 0);
  const result = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
  return result;
}

export async function downloadPlaybookPdf(funnel: FunnelPackage) {
  const pdfBytes = generatePlaybookPdfBytes(funnel);
  const blob = new Blob([pdfBytes as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = "productworks-playbook.pdf";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}
