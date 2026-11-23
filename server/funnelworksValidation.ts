/** Strict validation of AI output before a generation can consume its free entitlement. */
export function validateFunnelPackage(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const p = value as Record<string, any>;
  const text = (v: unknown, max = 4000) => typeof v === "string" && v.trim().length > 0 && v.length <= max;
  if (!Array.isArray(p.slides) || p.slides.length !== 7) return false;
  for (let i = 0; i < 7; i++) {
    const slide = p.slides[i];
    if (!slide || slide.slideNumber !== i + 1 ||
        slide.role !== (i === 0 ? "hook" : i === 6 ? "cta" : "step") ||
        !text(slide.eyebrow, 100) || !text(slide.headline, 180) || !text(slide.body, 600)) return false;
  }
  if (!p.playbook || !text(p.playbook.title, 180) || !text(p.playbook.subtitle, 300) ||
      !Array.isArray(p.playbook.pages) || p.playbook.pages.length !== 2) return false;
  for (let i = 0; i < 2; i++) {
    const page = p.playbook.pages[i];
    if (!page || page.pageNumber !== i + 1 || !text(page.sectionTitle, 180) ||
        !text(page.summary, 1000) || !Array.isArray(page.blocks) || page.blocks.length < 1 ||
        page.blocks.length > 8 || !page.blocks.every((b: any) =>
          text(b?.heading, 180) && Array.isArray(b?.bullets) && b.bullets.length > 0 &&
          b.bullets.length <= 10 && b.bullets.every((v: unknown) => text(v, 600)))) return false;
  }
  const posts = p.companionPosts;
  if (!posts || !text(posts.threads, 500) || !text(posts.x, 280) || !text(posts.linkedin, 3000)) return false;
  const store = p.storefront;
  return !!store && text(store.productTitle, 180) && text(store.suggestedPrice, 40) &&
    Array.isArray(store.outcomeBullets) && store.outcomeBullets.length === 3 &&
    store.outcomeBullets.every((v: unknown) => text(v, 300)) &&
    text(store.checkoutDescription, 2000) && text(store.orderBumpPitch, 500) && text(store.ctaKeyword, 80);
}
