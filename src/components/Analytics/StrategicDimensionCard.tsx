import React, { useState } from "react";
import { 
  DimensionAggregate, 
  PerformanceDimension, 
  SampleSizeConfidence,
  PerformanceTier
} from "../../types/intelligence";
import { 
  BarChart2, 
  ChevronDown, 
  ChevronUp, 
  ExternalLink, 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  ShieldCheck, 
  Award, 
  AlertCircle,
  Eye,
  MessageCircle,
  Heart,
  Share2
} from "lucide-react";

interface StrategicDimensionCardProps {
  aggregates: DimensionAggregate[];
  dimension: PerformanceDimension;
  dimensionTitle: string;
  dimensionDescription: string;
  baselineMedianViews: number;
  onSelectPost?: (mediaId: string) => void;
}

function getConfidenceChip(confidence: SampleSizeConfidence, count: number) {
  switch (confidence) {
    case "strong":
      return {
        label: `${count} posts (Strong)`,
        classes: "bg-status-success-bg text-status-success-text border-status-success-border"
      };
    case "usable":
      return {
        label: `${count} posts (Usable)`,
        classes: "bg-status-info-bg text-status-info-text border-status-info-border"
      };
    case "limited":
      return {
        label: `${count} posts (Limited)`,
        classes: "bg-status-warning-bg text-status-warning-text border-status-warning-border"
      };
    default:
      return {
        label: `${count} post (Early)`,
        classes: "bg-bg-app text-text-secondary border-border-primary"
      };
  }
}

function getTierBadge(tier: PerformanceTier, diffPercent: number) {
  if (tier === "significantly_above" || tier === "above") {
    return {
      label: `+${diffPercent.toFixed(1)}% vs baseline`,
      classes: "bg-status-success-bg text-status-success-text border-status-success-border",
      icon: TrendingUp
    };
  }
  if (tier === "below" || tier === "significantly_below") {
    return {
      label: `${diffPercent.toFixed(1)}% vs baseline`,
      classes: "bg-status-danger-bg text-status-danger-text border-status-danger-border",
      icon: TrendingDown
    };
  }
  return {
    label: "Near baseline",
    classes: "bg-bg-app text-text-secondary border-border-primary",
    icon: Minus
  };
}

export default function StrategicDimensionCard({
  aggregates,
  dimension,
  dimensionTitle,
  dimensionDescription,
  baselineMedianViews,
  onSelectPost
}: StrategicDimensionCardProps) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  if (!aggregates || aggregates.length === 0) {
    return (
      <div className="bg-bg-card border border-border-primary rounded-xl p-8 text-center shadow-sm">
        <p className="text-sm text-text-muted">
          No posts with {dimensionTitle.toLowerCase()} metadata found in the selected time window.
        </p>
      </div>
    );
  }

  // Calculate highest median views among aggregates for relative bar width
  const maxMedianViews = Math.max(...aggregates.map((a) => a.medianViews), baselineMedianViews, 1);

  return (
    <div className="bg-bg-card border border-border-primary rounded-xl p-5 sm:p-6 shadow-sm">
      {/* Header */}
      <div className="mb-5 pb-4 border-b border-border-primary">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold text-text-primary tracking-tight">
              {dimensionTitle}
            </h3>
            <p className="text-xs text-text-secondary mt-0.5">
              {dimensionDescription}
            </p>
          </div>
          <span className="text-xs font-medium text-text-secondary px-2.5 py-1 rounded-md bg-bg-app border border-border-primary shrink-0">
            {aggregates.length} {aggregates.length === 1 ? "variant" : "variants"} evaluated
          </span>
        </div>
      </div>

      {/* Aggregate Rows */}
      <div className="space-y-4">
        {aggregates.map((item) => {
          const isExpanded = expandedKey === item.key;
          const confChip = getConfidenceChip(item.sampleSizeConfidence, item.postCount);
          const tierBadge = getTierBadge(
            item.comparisonToBaseline.tier,
            item.comparisonToBaseline.viewsVsBaselineDiffPercent
          );
          const TierIcon = tierBadge.icon;

          // Relative bar width
          const barWidthPercent = Math.min(100, Math.max(8, (item.medianViews / maxMedianViews) * 100));
          const baselineMarkerPercent = Math.min(100, (baselineMedianViews / maxMedianViews) * 100);

          return (
            <div 
              key={item.key}
              className="border border-border-primary rounded-lg p-4 bg-bg-app hover:bg-bg-card-hover transition-colors"
            >
              {/* Row Top Summary */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm text-text-primary">
                    {item.displayName}
                  </span>
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${confChip.classes}`}>
                    {confChip.label}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <div className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${tierBadge.classes}`}>
                    <TierIcon className="w-3 h-3" />
                    <span>{tierBadge.label}</span>
                  </div>
                  <button
                    onClick={() => setExpandedKey(isExpanded ? null : item.key)}
                    className="p-1 text-text-muted hover:text-text-primary transition-colors rounded cursor-pointer"
                    title={isExpanded ? "Collapse details" : "Expand details"}
                  >
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Factual Performance Bar */}
              <div className="mt-3">
                <div className="flex items-baseline justify-between text-xs mb-1.5">
                  <span className="text-text-secondary">
                    Median Views: <strong className="text-text-primary">{item.medianViews.toLocaleString()}</strong>
                    <span className="text-[11px] text-text-muted ml-1.5">(avg: {item.averageViews.toLocaleString()})</span>
                  </span>
                  <span className="text-text-secondary">
                    Engagement: <strong className="text-text-primary">{item.medianEngagementRate.toFixed(2)}%</strong>
                  </span>
                </div>

                {/* Visual Bar with Baseline Benchmark Marker */}
                <div className="relative h-2 w-full bg-border-primary rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-purple-600 dark:bg-purple-400 rounded-full transition-all duration-500"
                    style={{ width: `${barWidthPercent}%` }}
                  />
                </div>
              </div>

              {/* Factual Evidence Statement */}
              <p className="mt-2.5 text-xs text-text-secondary leading-relaxed font-normal">
                {item.comparisonToBaseline.factualStatement}
              </p>

              {/* Expanded Cohort Details */}
              {isExpanded && (
                <div className="mt-4 pt-4 border-t border-border-primary space-y-3">
                  {/* Detailed Numbers Breakdown */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="p-2 rounded bg-bg-card border border-border-primary">
                      <span className="text-text-muted text-[11px]">Total Views:</span>
                      <p className="font-semibold text-text-primary mt-0.5">{item.totalViews.toLocaleString()}</p>
                    </div>
                    <div className="p-2 rounded bg-bg-card border border-border-primary">
                      <span className="text-text-muted text-[11px]">Views Range:</span>
                      <p className="font-semibold text-text-primary mt-0.5">{item.minViews} – {item.maxViews}</p>
                    </div>
                    <div className="p-2 rounded bg-bg-card border border-border-primary">
                      <span className="text-text-muted text-[11px]">Avg Interactions:</span>
                      <p className="font-semibold text-text-primary mt-0.5">{item.averageInteractions.toFixed(1)} / post</p>
                    </div>
                    <div className="p-2 rounded bg-bg-card border border-border-primary">
                      <span className="text-text-muted text-[11px]">Avg Eng Rate:</span>
                      <p className="font-semibold text-text-primary mt-0.5">{item.averageEngagementRate.toFixed(2)}%</p>
                    </div>
                  </div>

                  {/* Top Representative Post */}
                  {item.topPost && (
                    <div className="p-3 rounded-lg bg-bg-card border border-border-primary text-xs">
                      <div className="flex items-center justify-between text-[11px] text-text-muted mb-1">
                        <span className="font-medium text-status-success-text">Top Post in Cohort</span>
                        <div className="flex items-center gap-3">
                          <span className="flex items-center gap-1 font-semibold text-text-primary">
                            <Eye className="w-3 h-3 text-text-muted" />
                            {item.topPost.views.toLocaleString()} views
                          </span>
                          <span className="font-semibold text-text-primary">
                            {item.topPost.engagementRate.toFixed(1)}% eng
                          </span>
                        </div>
                      </div>
                      <p className="text-text-primary line-clamp-2 italic">
                        "{item.topPost.text}"
                      </p>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-[11px] text-text-muted">
                          {new Date(item.topPost.publishedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                        </span>
                        <div className="flex items-center gap-2">
                          {onSelectPost && (
                            <button
                              onClick={() => onSelectPost(item.topPost!.mediaId)}
                              className="text-[11px] font-medium text-brand-text hover:underline cursor-pointer"
                            >
                              Inspect Details
                            </button>
                          )}
                          {item.topPost.permalink && (
                            <a
                              href={item.topPost.permalink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-text-muted hover:text-text-primary p-0.5"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
