import React, { useState } from "react";
import { Sparkles, ArrowRight, ShieldCheck, Zap, DollarSign, CheckCircle2, TrendingUp, Users, RefreshCw, Loader2 } from "lucide-react";
import { PartnerProfile } from "../../types/partner";
import { joinPartnerProgram } from "../../services/partnerService";

interface PartnerActivationScreenProps {
  onPartnerCreated: (partner: PartnerProfile) => void;
  userEmail?: string;
}

export default function PartnerActivationScreen({ onPartnerCreated, userEmail }: PartnerActivationScreenProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [referralCount, setReferralCount] = useState(25);

  const estimatedMonthly = (referralCount * 3.50).toFixed(2);
  const estimatedAnnual = (referralCount * 3.50 * 12).toFixed(2);

  const handleJoin = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const partner = await joinPartnerProgram();
      onPartnerCreated(partner);
    } catch (err: any) {
      console.error("[PARTNER_JOIN] Error:", err);
      setError(err.message || "Failed to activate partner account. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto py-4 sm:py-8 px-4 space-y-10 animate-fade-in" id="partner-activation-container">
      {/* Hero Banner */}
      <div className="text-center max-w-3xl mx-auto space-y-4">
        <div className="inline-flex items-center gap-2 rounded-full bg-purple-500/10 px-4 py-1.5 text-xs font-semibold text-purple-600 dark:text-purple-400 border border-purple-500/20">
          <Zap className="h-3.5 w-3.5" /> Self-Serve Affiliate Program
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-text-primary font-sans leading-tight">
          Earn <span className="bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">50% Recurring Commission</span> on Every Referral
        </h1>
        <p className="text-base sm:text-lg text-text-secondary max-w-2xl mx-auto">
          Help creators, coaches, and entrepreneurs scale on Meta Threads with ThreadsWorks ($7/mo) and earn <strong className="text-text-primary">$3.50 every single month</strong> for as long as your referral remains a paying subscriber.
        </p>

        {/* Primary CTA */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            id="partner-join-btn"
            onClick={handleJoin}
            disabled={loading}
            className="w-full sm:w-auto px-8 py-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-base shadow-lg shadow-purple-600/25 flex items-center justify-center gap-3 transition-all hover:scale-[1.02] cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Activating Your Partner Account...</span>
              </>
            ) : (
              <>
                <span>Join Partner Program</span>
                <ArrowRight className="h-5 w-5" />
              </>
            )}
          </button>
        </div>
        <p className="text-xs text-text-muted">
          Instant activation • No application queue • Instant unique referral link
        </p>
        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-xs max-w-md mx-auto">
            {error}
          </div>
        )}
      </div>

      {/* Interactive Recurring Earnings Calculator */}
      <div className="rounded-2xl border border-border-primary bg-bg-card p-6 sm:p-8 shadow-sm">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="text-center space-y-1">
            <h2 className="text-lg font-bold text-text-primary font-sans flex items-center justify-center gap-2">
              <TrendingUp className="h-5 w-5 text-purple-500" />
              Calculate Your 50% Recurring Revenue
            </h2>
            <p className="text-xs text-text-muted">
              Based on ThreadsWorks standard $7/month creator subscription (50% commission = $3.50/mo per active user)
            </p>
          </div>

          {/* Slider */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-sm font-semibold text-text-primary">
              <span>Active Paying Referrals:</span>
              <span className="text-lg font-bold text-purple-600 dark:text-purple-400 font-mono">
                {referralCount} creators
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="500"
              step="1"
              value={referralCount}
              onChange={(e) => setReferralCount(Number(e.target.value))}
              className="w-full accent-purple-600 cursor-pointer h-2 bg-border-primary rounded-lg appearance-none"
            />
            <div className="flex justify-between text-[11px] text-text-muted font-mono">
              <span>1</span>
              <span>50</span>
              <span>100</span>
              <span>250</span>
              <span>500+</span>
            </div>
          </div>

          {/* Output Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="p-4 rounded-xl border border-purple-500/20 bg-purple-500/5 text-center space-y-1">
              <span className="text-xs uppercase tracking-wider text-purple-600 dark:text-purple-400 font-bold font-mono">
                Monthly Recurring Commission
              </span>
              <div className="text-3xl font-extrabold text-text-primary font-mono">
                ${estimatedMonthly} <span className="text-sm font-normal text-text-muted">/ month</span>
              </div>
              <p className="text-[11px] text-text-muted">Paid monthly as subscribers renew</p>
            </div>

            <div className="p-4 rounded-xl border border-pink-500/20 bg-pink-500/5 text-center space-y-1">
              <span className="text-xs uppercase tracking-wider text-pink-600 dark:text-pink-400 font-bold font-mono">
                Annual Recurring Run-Rate
              </span>
              <div className="text-3xl font-extrabold text-text-primary font-mono">
                ${estimatedAnnual} <span className="text-sm font-normal text-text-muted">/ year</span>
              </div>
              <p className="text-[11px] text-text-muted">Compounding as you refer more creators</p>
            </div>
          </div>
        </div>
      </div>

      {/* Program Core Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 rounded-2xl border border-border-primary bg-bg-card space-y-3">
          <div className="h-10 w-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
            50%
          </div>
          <h3 className="font-bold text-text-primary text-base">50% Recurring for Life</h3>
          <p className="text-xs text-text-secondary leading-relaxed">
            Earn 50% on every recurring monthly ($7/mo) or annual renewal generated by your referral. When they renew, you earn again.
          </p>
        </div>

        <div className="p-6 rounded-2xl border border-border-primary bg-bg-card space-y-3">
          <div className="h-10 w-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <h3 className="font-bold text-text-primary text-base">60-Day Cookie & Account Binding</h3>
          <p className="text-xs text-text-secondary leading-relaxed">
            Generous 60-day attribution window plus permanent customer account binding upon registration so you never lose credit.
          </p>
        </div>

        <div className="p-6 rounded-2xl border border-border-primary bg-bg-card space-y-3">
          <div className="h-10 w-10 rounded-xl bg-pink-500/10 text-pink-600 dark:text-pink-400 flex items-center justify-center">
            <Sparkles className="h-5 w-5" />
          </div>
          <h3 className="font-bold text-text-primary text-base">Built-in AI Promo Assistant</h3>
          <p className="text-xs text-text-secondary leading-relaxed">
            Generate authentic, scroll-stopping Threads promotional posts and hooks calibrated with verified product facts with 1 click.
          </p>
        </div>
      </div>

      {/* How it works simple 4-step workflow */}
      <div className="rounded-2xl border border-border-primary bg-bg-card p-6 sm:p-8 space-y-6">
        <h2 className="text-lg font-bold text-text-primary text-center">How The Partner Program Works</h2>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="space-y-2 text-center sm:text-left">
            <div className="h-8 w-8 rounded-full bg-purple-600 text-white font-bold text-xs flex items-center justify-center mx-auto sm:mx-0">1</div>
            <h4 className="font-bold text-sm text-text-primary">Get Your Link</h4>
            <p className="text-xs text-text-muted">Click join to get your unique ThreadsWorks referral URL instantly.</p>
          </div>
          <div className="space-y-2 text-center sm:text-left">
            <div className="h-8 w-8 rounded-full bg-purple-600 text-white font-bold text-xs flex items-center justify-center mx-auto sm:mx-0">2</div>
            <h4 className="font-bold text-sm text-text-primary">Share on Threads</h4>
            <p className="text-xs text-text-muted">Use our AI promotional angles and templates to share your link with creators.</p>
          </div>
          <div className="space-y-2 text-center sm:text-left">
            <div className="h-8 w-8 rounded-full bg-purple-600 text-white font-bold text-xs flex items-center justify-center mx-auto sm:mx-0">3</div>
            <h4 className="font-bold text-sm text-text-primary">Customer Subscribes</h4>
            <p className="text-xs text-text-muted">When a creator joins ThreadsWorks ($7/mo), you automatically receive a $3.50 commission.</p>
          </div>
          <div className="space-y-2 text-center sm:text-left">
            <div className="h-8 w-8 rounded-full bg-purple-600 text-white font-bold text-xs flex items-center justify-center mx-auto sm:mx-0">4</div>
            <h4 className="font-bold text-sm text-text-primary">Earn Month After Month</h4>
            <p className="text-xs text-text-muted">As long as the subscriber stays active, you earn 50% on every renewal. Payouts via PayPal / Wise.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
