import React from "react";
import { StrategicObservation, SampleSizeConfidence } from "../../types/intelligence";
import { Lightbulb, Award, AlertCircle, ShieldCheck, CheckCircle2 } from "lucide-react";

interface StrategicObservationsCardProps {
  observations: StrategicObservation[];
}

function getConfidenceBadge(confidence: SampleSizeConfidence) {
  switch (confidence) {
    case "strong":
      return {
        label: "Strong Evidence",
        classes: "bg-status-success-bg text-status-success-text border-status-success-border",
        icon: ShieldCheck
      };
    case "usable":
      return {
        label: "Usable Pattern",
        classes: "bg-status-info-bg text-status-info-text border-status-info-border",
        icon: Award
      };
    default:
      return {
        label: "Limited Evidence",
        classes: "bg-status-warning-bg text-status-warning-text border-status-warning-border",
        icon: AlertCircle
      };
  }
}

export default function StrategicObservationsCard({ observations }: StrategicObservationsCardProps) {
  if (!observations || observations.length === 0) return null;

  return (
    <div className="bg-bg-card border border-border-primary rounded-xl p-5 sm:p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border-primary">
        <span className="p-1.5 rounded bg-brand-surface border border-brand-border text-brand-text">
          <Lightbulb className="w-4 h-4" />
        </span>
        <div>
          <h3 className="text-base font-semibold text-text-primary tracking-tight">
            Historical Strategic Patterns
          </h3>
          <p className="text-xs text-text-secondary mt-0.5">
            Objective pattern correlations derived from your historical post performance and Content Memory attributes.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {observations.map((obs) => {
          const badge = getConfidenceBadge(obs.confidence);
          const BadgeIcon = badge.icon;

          return (
            <div
              key={obs.id}
              className="p-3.5 rounded-lg border border-border-primary bg-bg-app flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <h4 className="text-xs font-semibold text-text-primary">
                    {obs.title}
                  </h4>
                  <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border shrink-0 ${badge.classes}`}>
                    <BadgeIcon className="w-3 h-3" />
                    <span>{badge.label}</span>
                  </div>
                </div>

                <p className="text-xs text-text-secondary leading-relaxed font-normal">
                  {obs.statement}
                </p>
              </div>

              {obs.sampleSize > 0 && (
                <div className="mt-2 text-[10px] text-text-muted">
                  Sample size: {obs.sampleSize} {obs.sampleSize === 1 ? "post" : "posts"}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
