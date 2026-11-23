import React, { useState, useEffect } from "react";
import {
  CreatorProfileData,
  CreatorIntelligenceProfile,
  OutreachObjective,
  DMGenerationResponse,
  OutreachResponseStatus,
} from "../../types/influencer";
import { generateDMApi, generateFollowUpDMApi, recordOutreachApi, buildThreadsProfileUrl, getThreadsProfileUrl, normalizeThreadsUsername } from "../../utils/influencerApi";
import {
  X,
  Sparkles,
  Send,
  Copy,
  Check,
  RefreshCw,
  Zap,
  ShieldCheck,
  AlignLeft,
  Flame,
  CornerDownRight,
  UserCheck,
  Layers,
  ExternalLink,
} from "lucide-react";

import MultiTouchSequenceModal from "./MultiTouchSequenceModal";

interface PersonalizedDMModalProps {
  creator: CreatorProfileData;
  intelligence?: CreatorIntelligenceProfile | null;
  userId: string;
  isFollowUpMode?: boolean;
  originalDmText?: string;
  savedInfluencerId?: string;
  userContext?: any;
  onClose: () => void;
  onOutreachRecorded?: () => void;
}

export default function PersonalizedDMModal({
  creator,
  intelligence,
  userId,
  isFollowUpMode = false,
  originalDmText = "",
  savedInfluencerId,
  userContext,
  onClose,
  onOutreachRecorded,
}: PersonalizedDMModalProps) {
  const [selectedObjective, setSelectedObjective] = useState<OutreachObjective>("collaboration");
  const [customObjective, setCustomObjective] = useState("");
  const [toneAdjustment, setToneAdjustment] = useState<"default" | "shorter" | "casual" | "direct" | "warmer">("default");

  const [generatedDm, setGeneratedDm] = useState<string>("");
  const [whyItWorks, setWhyItWorks] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordedSuccess, setRecordedSuccess] = useState<boolean>(false);

  const [notes, setNotes] = useState<string>("");
  const [showSequenceModal, setShowSequenceModal] = useState<boolean>(false);

  useEffect(() => {
    handleGenerateDM("default");
  }, []);

  const handleGenerateDM = async (tone: "default" | "shorter" | "casual" | "direct" | "warmer" = toneAdjustment) => {
    setIsGenerating(true);
    setRecordedSuccess(false);

    try {
      if (isFollowUpMode && originalDmText) {
        const res = await generateFollowUpDMApi({
          influencer: creator,
          intelligence: intelligence || ({} as any),
          originalDmText,
          timeSinceContact: "3 days ago",
          previousStatus: "contacted",
          objective: selectedObjective,
        });

        if (res.success && res.data) {
          setGeneratedDm(res.data.dmText);
          setWhyItWorks(res.data.whyThisDmWorks);
        }
      } else {
        const res = await generateDMApi({
          influencer: creator,
          intelligence: intelligence || ({} as any),
          objective: selectedObjective,
          customObjective: selectedObjective === "custom" ? customObjective : undefined,
          toneAdjustment: tone,
        });

        if (res.success && res.data) {
          setGeneratedDm(res.data.dmText);
          setWhyItWorks(res.data.whyThisDmWorks);
        }
      }
    } catch (err) {
      console.error("[PersonalizedDMModal] Generation failed:", err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    if (!generatedDm) return;
    navigator.clipboard.writeText(generatedDm);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleExecuteAndRecord = async () => {
    if (!generatedDm) return;
    handleCopy();
    setIsRecording(true);

    try {
      if (savedInfluencerId) {
        await recordOutreachApi({
          userId,
          influencerId: savedInfluencerId,
          objective: selectedObjective,
          dmText: generatedDm,
          whyThisDmWorks: whyItWorks,
          status: "contacted",
          notes,
          isFollowUp: isFollowUpMode,
        });
      }

      setRecordedSuccess(true);
      if (onOutreachRecorded) {
        onOutreachRecorded();
      }
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      console.error("[PersonalizedDMModal] Record outreach failed:", err);
    } finally {
      setIsRecording(false);
    }
  };

  const objectivesList: Array<{ id: OutreachObjective; label: string; desc: string }> = [
    { id: "collaboration", label: "Collaboration", desc: "Co-create content or thread series" },
    { id: "relationship_building", label: "Relationship Building", desc: "High-trust strategic peer connection" },
    { id: "podcast_interview", label: "Podcast / Interview", desc: "Featured breakdown or interview" },
    { id: "promotion", label: "Promotion", desc: "Cross-promotion or offer exposure" },
    { id: "affiliate_partnership", label: "Affiliate Partnership", desc: "Revenue share or affiliate deal" },
    { id: "product_partnership", label: "Product Partnership", desc: "Co-building tool features" },
    { id: "expert_connection", label: "Expert Connection", desc: "Domain problem perspective" },
    { id: "custom", label: "Custom Reason", desc: "Specify custom relationship goal" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-bg-card border border-border-primary rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-primary px-6 py-4 bg-bg-sidebar/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
                {isFollowUpMode ? "Create Follow-Up DM" : "Personalized DM Engine"}
              </h2>
              <p className="text-xs text-text-secondary">
                Grounded in @{normalizeThreadsUsername(creator.username)}'s content & your ThreadsWorks profile
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-text-muted hover:text-text-primary hover:bg-bg-card-hover transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Target Creator Context Banner */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/20">
            <div className="flex items-center gap-3">
              <img
                src={creator.profilePicUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${creator.username}`}
                alt={creator.name}
                className="w-10 h-10 rounded-xl border border-purple-500/30 object-cover shrink-0"
              />
              <div>
                <span className="text-xs font-bold text-text-primary">{creator.name}</span>
                {(() => {
                  const handle = normalizeThreadsUsername(creator.threadsUsername || creator.username);
                  const profileUrl = creator.threadsProfileUrl || buildThreadsProfileUrl(handle);
                  return profileUrl && handle ? (
                    <a
                      href={profileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-mono text-purple-600 dark:text-purple-400 ml-2 hover:underline inline-flex items-center gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      @{handle}
                      <ExternalLink className="w-3 h-3 shrink-0" />
                    </a>
                  ) : (
                    <span className="text-xs font-mono text-text-muted ml-2">
                      Profile not verified
                    </span>
                  );
                })()}
                <p className="text-[11px] text-text-secondary line-clamp-1">{creator.bio}</p>
              </div>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-600 dark:text-purple-300 shrink-0">
              {creator.niche}
            </span>
          </div>

          {/* Objective Selector */}
          {!isFollowUpMode && (
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-text-secondary flex items-center justify-between">
                <span>Select Outreach Objective</span>
                <span className="text-[10px] text-text-muted font-normal font-mono">Why are you reaching out?</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {objectivesList.map((obj) => (
                  <button
                    key={obj.id}
                    onClick={() => {
                      setSelectedObjective(obj.id);
                      handleGenerateDM(toneAdjustment);
                    }}
                    className={`p-2.5 rounded-xl text-left border transition cursor-pointer flex flex-col justify-between ${
                      selectedObjective === obj.id
                        ? "bg-purple-600/15 border-purple-500 text-purple-600 dark:text-purple-300 font-bold"
                        : "bg-bg-card-hover border-border-primary text-text-secondary hover:text-text-primary"
                    }`}
                  >
                    <span className="text-xs leading-tight">{obj.label}</span>
                    <span className="text-[10px] text-text-muted line-clamp-1 mt-1 font-normal">{obj.desc}</span>
                  </button>
                ))}
              </div>

              {selectedObjective === "custom" && (
                <input
                  type="text"
                  placeholder="e.g. Invite to co-host an upcoming X Space / Threads event"
                  value={customObjective}
                  onChange={(e) => setCustomObjective(e.target.value)}
                  onBlur={() => handleGenerateDM(toneAdjustment)}
                  className="w-full mt-2 px-3 py-2 rounded-xl bg-bg-sidebar border border-border-primary text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-purple-500"
                />
              )}
            </div>
          )}

          {/* Tone Modifiers */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border-primary">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-bold text-text-muted mr-1">Tone:</span>
              {[
                { id: "default", label: "Balanced" },
                { id: "shorter", label: "Shorter" },
                { id: "casual", label: "More Casual" },
                { id: "direct", label: "More Direct" },
                { id: "warmer", label: "Warmer" },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    const newTone = t.id as any;
                    setToneAdjustment(newTone);
                    handleGenerateDM(newTone);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer border ${
                    toneAdjustment === t.id
                      ? "bg-purple-600 text-white border-purple-600 font-bold"
                      : "bg-bg-card-hover border-border-primary text-text-secondary hover:text-text-primary"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowSequenceModal(true)}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold text-purple-600 dark:text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 transition cursor-pointer border border-purple-500/30"
              >
                <Layers className="w-3.5 h-3.5" />
                Generate 3-Step Sequence
              </button>

              <button
                onClick={() => handleGenerateDM(toneAdjustment)}
                disabled={isGenerating}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold text-text-secondary hover:text-text-primary hover:bg-bg-card-hover transition cursor-pointer border border-border-primary"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? "animate-spin" : ""}`} />
                Regenerate
              </button>
            </div>
          </div>

          {/* Generated DM Box */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-text-secondary flex items-center gap-1.5">
                <Send className="w-3.5 h-3.5 text-purple-500" />
                Primary Ready-To-Send Message
              </label>
              <span className="text-[10px] text-text-muted font-mono">
                {generatedDm.length} chars (~{generatedDm.split(/\s+/).filter(Boolean).length} words)
              </span>
            </div>

            <div className="relative">
              {isGenerating ? (
                <div className="min-h-[140px] rounded-xl bg-bg-sidebar border border-border-primary p-6 flex flex-col items-center justify-center gap-2">
                  <Sparkles className="w-6 h-6 text-purple-500 animate-spin" />
                  <p className="text-xs text-text-secondary font-medium">
                    Finding intersection & crafting DM...
                  </p>
                </div>
              ) : (
                <textarea
                  value={generatedDm}
                  onChange={(e) => setGeneratedDm(e.target.value)}
                  rows={5}
                  className="w-full rounded-xl bg-bg-sidebar border border-border-primary p-4 text-xs font-mono leading-relaxed text-text-primary focus:outline-none focus:border-purple-500 resize-y shadow-inner"
                  placeholder="Generated message will appear here..."
                />
              )}
            </div>
          </div>

          {/* Why This DM Works Internal Explanation */}
          {whyItWorks && !isGenerating && (
            <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-950/20 via-bg-sidebar to-bg-card border border-emerald-500/30 space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                <UserCheck className="w-4 h-4" />
                Why This DM Works (Internal Connection Breakdown)
              </div>
              <p className="text-xs text-text-secondary leading-relaxed pl-6">
                {whyItWorks}
              </p>
            </div>
          )}

          {/* Outreach Notes input */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-text-muted uppercase tracking-wider">
              Outreach Notes (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Sent via Threads App on 9/18, following up next week"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-bg-sidebar border border-border-primary text-xs text-text-primary focus:outline-none focus:border-purple-500"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-border-primary bg-bg-sidebar/60 flex items-center justify-between shrink-0">
          <div className="text-xs text-text-muted flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            Copy to clipboard & update database status cleanly
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              disabled={!generatedDm}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-bg-card-hover border border-border-primary text-text-primary text-xs font-semibold hover:bg-bg-sidebar transition cursor-pointer"
            >
              {isCopied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              {isCopied ? "Copied!" : "Copy DM"}
            </button>

            <button
              onClick={handleExecuteAndRecord}
              disabled={!generatedDm || isRecording}
              className={`flex items-center gap-2 px-5 py-2 rounded-xl text-white text-xs font-bold transition shadow-lg cursor-pointer ${
                recordedSuccess
                  ? "bg-emerald-600"
                  : "bg-purple-600 hover:bg-purple-700 shadow-purple-600/25"
              }`}
            >
              {recordedSuccess ? (
                <>
                  <Check className="w-4 h-4" />
                  Recorded & Marked Contacted!
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Copy & Mark Contacted
                </>
              )}
            </button>
          </div>
        </div>

        {/* Multi-Touch Sequence Modal Overlay */}
        {showSequenceModal && (
          <MultiTouchSequenceModal
            creator={creator}
            intelligence={intelligence}
            userContext={userContext}
            onClose={() => setShowSequenceModal(false)}
            onOpenDM={() => setShowSequenceModal(false)}
          />
        )}
      </div>
    </div>
  );
}
