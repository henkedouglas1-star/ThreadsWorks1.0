import React, { useState, useEffect } from "react";
import {
  CreatorProfileData,
  BulkDMResult,
  OutreachObjective,
} from "../../types/influencer";
import { generateBulkDMApi, recordOutreachApi, buildThreadsProfileUrl, getThreadsProfileUrl, normalizeThreadsUsername } from "../../utils/influencerApi";
import {
  X,
  Sparkles,
  Users,
  Copy,
  Check,
  Send,
  Download,
  CheckCircle2,
  ListOrdered,
  ExternalLink,
} from "lucide-react";

interface BulkDMModalProps {
  userId: string;
  selectedCreators: CreatorProfileData[];
  userContext?: any;
  onClose: () => void;
  onRefreshSaved?: () => void;
}

export default function BulkDMModal({
  userId,
  selectedCreators,
  userContext,
  onClose,
  onRefreshSaved,
}: BulkDMModalProps) {
  const [objective, setObjective] = useState<OutreachObjective>("collaboration");
  const [results, setResults] = useState<BulkDMResult[]>([]);
  const [isGenerating, setIsGenerating] = useState<boolean>(true);
  const [activeCreatorIndex, setActiveCreatorIndex] = useState<number>(0);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState<boolean>(false);
  const [recordingStatus, setRecordingStatus] = useState<Record<string, boolean>>({});

  const handleGenerateBulk = async (objToUse = objective) => {
    setIsGenerating(true);
    try {
      const res = await generateBulkDMApi(selectedCreators, objToUse, userContext);
      if (res.success && res.results) {
        setResults(res.results);
      }
    } catch (err) {
      console.error("[BulkDMModal] Generation error:", err);
    } finally {
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    if (selectedCreators.length > 0) {
      handleGenerateBulk();
    }
  }, [selectedCreators]);

  const handleCopySingle = (index: number, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleCopyAll = () => {
    if (results.length === 0) return;
    const fullText = results
      .map(
        (r) =>
          `=== @${r.creator.username} (${r.creator.name}) ===\nWhy it works: ${r.whyThisDmWorks}\n\n${r.dmText}\n`
      )
      .join("\n----------------------------------------\n\n");
    navigator.clipboard.writeText(fullText);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const handleDownloadCsv = () => {
    if (results.length === 0) return;
    const csvRows = [
      ["Username", "Name", "Niche", "Personalized DM", "Why DM Works"].join(","),
      ...results.map((r) =>
        [
          `"${r.creator.username}"`,
          `"${r.creator.name}"`,
          `"${r.creator.niche}"`,
          `"${r.dmText.replace(/"/g, '""')}"`,
          `"${r.whyThisDmWorks.replace(/"/g, '""')}"`,
        ].join(",")
      ),
    ];

    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `threads_bulk_dms_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleMarkContacted = async (result: BulkDMResult) => {
    const creatorId = result.creator.id || result.creator.username;
    setRecordingStatus((prev) => ({ ...prev, [creatorId]: true }));
    try {
      await recordOutreachApi({
        userId,
        influencerId: creatorId,
        objective,
        dmText: result.dmText,
        whyThisDmWorks: result.whyThisDmWorks,
        status: "contacted",
      });
      if (onRefreshSaved) onRefreshSaved();
    } catch (err) {
      console.error("[BulkDMModal] Failed to record outreach:", err);
    }
  };

  const currentResult = results[activeCreatorIndex];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-bg-card border border-border-primary rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-primary px-6 py-4 bg-bg-sidebar/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
                Batch DM Personalization
                <span className="text-xs font-mono font-normal text-purple-600 dark:text-purple-300 px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20">
                  {selectedCreators.length} Creators Selected
                </span>
              </h2>
              <p className="text-xs text-text-secondary">
                Parallel AI generation of dual-grounded DMs for all selected creators
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

        {/* Toolbar */}
        <div className="px-6 py-3.5 bg-bg-sidebar/30 border-b border-border-primary flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-text-secondary uppercase tracking-wider">Campaign Objective:</span>
            <select
              value={objective}
              onChange={(e) => {
                const val = e.target.value as OutreachObjective;
                setObjective(val);
                handleGenerateBulk(val);
              }}
              className="px-3 py-1 rounded-xl bg-bg-card border border-border-primary text-xs font-medium text-text-primary focus:outline-none focus:border-purple-500 cursor-pointer"
            >
              <option value="collaboration">Co-Creation & Collaboration</option>
              <option value="relationship_building">High-Trust Relationship</option>
              <option value="podcast_interview">Podcast Interview Invite</option>
              <option value="promotion">Product Promotion</option>
              <option value="affiliate_partnership">Affiliate Partnership</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadCsv}
              disabled={isGenerating || results.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-bg-card-hover border border-border-primary text-text-primary text-xs font-semibold hover:bg-bg-sidebar transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-blue-500" />
              Export CSV
            </button>

            <button
              onClick={handleCopyAll}
              disabled={isGenerating || results.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition shadow-md shadow-purple-600/20 cursor-pointer"
            >
              {copiedAll ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedAll ? "Copied All DMs" : "Copy Batch Package"}
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          {/* Sidebar Creator List */}
          <div className="w-full md:w-72 border-r border-border-primary overflow-y-auto bg-bg-sidebar/20 p-3 space-y-2 shrink-0 max-h-48 md:max-h-none">
            <span className="text-[10px] font-mono uppercase text-text-muted px-2 block font-bold">
              Creators ({results.length}/{selectedCreators.length})
            </span>

            {selectedCreators.map((creator, i) => {
              const res = results[i];
              const isSelected = activeCreatorIndex === i;
              const isRecorded = recordingStatus[creator.id || creator.username];

              return (
                <button
                  key={creator.username}
                  onClick={() => setActiveCreatorIndex(i)}
                  className={`w-full p-2.5 rounded-xl border text-left transition flex items-center justify-between gap-2 cursor-pointer ${
                    isSelected
                      ? "bg-purple-600/10 border-purple-500/50 text-text-primary"
                      : "bg-bg-card border-border-primary text-text-secondary hover:text-text-primary hover:bg-bg-card-hover"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img
                      src={creator.profilePicUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${creator.username}`}
                      alt={creator.name}
                      className="w-8 h-8 rounded-lg object-cover shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-bold truncate text-text-primary">{creator.name}</div>
                      {(() => {
                        const handle = normalizeThreadsUsername(creator.threadsUsername || creator.username);
                        const profileUrl = creator.threadsProfileUrl || buildThreadsProfileUrl(handle);
                        return profileUrl && handle ? (
                          <a
                            href={profileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-[10px] font-mono text-purple-600 dark:text-purple-400 truncate hover:underline inline-flex items-center gap-0.5"
                          >
                            @{handle}
                            <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                          </a>
                        ) : (
                          <div className="text-[10px] font-mono text-text-muted truncate">
                            Profile not verified
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {isRecorded ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  ) : res ? (
                    <span className="w-2 h-2 rounded-full bg-purple-500 shrink-0" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5 text-brand-text animate-spin shrink-0" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Main Inspection View */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {isGenerating && results.length === 0 ? (
              <div className="py-20 text-center space-y-3">
                <Sparkles className="w-8 h-8 text-purple-500 animate-spin mx-auto" />
                <p className="text-sm font-medium text-text-primary">Generating Batch DMs across {selectedCreators.length} Creators...</p>
                <p className="text-xs text-text-muted">Grounded in specific creator bio, recent topics & ThreadsWorks offer</p>
              </div>
            ) : currentResult ? (
              <div className="space-y-4">
                {/* Creator Header */}
                <div className="flex items-center justify-between p-4 rounded-xl bg-bg-card-hover border border-border-primary">
                  <div className="flex items-center gap-3">
                    <img
                      src={currentResult.creator.profilePicUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentResult.creator.username}`}
                      alt={currentResult.creator.name}
                      className="w-10 h-10 rounded-xl object-cover"
                    />
                    <div>
                      <h3 className="text-sm font-bold text-text-primary">{currentResult.creator.name}</h3>
                      {(() => {
                        const handle = normalizeThreadsUsername(currentResult.creator.threadsUsername || currentResult.creator.username);
                        const profileUrl = currentResult.creator.threadsProfileUrl || buildThreadsProfileUrl(handle);
                        return profileUrl && handle ? (
                          <a
                            href={profileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-mono text-purple-600 dark:text-purple-400 hover:underline inline-flex items-center gap-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            @{handle}
                            <ExternalLink className="w-3 h-3 shrink-0" />
                            <span className="text-text-muted font-sans font-normal ml-1">• {currentResult.creator.niche}</span>
                          </a>
                        ) : (
                          <span className="text-xs font-mono text-text-muted">
                            Profile not verified • {currentResult.creator.niche}
                          </span>
                        );
                      })()}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopySingle(activeCreatorIndex, currentResult.dmText)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-bg-sidebar border border-border-primary text-xs font-semibold hover:text-purple-600 transition cursor-pointer"
                    >
                      {copiedIndex === activeCreatorIndex ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedIndex === activeCreatorIndex ? "Copied" : "Copy DM"}
                    </button>

                    <button
                      onClick={() => handleMarkContacted(currentResult)}
                      disabled={recordingStatus[currentResult.creator.id || currentResult.creator.username]}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition shadow-md shadow-purple-600/20 cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                      {recordingStatus[currentResult.creator.id || currentResult.creator.username]
                        ? "Contacted Recorded"
                        : "Mark Contacted"}
                    </button>
                  </div>
                </div>

                {/* Why it works */}
                <div className="p-3.5 rounded-xl bg-brand-surface border border-brand-border space-y-1">
                  <span className="text-[10px] font-mono uppercase font-bold text-brand-text">
                    Why This Message Works
                  </span>
                  <p className="text-xs text-text-primary leading-relaxed">{currentResult.whyThisDmWorks}</p>
                </div>

                {/* DM Text Box */}
                <div className="p-4 rounded-xl bg-bg-sidebar border border-border-primary font-mono text-xs text-text-primary whitespace-pre-wrap leading-relaxed shadow-inner">
                  {currentResult.dmText}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border-primary bg-bg-sidebar/50 flex items-center justify-between shrink-0">
          <span className="text-xs text-text-muted">
            Batch output ready for copy-paste outreach or CRM export
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-bg-card-hover border border-border-primary text-text-primary text-xs font-bold hover:bg-bg-sidebar transition cursor-pointer"
          >
            Close Batch Modal
          </button>
        </div>
      </div>
    </div>
  );
}
