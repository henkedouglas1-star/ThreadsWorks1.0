import { auth } from "../firebase";

/**
 * Initiates a Stripe Checkout Session or Customer Portal redirect.
 * Retrieves the current user's ID token, calls the backend endpoint,
 * and redirects the browser to the returned session URL.
 */
export async function redirectToStripeCheckout(billingCycle: "monthly" | "yearly" = "monthly"): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("You must be logged in to subscribe to Premium.");
  }

  // Retrieve the Firebase Auth ID Token
  const idToken = await currentUser.getIdToken(true);

  // Retrieve stored partner referral code if present
  let referralCode: string | null = null;
  try {
    referralCode = localStorage.getItem("threadsworks_partner_ref") || sessionStorage.getItem("threadsworks_partner_ref") || null;
  } catch (e) {
    // Ignore storage access issues
  }

  const response = await fetch("/api/stripe/create-checkout-session", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${idToken}`,
    },
    body: JSON.stringify({ billingCycle, referralCode: referralCode || undefined }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Failed to initiate Stripe session. Please try again later.");
  }

  if (data.url) {
    // Redirect the browser to Stripe Checkout or Billing Portal
    window.location.href = data.url;
  } else {
    throw new Error("Stripe did not return a valid redirect URL.");
  }
}
