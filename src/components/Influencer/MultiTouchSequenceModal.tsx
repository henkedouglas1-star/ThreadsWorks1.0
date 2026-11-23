import React, { useState, useEffect } from "react";
import {
  CreatorProfileData,
  CreatorIntelligenceProfile,
  MultiTouchSequenceResponse,
  OutreachObjective,
} from "../../types/influencer";
import { generateSequenceApi, buildThreadsProfileUrl, getThreadsProfileUrl, normalizeThreadsUsername } from "../../utils/influencerApi";
import {
  X,
  Sparkles,
  Calendar,
  Clock,
  Copy,
  Check,
  Send,
  ArrowRight,
  Layers,
  Zap,
  ExternalLink,
} from "lucide-react";

interface MultiTouchSequenceModalProps {
  creator: CreatorProfileData;
  intelligence?: CreatorIntelligenceProfile | null;
  userContext?: any;
  onClose: () => void;
  onOpenDM: (creator: CreatorProfileData, intelligence?: CreatorIntelligenceProfile) => void;
}

export default function MultiTouchSequenceModal({
  creator,
  intelligence,
  userContext,
  onClose,
  onOpenDM,
}: MultiTouchSequenceModalProps) {
  const [objective, setObjective] = useState<OutreachObjective>("collaboration");
  const [sequence, setSequence] = useState<MultiTouchSequenceResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [copiedStep, setCopiedStep] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState<boolean>(false);
  const [activeStep, setActiveStep] = useState<number>(1);

  const fetchSequence = async (selectedObj = objective) => {
    setIsLoading(true);
    try {
      const res = await generateSequenceApi(creator, intelligence || undefined, selectedObj, userContext);
      if (res.success && res.sequence) {
        setSequence(res.sequence);
      }
    } catch (err) {
      console.error("[MultiTouchSequenceModal] Sequence error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSequence();
  }, [creator.username]);

  const handleCopyStep = (stepNumber: number, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedStep(stepNumber);
    setTimeout(() => setCopiedStep(null), 2000);
  };

  const handleCopyAll = () => {
    if (!sequence) return;
    const fullText = sequence.steps
      .map(
        (s) =>
          `--- STEP ${s.stepNumber}: ${s.title.toUpperCase()} (Day ${s.delayDays}) ---\nSend Window: ${s.recommendedTimeWindow}\n\n${s.dmText}\n`
      )
      .join("\n\n");
    navigator.clipboard.writeText(fullText);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-bg-card border border-border-primary rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-border-primary px-6 py-4 bg-bg-sidebar/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
                Multi-Touch DM Sequence
                {(() => {
                  const handle = normalizeThreadsUsername(creator.threadsUsername || creator.username);
                  const profileUrl = creator.threadsProfileUrl || buildThreadsProfileUrl(handle);
                  return profileUrl && handle ? (
                    <a
                      href={profileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-mono font-normal text-purple-600 dark:text-purple-300 px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20 hover:underline inline-flex items-center gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      @{handle}
                      <ExternalLink className="w-3 h-3 shrink-0" />
                    </a>
                  ) : (
                    <span className="text-xs font-mono font-normal text-text-muted px-2 py-0.5 rounded-full bg-bg-card-hover border border-border-primary">
                      Profile not verified
                    </span>
                  );
                })()}
              </h2>
              <p className="text-xs text-text-secondary">
                Automated 3-step value-add follow-up schedule with optimal timing
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-text-muted hover:text-text-primary hover:bg-bg-card-hover transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Controls Header */}
        <div className="px-6 py-4 bg-bg-sidebar/30 border-b border-border-primary flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-text-secondary uppercase tracking-wider">Objective:</span>
            <select
              value={objective}
              onChange={(e) => {
                const val = e.target.value as OutreachObjective;
                setObjective(val);
                fetchSequence(val);
              }}
              className="px-3 py-1.5 rounded-xl bg-bg-card border border-border-primary text-xs font-medium text-text-primary focus:outline-none focus:border-purple-500 cursor-pointer"
            >
              <option value="collaboration">Co-Creation & Collaboration</option>
              <option value="relationship_building">High-Trust Relationship Building</option>
              <option value="podcast_interview">Podcast / Interview Invite</option>
              <option value="promotion">Product Promotion & Launch</option>
              <option value="affiliate_partnership">Affiliate & Revenue Share</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyAll}
              disabled={isLoading || !sequence}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-bg-card-hover border border-border-primary text-text-primary text-xs font-semibold hover:bg-bg-sidebar transition cursor-pointer"
            >
              {copiedAll ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-purple-500" />}
              {copiedAll ? "Sequence Copied" : "Copy Full Sequence"}
            </button>
          </div>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {isLoading ? (
            <div className="py-16 text-center space-y-3">
              <Sparkles className="w-8 h-8 text-purple-500 animate-spin mx-auto" />
              <p className="text-sm font-medium text-text-primary">Structuring Multi-Touch Outreach Sequence...</p>
              <p className="text-xs text-text-muted">Calculating optimal time windows and non-needy follow-up angles</p>
            </div>
          ) : sequence ? (
            <>
              {/* Optimal Send Timing Banner */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-purple-900/15 via-bg-card to-bg-card border border-purple-500/30 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-300">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] font-mono uppercase font-bold text-purple-600 dark:text-purple-300 block">
                      Recommended Send Window
                    </span>
                    <p className="text-xs font-semibold text-text-primary">{sequence.optimalSendWindow}</p>
                  </div>
                </div>
                <span className="text-[10px] font-mono px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-bold shrink-0">
                  Peak Activity Window
                </span>
              </div>

              {/* Step Selector Tabs */}
              <div className="grid grid-cols-3 gap-2">
                {sequence.steps.map((s) => (
                  <button
                    key={s.stepNumber}
                    onClick={() => setActiveStep(s.stepNumber)}
                    className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                      activeStep === s.stepNumber
                        ? "bg-purple-600/10 border-purple-500/50 text-text-primary"
                        : "bg-bg-sidebar border-border-primary text-text-secondary hover:text-text-primary"
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] font-mono uppercase mb-1">
                      <span className="font-bold text-purple-600 dark:text-purple-300">Touchpoint {s.stepNumber}</span>
                      <span className="text-text-muted">Day {s.delayDays}</span>
                    </div>
                    <div className="text-xs font-bold truncate">{s.title}</div>
                  </button>
                ))}
              </div>

              {/* Active Step Detailed Card */}
              {sequence.steps
                .filter((s) => s.stepNumber === activeStep)
                .map((s) => (
                  <div key={s.stepNumber} className="p-5 rounded-2xl bg-bg-card border border-border-primary space-y-4">
                    <div className="flex items-center justify-between border-b border-border-primary/60 pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-extrabold text-purple-600 dark:text-purple-300 uppercase font-mono">
                            Step {s.stepNumber}: {s.title}
                          </span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-bg-sidebar border border-border-primary text-text-muted">
                            {s.delayDays === 0 ? "Send Immediately (Day 0)" : `Wait ${s.delayDays} Days`}
                          </span>
                        </div>
                        <p className="text-xs text-text-secondary mt-1">{s.angleExplanation}</p>
                      </div>

                      <button
                        onClick={() => handleCopyStep(s.stepNumber, s.dmText)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition shadow-md shadow-purple-600/20 cursor-pointer shrink-0"
                      >
                        {copiedStep === s.stepNumber ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        {copiedStep === s.stepNumber ? "Copied Step" : "Copy Step DM"}
                      </button>
                    </div>

                    {/* Message Box */}
                    <div className="p-4 rounded-xl bg-bg-sidebar border border-border-primary/80 font-mono text-xs text-text-primary whitespace-pre-wrap leading-relaxed shadow-inner">
                      {s.dmText}
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-text-muted pt-1">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-purple-500" />
                        Send Window: {s.recommendedTimeWindow}
                      </span>
                      <span>Length: ~{s.dmText.split(" ").length} words</span>
                    </div>
                  </div>
                ))}
            </>
          ) : (
            <p className="text-xs text-text-muted italic text-center py-8">Failed to generate sequence.</p>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border-primary bg-bg-sidebar/50 flex items-center justify-between shrink-0">
          <span className="text-xs text-text-muted flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-500" /> Non-needy value-add schedule designed for maximum response
          </span>
          <button
            onClick={() => {
              onClose();
              onOpenDM(creator, intelligence || undefined);
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-bg-card-hover border border-border-primary text-text-primary hover:bg-bg-sidebar text-xs font-bold transition cursor-pointer"
          >
            Open Single DM Editor <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
