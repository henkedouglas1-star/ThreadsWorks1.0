import React from "react";
import { CombinationAggregate, SampleSizeConfidence, PerformanceTier } from "../../types/intelligence";
import { GitMerge, TrendingUp, TrendingDown, Minus, ShieldCheck, Award, AlertCircle } from "lucide-react";

interface MultiDimensionalPatternListProps {
  combinations: CombinationAggregate[];
  baselineMedianViews: number;
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
    default:
      return {
        label: `${count} posts (Limited)`,
        classes: "bg-status-warning-bg text-status-warning-text border-status-warning-border"
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

export default function MultiDimensionalPatternList({
  combinations,
  baselineMedianViews
}: MultiDimensionalPatternListProps) {
  if (!combinations || combinations.length === 0) {
    return (
      <div className="bg-bg-card border border-border-primary rounded-xl p-6 text-center shadow-sm">
        <p className="text-sm text-text-secondary">
          No multi-attribute combinations with 2+ observations found yet.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-bg-card border border-border-primary rounded-xl p-5 sm:p-6 shadow-sm">
      <div className="flex items-center justify-between mb-5 pb-4 border-b border-border-primary">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1 rounded bg-brand-surface border border-brand-border text-brand-text">
              <GitMerge className="w-4 h-4" />
            </span>
            <h3 className="text-base font-semibold text-text-primary tracking-tight">
              Strategic Attribute Combinations
            </h3>
          </div>
          <p className="text-xs text-text-secondary mt-1">
            Analyzing the intersection of Strategy + Format across repeated historical posts.
          </p>
        </div>
        <span className="text-xs text-text-muted font-medium">
          {combinations.length} {combinations.length === 1 ? "pattern" : "patterns"}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {combinations.map((combo) => {
          const confChip = getConfidenceChip(combo.sampleSizeConfidence, combo.postCount);
          const tierBadge = getTierBadge(combo.tier, combo.viewsVsBaselineDiffPercent);
          const TierIcon = tierBadge.icon;

          return (
            <div
              key={combo.id}
              className="p-4 rounded-lg border border-border-primary bg-bg-app flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-bg-card border border-border-primary text-text-primary">
                        {combo.primaryKey}
                      </span>
                      <span className="text-xs text-text-muted font-medium">+</span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-bg-card border border-border-primary text-text-primary">
                        {combo.secondaryKey}
                      </span>
                    </div>
                  </div>

                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border shrink-0 ${confChip.classes}`}>
                    {confChip.label}
                  </span>
                </div>

                <div className="mt-3 flex items-baseline justify-between text-xs">
                  <span className="text-text-secondary">
                    Median: <strong className="text-text-primary">{combo.medianViews.toLocaleString()} views</strong>
                  </span>
                  <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${tierBadge.classes}`}>
                    <TierIcon className="w-3 h-3" />
                    <span>{tierBadge.label}</span>
                  </div>
                </div>

                <p className="mt-2.5 text-xs text-text-secondary leading-relaxed font-normal">
                  {combo.factualStatement}
                </p>
              </div>

              <div className="mt-3 pt-3 border-t border-border-primary flex items-center justify-between text-[11px] text-text-muted">
                <span>Eng Rate: {combo.medianEngagementRate.toFixed(2)}% median</span>
                <span>Avg: {combo.averageViews.toFixed(0)} views</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
