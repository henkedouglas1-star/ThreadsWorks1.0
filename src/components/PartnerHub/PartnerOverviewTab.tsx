import React, { useState } from "react";
import {
  Copy,
  Check,
  Zap,
  TrendingUp,
  DollarSign,
  Users,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  ExternalLink,
  Clock,
  CheckCircle2,
  Wallet
} from "lucide-react";
import { PartnerProfile, PartnerPerformanceMetrics } from "../../types/partner";

interface PartnerOverviewTabProps {
  partner: PartnerProfile;
  metrics: PartnerPerformanceMetrics | null;
  onNavigateTab: (tabId: string) => void;
}

export default function PartnerOverviewTab({ partner, metrics, onNavigateTab }: PartnerOverviewTabProps) {
  const [copied, setCopied] = useState(false);

  const referralUrl = partner.referralUrl || `https://threadsworks.com/?ref=${partner.referralCode}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(referralUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const activeReferrals = partner.activeCustomers || 0;
  const estimatedMRR = partner.monthlyRecurringCommission || Number((activeReferrals * 3.50).toFixed(2));
  const totalEarned = partner.totalEarned || 0;
  const payableBalance = partner.payableBalance || 0;
  const pendingBalance = partner.pendingBalance || 0;
  const paidBalance = partner.paidBalance || 0;

  return (
    <div className="space-y-6 animate-fade-in" id="partner-overview-tab">
      {/* Commission Rate & Referral Link Centerpiece */}
      <div className="rounded-2xl border border-purple-500/20 bg-gradient-to-br from-purple-500/10 via-bg-card to-pink-500/5 p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-border-primary/50">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-500/15 px-3 py-1 text-xs font-bold text-purple-600 dark:text-purple-300 border border-purple-500/20">
                <Zap className="h-3.5 w-3.5" /> 50% Recurring Commission
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <CheckCircle2 className="h-3 w-3" /> Active Partner
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-text-primary font-sans pt-1">
              Your ThreadsWorks Referral Engine
            </h2>
            <p className="text-xs sm:text-sm text-text-secondary max-w-2xl">
              You earn <strong>50% recurring ($3.50/mo)</strong> on every $7/month ThreadsWorks subscriber who joins through your link.
            </p>
          </div>

          <div className="shrink-0 flex items-center gap-2">
            <button
              onClick={() => onNavigateTab("promote")}
              className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs sm:text-sm font-bold shadow-md shadow-purple-600/20 flex items-center gap-2 transition cursor-pointer"
            >
              <Sparkles className="h-4 w-4" />
              <span>Promote ThreadsWorks</span>
            </button>
          </div>
        </div>

        {/* Link Copy Bar */}
        <div className="pt-4 space-y-2">
          <label className="text-xs font-bold text-text-secondary uppercase tracking-wider font-mono">
            Your Unique Referral Link:
          </label>
          <div className="flex items-center gap-2">
            <div className="flex-1 rounded-xl border border-border-primary bg-bg-primary px-3.5 py-2.5 text-xs sm:text-sm font-mono text-text-primary truncate select-all">
              {referralUrl}
            </div>
            <button
              id="overview-copy-link-btn"
              onClick={handleCopyLink}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 transition cursor-pointer shrink-0 ${
                copied
                  ? "bg-emerald-600 text-white"
                  : "bg-purple-600 hover:bg-purple-700 text-white shadow-sm"
              }`}
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  <span>Copy My Link</span>
                </>
              )}
            </button>
          </div>
          <div className="flex flex-wrap items-center justify-between text-[11px] text-text-muted gap-2 pt-1">
            <span>Cookie duration: <strong>60 days</strong> + permanent account binding</span>
            <span className="font-mono">Referral Code: <strong>{partner.referralCode}</strong></span>
          </div>
        </div>
      </div>

      {/* 6 Core Financial Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* Card 1: Active Referrals */}
        <div className="p-4 rounded-xl border border-border-primary bg-bg-card space-y-1">
          <div className="flex items-center justify-between text-text-muted">
            <span className="text-[11px] font-bold uppercase tracking-wider font-mono">Active Referrals</span>
            <Users className="h-4 w-4 text-purple-500" />
          </div>
          <div className="text-2xl font-extrabold text-text-primary font-mono">
            {activeReferrals}
          </div>
          <p className="text-[10px] text-text-muted">Paying $7/mo subscribers</p>
        </div>

        {/* Card 2: Monthly Recurring Commission (MRR) */}
        <div className="p-4 rounded-xl border border-purple-500/20 bg-purple-500/5 space-y-1">
          <div className="flex items-center justify-between text-purple-600 dark:text-purple-400">
            <span className="text-[11px] font-bold uppercase tracking-wider font-mono">Monthly MRR</span>
            <TrendingUp className="h-4 w-4" />
          </div>
          <div className="text-2xl font-extrabold text-purple-600 dark:text-purple-400 font-mono">
            ${estimatedMRR.toFixed(2)}
          </div>
          <p className="text-[10px] text-text-muted">Recurring every month</p>
        </div>

        {/* Card 3: Total Earned */}
        <div className="p-4 rounded-xl border border-border-primary bg-bg-card space-y-1">
          <div className="flex items-center justify-between text-text-muted">
            <span className="text-[11px] font-bold uppercase tracking-wider font-mono">Total Earned</span>
            <DollarSign className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-extrabold text-text-primary font-mono">
            ${totalEarned.toFixed(2)}
          </div>
          <p className="text-[10px] text-text-muted">All-time commissions</p>
        </div>

        {/* Card 4: Payable Balance */}
        <div className="p-4 rounded-xl border border-border-primary bg-bg-card space-y-1">
          <div className="flex items-center justify-between text-text-muted">
            <span className="text-[11px] font-bold uppercase tracking-wider font-mono">Payable</span>
            <Wallet className="h-4 w-4 text-blue-500" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
            ${payableBalance.toFixed(2)}
          </div>
          <p className="text-[10px] text-text-muted">Available to withdraw</p>
        </div>

        {/* Card 5: Pending */}
        <div className="p-4 rounded-xl border border-border-primary bg-bg-card space-y-1">
          <div className="flex items-center justify-between text-text-muted">
            <span className="text-[11px] font-bold uppercase tracking-wider font-mono">Pending</span>
            <Clock className="h-4 w-4 text-amber-500" />
          </div>
          <div className="text-2xl font-extrabold text-text-primary font-mono">
            ${pendingBalance.toFixed(2)}
          </div>
          <p className="text-[10px] text-text-muted">Processing in payout</p>
        </div>

        {/* Card 6: Paid to Date */}
        <div className="p-4 rounded-xl border border-border-primary bg-bg-card space-y-1">
          <div className="flex items-center justify-between text-text-muted">
            <span className="text-[11px] font-bold uppercase tracking-wider font-mono">Paid Out</span>
            <ShieldCheck className="h-4 w-4 text-text-muted" />
          </div>
          <div className="text-2xl font-extrabold text-text-primary font-mono">
            ${paidBalance.toFixed(2)}
          </div>
          <p className="text-[10px] text-text-muted">Sent to your account</p>
        </div>
      </div>

      {/* Quick Action Hub */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Action 1 */}
        <div
          onClick={() => onNavigateTab("promote")}
          className="p-5 rounded-2xl border border-border-primary bg-bg-card hover:bg-bg-card-hover transition cursor-pointer space-y-2 group"
        >
          <div className="flex items-center justify-between">
            <div className="h-9 w-9 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Sparkles className="h-4.5 w-4.5" />
            </div>
            <ArrowRight className="h-4 w-4 text-text-muted group-hover:text-purple-500 group-hover:translate-x-1 transition-all" />
          </div>
          <h3 className="font-bold text-text-primary text-sm">Promote ThreadsWorks</h3>
          <p className="text-xs text-text-secondary leading-relaxed">
            Browse 12 promotional angles, ready-to-use Threads templates, and the built-in AI post generator.
          </p>
        </div>

        {/* Action 2 */}
        <div
          onClick={() => onNavigateTab("commissions")}
          className="p-5 rounded-2xl border border-border-primary bg-bg-card hover:bg-bg-card-hover transition cursor-pointer space-y-2 group"
        >
          <div className="flex items-center justify-between">
            <div className="h-9 w-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <DollarSign className="h-4.5 w-4.5" />
            </div>
            <ArrowRight className="h-4 w-4 text-text-muted group-hover:text-emerald-500 group-hover:translate-x-1 transition-all" />
          </div>
          <h3 className="font-bold text-text-primary text-sm">Auditable Commissions Ledger</h3>
          <p className="text-xs text-text-secondary leading-relaxed">
            Inspect every single 50% commission generated by your referrals with exact Stripe transaction references.
          </p>
        </div>

        {/* Action 3 */}
        <div
          onClick={() => onNavigateTab("payouts")}
          className="p-5 rounded-2xl border border-border-primary bg-bg-card hover:bg-bg-card-hover transition cursor-pointer space-y-2 group"
        >
          <div className="flex items-center justify-between">
            <div className="h-9 w-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Wallet className="h-4.5 w-4.5" />
            </div>
            <ArrowRight className="h-4 w-4 text-text-muted group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
          </div>
          <h3 className="font-bold text-text-primary text-sm">Request Payout ($25 Min)</h3>
          <p className="text-xs text-text-secondary leading-relaxed">
            Manage your PayPal or Wise payout details and request withdrawal of your payable balance.
          </p>
        </div>
      </div>
    </div>
  );
}
