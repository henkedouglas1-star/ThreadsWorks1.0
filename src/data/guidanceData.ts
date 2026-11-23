import { ToolGuidanceResult, PresetDesireScenario } from "../types/guidance";

export const PRESET_DESIRES: PresetDesireScenario[] = [
  {
    id: "first-sale",
    desire: "I want to make my first sale.",
    category: "sales",
    shortLabel: "Make my first sale"
  },
  {
    id: "scale-sales",
    desire: "I have an existing product and some buyers, but sales have plateaued and conversion is inconsistent.",
    category: "sales",
    shortLabel: "Break past a sales plateau"
  },
  {
    id: "turn-knowledge-into-asset",
    desire: "I have deep expertise and ideas, and I want to package them into a high-value digital asset or product.",
    category: "creation",
    shortLabel: "Package knowledge into a product"
  },
  {
    id: "scroll-stopping-threads",
    desire: "I want to create magnetic content angles that stop the scroll and build high-authority engagement on Threads.",
    category: "audience",
    shortLabel: "Stop the scroll on Threads"
  },
  {
    id: "irresistible-offer",
    desire: "I need to construct a high-converting, irresistible offer with clear pricing and risk reversal.",
    category: "sales",
    shortLabel: "Build an irresistible offer"
  },
  {
    id: "recurring-income",
    desire: "I want to stop relying on sporadic one-off launches and build predictable monthly recurring revenue.",
    category: "systems",
    shortLabel: "Build recurring revenue"
  },
  {
    id: "first-1000-followers",
    desire: "I want to gain my first 1,000 targeted followers and build an authentic creator audience from scratch.",
    category: "audience",
    shortLabel: "Grow first 1,000 followers"
  },
  {
    id: "close-dm-conversations",
    desire: "I get DMs and inquiries, but I struggle to turn casual chats into closed paying clients without feeling pushy.",
    category: "sales",
    shortLabel: "Convert conversations to sales"
  }
];

export const HEURISTIC_GUIDANCE_MAP: Record<string, ToolGuidanceResult> = {
  "first-sale": {
    understoodDesire: "You want to cross the zero-to-one threshold and secure your very first paying customer.",
    identifiedProblem: "You have an idea or early product, but no validated buyer mechanism or high-urgency reason for someone to buy right now.",
    strategicGuidance: "Your immediate problem isn't creating more content or building complex funnels. You need to validate what's preventing your offer from converting and close one real buyer.",
    recommendedToolId: "first-sale-ai",
    recommendedToolName: "First Sale AI",
    whyThisTool: "First Sale AI is built specifically to break through the zero-to-one barrier. It validates simple offers, pinpoints eager early adopters, and constructs the direct path to your first transaction.",
    expectedResult: "A crystal-clear validation roadmap and direct outreach strategy to secure your first paying customer in days, not months.",
    nextStepToolId: "how-to-get-your-first-1-000-followers",
    nextStepToolName: "How To Get Your First 1,000 Followers",
    nextStepReason: "Once your first sale validates the offer, your next step is scaling targeted organic distribution to reach consistent daily buyers.",
    productUrl: "https://contentpaysyou.com/products/first-sale-ai",
    nextProductUrl: "https://contentpaysyou.com/products/how-to-get-your-first-1-000-followers"
  },
  "scale-sales": {
    understoodDesire: "You want to increase total revenue, stabilize cashflow, and identify why your existing funnel isn't converting consistently.",
    identifiedProblem: "Revenue bottlenecks are hiding inside offer positioning, weak conversion levers, or lack of urgency in the buyer journey.",
    strategicGuidance: "Do not guess where the leak is. Pinpoint the exact constraint in your positioning or checkout friction that causes qualified leads to hesitate.",
    recommendedToolId: "more-sales-ai",
    recommendedToolName: "More Sales AI",
    whyThisTool: "More Sales AI surgically diagnoses conversion leaks across your offer, copy, and buyer psychology to unlock rapid revenue gains.",
    expectedResult: "A comprehensive bottleneck diagnosis and high-leverage optimization plan to lift overall conversion rates.",
    nextStepToolId: "repeat-revenue-ai",
    nextStepToolName: "Repeat Revenue AI",
    nextStepReason: "After fixing front-end conversion leaks, engineer continuity and retention engines so every customer compounds into monthly recurring revenue.",
    productUrl: "https://contentpaysyou.com/products/next-sale-ai",
    nextProductUrl: "https://contentpaysyou.com/products/repeat-revenue-ai"
  },
  "turn-knowledge-into-asset": {
    understoodDesire: "You want to turn your personal expertise, insights, or skill set into a standalone digital asset that generates income independently.",
    identifiedProblem: "Knowledge is unstructured and trapped inside your head, making it difficult to price, package, and deliver systematically.",
    strategicGuidance: "Shift from trading hours for dollars to distilling your core frameworks into a modular, premium digital asset.",
    recommendedToolId: "digital-asset-creator-ai",
    recommendedToolName: "Digital Asset Creator AI",
    whyThisTool: "Digital Asset Creator AI transforms raw insights and unstructured experience into high-value guides, toolkits, and structured digital products ready for sale.",
    expectedResult: "A complete curriculum, asset outline, and packaging architecture for a high-converting digital product.",
    nextStepToolId: "offer-builder-ai",
    nextStepToolName: "Offer Builder AI",
    nextStepReason: "Once your digital asset is structured, package it inside an irresistible offer stack with bonuses, guarantees, and clear pricing.",
    productUrl: "https://contentpaysyou.com/products/digital-asset-creator-ai",
    nextProductUrl: "https://contentpaysyou.com/products/offer-builder-ai"
  },
  "scroll-stopping-threads": {
    understoodDesire: "You want your content to cut through the feed noise, capture high attention, and establish immediate authority on Meta Threads.",
    identifiedProblem: "Generic content angles and predictable formats get scrolled past because they lack pattern interrupts and sharp contrast.",
    strategicGuidance: "You don't need 100 new topics—you need distinct, contrarian, and high-resonance angles on the proven ideas you already have.",
    recommendedToolId: "content-angle-ai",
    recommendedToolName: "Content Angle AI",
    whyThisTool: "Content Angle AI multiplies single concepts into high-converting unique perspectives, contrarian hooks, and scroll-stopping frames designed for rapid algorithmic engagement.",
    expectedResult: "A stream of non-obvious, highly shareable content angles that position you as an undisputed authority.",
    nextStepToolId: "threads-post-writer",
    nextStepToolName: "Threads Post Writer",
    nextStepReason: "Once you have your sharp angles, format them into publication-ready single posts and multi-part threads optimized for the Meta Threads algorithm.",
    productUrl: "https://contentpaysyou.com/products/content-angle-ai",
    nextProductUrl: "https://contentpaysyou.com"
  },
  "irresistible-offer": {
    understoodDesire: "You want an offer so compelling and crystal-clear that ideal prospects feel foolish saying no.",
    identifiedProblem: "The offer value proposition is vague, lacks risk reversal, or doesn't clearly articulate the transformation compared to the price.",
    strategicGuidance: "Great products fail with weak packaging. Clarify the core promise, stack strategic bonuses, and eliminate buyer risk.",
    recommendedToolId: "offer-builder-ai",
    recommendedToolName: "Offer Builder AI",
    whyThisTool: "Offer Builder AI engineers high-ticket and self-liquidating offer stacks, structuring the exact pricing logic, bonuses, and guarantees needed to maximize conversion.",
    expectedResult: "A complete, high-converting offer blueprint with bulletproof value positioning and risk reversal.",
    nextStepToolId: "sales-page-ai",
    nextStepToolName: "Sales Page AI",
    nextStepReason: "With an irresistible offer constructed, translate your offer stack into a high-converting sales page or landing page.",
    productUrl: "https://contentpaysyou.com/products/offer-builder-ai",
    nextProductUrl: "https://contentpaysyou.com"
  }
};
