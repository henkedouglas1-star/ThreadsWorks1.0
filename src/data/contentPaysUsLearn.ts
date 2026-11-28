export interface LearnTopic {
  id: string;
  title: string;
  stage: string;
  summary: string;
  keyPrinciples: string[];
  practicalApplication: string;
}

export const LEARN_TOPICS: LearnTopic[] = [
  {
    id: "brand-development",
    title: "1. Brand Development",
    stage: "Foundation",
    summary: "Define your core expertise, unique perspective, and target audience so your work is instantly recognizable and trusted.",
    keyPrinciples: [
      "Clarity over cleverness: State what you do and who you help without jargon.",
      "Root in genuine experience: Build your authority on what you have actually practiced and tested.",
      "Consistent positioning: Align your visual identity, tone, and topics around a singular core message."
    ],
    practicalApplication: "Use CreatorWorks to map your core expertise and audience pillars before writing your first piece of public content."
  },
  {
    id: "buyer-demand",
    title: "2. Buyer Demand",
    stage: "Foundation",
    summary: "Discover and validate real problems your audience is actively trying to solve before investing weeks in building solutions.",
    keyPrinciples: [
      "Listen before building: Analyze audience questions, common frustrations, and recurring search queries.",
      "Focus on urgent friction: Prioritize problems that cause friction, wasted time, or financial loss.",
      "Validate with conversation: Test your assumptions by talking directly with prospective community members."
    ],
    practicalApplication: "Use DemandWorks to collect audience questions and confirm genuine market demand before shaping offers."
  },
  {
    id: "content-creation",
    title: "3. Content Creation",
    stage: "Attention",
    summary: "Develop structured content systems that turn everyday observations and lessons into engaging, readable posts.",
    keyPrinciples: [
      "Structure drives retention: Combine strong opening hooks with clear, scannable body points.",
      "Rotate perspectives: Vary your writing angles—from tactical walkthroughs to counterexamples—to stay fresh.",
      "Respect platform constraints: Format your writing for mobile reading limits and natural pacing."
    ],
    practicalApplication: "Use ThreadsWorks and ContentWorks to draft structured posts, test opening hooks, and maintain an active editorial calendar."
  },
  {
    id: "audience-relationships",
    title: "4. Audience Relationships",
    stage: "Attention",
    summary: "Build genuine community through two-way conversation rather than treating social media as a broadcast megaphone.",
    keyPrinciples: [
      "Engage authentically: Respond thoughtfully to comments and questions to foster trust.",
      "Create safe spaces: Encourage constructive dialogue and peer-to-peer discussion.",
      "Cultivate advocates: Turn casual readers into active community champions by acknowledging their contributions."
    ],
    practicalApplication: "Use CommunityWorks to manage conversations and nurture long-term relationships with your most engaged followers."
  },
  {
    id: "offer-creation",
    title: "5. Offer Creation",
    stage: "Monetization",
    summary: "Translate your intangible knowledge into structured, high-value commercial offers that solve specific problems.",
    keyPrinciples: [
      "Outcome-focused scoping: Design your offer around the specific result the buyer achieves, not just the number of deliverables.",
      "Transparent pricing: Price your offers fairly based on the tangible value and time saved for the customer.",
      "Clear transformation promise: Articulate the 'before' state and the 'after' state with crystal clarity."
    ],
    practicalApplication: "Use OfferWorks to outline your core expertise into a structured digital product, workshop, or advisory service."
  },
  {
    id: "digital-products",
    title: "6. Digital Products",
    stage: "Monetization",
    summary: "Package your knowledge into downloadable digital assets like PDF playbooks, templates, and guides behind your offers.",
    keyPrinciples: [
      "Actionable formats: Deliver practical templates and step-by-step guides that buyers can put to work immediately.",
      "Professional presentation: Ensure your digital assets look polished, clean, and easy to navigate.",
      "Automated packaging: Connect your core ideas directly to downloadable files and promotional copy."
    ],
    practicalApplication: "Use ProductWorks to instantly generate professional PDF playbooks, carousels, and sales copy from a single idea."
  },
  {
    id: "customer-acquisition",
    title: "7. Customer Acquisition",
    stage: "Monetization",
    summary: "Design seamless conversion paths that connect educational content to clear offers and transactions without high-pressure tactics.",
    keyPrinciples: [
      "Frictionless pathways: Make the transition from reading free content to exploring paid offers natural and transparent.",
      "Educational marketing: Teach valuable insights upfront so buyers feel confident in your expertise.",
      "Clear calls to action: Tell interested readers exactly what step to take next."
    ],
    practicalApplication: "Use FunnelWorks and SalesWorks to map customer journeys and craft transparent, persuasive sales pages."
  },
  {
    id: "customer-delivery",
    title: "8. Customer Delivery",
    stage: "Customer Success",
    summary: "Ensure smooth onboarding and exceptional fulfillment so every customer achieves their desired outcome and succeeds.",
    keyPrinciples: [
      "Proactive onboarding: Welcome new buyers instantly and guide them to their first quick win.",
      "Reliable fulfillment: Deliver promised assets and educational materials without friction.",
      "Feedback loops: Gather customer insights to continuously improve your products and experience."
    ],
    practicalApplication: "Use DeliveryWorks and ProofWorks to streamline onboarding, manage fulfillment, and collect authentic success evidence."
  },
  {
    id: "sustainablegrowth",
    title: "9. Sustainable Growth",
    stage: "Expansion",
    summary: "Analyze performance data, amplify what works through organic or paid distribution, and scale your business sustainably.",
    keyPrinciples: [
      "Data-backed decisions: Review engagement and sales analytics to double down on winning strategies.",
      "Leverage partnerships: Collaborate with peers and build affiliate networks to expand your reach organically.",
      "Systems over hustle: Build repeatable operational workflows so growth compounds without burnout."
    ],
    practicalApplication: "Use GrowthWorks, AdsWorks, and AffiliateWorks to track performance, scale distribution, and expand your creator ecosystem."
  }
];
