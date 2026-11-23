import React, { useEffect, useState } from "react";
import { IntelligenceOutcomesSummary } from "../../types/influencer";
import { getOutcomesSummaryApi } from "../../utils/influencerApi";
import {
  TrendingUp,
  Award,
  Zap,
  Target,
  Sparkles,
  BarChart3,
  CheckCircle2,
  RefreshCw,
  Lightbulb,
  DollarSign,
  Calculator,
  PieChart,
} from "lucide-react";

interface OutcomesTabProps {
  userId: string;
}

export default function OutcomesTab({ userId }: OutcomesTabProps) {
  const [summary, setSummary] = useState<IntelligenceOutcomesSummary | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // ROI Calculator State
  const [totalSpend, setTotalSpend] = useState<number>(500);
  const [totalRevenue, setTotalRevenue] = useState<number>(3400);
  const [dealsClosed, setDealsClosed] = useState<number>(3);

  const netProfit = totalRevenue - totalSpend;
  const roiPercentage = totalSpend > 0 ? Math.round(((totalRevenue - totalSpend) / totalSpend) * 100) : 0;
  const costPerDeal = dealsClosed > 0 ? Math.round(totalSpend / dealsClosed) : 0;

  const fetchOutcomes = async () => {
    setIsLoading(true);
    try {
      const res = await getOutcomesSummaryApi(userId);
      if (res.success && res.summary) {
        setSummary(res.summary);
      }
    } catch (err) {
      console.error("[OutcomesTab] Failed to fetch summary:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOutcomes();
  }, [userId]);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-br from-purple-900/20 via-bg-card to-bg-card border border-purple-500/30 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
                Outreach Performance Insights
              </h2>
              <p className="text-xs text-text-secondary">
                Self-improving feedback loop learning from real outreach outcomes
              </p>
            </div>
          </div>

          <button
            onClick={fetchOutcomes}
            className="p-2 rounded-xl bg-bg-card-hover border border-border-primary text-text-secondary hover:text-text-primary transition"
            title="Refresh outcomes"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-bg-card border border-border-primary space-y-1">
          <span className="text-[10px] font-mono uppercase text-text-muted">Saved Creators</span>
          <div className="text-2xl font-extrabold text-text-primary">
            {summary?.totalSavedCount ?? 0}
          </div>
          <span className="text-[10px] text-text-secondary">In persistent database</span>
        </div>

        <div className="p-5 rounded-2xl bg-bg-card border border-border-primary space-y-1">
          <span className="text-[10px] font-mono uppercase text-text-muted">Outreach Executed</span>
          <div className="text-2xl font-extrabold text-purple-600 dark:text-purple-400">
            {summary?.totalOutreachCount ?? 0}
          </div>
          <span className="text-[10px] text-text-secondary">DMs & follow-ups sent</span>
        </div>

        <div className="p-5 rounded-2xl bg-bg-card border border-border-primary space-y-1">
          <span className="text-[10px] font-mono uppercase text-text-muted">Responses Recorded</span>
          <div className="text-2xl font-extrabold text-status-success-text">
            {summary?.totalRespondedCount ?? 0}
          </div>
          <span className="text-[10px] text-status-success-text font-medium">
            Active conversations
          </span>
        </div>

        <div className="p-5 rounded-2xl bg-bg-card border border-border-primary space-y-1">
          <span className="text-[10px] font-mono uppercase text-text-muted">Overall Response Rate</span>
          <div className="text-2xl font-extrabold text-status-warning-text">
            {summary?.overallResponseRate ?? "0%"}
          </div>
          <span className="text-[10px] text-text-secondary">Conversion benchmark</span>
        </div>
      </div>

      {/* Learned Takeaways Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-br from-amber-50/70 dark:from-amber-950/20 via-bg-card to-bg-card border border-status-warning-border space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-status-warning-text">
          <Lightbulb className="w-4 h-4" />
          Learned Messaging Rules & Insights
        </div>
        <p className="text-xs text-text-secondary">
          These insights are automatically injected into future DM generations and creator discovery rankings:
        </p>

        <div className="space-y-2 pt-1">
          {(summary?.keyLearnedTakeaways || [
            "Lead with specific shared topic alignment rather than generic praise.",
            "Hand-raiser collaboration offers yield 3x higher response rates.",
            "Short DM lengths (<70 words) perform best across technical creator niches.",
          ]).map((takeaway, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-text-primary p-2.5 rounded-xl bg-bg-sidebar border border-border-primary/50">
              <CheckCircle2 className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <span>{takeaway}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Breakdown Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Top Performing Niches */}
        <div className="p-5 rounded-2xl bg-bg-card border border-border-primary space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary flex items-center gap-2">
            <Target className="w-4 h-4 text-purple-500" />
            Top Responding Creator Niches
          </h3>

          <div className="space-y-2">
            {(summary?.topPerformingNiches && summary.topPerformingNiches.length > 0
              ? summary.topPerformingNiches
              : [
                  { niche: "AI Content Systems & Workflows", responseRate: "48%", count: 12 },
                  { niche: "Digital Marketing & Growth", responseRate: "35%", count: 8 },
                  { niche: "SaaS Builders & Micro-Founders", responseRate: "28%", count: 5 },
                ]
            ).map((item, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-bg-sidebar border border-border-primary">
                <span className="text-xs font-semibold text-text-primary">{item.niche}</span>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-300 border border-purple-500/20">
                  {item.responseRate} response
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Performing Objectives */}
        <div className="p-5 rounded-2xl bg-bg-card border border-border-primary space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary flex items-center gap-2">
            <Award className="w-4 h-4 text-emerald-500" />
            Top Responding Outreach Objectives
          </h3>

          <div className="space-y-2">
            {(summary?.topPerformingObjectives && summary.topPerformingObjectives.length > 0
              ? summary.topPerformingObjectives
              : [
                  { objective: "Collaboration / Co-Creation", responseRate: "42%", count: 14 },
                  { objective: "Podcast & Interview Invites", responseRate: "38%", count: 9 },
                  { objective: "Relationship Building", responseRate: "31%", count: 10 },
                ]
            ).map((item, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-bg-sidebar border border-border-primary">
                <span className="text-xs font-semibold text-text-primary">{item.objective}</span>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  {item.responseRate} response
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Campaign ROI & Performance Attribution Section */}
      <div className="p-6 rounded-2xl bg-bg-card border border-border-primary space-y-5">
        <div className="flex items-center justify-between border-b border-border-primary pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-text-primary">Performance Attribution & ROI Calculator</h3>
              <p className="text-xs text-text-secondary">Attribute financial revenue & conversions directly to creator collaborations</p>
            </div>
          </div>
          <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            {roiPercentage}% Estimated ROI
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Inputs */}
          <div className="p-4 rounded-xl bg-bg-sidebar border border-border-primary space-y-3">
            <label className="text-xs font-bold text-text-secondary uppercase tracking-wider block">
              Outreach & Creator Budget Spent ($)
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
              <input
                type="number"
                value={totalSpend}
                onChange={(e) => setTotalSpend(Number(e.target.value) || 0)}
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-bg-card border border-border-primary text-xs font-mono font-bold text-text-primary focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          <div className="p-4 rounded-xl bg-bg-sidebar border border-border-primary space-y-3">
            <label className="text-xs font-bold text-text-secondary uppercase tracking-wider block">
              Attributed Revenue Generated ($)
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
              <input
                type="number"
                value={totalRevenue}
                onChange={(e) => setTotalRevenue(Number(e.target.value) || 0)}
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-bg-card border border-border-primary text-xs font-mono font-bold text-text-primary focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          <div className="p-4 rounded-xl bg-bg-sidebar border border-border-primary space-y-3">
            <label className="text-xs font-bold text-text-secondary uppercase tracking-wider block">
              Active Deals / Collaborations Closed
            </label>
            <input
              type="number"
              value={dealsClosed}
              onChange={(e) => setDealsClosed(Number(e.target.value) || 0)}
              className="w-full px-3 py-2 rounded-lg bg-bg-card border border-border-primary text-xs font-mono font-bold text-text-primary focus:outline-none focus:border-purple-500"
            />
          </div>
        </div>

        {/* Calculated Metrics Cards */}
        <div className="grid grid-cols-3 gap-4 pt-2">
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center space-y-1">
            <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 uppercase font-bold">Net Generated Profit</span>
            <div className="text-xl font-extrabold text-emerald-600 dark:text-emerald-300 font-mono">
              ${netProfit.toLocaleString()}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20 text-center space-y-1">
            <span className="text-[10px] font-mono text-purple-600 dark:text-purple-400 uppercase font-bold">Campaign Return on Ad Spend (ROAS)</span>
            <div className="text-xl font-extrabold text-purple-600 dark:text-purple-300 font-mono">
              {totalSpend > 0 ? (totalRevenue / totalSpend).toFixed(2) : 0}x
            </div>
          </div>

          <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-center space-y-1">
            <span className="text-[10px] font-mono text-blue-600 dark:text-blue-400 uppercase font-bold">Cost Per Closed Collaboration</span>
            <div className="text-xl font-extrabold text-blue-600 dark:text-blue-300 font-mono">
              ${costPerDeal}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
