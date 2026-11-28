import { CONTENT_PAYS_US_APPS } from "./contentPaysUsRegistry";

export type MembershipPlan = {
  id: string;
  name: string;
  monthlyCents: number | null;
  includes: readonly string[];
  value: string;
  checkout: "existing" | "gated" | "free";
  paymentLink?: string;
};

export const MEMBERSHIP_PLANS: readonly MembershipPlan[] = [
  { id: "free", name: "Free", monthlyCents: 0, includes: [], value: "Explore creator tools and start learning without a subscription.", checkout: "free" },
  { id: "threadsworks-pro", name: "ThreadsWorks Pro", monthlyCents: 700, includes: ["threadsworks"], value: "Create unlimited posts and build a consistent Threads publishing workflow.", checkout: "existing" },
  { id: "contentpaysclub", name: "ContentPaysClub", monthlyCents: 2900, paymentLink: "https://buy.stripe.com/9B6eVe8Rc3wt3mx8yecEw01", includes: ["club"], value: "Learn through weekly practical business courses and apply that knowledge to your own creator business.", checkout: "gated" },
  { id: "contentpaysbundle", name: "ContentPaysBundle", monthlyCents: 10000, paymentLink: "https://buy.stripe.com/28E5kE3wS8QN6yJ4hYcEw00", includes: ["club", ...CONTENT_PAYS_US_APPS.map(app => app.id)], value: "Use one connected workspace to develop knowledge, create products, attract customers and grow your business.", checkout: "gated" },
  ...CONTENT_PAYS_US_APPS.filter(app => app.id !== "threadsworks").map(app => ({
    id: "app-" + app.id, name: app.name, monthlyCents: null, includes: [app.id],
    value: app.problemSolved, checkout: "gated" as const
  }))
];

// These commercial terms are approved targets, not active payment capabilities.
export const CREATOR_SALE_PLATFORM_FEE_PERCENT = 5;
export const QUALIFYING_SUBSCRIPTION_AFFILIATE_PERCENT = 50;

// Pure entitlement resolution for verified server-side subscription records.
// Never infer paid access from an email, a client request or an unknown Stripe price.
export function resolveMembershipAccess(planIds: readonly string[]): string[] {
  const access = new Set<string>();
  for (const plan of MEMBERSHIP_PLANS) {
    if (plan.monthlyCents !== null && plan.monthlyCents > 0 && planIds.includes(plan.id)) {
      for (const item of plan.includes) access.add(item);
    }
  }
  return Array.from(access).sort();
}
