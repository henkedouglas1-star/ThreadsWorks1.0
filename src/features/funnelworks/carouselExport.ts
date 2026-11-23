import type { CarouselSlide, FunnelThemeId } from "./types";

const THEMES: Record<FunnelThemeId, { bg: string; fg: string; muted: string; accent: string }> = {
  editorial_dark: { bg: "#11111b", fg: "#ffffff", muted: "#c4c4d0", accent: "#a78bfa" },
  swiss_light: { bg: "#f8f8f5", fg: "#141414", muted: "#555555", accent: "#d54b31" },
  terminal_contrast: { bg: "#091b14", fg: "#e5ffe9", muted: "#a6d1b6", accent: "#79f2a0" },
  warm_creator: { bg: "#f9ede0", fg: "#36231d", muted: "#795b50", accent: "#b65738" }
};

function wrapLines(ctx: CanvasRenderingContext2D, value: string, width: number): string[] {
  const words = value.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? current + " " + word : word;
    if (ctx.measureText(candidate).width > width && current) {
      lines.push(current);
      current = word;
    } else current = candidate;
  }
  if (current) lines.push(current);
  return lines;
}

function drawWrapped(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines: number) {
  const lines = wrapLines(ctx, value, maxWidth);
  lines.slice(0, maxLines).forEach((line, i) => ctx.fillText(line, x, y + i * lineHeight));
  return Math.min(lines.length, maxLines) * lineHeight;
}

export function renderCarouselSlide(slide: CarouselSlide, theme: FunnelThemeId, brand = "THREADSWORKS"): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser does not support image export.");
  const colors = THEMES[theme];
  ctx.fillStyle = colors.bg;
  ctx.fillRect(0, 0, 1080, 1350);

  ctx.fillStyle = colors.accent;
  ctx.fillRect(84, 94, 78, 9);
  ctx.font = "bold 30px Arial, sans-serif";
  ctx.fillText(slide.eyebrow.toUpperCase().slice(0, 42), 84, 183);

  ctx.fillStyle = colors.fg;
  ctx.textBaseline = "top";
  let size = 83;
  let lines: string[] = [];
  do {
    ctx.font = "bold " + size + "px Arial, sans-serif";
    lines = wrapLines(ctx, slide.headline, 912);
    if (lines.length <= 6) break;
    size -= 4;
  } while (size > 42);
  const headlineHeight = drawWrapped(ctx, slide.headline, 84, 280, 912, size * 1.17, 6);

  ctx.fillStyle = colors.muted;
  ctx.font = "38px Arial, sans-serif";
  drawWrapped(ctx, slide.body, 84, Math.min(920, 310 + headlineHeight + 72), 900, 58, 5);

  ctx.strokeStyle = colors.accent;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(84, 1204);
  ctx.lineTo(996, 1204);
  ctx.stroke();

  ctx.fillStyle = colors.fg;
  ctx.font = "bold 25px Arial, sans-serif";
  ctx.fillText(brand.toUpperCase().slice(0, 48), 84, 1240);
  ctx.textAlign = "right";
  ctx.fillText(String(slide.slideNumber).padStart(2, "0") + " / 07", 996, 1240);
  return canvas;
}

export async function downloadSlidePng(slide: CarouselSlide, theme: FunnelThemeId, brand?: string) {
  const canvas = renderCarouselSlide(slide, theme, brand);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(value => value ? resolve(value) : reject(new Error("PNG export failed.")), "image/png"));
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "funnelworks-slide-" + String(slide.slideNumber).padStart(2, "0") + ".png";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
