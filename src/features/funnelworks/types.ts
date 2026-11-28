/**
 * FunnelWorks: product-generation contracts.
 * Additive types; existing post and savedPosts persistence remain unchanged.
 */
export type FunnelGoal = 'lead_magnet' | 'impulse_product';
export type FunnelThemeId = 'editorial_dark' | 'swiss_light' | 'terminal_contrast' | 'warm_creator';

export interface CarouselSlide {
  slideNumber: number;
  role: 'hook' | 'step' | 'cta';
  eyebrow: string;
  headline: string;
  body: string;
  highlightMetric?: string;
}

export interface PlaybookPage {
  pageNumber: 1 | 2;
  sectionTitle: string;
  summary: string;
  blocks: Array<{ heading: string; bullets: string[]; proTip?: string }>;
}

export interface StorefrontKit {
  productTitle: string;
  suggestedPrice: string;
  outcomeBullets: [string, string, string];
  checkoutDescription: string;
  orderBumpPitch: string;
  ctaKeyword: string;
}

export interface FunnelPackage {
  id: string;
  createdAt: string;
  sourceTopic: string;
  goal: FunnelGoal;
  theme: FunnelThemeId;
  creatorHandle: string;
  creatorBrand?: string;
  slides: CarouselSlide[];
  companionPosts: { threads: string; x: string; linkedin: string };
  playbook: {
    title: string;
    subtitle: string;
    pages: [PlaybookPage, PlaybookPage];
  };
  storefront: StorefrontKit;
}

export interface FunnelUsageState {
  freeLifetimeGenerations: number;
  // Pro generations are unlimited; server controls abuse and cost protection.
}
