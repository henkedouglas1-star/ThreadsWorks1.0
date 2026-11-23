import React from "react";
import { AccountAnalyticsSnapshot } from "../../types/analytics";
import { Eye, Heart, MessageCircle, Repeat, Quote, Users, Sparkles, TrendingUp, Calendar } from "lucide-react";

interface AccountOverviewCardsProps {
  account: AccountAnalyticsSnapshot | null;
  historicalSnapshotsCount?: number;
  selectedTimeframe?: "1d" | "7d" | "30d";
  onTimeframeChange?: (timeframe: "1d" | "7d" | "30d") => void;
}

export default function AccountOverviewCards({
  account,
  historicalSnapshotsCount = 0,
  selectedTimeframe = "7d",
  onTimeframeChange
}: AccountOverviewCardsProps) {
  if (!account) return null;

  // Read metrics from the selected timeframe window if available, with graceful fallback
  const windowData = account.windows?.[selectedTimeframe];

  const views = windowData?.views ?? account.metrics?.views ?? (account as any).views ?? 0;
  const likes = windowData?.likes ?? account.metrics?.likes ?? (account as any).likes ?? 0;
  const replies = windowData?.replies ?? account.metrics?.replies ?? (account as any).replies ?? 0;
  const reposts = windowData?.reposts ?? account.metrics?.reposts ?? (account as any).reposts ?? 0;
  const quotes = windowData?.quotes ?? account.metrics?.quotes ?? (account as any).quotes ?? 0;
  const followersCount = windowData?.followersCount ?? account.metrics?.followersCount ?? (account as any).followersCount ?? 0;

  // Derived metrics
  const totalEngagements = windowData?.totalEngagements ?? account.derivedMetrics?.totalEngagements ?? (likes + replies + reposts + quotes);
  const engagementRateOnViews = windowData?.engagementRateOnViews ?? account.derivedMetrics?.engagementRateOnViews ?? (views > 0 ? (totalEngagements / views) * 100 : 0);
  const followerGrowth = windowData?.followerGrowth ?? (account.derivedMetrics as any)?.followerGrowth;
  const isCollectingHistory = windowData?.isCollectingHistory ?? account.derivedMetrics?.isCollectingHistory;

  const timeframeLabels: Record<"1d" | "7d" | "30d", string> = {
    "1d": "Past 24 Hours",
    "7d": "Past 7 Days",
    "30d": "Past 30 Days"
  };

  return (
    <div className="space-y-4" id="account-overview-section">
      {/* Timeframe Selector Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-bg-card border border-border-primary rounded-xl px-4 py-3 shadow-xs">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-purple-500" />
          <span className="text-xs font-bold text-text-primary">Rolling Analytics Window:</span>
          <span className="text-xs text-text-muted font-medium">{timeframeLabels[selectedTimeframe]}</span>
        </div>

        <div className="flex items-center gap-1.5 bg-bg-app border border-border-primary p-1 rounded-lg">
          {(["1d", "7d", "30d"] as const).map((tf) => (
            <button
              key={tf}
              type="button"
              id={`timeframe-selector-${tf}`}
              onClick={() => onTimeframeChange?.(tf)}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                selectedTimeframe === tf
                  ? "bg-purple-600 text-white shadow-xs"
                  : "text-text-secondary hover:text-text-primary hover:bg-bg-card"
              }`}
            >
              {tf.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Primary Key Metric Highlights */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {/* Total Views */}
        <div className="rounded-2xl border border-border-primary bg-bg-card p-4 md:p-5 shadow-sm hover:border-purple-500/30 transition flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Total Views</span>
            <div className="h-7 w-7 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <Eye className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl md:text-3xl font-extrabold text-text-primary tracking-tight font-mono">
              {views.toLocaleString()}
            </div>
            <div className="text-[10px] text-text-muted mt-1 flex items-center gap-1">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-purple-500" />
              <span>Earned in {selectedTimeframe.toUpperCase()}</span>
            </div>
          </div>
        </div>

        {/* Total Engagements (Derived) */}
        <div className="rounded-2xl border border-border-primary bg-bg-card p-4 md:p-5 shadow-sm hover:border-pink-500/30 transition flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Engagements</span>
            <div className="h-7 w-7 rounded-lg bg-pink-500/10 flex items-center justify-center text-pink-600 dark:text-pink-400">
              <Sparkles className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl md:text-3xl font-extrabold text-text-primary tracking-tight font-mono">
              {totalEngagements.toLocaleString()}
            </div>
            <div className="text-[10px] text-text-muted mt-1 flex items-center gap-1">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-pink-500" />
              <span>Likes + Replies + Reposts + Quotes</span>
            </div>
          </div>
        </div>

        {/* Engagement Rate (Derived) */}
        <div className="rounded-2xl border border-border-primary bg-bg-card p-4 md:p-5 shadow-sm hover:border-emerald-500/30 transition flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Engagement Rate</span>
            <div className="h-7 w-7 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl md:text-3xl font-extrabold text-text-primary tracking-tight font-mono">
              {engagementRateOnViews.toFixed(2)}%
            </div>
            <div className="text-[10px] text-text-muted mt-1 flex items-center gap-1">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>Engagements / Views ({selectedTimeframe.toUpperCase()})</span>
            </div>
          </div>
        </div>

        {/* Followers */}
        <div className="rounded-2xl border border-border-primary bg-bg-card p-4 md:p-5 shadow-sm hover:border-cyan-500/30 transition flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Followers</span>
            <div className="h-7 w-7 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-600 dark:text-cyan-400">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl md:text-3xl font-extrabold text-text-primary tracking-tight font-mono">
              {followersCount.toLocaleString()}
            </div>
            <div className="text-[10px] text-text-muted mt-1 flex items-center gap-1">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-cyan-500" />
              {typeof followerGrowth === "number" && !isCollectingHistory ? (
                <span>
                  {followerGrowth >= 0 ? `+${followerGrowth}` : followerGrowth} net growth
                </span>
              ) : (
                <span>Account baseline</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Secondary Granular Interaction Breakdown */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Likes */}
        <div className="rounded-xl border border-border-primary bg-bg-app p-3.5 flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Likes</div>
            <div className="text-lg font-bold text-text-primary font-mono">{likes.toLocaleString()}</div>
          </div>
          <div className="h-7 w-7 rounded-lg bg-pink-500/10 flex items-center justify-center text-pink-500">
            <Heart className="h-3.5 w-3.5" />
          </div>
        </div>

        {/* Replies */}
        <div className="rounded-xl border border-border-primary bg-bg-app p-3.5 flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Replies</div>
            <div className="text-lg font-bold text-text-primary font-mono">{replies.toLocaleString()}</div>
          </div>
          <div className="h-7 w-7 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500">
            <MessageCircle className="h-3.5 w-3.5" />
          </div>
        </div>

        {/* Reposts */}
        <div className="rounded-xl border border-border-primary bg-bg-app p-3.5 flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Reposts</div>
            <div className="text-lg font-bold text-text-primary font-mono">{reposts.toLocaleString()}</div>
          </div>
          <div className="h-7 w-7 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">
            <Repeat className="h-3.5 w-3.5" />
          </div>
        </div>

        {/* Quotes */}
        <div className="rounded-xl border border-border-primary bg-bg-app p-3.5 flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Quotes</div>
            <div className="text-lg font-bold text-text-primary font-mono">{quotes.toLocaleString()}</div>
          </div>
          <div className="h-7 w-7 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500">
            <Quote className="h-3.5 w-3.5" />
          </div>
        </div>
      </div>
    </div>
  );
}
