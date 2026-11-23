import { test } from "node:test";
import { strict as assert } from "node:assert";
import { validateFunnelPackage } from "../server/funnelworksValidation";

function validPackage() {
  return {
    slides: Array.from({ length: 7 }, (_, i) => ({
      slideNumber: i + 1,
      role: i === 0 ? "hook" : i === 6 ? "cta" : "step",
      eyebrow: "Step",
      headline: "Build a useful product",
      body: "Start with a specific buyer outcome."
    })),
    playbook: {
      title: "Product Playbook",
      subtitle: "A practical guide",
      pages: [1, 2].map(pageNumber => ({
        pageNumber, sectionTitle: "Get started", summary: "A clear plan.",
        blocks: [{ heading: "Checklist", bullets: ["Pick an audience", "Define the outcome"] }]
      }))
    },
    companionPosts: { threads: "Start with the buyer.", x: "One buyer, one result.", linkedin: "A practical way to launch." },
    storefront: {
      productTitle: "Product Playbook", suggestedPrice: "$19",
      outcomeBullets: ["Define an outcome", "Create the guide", "Launch it"],
      checkoutDescription: "A practical product guide.",
      orderBumpPitch: "Add a checklist.", ctaKeyword: "GUIDE"
    }
  };
}

test("accepts a complete FunnelWorks package", () => {
  assert.equal(validateFunnelPackage(validPackage()), true);
});

test("rejects incomplete slide collections and wrong slide order", () => {
  const p = validPackage();
  p.slides.pop();
  assert.equal(validateFunnelPackage(p), false);
  const q = validPackage();
  q.slides[0].slideNumber = 2;
  assert.equal(validateFunnelPackage(q), false);
});

test("rejects incorrect playbook page count", () => {
  const p = validPackage();
  p.playbook.pages.pop();
  assert.equal(validateFunnelPackage(p), false);
});

test("rejects overlength social posts and missing storefront data", () => {
  const p = validPackage();
  p.companionPosts.x = "x".repeat(281);
  assert.equal(validateFunnelPackage(p), false);
  const q = validPackage();
  q.storefront.outcomeBullets.pop();
  assert.equal(validateFunnelPackage(q), false);
});
