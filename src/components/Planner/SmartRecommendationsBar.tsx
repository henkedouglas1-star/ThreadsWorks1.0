import React, { useMemo } from "react";
import {
  Sparkles,
  Calendar,
  Lightbulb,
  FileText,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowRight,
  CopyCheck,
  Layers,
} from "lucide-react";
import { CanonicalContentRecord, CanonicalStage } from "../../lib/canonicalContent";
import {
  SmartRecommendation,
  buildGroundedRecommendations,
} from "../../lib/contentIntelligence";
import { UserProfile } from "../../types";

interface SmartRecommendationsBarProps {
  records: CanonicalContentRecord[];
  profile?: UserProfile | null;
  onSelectStageFilter: (stage: CanonicalStage | "all" | "unfinished") => void;
  onRecommendationAction: (rec: SmartRecommendation) => void;
}

export default function SmartRecommendationsBar({
  records,
  profile,
  onSelectStageFilter,
  onRecommendationAction,
}: SmartRecommendationsBarProps) {
  const counts = useMemo(() => {
    const map: Record<CanonicalStage, number> = {
      Idea: 0,
      Draft: 0,
      Ready: 0,
      Planned: 0,
      Scheduled: 0,
      Published: 0,
      Failed: 0,
    };
    for (const r of records) {
      map[r.stage] = (map[r.stage] || 0) + 1;
    }
    return map;
  }, [records]);

  const recommendations = useMemo(
    () => buildGroundedRecommendations(records, profile),
    [records, profile]
  );

  const pipelineCards: Array<{
    stage: CanonicalStage;
    label: string;
    count: number;
    accent: string;
    icon: React.ReactNode;
  }> = [
    {
      stage: "Idea",
      label: "Ideas",
      count: counts.Idea,
      accent: "text-sky-800 dark:text-sky-400 border-sky-300 dark:border-sky-500/20 bg-sky-50 dark:bg-sky-500/5 hover:border-sky-400 dark:hover:border-sky-500/40",
      icon: <Lightbulb className="h-3.5 w-3.5 text-sky-700 dark:text-sky-400" />,
    },
    {
      stage: "Draft",
      label: "Drafts",
      count: counts.Draft,
      accent: "text-text-primary border-border-primary bg-bg-card dark:bg-bg-app hover:border-slate-400 dark:hover:border-zinc-500/40",
      icon: <FileText className="h-3.5 w-3.5 text-text-secondary" />,
    },
    {
      stage: "Ready",
      label: "Ready",
      count: counts.Ready,
      accent: "text-teal-800 dark:text-teal-400 border-teal-300 dark:border-teal-500/20 bg-teal-50 dark:bg-teal-500/5 hover:border-teal-400 dark:hover:border-teal-500/40",
      icon: <CheckCircle2 className="h-3.5 w-3.5 text-teal-700 dark:text-teal-400" />,
    },
    {
      stage: "Planned",
      label: "Planned",
      count: counts.Planned,
      accent: "text-status-warning-text border-status-warning-border bg-status-warning-bg hover:border-amber-500",
      icon: <Layers className="h-3.5 w-3.5 text-status-warning-text" />,
    },
    {
      stage: "Scheduled",
      label: "Scheduled",
      count: counts.Scheduled,
      accent: "text-brand-text-strong border-brand-border bg-brand-surface/70 dark:bg-purple-500/5 hover:border-purple-400",
      icon: <Clock className="h-3.5 w-3.5 text-brand-text" />,
    },
    {
      stage: "Published",
      label: "Published",
      count: counts.Published,
      accent: "text-status-success-text border-status-success-border bg-status-success-bg hover:border-emerald-500",
      icon: <Calendar className="h-3.5 w-3.5 text-status-success-text" />,
    },
  ];

  const getRecIcon = (kind: SmartRecommendation["kind"]) => {
    switch (kind) {
      case "failed_recovery":
        return <AlertTriangle className="h-3.5 w-3.5 text-status-danger-text shrink-0" />;
      case "ready_drafts":
        return <CheckCircle2 className="h-3.5 w-3.5 text-teal-700 dark:text-teal-400 shrink-0" />;
      case "open_day":
        return <Calendar className="h-3.5 w-3.5 text-status-warning-text shrink-0" />;
      case "saved_idea":
        return <Lightbulb className="h-3.5 w-3.5 text-sky-700 dark:text-sky-400 shrink-0" />;
      case "duplicates":
        return <CopyCheck className="h-3.5 w-3.5 text-orange-700 dark:text-orange-400 shrink-0" />;
      default:
        return <Sparkles className="h-3.5 w-3.5 text-brand-text shrink-0" />;
    }
  };

  return (
    <div className="space-y-3" id="smart-recommendations-bar">
      {/* Lifecycle Overview Strip */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {pipelineCards.map((card) => (
          <button
            key={card.stage}
            type="button"
            onClick={() => onSelectStageFilter(card.stage)}
            className={`rounded-xl border px-3 py-2.5 transition cursor-pointer flex items-center justify-between gap-2 ${card.accent}`}
          >
            <div className="flex items-center gap-1.5 min-w-0">
              {card.icon}
              <span className="text-[11px] font-semibold text-text-primary dark:text-text-secondary truncate">
                {card.label}
              </span>
            </div>
            <span className="text-sm font-bold font-mono text-text-primary shrink-0">
              {card.count}
            </span>
          </button>
        ))}
      </div>

      {/* Failed Recovery Alert Strip if any failed records exist */}
      {counts.Failed > 0 && (
        <div className="rounded-xl border border-status-danger-border bg-status-danger-bg px-3.5 py-2.5 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-xs text-status-danger-text">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span className="font-semibold">
              {counts.Failed} {counts.Failed === 1 ? "post" : "posts"} failed to publish and can be recovered or rescheduled.
            </span>
          </div>
          <button
            type="button"
            onClick={() => onSelectStageFilter("Failed")}
            className="inline-flex items-center gap-1 rounded-lg border border-status-danger-border bg-bg-card dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 px-2.5 py-1 text-[11px] font-bold text-status-danger-text transition cursor-pointer"
          >
            <span>Review Failed</span>
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Grounded Smart Recommendations */}
      {recommendations.length > 0 && (
        <div className="rounded-2xl border border-border-primary bg-bg-card p-3.5 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-brand-text" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-text-primary">
                Next Best Actions
              </span>
            </div>
            <span className="text-[10px] text-text-secondary">
              Based on your saved content &amp; current week
            </span>
          </div>

          <div className="grid gap-2 md:grid-cols-3">
            {recommendations.slice(0, 3).map((rec) => (
              <div
                key={rec.id}
                className="rounded-xl border border-border-primary bg-bg-app p-3 flex flex-col justify-between gap-2.5 hover:border-purple-500/40 transition"
              >
                <div className="flex items-start gap-2">
                  <div className="mt-0.5">{getRecIcon(rec.kind)}</div>
                  <div className="space-y-1 min-w-0">
                    <p className="!text-left !mx-0 text-xs font-semibold text-text-primary leading-snug">
                      {rec.message}
                    </p>
                    {rec.detail && (
                      <p className="!text-left !mx-0 text-[11px] text-text-secondary leading-snug">
                        {rec.detail}
                      </p>
                    )}
                  </div>
                </div>
                {rec.actionLabel && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => onRecommendationAction(rec)}
                      className="inline-flex items-center gap-1 rounded-lg border border-brand-border bg-brand-surface hover:bg-brand-surface-hover px-2.5 py-1 text-[11px] font-bold text-brand-text-strong transition cursor-pointer"
                    >
                      <span>{rec.actionLabel}</span>
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
