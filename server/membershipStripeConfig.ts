// Public Stripe object identifiers supplied by the account owner.
// These are not API keys or secrets. Verify against Stripe before checkout.
export const MEMBERSHIP_STRIPE_IDS = {
  contentpaysclub: {
    priceId: "price_1UgkNQK7Obw8ICyaGjM9Gz6S",
    paymentLinkId: "plink_1UgkSKK7Obw8ICyaXm3IYkjf",
  },
  contentpaysbundle: {
    productId: "prod_ViAjBFyVK5g8Rl",
    priceId: "price_1UgkO5K7Obw8ICyaajSKqsvp",
    paymentLinkId: "plink_1UgkRcK7Obw8ICyaUwN4ON4o",
  },
} as const;
