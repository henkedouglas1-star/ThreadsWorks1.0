import React, { useState } from "react";
import {
  TrendingUp,
  MousePointerClick,
  UserPlus,
  Zap,
  DollarSign,
  Percent,
  Calendar,
  Layers,
  Sparkles
} from "lucide-react";
import { PartnerProfile, PartnerPerformanceMetrics } from "../../types/partner";

interface PerformanceTabProps {
  partner: PartnerProfile;
  metrics: PartnerPerformanceMetrics | null;
}

export default function PerformanceTab({ partner, metrics }: PerformanceTabProps) {
  const [timeframe, setTimeframe] = useState<"7d" | "30d" | "90d" | "all">("30d");

  const totalClicks = metrics?.totalClicks || partner.totalClicks || 0;
  const totalSignups = metrics?.totalSignups || partner.totalSignups || 0;
  const payingCustomers = metrics?.payingCustomers || partner.totalCustomers || 0;
  const activeReferrals = metrics?.activeReferrals || partner.activeCustomers || 0;
  const conversionRate = totalClicks > 0 ? ((payingCustomers / totalClicks) * 100).toFixed(2) : "0.00";
  const revenueGenerated = (payingCustomers * 7.00).toFixed(2);
  const totalEarned = (partner.totalEarned || 0).toFixed(2);
  const monthlyMRR = (partner.monthlyRecurringCommission || activeReferrals * 3.50).toFixed(2);

  const rawTimeframe = metrics?.timeframeData || [];
  const displayPoints = timeframe === "7d"
    ? rawTimeframe.slice(-7)
    : (timeframe === "90d" ? rawTimeframe : rawTimeframe.slice(-30));

  return (
    <div className="space-y-6 animate-fade-in" id="partner-performance-tab">
      {/* Header & Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-text-primary">
            Referral & Conversion Analytics
          </h2>
          <p className="text-xs text-text-secondary">
            Real-time attribution performance across clicks, registrations, and paying subscribers.
          </p>
        </div>

        {/* Timeframe Filter Buttons */}
        <div className="flex items-center rounded-xl bg-bg-card border border-border-primary p-1 text-xs font-semibold">
          <button
            onClick={() => setTimeframe("7d")}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              timeframe === "7d" ? "bg-purple-600 text-white shadow-sm" : "text-text-muted hover:text-text-primary"
            }`}
          >
            7 Days
          </button>
          <button
            onClick={() => setTimeframe("30d")}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              timeframe === "30d" ? "bg-purple-600 text-white shadow-sm" : "text-text-muted hover:text-text-primary"
            }`}
          >
            30 Days
          </button>
          <button
            onClick={() => setTimeframe("90d")}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              timeframe === "90d" ? "bg-purple-600 text-white shadow-sm" : "text-text-muted hover:text-text-primary"
            }`}
          >
            90 Days
          </button>
          <button
            onClick={() => setTimeframe("all")}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              timeframe === "all" ? "bg-purple-600 text-white shadow-sm" : "text-text-muted hover:text-text-primary"
            }`}
          >
            All Time
          </button>
        </div>
      </div>

      {/* Conversion Funnel Breakdown */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-xl border border-border-primary bg-bg-card space-y-1">
          <div className="flex items-center justify-between text-text-muted">
            <span className="text-[11px] font-bold uppercase tracking-wider font-mono">1. Link Clicks</span>
            <MousePointerClick className="h-4 w-4 text-purple-500" />
          </div>
          <div className="text-2xl font-extrabold text-text-primary font-mono">{totalClicks}</div>
          <p className="text-[10px] text-text-muted">Total unique link visits</p>
        </div>

        <div className="p-4 rounded-xl border border-border-primary bg-bg-card space-y-1">
          <div className="flex items-center justify-between text-text-muted">
            <span className="text-[11px] font-bold uppercase tracking-wider font-mono">2. Registrations</span>
            <UserPlus className="h-4 w-4 text-blue-500" />
          </div>
          <div className="text-2xl font-extrabold text-text-primary font-mono">{totalSignups}</div>
          <p className="text-[10px] text-text-muted">Attributed accounts created</p>
        </div>

        <div className="p-4 rounded-xl border border-border-primary bg-bg-card space-y-1">
          <div className="flex items-center justify-between text-text-muted">
            <span className="text-[11px] font-bold uppercase tracking-wider font-mono">3. Paying Customers</span>
            <Zap className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">{payingCustomers}</div>
          <p className="text-[10px] text-text-muted">Subscribed to ThreadsWorks</p>
        </div>

        <div className="p-4 rounded-xl border border-border-primary bg-bg-card space-y-1">
          <div className="flex items-center justify-between text-text-muted">
            <span className="text-[11px] font-bold uppercase tracking-wider font-mono">4. Conversion Rate</span>
            <Percent className="h-4 w-4 text-pink-500" />
          </div>
          <div className="text-2xl font-extrabold text-pink-600 dark:text-pink-400 font-mono">{conversionRate}%</div>
          <p className="text-[10px] text-text-muted">Click-to-customer ratio</p>
        </div>
      </div>

      {/* Revenue & MRR Snapshot */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl border border-purple-500/20 bg-purple-500/5 space-y-1 text-center sm:text-left">
          <span className="text-xs uppercase font-bold font-mono text-purple-600 dark:text-purple-400">
            Current Monthly Recurring MRR
          </span>
          <div className="text-3xl font-extrabold text-text-primary font-mono">
            ${monthlyMRR} <span className="text-xs text-text-muted font-normal">/ month</span>
          </div>
          <p className="text-[11px] text-text-muted">Active recurring affiliate earnings</p>
        </div>

        <div className="p-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 space-y-1 text-center sm:text-left">
          <span className="text-xs uppercase font-bold font-mono text-emerald-600 dark:text-emerald-400">
            Total Affiliate Revenue Earned
          </span>
          <div className="text-3xl font-extrabold text-text-primary font-mono">
            ${totalEarned}
          </div>
          <p className="text-[11px] text-text-muted">All-time commissions credited</p>
        </div>

        <div className="p-5 rounded-2xl border border-border-primary bg-bg-card space-y-1 text-center sm:text-left">
          <span className="text-xs uppercase font-bold font-mono text-text-secondary">
            Gross Customer Sales Generated
          </span>
          <div className="text-3xl font-extrabold text-text-primary font-mono">
            ${revenueGenerated}
          </div>
          <p className="text-[11px] text-text-muted">Gross value generated for ThreadsWorks</p>
        </div>
      </div>

      {/* Performance Activity Graph / Timeline */}
      <div className="rounded-2xl border border-border-primary bg-bg-card p-6 space-y-4 shadow-sm">
        <h3 className="text-base font-bold text-text-primary flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-purple-500" />
          Recent Activity Timeline ({displayPoints.length} Days)
        </h3>

        <div className="space-y-2 pt-2">
          <div className="grid grid-cols-5 text-[11px] font-bold font-mono uppercase text-text-muted pb-2 border-b border-border-primary">
            <div>Date</div>
            <div className="text-center">Clicks</div>
            <div className="text-center">Signups</div>
            <div className="text-center">New Customers</div>
            <div className="text-right">Commission</div>
          </div>

          {displayPoints.length === 0 ? (
            <div className="py-8 text-center text-xs text-text-muted">
              No click or conversion activity recorded yet in this timeframe. Share your referral link to begin tracking!
            </div>
          ) : (
            displayPoints.map((dp, idx) => (
              <div key={idx} className="grid grid-cols-5 text-xs py-2 border-b border-border-primary/40 font-mono items-center">
                <div className="text-text-secondary">{dp.date}</div>
                <div className="text-center text-text-primary font-semibold">{dp.clicks}</div>
                <div className="text-center text-status-info-text font-medium">{dp.signups}</div>
                <div className="text-center text-status-success-text font-bold">{dp.conversions}</div>
                <div className="text-right text-brand-text font-bold">
                  ${dp.commission.toFixed(2)}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
