import type { FunnelPackage } from "./types";
import { renderCarouselSlide } from "./carouselExport";

const encoder = new TextEncoder();
function u16(v: number) { return [v & 255, (v >>> 8) & 255]; }
function u32(v: number) { return [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255]; }
function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function concat(parts: Uint8Array[]): Uint8Array {
  const length = parts.reduce((n, p) => n + p.length, 0);
  const result = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) { result.set(part, offset); offset += part.length; }
  return result;
}
function bytes(values: number[]) { return new Uint8Array(values); }

export function makeZip(files: Array<{ name: string; data: Uint8Array }>): Uint8Array {
  const local: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const file of files) {
    const name = encoder.encode(file.name);
    const crc = crc32(file.data);
    const length = file.data.length;
    const common = [...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(crc), ...u32(length), ...u32(length), ...u16(name.length), ...u16(0)];
    const header = bytes([...u32(0x04034b50), ...common]);
    local.push(header, name, file.data);
    central.push(bytes([...u32(0x02014b50), ...u16(20), ...common, ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(offset)]), name);
    offset += header.length + name.length + length;
  }
  const directory = concat(central);
  const footer = bytes([...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length), ...u32(directory.length), ...u32(offset), ...u16(0)]);
  return concat([...local, directory, footer]);
}

export async function downloadCarouselZip(funnel: FunnelPackage) {
  const files = await Promise.all(funnel.slides.map(async slide => {
    const canvas = renderCarouselSlide(slide, funnel.theme, funnel.creatorBrand);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error("Could not render slide.")), "image/png"));
    return { name: "slide-" + String(slide.slideNumber).padStart(2, "0") + ".png", data: new Uint8Array(await blob.arrayBuffer()) };
  }));
  const zip = makeZip(files);
  const url = URL.createObjectURL(new Blob([zip as BlobPart], { type: "application/zip" }));
  const a = document.createElement("a");
  a.href = url; a.download = "productworks-carousel-slides.zip";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

export function downloadCompanionPostsTxt(funnel: FunnelPackage) {
  const text = `PRODUCTWORKS COMPANION POSTS
Product: ${funnel.storefront.productTitle}
Creator/Brand: ${funnel.creatorBrand || "Creator"}

--- THREADS POST ---
${funnel.companionPosts.threads}

--- X (TWITTER) POST ---
${funnel.companionPosts.x}

--- LINKEDIN POST ---
${funnel.companionPosts.linkedin}
`;
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "productworks-companion-posts.txt";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function downloadStorefrontTxt(funnel: FunnelPackage) {
  const text = `PRODUCTWORKS STOREFRONT KIT
Product Title: ${funnel.storefront.productTitle}
Suggested Price: ${funnel.storefront.suggestedPrice}
CTA Keyword: ${funnel.storefront.ctaKeyword}

OUTCOME BULLETS:
1. ${funnel.storefront.outcomeBullets[0] || ""}
2. ${funnel.storefront.outcomeBullets[1] || ""}
3. ${funnel.storefront.outcomeBullets[2] || ""}

CHECKOUT DESCRIPTION:
${funnel.storefront.checkoutDescription}

OPTIONAL ADD-ON / ORDER BUMP COPY:
${funnel.storefront.orderBumpPitch || "N/A"}
`;
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "productworks-storefront-copy.txt";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export async function downloadCompleteProductWorksZip(funnel: FunnelPackage) {
  const files: Array<{ name: string; data: Uint8Array }> = [];
  for (const slide of funnel.slides) {
    const canvas = renderCarouselSlide(slide, funnel.theme, funnel.creatorBrand);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error("Slide render failed")), "image/png"));
    files.push({ name: `slides/slide-${String(slide.slideNumber).padStart(2, "0")}.png`, data: new Uint8Array(await blob.arrayBuffer()) });
  }

  const { generatePlaybookPdfBytes } = await import("./playbookExport");
  const pdfBytes = generatePlaybookPdfBytes(funnel);
  files.push({ name: "playbook.pdf", data: pdfBytes });

  const companionText = `PRODUCTWORKS COMPANION POSTS\nProduct: ${funnel.storefront.productTitle}\n\n--- THREADS ---\n${funnel.companionPosts.threads}\n\n--- X ---\n${funnel.companionPosts.x}\n\n--- LINKEDIN ---\n${funnel.companionPosts.linkedin}\n`;
  files.push({ name: "companion-posts.txt", data: new TextEncoder().encode(companionText) });

  const storefrontText = `PRODUCTWORKS STOREFRONT KIT\nTitle: ${funnel.storefront.productTitle}\nSuggested Price: ${funnel.storefront.suggestedPrice}\nCTA: ${funnel.storefront.ctaKeyword}\n\nOutcomes:\n- ${funnel.storefront.outcomeBullets.join("\n- ")}\n\nCheckout Description:\n${funnel.storefront.checkoutDescription}\n\nAdd-on / Bump Copy:\n${funnel.storefront.orderBumpPitch}\n`;
  files.push({ name: "storefront-copy.txt", data: new TextEncoder().encode(storefrontText) });

  const zip = makeZip(files);
  const blob = new Blob([zip as BlobPart], { type: "application/zip" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "productworks-complete-package.zip";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}
