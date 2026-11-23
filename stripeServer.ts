import Stripe from "stripe";

let stripeInstance: Stripe | null = null;

/**
 * Returns the lazily-initialized Stripe instance.
 * Throws a clear error if STRIPE_SECRET_KEY is not defined.
 */
export function getStripe(): Stripe {
  if (!stripeInstance) {
    const apiKey = process.env.STRIPE_SECRET_KEY;
    if (!apiKey) {
      throw new Error("STRIPE_SECRET_KEY environment variable is missing. Please define it in your secrets.");
    }
    
    stripeInstance = new Stripe(apiKey, {
      typescript: true,
    });
    
    console.log("[STRIPE] Stripe server SDK initialized successfully.");
  }
  return stripeInstance;
}
