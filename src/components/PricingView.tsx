import React, { useState, memo } from "react";
import { Sparkles, CheckCircle2, ShieldCheck, Loader2, Zap, RefreshCw, Check, AlertCircle } from "lucide-react";
import { redirectToStripeCheckout } from "../utils/stripeClient";
import { useGenerationUsage } from "../services/generationLimitService";
import { auth } from "../firebase";

interface PricingViewProps {
  subscriptionStatus: string;
}

const PricingView = memo(function PricingView({ subscriptionStatus }: PricingViewProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");

  const isActive = subscriptionStatus === "active";
  const { remaining, used, isLimitReached, displayMessage } = useGenerationUsage(
    auth.currentUser?.uid,
    subscriptionStatus,
    auth.currentUser?.email || undefined
  );

  const handleUpgradeClick = async () => {
    if (loading) return; // Prevent duplicate Checkout Session creation
    setLoading(true);
    setError(null);
    try {
      await redirectToStripeCheckout(billingCycle);
    } catch (err: any) {
      console.error("[PRICING_VIEW] Upgrade failed:", err);
      setError(err.message || "Failed to connect to Stripe. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const freeFeatures = [
    "150 AI content generations per month",
    "5 scheduled posts per day",
    "Direct 1 Click Meta Threads publishing",
    "Core Voice & DNA profile",
    "Full Content Library & Calendar access",
    "Standard generation speed",
  ];

  const proFeatures = [
    "Unlimited AI content generation",
    "Unlimited scheduled posts",
    "Surgical DNA Context Matching",
    "Cross-Thread Multi-Part Synthesizer",
    "Advanced Editorial Queue & Priority Scheduling",
    "High-converting Sales & Attention frameworks",
    "Direct developer support",
  ];

  return (
    <div className="space-y-8 py-2 animate-fade-in max-w-5xl mx-auto" id="pricing-view-container">
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto space-y-3">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-brand-surface px-3 py-1 text-xs font-semibold text-brand-text-strong border border-brand-border">
          <Zap className="h-3.5 w-3.5" /> Transparent Pricing
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-text-primary font-sans sm:text-4xl">
          Simple, Transparent <span className="bg-gradient-to-r from-purple-700 to-pink-700 dark:from-purple-400 dark:to-pink-500 bg-clip-text text-transparent">Creator Plans</span>
        </h1>
        <p className="text-sm text-text-secondary">
          Scale your business authority on Meta Threads. Generate unlimited content and automate your publishing queue.
        </p>
      </div>

      {/* Monthly / Yearly Toggle */}
      <div className="flex justify-center items-center gap-3">
        <button
          onClick={() => setBillingCycle("monthly")}
          className={`text-xs font-bold font-sans px-4 py-2 rounded-xl transition cursor-pointer ${
            billingCycle === "monthly" 
              ? "bg-purple-600 text-white shadow-sm" 
              : "text-text-muted hover:text-text-primary"
          }`}
        >
          Billed Monthly
        </button>
        
        {/* Toggle Switch */}
        <button
          type="button"
          onClick={() => setBillingCycle(billingCycle === "monthly" ? "yearly" : "monthly")}
          className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none bg-purple-600"
          aria-label="Toggle annual or monthly billing"
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
              billingCycle === "yearly" ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>

        <button
          onClick={() => setBillingCycle("yearly")}
          className={`text-xs font-bold font-sans px-4 py-2 rounded-xl transition cursor-pointer flex items-center gap-1.5 ${
            billingCycle === "yearly" 
              ? "bg-purple-600 text-white shadow-sm" 
              : "text-text-muted hover:text-text-primary"
          }`}
        >
          <span>Billed Annually</span>
          <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold border ${
            billingCycle === "yearly"
              ? "bg-white/20 text-white border-white/30"
              : "bg-pink-100 dark:bg-pink-500/15 text-pink-800 dark:text-pink-300 border-pink-300 dark:border-pink-500/25"
          }`}>
            Save 30%
          </span>
        </button>
      </div>

      {/* Plan Cards Grid */}
      <div className="grid md:grid-cols-2 gap-6 items-stretch max-w-4xl mx-auto">
        
        {/* Free Plan Card */}
        <div className="rounded-3xl border border-border-primary bg-bg-card p-7 shadow-xl flex flex-col justify-between space-y-6 relative" id="plan-card-free">
          <div className="space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-xl font-bold text-text-primary">Free</h3>
                <p className="text-xs text-text-secondary mt-1">Core creator tools for getting started</p>
              </div>
              {!isActive && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-500/10 px-3 py-1 text-xs font-semibold text-text-secondary border border-border-primary">
                  Current Plan
                </span>
              )}
            </div>

            {/* Price */}
            <div className="flex flex-col py-2 border-b border-border-primary gap-1">
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-extrabold text-text-primary tracking-tight">
                  $0
                </span>
                <span className="text-sm font-semibold text-text-muted">/ month</span>
              </div>
              <span className="text-[11px] text-text-muted">
                Free forever • No credit card required
              </span>
            </div>

            {/* Monthly Generation Usage Display for Free Plan */}
            {!isActive && (
              <div className={`p-3.5 rounded-2xl border ${isLimitReached ? "bg-status-danger-bg border-status-danger-border" : "bg-bg-app border-border-primary"} space-y-2`}>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-text-secondary flex items-center gap-1.5">
                    {isLimitReached ? <AlertCircle className="w-3.5 h-3.5 text-status-danger-text" /> : <Sparkles className="w-3.5 h-3.5 text-brand-text" />}
                    Monthly AI Allowance
                  </span>
                  <span className={`font-mono text-xs font-bold ${isLimitReached ? "text-status-danger-text" : "text-brand-text-strong"}`}>
                    {used}/150 used
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-bg-card overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${isLimitReached ? "bg-red-600 dark:bg-red-500" : "bg-purple-600"}`}
                    style={{ width: `${Math.min(100, (used / 150) * 100)}%` }}
                  />
                </div>
                <p className={`text-[11px] font-medium ${isLimitReached ? "text-status-danger-text font-semibold" : "text-text-muted"}`}>
                  {displayMessage}
                </p>
              </div>
            )}

            {/* Features checkmarks */}
            <div className="space-y-3 pt-2 text-left">
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-text-muted font-mono text-left">Plan Features</h4>
              <ul className="space-y-3 text-left">
                {freeFeatures.map((feature, index) => (
                  <li key={index} className="flex items-start gap-2.5 text-xs text-text-secondary text-left">
                    <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span className={`text-left flex-1 ${index < 2 ? "font-semibold text-text-primary" : ""}`}>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div>
            <div className="rounded-xl bg-bg-app border border-border-primary py-3 px-4 text-center text-xs font-semibold text-text-muted">
              Included with your account
            </div>
          </div>
        </div>

        {/* Pro Plan Card */}
        <div className="relative group rounded-3xl" id="plan-card-pro">
          <div className="absolute -inset-0.5 rounded-3xl bg-gradient-to-r from-purple-600 to-pink-600 opacity-30 blur-xl group-hover:opacity-40 transition duration-500"></div>
          
          <div className="relative h-full rounded-3xl border border-purple-500/30 bg-bg-card p-7 shadow-2xl backdrop-blur-xl flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              {/* Badge */}
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-xl font-bold text-text-primary">Pro</h3>
                  <p className="text-xs text-text-secondary mt-1">For serious digital entrepreneurs & strategists</p>
                </div>
                {isActive ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-status-success-bg px-3 py-1 text-xs font-semibold text-status-success-text border border-status-success-border">
                    <CheckCircle2 className="h-3 w-3" /> Active Plan
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-surface px-3 py-1 text-xs font-semibold text-brand-text-strong border border-brand-border">
                    Popular
                  </span>
                )}
              </div>

              {/* Pricing Row */}
              <div className="flex flex-col py-2 border-b border-border-primary gap-1">
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold text-text-primary tracking-tight">
                    {billingCycle === "yearly" ? "$59" : "$7"}
                  </span>
                  <span className="text-sm font-semibold text-text-muted">
                    {billingCycle === "yearly" ? "/ year" : "/ month"}
                  </span>
                </div>
                {billingCycle === "yearly" ? (
                  <span className="text-[11px] font-mono font-semibold text-pink-700 dark:text-pink-400">
                    Billed annually at $59/year (approx. $4.92/mo) — You save $25!
                  </span>
                ) : (
                  <span className="text-[11px] text-text-muted">
                    Billed monthly at $7/month
                  </span>
                )}
              </div>

              {/* Error Message Display */}
              {error && (
                <div className="rounded-xl bg-status-danger-bg border border-status-danger-border p-3 text-xs text-status-danger-text leading-relaxed font-mono">
                  ⚠️ {error}
                </div>
              )}

              {/* Features checkmarks */}
              <div className="space-y-3 pt-2 text-left">
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-text-muted font-mono text-left">Everything in Free, plus</h4>
                <ul className="space-y-3 text-left">
                  {proFeatures.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2.5 text-xs text-text-primary font-medium text-left">
                      <CheckCircle2 className="h-4 w-4 text-brand-text shrink-0 mt-0.5" />
                      <span className="text-left flex-1">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="space-y-3">
              {/* Upgrade / Manage Button */}
              <button
                id="pricing-upgrade-btn"
                disabled={loading}
                onClick={handleUpgradeClick}
                className={`w-full relative flex items-center justify-center gap-2 rounded-2xl py-3.5 px-4 text-sm font-bold transition-all duration-300 shadow-xl cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                  isActive 
                    ? "bg-bg-app text-text-primary hover:bg-bg-card-hover border border-border-primary" 
                    : "bg-purple-600 hover:bg-purple-500 text-white hover:shadow-purple-500/20"
                }`}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-white" />
                    <span>Redirecting to Secure Stripe Server...</span>
                  </>
                ) : isActive ? (
                  <>
                    <RefreshCw className="h-4 w-4 text-text-muted" />
                    <span>Manage Billing Portal</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    <span>
                      {billingCycle === "yearly" ? "Upgrade to Pro ($59/year)" : "Upgrade to Pro ($7/mo)"}
                    </span>
                  </>
                )}
              </button>

              {/* Security details */}
              <div className="flex items-center justify-center gap-1.5 text-[10px] text-text-muted font-mono">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400" /> Secure checkout powered by Stripe
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
});

export default PricingView;

