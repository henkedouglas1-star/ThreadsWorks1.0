import type { ImageAspectRatio } from "../src/types/aiImage";

export interface ImagePromptContext {
  postText: string;
  parts?: string[];
  topic?: string;
  pillarTitle?: string;
  tone?: string;
  audience?: string;
  brandStyle?: string;
  brandColors?: string[];
  visualDirection?: string;
  aspectRatio?: ImageAspectRatio;
}

export interface BuiltImagePrompt {
  prompt: string;
  altText: string;
  aspectRatio: ImageAspectRatio;
  promptSummary: string;
}

const ALLOWED_ASPECT_RATIOS = new Set<ImageAspectRatio>(["1:1", "3:4", "4:3"]);

function cleanText(input: string | undefined | null, maxLen: number): string {
  if (!input) return "";
  return String(input)
    .replace(/\s+/g, " ")
    .replace(/[<>]/g, "")
    .trim()
    .slice(0, maxLen);
}

/**
 * Extracts a concise core theme from a completed Threads post without repeating
 * the raw post copy verbatim onto the image.
 */
function summarizeCoreMessage(postText: string, parts?: string[]): string {
  const combined =
    Array.isArray(parts) && parts.length > 0
      ? parts.map((p) => cleanText(p, 500)).filter(Boolean).join(" ")
      : cleanText(postText, 1200);

  if (!combined) return "a clear creator insight";

  // Take first 2 sentences / ~280 chars as the conceptual core
  const sentences = combined
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const lead = sentences.slice(0, 2).join(" ");
  return cleanText(lead || combined, 280);
}

/**
 * Builds a high-craft, contextual, Threads-friendly visual generation prompt
 * that complements the completed post rather than repeating its text.
 */
export function buildContextualImagePrompt(
  ctx: ImagePromptContext
): BuiltImagePrompt {
  const aspectRatio: ImageAspectRatio =
    ctx.aspectRatio && ALLOWED_ASPECT_RATIOS.has(ctx.aspectRatio)
      ? ctx.aspectRatio
      : "1:1";

  const coreMessage = summarizeCoreMessage(ctx.postText, ctx.parts);
  const topic = cleanText(ctx.topic, 100);
  const pillar = cleanText(ctx.pillarTitle, 100);
  const audience = cleanText(ctx.audience, 140);
  const tone = cleanText(ctx.tone, 80) || "authoritative, clear, encouraging";
  const brandStyle =
    cleanText(ctx.brandStyle, 140) ||
    "modern editorial photography or refined minimalist conceptual illustration";
  const brandColors = Array.isArray(ctx.brandColors)
    ? ctx.brandColors
        .map((c) => cleanText(c, 32))
        .filter(Boolean)
        .slice(0, 4)
    : [];
  const visualDirection = cleanText(ctx.visualDirection, 220);

  const lines: string[] = [
    `Create a single clean, high-clarity visual designed to accompany a Meta Threads post (${aspectRatio} framing, centered focal composition that reads clearly on mobile feeds).`,
    `Core concept to visually complement (represent the idea visually, do NOT copy or render the post text inside the image): "${coreMessage}".`,
  ];

  if (topic || pillar) {
    lines.push(
      `Subject focus: ${[topic, pillar].filter(Boolean).join(" — ")}.`
    );
  }
  if (audience) {
    lines.push(`Intended audience resonance: ${audience}.`);
  }
  lines.push(`Mood and tone: ${tone}.`);
  lines.push(`Visual aesthetic: ${brandStyle}.`);

  if (brandColors.length > 0) {
    lines.push(
      `Subtle color palette guidance: harmonize with ${brandColors.join(", ")} using balanced natural contrast.`
    );
  }

  if (visualDirection) {
    lines.push(`Additional creative direction from creator: ${visualDirection}.`);
  }

  lines.push(
    "Strict composition and integrity guardrails:",
    "- Complement the message through visual metaphor, atmosphere, or authentic editorial scene rather than repeating sentences from the post.",
    "- Zero embedded text, zero captions, zero watermarks, zero logos.",
    "- Never generate fake testimonials, fabricated analytics screenshots, fake social media UI cards, fake revenue charts, or misleading/unsupported claims.",
    "- Keep lighting crisp, natural, and distraction-free with strong focal clarity at mobile feed scale."
  );

  const altSubject = topic || pillar || "the Threads post";
  const altText = cleanText(
    `Editorial visual illustration complementing a Threads post about ${altSubject}.`,
    200
  );

  const promptSummary = cleanText(
    `${topic || pillar || "Post visual"} (${aspectRatio}, ${tone})`,
    140
  );

  return {
    prompt: lines.join("\n"),
    altText,
    aspectRatio,
    promptSummary,
  };
}
