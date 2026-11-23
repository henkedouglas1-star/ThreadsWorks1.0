import React from "react";
import { PerformanceOutlier } from "../../types/intelligence";
import { 
  Sparkles, 
  TrendingUp, 
  TrendingDown, 
  ExternalLink, 
  Eye, 
  MessageCircle, 
  Heart,
  Layers,
  ArrowUpRight
} from "lucide-react";

interface PerformanceOutlierListProps {
  outliers: PerformanceOutlier[];
  baselineMedianViews: number;
  onSelectPost?: (mediaId: string) => void;
}

export default function PerformanceOutlierList({
  outliers,
  baselineMedianViews,
  onSelectPost
}: PerformanceOutlierListProps) {
  if (!outliers || outliers.length === 0) {
    return (
      <div className="bg-bg-card border border-border-primary rounded-xl p-6 text-center shadow-sm">
        <p className="text-sm text-text-muted">
          No statistical outliers detected in this time window. Post performance is clustered tightly around your baseline.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-bg-card border border-border-primary rounded-xl p-5 sm:p-6 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 pb-4 border-b border-border-primary">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded bg-brand-surface border border-brand-border text-brand-text">
              <Sparkles className="w-4 h-4" />
            </span>
            <h3 className="text-base font-semibold text-text-primary tracking-tight">
              Performance Outliers
            </h3>
          </div>
          <p className="text-xs text-text-secondary mt-1">
            Posts that performed significantly above or below your baseline median benchmark.
          </p>
        </div>
        <span className="text-xs text-text-secondary font-medium">
          {outliers.length} {outliers.length === 1 ? "outlier" : "outliers"}
        </span>
      </div>

      {/* Grid of Outlier Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {outliers.map((item) => {
          const isHigh = item.classification === "significantly_above_baseline" || item.classification === "above_baseline";
          const ratioBadge = isHigh
            ? {
                label: `${item.deviationRatio.toFixed(1)}x Baseline`,
                classes: "bg-status-success-bg text-status-success-text border-status-success-border",
                icon: TrendingUp
              }
            : {
                label: `${item.deviationRatio.toFixed(1)}x Baseline`,
                classes: "bg-status-danger-bg text-status-danger-text border-status-danger-border",
                icon: TrendingDown
              };
          const RatioIcon = ratioBadge.icon;

          const mem = item.strategicContext;

          return (
            <div
              key={item.post.id || item.post.mediaId}
              className="p-4 rounded-lg border border-border-primary bg-bg-app flex flex-col justify-between hover:bg-bg-card-hover transition-colors"
            >
              <div>
                {/* Outlier Header */}
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${ratioBadge.classes}`}>
                    <RatioIcon className="w-3.5 h-3.5" />
                    <span>{ratioBadge.label}</span>
                  </div>
                  <span className="text-[11px] text-text-muted font-normal">
                    {new Date(item.post.publishedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </span>
                </div>

                {/* Text excerpt */}
                <p className="text-xs text-text-primary line-clamp-3 leading-relaxed mt-2 font-normal">
                  "{item.post.text || item.strategicContext?.hook || "No caption text"}"
                </p>

                {/* Attached Strategic Attributes */}
                {mem && (mem.pillarTitle || mem.strategicAngle || mem.format) && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {mem.pillarTitle && (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-bg-card border border-border-primary text-text-secondary">
                        {mem.pillarTitle}
                      </span>
                    )}
                    {mem.format && (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-bg-card border border-border-primary text-text-secondary">
                        {mem.format}
                      </span>
                    )}
                    {mem.strategicAngle && (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-bg-card border border-border-primary text-text-secondary">
                        {mem.strategicAngle}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Metrics & Actions Footer */}
              <div className="mt-4 pt-3 border-t border-border-primary">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1 font-bold text-text-primary">
                      <Eye className="w-3.5 h-3.5 text-text-muted" />
                      {(item.post.metrics?.views || 0).toLocaleString()}
                    </span>
                    <span className="font-medium text-text-secondary">
                      {(item.post.derivedMetrics?.engagementRate || 0).toFixed(1)}% eng
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {onSelectPost && (
                      <button
                        onClick={() => onSelectPost(item.post.mediaId)}
                        className="text-[11px] font-semibold text-brand-text hover:underline flex items-center gap-0.5 cursor-pointer"
                      >
                        Inspect
                        <ArrowUpRight className="w-3 h-3" />
                      </button>
                    )}
                    {item.post.permalink && (
                      <a
                        href={item.post.permalink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-text-muted hover:text-text-primary p-0.5"
                        title="View on Threads"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
