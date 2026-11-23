import React, { useState, useEffect } from "react";
import {
  CreatorProfileData,
  CreatorIntelligenceProfile,
  CoCreationPitchResponse,
} from "../../types/influencer";
import { generateCoCreationPitchApi, buildThreadsProfileUrl, getThreadsProfileUrl, normalizeThreadsUsername } from "../../utils/influencerApi";
import {
  X,
  Sparkles,
  Layers,
  Copy,
  Check,
  RefreshCw,
  FileText,
  UserCheck,
  Zap,
  Send,
  ExternalLink,
} from "lucide-react";

interface CoCreationStudioModalProps {
  creator: CreatorProfileData;
  intelligence?: CreatorIntelligenceProfile | null;
  userContext?: any;
  onClose: () => void;
  onOpenDM?: () => void;
}

export default function CoCreationStudioModal({
  creator,
  intelligence,
  userContext,
  onClose,
  onOpenDM,
}: CoCreationStudioModalProps) {
  const [pitchData, setPitchData] = useState<CoCreationPitchResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<"concepts" | "onepager">("concepts");
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedMarkdown, setCopiedMarkdown] = useState<boolean>(false);

  const fetchPitch = async () => {
    setIsLoading(true);
    try {
      const res = await generateCoCreationPitchApi(creator, intelligence || undefined, userContext);
      if (res.success && res.pitch) {
        setPitchData(res.pitch);
      }
    } catch (err) {
      console.error("[CoCreationStudioModal] Pitch error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPitch();
  }, [creator.username]);

  const handleCopyConcept = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleCopyMarkdown = () => {
    if (!pitchData?.onePagerMarkdown) return;
    navigator.clipboard.writeText(pitchData.onePagerMarkdown);
    setCopiedMarkdown(true);
    setTimeout(() => setCopiedMarkdown(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-bg-card border border-border-primary rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-border-primary px-6 py-4 bg-bg-sidebar/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
              <Sparkles className="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
                Co-Creation Concept Studio
                {(() => {
                  const handle = normalizeThreadsUsername(creator.threadsUsername || creator.username);
                  const profileUrl = creator.threadsProfileUrl || buildThreadsProfileUrl(handle);
                  return profileUrl && handle ? (
                    <a
                      href={profileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-mono px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-300 hover:underline inline-flex items-center gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      @{handle}
                      <ExternalLink className="w-3 h-3 shrink-0" />
                    </a>
                  ) : (
                    <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-bg-card-hover text-text-muted">
                      Profile not verified
                    </span>
                  );
                })()}
              </h2>
              <p className="text-xs text-text-secondary">AI-generated joint thread concepts & co-authored pitch one-pager</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-text-muted hover:text-text-primary hover:bg-bg-card-hover transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center gap-2 px-6 pt-4 border-b border-border-primary bg-bg-sidebar/30">
          <button
            onClick={() => setActiveTab("concepts")}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold border-b-2 transition cursor-pointer ${
              activeTab === "concepts"
                ? "border-purple-600 text-purple-600 dark:text-purple-400"
                : "border-transparent text-text-secondary hover:text-text-primary"
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Joint Thread Concepts (3)</span>
          </button>

          <button
            onClick={() => setActiveTab("onepager")}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold border-b-2 transition cursor-pointer ${
              activeTab === "onepager"
                ? "border-purple-600 text-purple-600 dark:text-purple-400"
                : "border-transparent text-text-secondary hover:text-text-primary"
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Shareable Proposal One-Pager</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {isLoading ? (
            <div className="py-16 text-center space-y-3">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-purple-500" />
              <p className="text-xs text-text-muted">Analyzing profile overlap and synthesizing joint thread concepts...</p>
            </div>
          ) : !pitchData ? (
            <div className="py-12 text-center text-xs text-text-muted">Failed to generate co-creation concepts. Please retry.</div>
          ) : activeTab === "concepts" ? (
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20 text-xs text-purple-600 dark:text-purple-300">
                <span className="font-bold">Pitch Strategic Angle:</span> {pitchData.pitchHeadline}
              </div>

              <div className="space-y-5">
                {pitchData.concepts.map((concept, idx) => (
                  <div
                    key={idx}
                    className="p-5 rounded-2xl bg-bg-card border border-border-primary space-y-4 shadow-sm hover:border-purple-500/40 transition"
                  >
                    <div className="flex items-start justify-between gap-3 border-b border-border-primary pb-3">
                      <div>
                        <span className="text-[10px] font-mono font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">
                          Concept #{idx + 1}
                        </span>
                        <h3 className="text-sm font-bold text-text-primary mt-0.5">{concept.title}</h3>
                      </div>
                      <button
                        onClick={() => handleCopyConcept(concept.pitchDmSummary, idx)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-bg-sidebar border border-border-primary text-text-primary hover:text-purple-600 text-xs font-semibold transition cursor-pointer shrink-0"
                      >
                        {copiedIndex === idx ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-text-muted" />}
                        <span>{copiedIndex === idx ? "Pitch Copied" : "Copy Pitch DM"}</span>
                      </button>
                    </div>

                    <p className="text-xs text-text-secondary leading-relaxed">{concept.dualAngleSummary}</p>

                    {/* Dual Roles */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div className="p-3 rounded-xl bg-bg-sidebar border border-border-primary text-xs space-y-1">
                        <span className="text-[10px] font-bold text-text-muted uppercase">Your Angle / Role</span>
                        <p className="text-text-primary font-medium">{concept.myPerspectiveRole}</p>
                      </div>

                      <div className="p-3 rounded-xl bg-purple-500/5 border border-purple-500/20 text-xs space-y-1">
                        <span className="text-[10px] font-bold text-purple-600 dark:text-purple-300 uppercase">@{normalizeThreadsUsername(creator.username)}'s Role</span>
                        <p className="text-text-primary font-medium">{concept.creatorPerspectiveRole}</p>
                      </div>
                    </div>

                    {/* Thread Outline */}
                    <div className="space-y-2 pt-2 border-t border-border-primary/60">
                      <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Co-Authored Thread Structure</span>
                      <div className="space-y-1.5">
                        {concept.outlinePosts.map((post, pIdx) => (
                          <div key={pIdx} className="flex items-start gap-2 text-xs text-text-secondary">
                            <span className="font-mono font-bold text-purple-500 shrink-0">P{pIdx + 1}.</span>
                            <span>{post}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* Markdown One-Pager View */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-text-secondary uppercase tracking-wider">Proposal Document (Markdown)</span>
                <button
                  onClick={handleCopyMarkdown}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition shadow-md cursor-pointer"
                >
                  {copiedMarkdown ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedMarkdown ? "Markdown Copied" : "Copy Full Proposal"}</span>
                </button>
              </div>

              <div className="p-5 rounded-2xl bg-bg-sidebar border border-border-primary font-mono text-xs text-text-primary whitespace-pre-wrap leading-relaxed max-h-[450px] overflow-y-auto">
                {pitchData.onePagerMarkdown}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border-primary bg-bg-sidebar/50 flex justify-between items-center">
          <button
            onClick={fetchPitch}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-bg-card border border-border-primary text-text-secondary hover:text-text-primary text-xs font-semibold transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            Regenerate Concepts
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-bg-card-hover border border-border-primary text-text-primary text-xs font-bold cursor-pointer"
            >
              Close
            </button>
            {onOpenDM && (
              <button
                onClick={() => {
                  onClose();
                  onOpenDM();
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition shadow-md shadow-purple-600/20 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                Send Pitch DM
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
