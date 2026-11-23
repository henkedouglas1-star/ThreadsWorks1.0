import React, { useState } from "react";
import { 
  ContentPerformanceRecommendation, 
  RecommendationCategory 
} from "../../types/recommendations";
import { 
  Sparkles, 
  TrendingUp, 
  FlaskConical, 
  Wrench, 
  AlertTriangle, 
  PieChart, 
  ChevronDown, 
  ChevronUp, 
  ExternalLink, 
  ArrowUpRight, 
  ArrowDownRight, 
  ShieldCheck, 
  Layers, 
  Compass, 
  FileText, 
  Send, 
  CheckCircle2,
  ArrowRight
} from "lucide-react";

interface RecommendationCardProps {
  recommendation: ContentPerformanceRecommendation;
  onApplyAction?: (action: NonNullable<ContentPerformanceRecommendation["suggestedAction"]>) => void;
  onSelectPost?: (mediaId: string) => void;
}

export default function RecommendationCard({
  recommendation,
  onApplyAction,
  onSelectPost
}: RecommendationCardProps) {
  const [isEvidenceOpen, setIsEvidenceOpen] = useState(false);

  const getCategoryConfig = (category: RecommendationCategory) => {
    switch (category) {
      case "what_to_repeat":
        return {
          label: "What to Repeat",
          icon: TrendingUp,
          badgeBg: "bg-status-success-bg border-status-success-border text-status-success-text",
          headerColor: "text-emerald-900 dark:text-emerald-100",
          cardBorder: "border-border-primary hover:border-emerald-400 dark:hover:border-emerald-700"
        };
      case "what_to_test":
        return {
          label: "What to Test",
          icon: FlaskConical,
          badgeBg: "bg-status-info-bg border-status-info-border text-status-info-text",
          headerColor: "text-sky-900 dark:text-sky-100",
          cardBorder: "border-border-primary hover:border-sky-400 dark:hover:border-sky-700"
        };
      case "what_to_refine":
        return {
          label: "What to Refine",
          icon: Wrench,
          badgeBg: "bg-status-warning-bg border-status-warning-border text-status-warning-text",
          headerColor: "text-amber-900 dark:text-amber-100",
          cardBorder: "border-border-primary hover:border-amber-400 dark:hover:border-amber-700"
        };
      case "what_to_avoid_over_repeating":
        return {
          label: "Pacing Adjustment",
          icon: AlertTriangle,
          badgeBg: "bg-status-danger-bg border-status-danger-border text-status-danger-text",
          headerColor: "text-rose-900 dark:text-rose-100",
          cardBorder: "border-border-primary hover:border-rose-400 dark:hover:border-rose-700"
        };
      case "content_mix":
        return {
          label: "Content Mix",
          icon: PieChart,
          badgeBg: "bg-brand-surface border-brand-border text-brand-text-strong",
          headerColor: "text-purple-900 dark:text-purple-100",
          cardBorder: "border-border-primary hover:border-purple-400 dark:hover:border-purple-700"
        };
    }
  };

  const getConfidenceConfig = (conf: string) => {
    switch (conf) {
      case "strong":
        return {
          label: "Strong Evidence",
          color: "bg-status-success-bg text-status-success-text border-status-success-border"
        };
      case "usable":
        return {
          label: "Usable Evidence",
          color: "bg-status-info-bg text-status-info-text border-status-info-border"
        };
      case "limited":
        return {
          label: "Early Signal",
          color: "bg-status-warning-bg text-status-warning-text border-status-warning-border"
        };
      default:
        return {
          label: "Insufficient Data",
          color: "bg-bg-app text-text-secondary border-border-primary"
        };
    }
  };

  const categoryCfg = getCategoryConfig(recommendation.category);
  const confidenceCfg = getConfidenceConfig(recommendation.confidence);
  const CategoryIcon = categoryCfg.icon;

  const isPositiveVariance = recommendation.evidence.variancePercent >= 0;

  return (
    <div 
      className={`bg-bg-card rounded-xl border p-5 transition-all shadow-sm ${categoryCfg.cardBorder}`}
      id={`recommendation-card-${recommendation.id}`}
    >
      {/* Top Header Row: Category Badge + Confidence Badge */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${categoryCfg.badgeBg}`}>
            <CategoryIcon className="w-3.5 h-3.5" />
            {categoryCfg.label}
          </span>
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border ${confidenceCfg.color}`}>
            <ShieldCheck className="w-3 h-3" />
            {confidenceCfg.label}
          </span>
        </div>

        {/* Dimension / Intent Tag */}
        {recommendation.strategicContext.intent && (
          <span className="text-[11px] font-medium uppercase tracking-wider text-text-muted">
            {recommendation.strategicContext.intent.replace("_", " ")}
          </span>
        )}
      </div>

      {/* Title */}
      <h3 className="text-base font-semibold text-text-primary leading-snug">
        {recommendation.title}
      </h3>

      {/* Actionable Recommendation */}
      <p className="text-sm text-text-secondary mt-2 leading-relaxed">
        {recommendation.recommendation}
      </p>

      {/* Factual Rationale */}
      <div className="mt-3 p-3 bg-bg-app rounded-lg border border-border-primary">
        <div className="flex items-start gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-text-muted mt-1.5 flex-shrink-0" />
          <p className="text-xs text-text-secondary leading-relaxed font-mono">
            {recommendation.rationale}
          </p>
        </div>
      </div>

      {/* Strategic Tags Row */}
      <div className="flex flex-wrap items-center gap-2 mt-3.5">
        {recommendation.strategicContext.pillarTitle && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-bg-app border border-border-primary text-text-secondary text-[11px] font-medium rounded">
            <Layers className="w-3 h-3 text-text-muted" />
            Pillar: {recommendation.strategicContext.pillarTitle}
          </span>
        )}
        {recommendation.strategicContext.format && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-bg-app border border-border-primary text-text-secondary text-[11px] font-medium rounded">
            <FileText className="w-3 h-3 text-text-muted" />
            Format: {recommendation.strategicContext.format}
          </span>
        )}
        {recommendation.strategicContext.strategicAngle && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-bg-app border border-border-primary text-text-secondary text-[11px] font-medium rounded">
            <Compass className="w-3 h-3 text-text-muted" />
            Angle: {recommendation.strategicContext.strategicAngle}
          </span>
        )}
        {recommendation.strategicContext.cta && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-bg-app border border-border-primary text-text-secondary text-[11px] font-medium rounded">
            <Send className="w-3 h-3 text-text-muted" />
            CTA: {recommendation.strategicContext.cta}
          </span>
        )}
      </div>

      {/* Action Footer & Evidence Toggle */}
      <div className="flex items-center justify-between pt-3 mt-4 border-t border-border-primary">
        <button
          type="button"
          onClick={() => setIsEvidenceOpen(!isEvidenceOpen)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
        >
          {isEvidenceOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          {isEvidenceOpen ? "Hide Evidence Details" : "View Performance Evidence"}
        </button>

        {recommendation.suggestedAction && onApplyAction && (
          <button
            type="button"
            onClick={() => onApplyAction(recommendation.suggestedAction!)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
          >
            <span>{recommendation.suggestedAction.actionLabel}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Expandable Performance Evidence Drawer */}
      {isEvidenceOpen && (
        <div className="mt-3 pt-3 border-t border-dashed border-border-primary space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="bg-bg-app p-2.5 rounded-lg border border-border-primary">
              <span className="text-[11px] text-text-muted block font-medium">Metric</span>
              <span className="text-xs font-semibold text-text-primary capitalize">
                {recommendation.evidence.metric.replace("_", " ")}
              </span>
            </div>

            <div className="bg-bg-app p-2.5 rounded-lg border border-border-primary">
              <span className="text-[11px] text-text-muted block font-medium">Cohort Median</span>
              <span className="text-xs font-semibold text-text-primary font-mono">
                {recommendation.evidence.metric === "engagement_rate" 
                  ? `${recommendation.evidence.cohortMedian.toFixed(2)}%`
                  : recommendation.evidence.cohortMedian.toLocaleString()}
              </span>
            </div>

            <div className="bg-bg-app p-2.5 rounded-lg border border-border-primary">
              <span className="text-[11px] text-text-muted block font-medium">Creator Baseline</span>
              <span className="text-xs font-semibold text-text-primary font-mono">
                {recommendation.evidence.metric === "engagement_rate"
                  ? `${recommendation.evidence.creatorBaseline.toFixed(2)}%`
                  : recommendation.evidence.creatorBaseline.toLocaleString()}
              </span>
            </div>

            <div className="bg-bg-app p-2.5 rounded-lg border border-border-primary">
              <span className="text-[11px] text-text-muted block font-medium">Variance</span>
              <div className="flex items-center gap-1 mt-0.5">
                {isPositiveVariance ? (
                  <ArrowUpRight className="w-3.5 h-3.5 text-status-success-text" />
                ) : (
                  <ArrowDownRight className="w-3.5 h-3.5 text-status-danger-text" />
                )}
                <span className={`text-xs font-bold font-mono ${isPositiveVariance ? "text-status-success-text" : "text-status-danger-text"}`}>
                  {isPositiveVariance ? "+" : ""}{recommendation.evidence.variancePercent.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>

          <div className="text-[11px] text-text-secondary flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-status-success-text flex-shrink-0" />
            <span>{recommendation.evidence.confidenceExplanation}</span>
          </div>

          {/* Linked Source Posts if available */}
          {recommendation.evidence.sourcePosts && recommendation.evidence.sourcePosts.length > 0 && (
            <div className="mt-2 space-y-1.5">
              <span className="text-[11px] font-semibold text-text-secondary block">
                Source Posts Analyzed:
              </span>
              {recommendation.evidence.sourcePosts.map((post) => (
                <div 
                  key={post.mediaId}
                  className="p-2 bg-bg-app border border-border-primary rounded-md text-xs flex items-center justify-between gap-3"
                >
                  <p className="text-text-secondary truncate flex-1 font-mono text-[11px]">
                    "{post.text}"
                  </p>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-[11px] font-semibold text-text-primary font-mono">
                      {post.views.toLocaleString()} views
                    </span>
                    {onSelectPost && (
                      <button
                        type="button"
                        onClick={() => onSelectPost(post.mediaId)}
                        className="text-brand-text-strong hover:underline text-[11px] font-semibold cursor-pointer"
                      >
                        Inspect
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
