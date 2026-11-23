import React from "react";
import { CreatorPerformanceBaseline, SampleSizeConfidence } from "../../types/intelligence";
import { 
  BarChart3, 
  Target, 
  TrendingUp, 
  Layers, 
  HelpCircle, 
  ShieldCheck, 
  AlertCircle,
  Activity,
  Award
} from "lucide-react";

interface CreatorBaselineCardProps {
  baseline: CreatorPerformanceBaseline;
  period: "7d" | "14d" | "30d" | "90d" | "all";
}

function getConfidenceBadge(confidence: SampleSizeConfidence, totalSampled: number) {
  switch (confidence) {
    case "strong":
      return {
        label: `Strong Evidence (${totalSampled} posts)`,
        color: "bg-status-success-bg text-status-success-text border-status-success-border",
        icon: ShieldCheck
      };
    case "usable":
      return {
        label: `Usable Evidence (${totalSampled} posts)`,
        color: "bg-status-info-bg text-status-info-text border-status-info-border",
        icon: Award
      };
    case "limited":
      return {
        label: `Limited Sample (${totalSampled} posts)`,
        color: "bg-status-warning-bg text-status-warning-text border-status-warning-border",
        icon: AlertCircle
      };
    default:
      return {
        label: `Early Baseline (${totalSampled} post)`,
        color: "bg-bg-app text-text-secondary border-border-primary",
        icon: AlertCircle
      };
  }
}

export default function CreatorBaselineCard({ baseline, period }: CreatorBaselineCardProps) {
  const badge = getConfidenceBadge(baseline.confidence, baseline.totalPostsSampled);
  const BadgeIcon = badge.icon;

  const periodLabel = {
    all: "All Historical Posts",
    "90d": "Last 90 Days",
    "30d": "Last 30 Days",
    "14d": "Last 14 Days",
    "7d": "Last 7 Days"
  }[period] || "All Posts";

  return (
    <div 
      id="creator-performance-baseline-card"
      className="bg-bg-card border border-border-primary rounded-xl p-5 sm:p-6 shadow-sm relative overflow-hidden"
    >
      {/* Header with Title and Confidence */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-border-primary">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="p-1.5 rounded-lg bg-brand-surface border border-brand-border text-brand-text">
              <Target className="w-4 h-4" />
            </span>
            <h3 className="text-base font-semibold text-text-primary tracking-tight">
              Personal Performance Baseline
            </h3>
            <span className="text-xs px-2 py-0.5 rounded-md bg-bg-app border border-border-primary text-text-secondary font-medium">
              {periodLabel}
            </span>
          </div>
          <p className="text-xs text-text-secondary mt-1 max-w-xl leading-relaxed">
            Your unique historical median benchmark. Content dimensions are evaluated against your personal median rather than generic industry averages.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${badge.color}`}>
            <BadgeIcon className="w-3.5 h-3.5" />
            <span>{badge.label}</span>
          </div>
        </div>
      </div>

      {/* Primary Baseline Metric Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 pt-5">
        {/* Metric 1: Median Views (Core Benchmark) */}
        <div className="p-4 rounded-lg bg-bg-app border border-border-primary">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-text-secondary">
              Median Views / Post
            </span>
            <BarChart3 className="w-3.5 h-3.5 text-text-muted" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-text-primary tracking-tight">
              {baseline.medianViews.toLocaleString()}
            </span>
            <span className="text-xs text-text-muted font-normal">
              (avg: {baseline.averageViews.toLocaleString()})
            </span>
          </div>
          <div className="mt-2 text-[11px] text-text-muted flex items-center justify-between">
            <span>25th–75th range:</span>
            <span className="font-medium text-text-secondary">
              {baseline.p25Views} – {baseline.p75Views} views
            </span>
          </div>
          {baseline.recencyWeightedMedianViews !== undefined && (
            <div className="mt-1 text-[10px] text-text-muted flex items-center justify-between border-t border-border-primary pt-1">
              <span>Recency Weighted:</span>
              <span className="font-semibold text-text-secondary">
                {baseline.recencyWeightedMedianViews} median
              </span>
            </div>
          )}
        </div>

        {/* Metric 2: Median Engagement Rate */}
        <div className="p-4 rounded-lg bg-bg-app border border-border-primary">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-text-secondary">
              Median Engagement Rate
            </span>
            <TrendingUp className="w-3.5 h-3.5 text-text-muted" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-text-primary tracking-tight">
              {baseline.medianEngagementRate.toFixed(2)}%
            </span>
            <span className="text-xs text-text-muted font-normal">
              (avg: {baseline.averageEngagementRate.toFixed(2)}%)
            </span>
          </div>
          <div className="mt-2 text-[11px] text-text-muted flex items-center justify-between">
            <span>Interactions / post:</span>
            <span className="font-medium text-text-secondary">
              {baseline.medianInteractions} median ({baseline.averageInteractions.toFixed(0)} avg)
            </span>
          </div>
        </div>

        {/* Metric 3: Typical Interaction Breakdown */}
        <div className="p-4 rounded-lg bg-bg-app border border-border-primary">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-text-secondary">
              Average Interaction Mix
            </span>
            <Activity className="w-3.5 h-3.5 text-text-muted" />
          </div>
          <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 text-xs">
            <div className="flex items-center justify-between text-text-secondary">
              <span>Likes:</span>
              <span className="font-semibold text-text-primary">{baseline.averageLikes.toFixed(1)}</span>
            </div>
            <div className="flex items-center justify-between text-text-secondary">
              <span>Replies:</span>
              <span className="font-semibold text-text-primary">{baseline.averageReplies.toFixed(1)}</span>
            </div>
            <div className="flex items-center justify-between text-text-secondary">
              <span>Reposts:</span>
              <span className="font-semibold text-text-primary">{baseline.averageReposts.toFixed(1)}</span>
            </div>
            <div className="flex items-center justify-between text-text-secondary">
              <span>Quotes:</span>
              <span className="font-semibold text-text-primary">{baseline.averageQuotes.toFixed(1)}</span>
            </div>
          </div>
        </div>

        {/* Metric 4: Sample Breadth & Memory Link */}
        <div className="p-4 rounded-lg bg-bg-app border border-border-primary">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-text-secondary">
              Content Memory Coverage
            </span>
            <Layers className="w-3.5 h-3.5 text-text-muted" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-text-primary tracking-tight">
              {baseline.postsWithMemoryContext}
            </span>
            <span className="text-xs text-text-muted font-normal">
              of {baseline.totalPostsSampled} posts ({baseline.totalPostsSampled > 0 ? Math.round((baseline.postsWithMemoryContext / baseline.totalPostsSampled) * 100) : 0}%)
            </span>
          </div>
          <p className="mt-2 text-[11px] text-text-secondary leading-snug">
            {baseline.maturationBreakdown
              ? `${baseline.maturationBreakdown.matureCount} mature posts (≥48h)${baseline.maturationBreakdown.maturingCount > 0 ? `, ${baseline.maturationBreakdown.maturingCount} maturing (<48h)` : ""}`
              : baseline.postsWithMemoryContext > 0
                ? "Posts mapped to strategic pillars, angles, and formats."
                : "Posts synchronized directly from Threads feed."}
          </p>
        </div>
      </div>
    </div>
  );
}
