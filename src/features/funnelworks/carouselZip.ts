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
    const canvas = renderCarouselSlide(slide, funnel.theme);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error("Could not render slide.")), "image/png"));
    return { name: "slide-" + String(slide.slideNumber).padStart(2, "0") + ".png", data: new Uint8Array(await blob.arrayBuffer()) };
  }));
  const zip = makeZip(files);
  const url = URL.createObjectURL(new Blob([zip as BlobPart], { type: "application/zip" }));
  const a = document.createElement("a");
  a.href = url; a.download = "funnelworks-carousel.zip";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}
