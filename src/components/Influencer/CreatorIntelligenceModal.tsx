import React, { useState, useRef, useEffect } from "react";
import {
  CreatorProfileData,
  CreatorIntelligenceProfile,
  SavedInfluencer,
} from "../../types/influencer";
import {
  updateSavedInfluencerApi,
  buildThreadsProfileUrl,
  getThreadsProfileUrl,
  normalizeThreadsUsername
} from "../../utils/influencerApi";
import {
  X,
  Sparkles,
  Users,
  Target,
  Layers,
  Send,
  BookmarkCheck,
  Bookmark,
  TrendingUp,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  Zap,
  DollarSign,
  AlertCircle,
  Info,
  HelpCircle,
  RotateCcw,
  Calendar,
  Play,
  Flame,
  ArrowUpRight,
  Check
} from "lucide-react";

interface CreatorIntelligenceModalProps {
  creator: CreatorProfileData;
  intelligence?: CreatorIntelligenceProfile | null;
  savedRecord?: SavedInfluencer | null;
  isLoadingIntelligence?: boolean;
  onClose: () => void;
  onSaveCreator: (creator: CreatorProfileData, intelligence?: CreatorIntelligenceProfile) => void;
  onOpenDM: (creator: CreatorProfileData, intelligence?: CreatorIntelligenceProfile) => void;
  onOpenCoCreationStudio?: (creator: CreatorProfileData, intelligence?: CreatorIntelligenceProfile) => void;
}

export default function CreatorIntelligenceModal({
  creator,
  intelligence,
  savedRecord,
  isLoadingIntelligence,
  onClose,
  onSaveCreator,
  onOpenDM,
  onOpenCoCreationStudio,
}: CreatorIntelligenceModalProps) {
  const [activeSubTab, setActiveSubTab] = useState<"overview" | "content" | "relevance" | "pricing">("pricing");
  const [isBioExpanded, setIsBioExpanded] = useState(false);
  const [expandedPosts, setExpandedPosts] = useState<Record<number, boolean>>({});

  const navRef = useRef<HTMLDivElement>(null);
  const isSaved = Boolean(savedRecord);

  // Pricing calculator state
  const [selectedDeliverable, setSelectedDeliverable] = useState<string>("1 Sponsored Threads Post");

  // Outcomes logging state
  const [actualPrice, setActualPrice] = useState<string>("");
  const [actualViews, setActualViews] = useState<string>("");
  const [actualLikes, setActualLikes] = useState<string>("");
  const [actualReplies, setActualReplies] = useState<string>("");
  const [actualClicks, setActualClicks] = useState<string>("");
  const [actualConversions, setActualConversions] = useState<string>("");
  const [actualRevenue, setActualRevenue] = useState<string>("");
  const [deliverableType, setDeliverableType] = useState<string>("1 Sponsored Threads Post");
  const [campaignDate, setCampaignDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [campaignOutcome, setCampaignOutcome] = useState<"success" | "neutral" | "unsuccessful" | "">("");
  const [outcomeNotes, setOutcomeNotes] = useState<string>("");
  const [isLoggingOutcome, setIsLoggingOutcome] = useState(false);
  const [logSuccessMessage, setLogSuccessMessage] = useState<string | null>(null);

  // Initialize outcome logger states if there is existing saved outcomes data
  useEffect(() => {
    if (savedRecord?.outcomeData) {
      const od = savedRecord.outcomeData;
      setActualPrice(od.actualPrice?.toString() || "");
      setActualViews(od.actualViews?.toString() || "");
      setActualLikes(od.actualLikes?.toString() || "");
      setActualReplies(od.actualReplies?.toString() || "");
      setActualClicks(od.actualClicks?.toString() || "");
      setActualConversions(od.actualConversions?.toString() || "");
      setActualRevenue(od.actualRevenue?.toString() || "");
      setDeliverableType(od.deliverableType || "1 Sponsored Threads Post");
      setCampaignDate(od.campaignDate || new Date().toISOString().split("T")[0]);
      setCampaignOutcome(od.campaignOutcome || "");
      setOutcomeNotes(od.outcomeNotes || "");
    }
  }, [savedRecord]);

  const handleSaveOutcome = async () => {
    if (!savedRecord) return;
    setIsLoggingOutcome(true);
    setLogSuccessMessage(null);
    try {
      const parsedPrice = parseFloat(actualPrice) || 0;
      const parsedViews = parseInt(actualViews) || 0;
      const parsedLikes = parseInt(actualLikes) || 0;
      const parsedReplies = parseInt(actualReplies) || 0;
      const parsedClicks = parseInt(actualClicks) || 0;
      const parsedConversions = parseInt(actualConversions) || 0;
      const parsedRevenue = parseFloat(actualRevenue) || 0;

      // Calculate ROI Percentage
      let roiPct = "0%";
      if (parsedPrice > 0) {
        roiPct = `${Math.round(((parsedRevenue - parsedPrice) / parsedPrice) * 100)}%`;
      }

      await updateSavedInfluencerApi(savedRecord.id, {
        outcomeData: {
          outcomeNotes,
          rating: campaignOutcome === "success" ? 5 : campaignOutcome === "neutral" ? 3 : 1,
          actualPrice: parsedPrice,
          actualViews: parsedViews,
          actualLikes: parsedLikes,
          actualReplies: parsedReplies,
          actualClicks: parsedClicks,
          actualConversions: parsedConversions,
          actualRevenue: parsedRevenue,
          roiPercentage: roiPct,
          deliverableType,
          campaignDate,
          campaignOutcome
        }
      });
      setLogSuccessMessage("Campaign outcome logged! The Pricing feedback loop will adapt based on this data.");
      if (onSaveCreator) {
        onSaveCreator(creator, intelligence || undefined);
      }
    } catch (err) {
      console.error("[CreatorIntelligenceModal] Log campaign outcomes failed:", err);
    } finally {
      setIsLoggingOutcome(false);
    }
  };

  const handleTabChange = (tab: "overview" | "content" | "relevance" | "pricing") => {
    setActiveSubTab(tab);
    const tabElement = document.getElementById(`tab-btn-${tab}`);
    if (tabElement && navRef.current) {
      tabElement.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
  };

  const toggleExpandPost = (index: number) => {
    setExpandedPosts((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-0 sm:p-4 overflow-y-auto">
      <div className="relative w-full sm:max-w-4xl bg-bg-card border-0 sm:border sm:border-border-primary rounded-none sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[100dvh] sm:h-auto sm:max-h-[90vh] min-w-0 box-border">
        
        {/* Sticky Header */}
        <div className="flex items-center justify-between border-b border-border-primary px-4 sm:px-6 py-3.5 sm:py-4 bg-bg-sidebar/95 shrink-0 sticky top-0 z-10 backdrop-blur-md">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 shrink-0">
              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0 text-left">
              <h2 className="text-sm sm:text-lg font-bold text-text-primary flex items-center gap-2 text-left truncate">
                Creator Intelligence
                <span className="text-[10px] sm:text-xs font-normal px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-300 border border-purple-500/20 shrink-0">
                  {creator.platform || "Threads"}
                </span>
              </h2>
              <p className="text-[11px] sm:text-xs text-text-secondary text-left truncate hidden sm:block">
                Deep profile analysis, content themes & strategic overlap
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close Creator Intelligence View"
            className="p-2.5 rounded-xl text-text-muted hover:text-text-primary hover:bg-bg-card-hover transition cursor-pointer shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Creator Hero Card */}
        <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-border-primary bg-gradient-to-r from-purple-900/15 via-bg-card to-bg-card shrink-0 space-y-4 min-w-0">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 min-w-0">
            <div className="flex items-start gap-3.5 sm:gap-4 w-full sm:w-auto min-w-0">
              <img
                src={creator.profilePicUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${creator.username}`}
                alt={creator.name}
                className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl border-2 border-purple-500/30 object-cover shadow-md shrink-0 mt-0.5 sm:mt-0"
              />
              <div className="min-w-0 flex-1 text-left">
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  <h3 className="text-base sm:text-xl font-extrabold text-text-primary text-left break-words leading-tight">{creator.name}</h3>
                  {(() => {
                    const handle = normalizeThreadsUsername(creator.threadsUsername || creator.username);
                    const profileUrl = creator.threadsProfileUrl || buildThreadsProfileUrl(handle);
                    return profileUrl && handle ? (
                      <a
                        href={profileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-mono text-purple-600 dark:text-purple-400 hover:underline inline-flex items-center gap-1 shrink-0 bg-purple-500/10 sm:bg-transparent px-2 py-0.5 sm:p-0 rounded-md sm:rounded-none border border-purple-500/20 sm:border-none min-w-0 max-w-full"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="truncate">@{handle}</span>
                        <ExternalLink className="w-3 h-3 shrink-0" />
                      </a>
                    ) : (
                      <span className="text-xs font-mono text-text-muted">
                        Profile not verified
                      </span>
                    );
                  })()}
                </div>

                {creator.bio && (
                  <div className="mt-1.5 text-xs text-text-secondary text-left leading-relaxed">
                    <p className="break-words font-sans">
                      {isBioExpanded || creator.bio.length <= 110
                        ? creator.bio
                        : `${creator.bio.slice(0, 110)}...`}
                    </p>
                    {creator.bio.length > 110 && (
                      <button
                        onClick={() => setIsBioExpanded(!isBioExpanded)}
                        className="text-[11px] font-bold text-purple-600 dark:text-purple-400 hover:underline mt-1 inline-block cursor-pointer"
                      >
                        {isBioExpanded ? "Show Less" : "Read More"}
                      </button>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                  {creator.niche && (
                    <span className="text-[10px] sm:text-[11px] font-mono px-2 py-0.5 rounded-md bg-bg-card-hover border border-border-primary text-text-secondary truncate">
                      {creator.niche}
                    </span>
                  )}
                  {creator.category && (
                    <span className="text-[10px] sm:text-[11px] font-mono px-2 py-0.5 rounded-md bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-300 truncate">
                      {creator.category}
                    </span>
                  )}
                  {creator.followerCount !== undefined && creator.followerCount !== null && (
                    <span className="text-[10px] sm:text-[11px] font-mono px-2 py-0.5 rounded-md bg-bg-card-hover border border-border-primary text-text-muted flex items-center gap-1 shrink-0">
                      <Users className="w-3 h-3 shrink-0" />
                      {creator.followerCount.toLocaleString()} followers
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Actions Bar - Responsive Grid on Mobile */}
            <div className="w-full sm:w-auto shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-border-primary/50">
              <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 w-full sm:w-auto">
                <button
                  onClick={() => onSaveCreator(creator, intelligence || undefined)}
                  className={`col-span-2 sm:col-span-1 flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer border min-h-[42px] ${
                    isSaved
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                      : "bg-bg-card-hover border-border-primary text-text-primary hover:bg-bg-sidebar"
                  }`}
                >
                  {isSaved ? (
                    <>
                      <BookmarkCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                      Saved
                    </>
                  ) : (
                    <>
                      <Bookmark className="w-4 h-4 text-text-muted shrink-0" />
                      Save
                    </>
                  )}
                </button>

                {onOpenCoCreationStudio && (
                  <button
                    onClick={() => onOpenCoCreationStudio(creator, intelligence || undefined)}
                    className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 dark:text-purple-300 border border-purple-500/20 text-xs font-bold transition cursor-pointer min-h-[42px] whitespace-nowrap"
                    title="Generate Joint Thread Pitch & One-Pager"
                  >
                    <Sparkles className="w-4 h-4 text-purple-500 shrink-0" />
                    Co-Creation Pitch
                  </button>
                )}

                <button
                  onClick={() => onOpenDM(creator, intelligence || undefined)}
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition shadow-lg shadow-purple-600/25 cursor-pointer min-h-[42px] whitespace-nowrap"
                >
                  <Send className="w-4 h-4 shrink-0" />
                  Personalized DM
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Intelligence Sub-Tabs Navigation (Horizontally Scrollable) */}
        <div
          ref={navRef}
          className="flex items-center border-b border-border-primary px-3 sm:px-6 bg-bg-sidebar/40 shrink-0 overflow-x-auto no-scrollbar scrollbar-none scroll-smooth w-full min-w-0"
        >
          <button
            id="tab-btn-pricing"
            onClick={() => handleTabChange("pricing")}
            className={`shrink-0 whitespace-nowrap flex items-center gap-1.5 py-3 px-3.5 sm:px-4 text-xs font-bold border-b-2 transition cursor-pointer ${
              activeSubTab === "pricing"
                ? "border-purple-500 text-purple-600 dark:text-purple-300"
                : "border-transparent text-text-muted hover:text-text-primary"
            }`}
          >
            <DollarSign className="w-4 h-4 shrink-0 text-emerald-500" />
            Value & Sponsorship
            {intelligence?.valuation?.influenceScore !== undefined && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 ml-0.5 font-bold">
                {intelligence.valuation.influenceScore} Score
              </span>
            )}
          </button>

          <button
            id="tab-btn-relevance"
            onClick={() => handleTabChange("relevance")}
            className={`shrink-0 whitespace-nowrap flex items-center gap-1.5 py-3 px-3.5 sm:px-4 text-xs font-bold border-b-2 transition cursor-pointer ${
              activeSubTab === "relevance"
                ? "border-purple-500 text-purple-600 dark:text-purple-300"
                : "border-transparent text-text-muted hover:text-text-primary"
            }`}
          >
            <Target className="w-4 h-4 shrink-0" />
            Relevance To Me
            {intelligence?.relevanceToMe?.overallOverlapScore !== undefined && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-600 dark:text-purple-300 ml-0.5">
                {intelligence.relevanceToMe.overallOverlapScore}% Match
              </span>
            )}
          </button>

          <button
            id="tab-btn-content"
            onClick={() => handleTabChange("content")}
            className={`shrink-0 whitespace-nowrap flex items-center gap-1.5 py-3 px-3.5 sm:px-4 text-xs font-bold border-b-2 transition cursor-pointer ${
              activeSubTab === "content"
                ? "border-purple-500 text-purple-600 dark:text-purple-300"
                : "border-transparent text-text-muted hover:text-text-primary"
            }`}
          >
            <Layers className="w-4 h-4 shrink-0" />
            Content Intelligence
          </button>

          <button
            id="tab-btn-overview"
            onClick={() => handleTabChange("overview")}
            className={`shrink-0 whitespace-nowrap flex items-center gap-1.5 py-3 px-3.5 sm:px-4 text-xs font-bold border-b-2 transition cursor-pointer ${
              activeSubTab === "overview"
                ? "border-purple-500 text-purple-600 dark:text-purple-300"
                : "border-transparent text-text-muted hover:text-text-primary"
            }`}
          >
            <Users className="w-4 h-4 shrink-0" />
            Creator Overview
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 sm:space-y-6 pb-28 sm:pb-8 min-w-0 w-full box-border">
          {isLoadingIntelligence ? (
            <div className="py-16 text-center space-y-3">
              <Sparkles className="w-8 h-8 text-purple-500 animate-spin mx-auto" />
              <p className="text-sm font-medium text-text-primary">Analyzing Creator Intelligence & Overlap...</p>
              <p className="text-xs text-text-muted">Comparing creator content against your ThreadsWorks offer & niche context</p>
            </div>
          ) : (
            <>
              {/* SUB TAB: SPONSORSHIP VALUE & PRICING */}
              {activeSubTab === "pricing" && (
                <div className="space-y-5 sm:space-y-6 min-w-0 text-left">
                  {/* Title and Rating banner */}
                  <div className="flex flex-col md:flex-row items-stretch gap-4">
                    {/* Value Card */}
                    <div className="flex-1 p-5 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-emerald-600/5 to-bg-card border border-emerald-500/30 flex flex-col justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                          <Flame className="w-4 h-4 text-emerald-500" />
                          Threads Influence Value Score
                        </div>
                        <p className="text-[11px] text-text-muted">
                          Factoring organic reply density, target niche alignment, and conversation rate
                        </p>
                      </div>
                      <div className="flex items-baseline gap-2 py-4">
                        <span className="text-4xl sm:text-5xl font-extrabold text-status-success-text font-mono tracking-tight">
                          {intelligence?.valuation?.influenceScore || 72}
                        </span>
                        <span className="text-sm font-medium text-text-muted">/ 100</span>
                        <span className="ml-auto px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          {(intelligence?.valuation?.influenceScore || 72) >= 80 
                            ? "Elite Conversion" 
                            : (intelligence?.valuation?.influenceScore || 72) >= 60 
                            ? "High Conversion" 
                            : "Stable Micro"}
                        </span>
                      </div>
                      <div className="text-xs text-text-secondary border-t border-emerald-500/20 pt-2">
                        Replies-to-likes ratio holds a 2x weight modifier on Threads due to authentic conversation depth.
                      </div>
                    </div>

                    {/* Confidence & Verification Status */}
                    <div className="flex-1 p-5 rounded-2xl bg-bg-card border border-border-primary flex flex-col justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-text-secondary uppercase tracking-wider">
                          <ShieldCheck className="w-4 h-4 text-purple-500" />
                          Data Confidence Index
                        </div>
                        <p className="text-[11px] text-text-muted">
                          Integrity analysis of recent activity signals and data point density
                        </p>
                      </div>

                      <div className="flex items-center gap-3 py-4">
                        <span className={`px-3.5 py-1.5 rounded-full text-sm font-black border uppercase font-mono tracking-wider ${
                          (intelligence?.valuation?.confidence || "MEDIUM") === "HIGH"
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                            : (intelligence?.valuation?.confidence || "MEDIUM") === "MEDIUM"
                            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
                            : "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30"
                        }`}>
                          {intelligence?.valuation?.confidence || "MEDIUM"} CONFIDENCE
                        </span>
                        <span className="text-xs font-mono text-text-muted">
                          Score: {intelligence?.valuation?.metricConfidenceScore || 60}%
                        </span>
                      </div>

                      <p className="text-xs text-text-muted leading-relaxed">
                        {intelligence?.valuation?.confidenceExplanation || "Recommended pricing is a high-signal estimate based on current profile metrics."}
                      </p>
                    </div>
                  </div>

                  {/* Primary Estimator Calculator Component */}
                  <div className="p-5 rounded-2xl bg-bg-card border border-border-primary space-y-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border-primary pb-4">
                      <div>
                        <h4 className="text-sm font-bold text-text-primary flex items-center gap-1.5">
                          <DollarSign className="w-4 h-4 text-emerald-500" />
                          Sponsorship Pricing Calculator
                        </h4>
                        <p className="text-xs text-text-muted">Interactive deliverables calculator based on real-time signals</p>
                      </div>

                      {/* Selector */}
                      <select
                        value={selectedDeliverable}
                        onChange={(e) => setSelectedDeliverable(e.target.value)}
                        className="bg-bg-sidebar border border-border-primary rounded-xl px-3 py-1.5 text-xs font-bold text-text-primary outline-none focus:border-purple-500 transition max-w-xs cursor-pointer"
                      >
                        <option value="1 Sponsored Threads Post">1 Sponsored Threads Post (1.0x)</option>
                        <option value="Sponsored Thread">Sponsored Thread Sequence (1.75x)</option>
                        <option value="Promotional Mention">Promotional Mention / Shout-out (0.45x)</option>
                        <option value="Promotional Recommendation">Niche Recommendation Post (0.75x)</option>
                        <option value="Multi-Post Campaign">Multi-Post Campaign Bundle (3.25x)</option>
                      </select>
                    </div>

                    {/* Pricing Big Box */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-bg-sidebar/50 p-4 rounded-xl border border-border-secondary">
                      {/* Midpoint Recommended */}
                      <div className="md:col-span-2 space-y-2 text-left">
                        <span className="text-[10px] uppercase font-mono tracking-widest text-text-muted font-bold">
                          Recommended Sponsorship Offer
                        </span>
                        <div className="flex items-baseline gap-2.5">
                          <span className="text-3xl sm:text-4xl font-black text-status-success-text font-mono">
                            ${intelligence?.valuation?.recommendedSponsorships?.[selectedDeliverable]?.recommendedOffer || 120}
                          </span>
                          <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider bg-bg-card px-2 py-0.5 rounded border border-border-primary">
                            ThreadsWorks Estimate
                          </span>
                        </div>
                        <p className="text-xs text-text-muted leading-relaxed pt-1">
                          Calculated target offer for a <span className="font-bold text-text-primary">{selectedDeliverable}</span>.
                        </p>
                      </div>

                      {/* Ranges and Negotiating Support */}
                      <div className="p-3 bg-bg-card rounded-lg border border-border-primary/50 flex flex-col justify-center space-y-1.5 text-left">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-text-muted">Range:</span>
                          <span className="font-mono font-bold text-text-primary">
                            ${intelligence?.valuation?.recommendedSponsorships?.[selectedDeliverable]?.lowRange || 100} – ${intelligence?.valuation?.recommendedSponsorships?.[selectedDeliverable]?.highRange || 140}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-text-muted">Opening Offer:</span>
                          <span className="font-mono font-bold text-status-success-text">
                            ${Math.max(15, Math.round((intelligence?.valuation?.recommendedSponsorships?.[selectedDeliverable]?.recommendedOffer || 120) * 0.8))}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs pt-1.5 border-t border-border-secondary/50">
                          <span className="text-text-muted flex items-center gap-0.5">
                            Est. Fair Value:
                          </span>
                          <span className="font-mono font-extrabold text-purple-500">
                            ${intelligence?.valuation?.recommendedSponsorships?.[selectedDeliverable]?.recommendedOffer || 120}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Explanatory text */}
                    <div className="p-3 bg-blue-500/5 rounded-xl border border-blue-500/10 flex items-start gap-2.5">
                      <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                      <div className="space-y-0.5">
                        <span className="text-[10px] uppercase font-bold tracking-widest text-blue-500 block">
                          Why This Valuation?
                        </span>
                        <p className="text-xs leading-relaxed text-text-muted text-left">
                          {intelligence?.valuation?.whyThisPrice || `Recommended pricing based on @${normalizeThreadsUsername(creator.username)}'s ${creator.followerCount?.toLocaleString() || "organic"} followers, active comments, and average conversation depth.`}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Negotiation playbook card */}
                  <div className="p-5 rounded-2xl bg-bg-card border border-border-primary space-y-4">
                    <h4 className="text-sm font-bold text-text-primary flex items-center gap-1.5">
                      <Zap className="w-4 h-4 text-purple-500" />
                      Negotiation Playbook & Anchoring Strategy
                    </h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="p-3 bg-bg-sidebar/40 rounded-xl border border-border-secondary space-y-1">
                        <span className="text-[10px] uppercase font-mono tracking-widest text-text-muted block font-extrabold">
                          Phase 1: Opening Offer
                        </span>
                        <p className="text-xs text-text-muted leading-normal text-left">
                          Open negotiations at <span className="font-bold text-text-primary">${Math.max(15, Math.round((intelligence?.valuation?.recommendedSponsorships?.[selectedDeliverable]?.recommendedOffer || 120) * 0.8))}</span>. Frame the pitch around mutual value, providing the creator with a structured campaign outline.
                        </p>
                      </div>

                      <div className="p-3 bg-bg-sidebar/40 rounded-xl border border-border-secondary space-y-1">
                        <span className="text-[10px] uppercase font-mono tracking-widest text-text-muted block font-extrabold">
                          Phase 2: Target Range
                        </span>
                        <p className="text-xs text-text-muted leading-normal text-left">
                          Be prepared to settle between <span className="font-bold text-text-primary">${intelligence?.valuation?.recommendedSponsorships?.[selectedDeliverable]?.lowRange || 100}</span> and <span className="font-bold text-text-primary">${intelligence?.valuation?.recommendedSponsorships?.[selectedDeliverable]?.highRange || 140}</span>. Emphasize tracking metrics and ROI attribution.
                        </p>
                      </div>

                      <div className="p-3 bg-bg-sidebar/40 rounded-xl border border-border-secondary space-y-1">
                        <span className="text-[10px] uppercase font-mono tracking-widest text-text-muted block font-extrabold">
                          Anchoring Strategy
                        </span>
                        <p className="text-xs text-text-muted leading-normal text-left">
                          Since @{normalizeThreadsUsername(creator.username)} boasts a high-conviction audience overlap with your offer, propose a bonus-adjusted offer: a smaller upfront fee combined with performance incentives.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Campaign Feedback loop Form - Rendered ONLY if the creator is saved in pipeline */}
                  {savedRecord ? (
                    <div className="p-5 rounded-2xl bg-bg-card border border-purple-500/20 space-y-4">
                      <div className="flex items-center gap-2 border-b border-border-primary pb-3">
                        <Calendar className="w-4.5 h-4.5 text-purple-500" />
                        <div>
                          <h4 className="text-sm font-bold text-text-primary">
                            Log Campaign Outcomes (Trains Pricing Intelligence)
                          </h4>
                          <p className="text-[11px] text-text-muted">
                            Train the ThreadsWorks pricing loop using actual results from this specific creator
                          </p>
                        </div>
                      </div>

                      {logSuccessMessage && (
                        <div className="p-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs rounded-xl border border-emerald-500/20 flex items-center gap-2">
                          <CheckCircle2 className="w-4.5 h-4.5 shrink-0" />
                          <span>{logSuccessMessage}</span>
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                        {/* Cost */}
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">
                            Actual Negotiated Price ($)
                          </label>
                          <input
                            type="number"
                            value={actualPrice}
                            onChange={(e) => setActualPrice(e.target.value)}
                            placeholder="e.g. 150"
                            className="w-full bg-bg-sidebar border border-border-primary rounded-xl px-3 py-2 text-xs text-text-primary outline-none focus:border-purple-500 transition"
                          />
                        </div>

                        {/* Deliverable Used */}
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">
                            Deliverable Type
                          </label>
                          <select
                            value={deliverableType}
                            onChange={(e) => setDeliverableType(e.target.value)}
                            className="w-full bg-bg-sidebar border border-border-primary rounded-xl px-2 py-2 text-xs text-text-primary outline-none focus:border-purple-500 transition cursor-pointer"
                          >
                            <option value="1 Sponsored Threads Post">1 Sponsored Threads Post</option>
                            <option value="Sponsored Thread">Sponsored Thread</option>
                            <option value="Promotional Mention">Promotional Mention</option>
                            <option value="Promotional Recommendation">Promotional Recommendation</option>
                            <option value="Multi-Post Campaign">Multi-Post Campaign</option>
                          </select>
                        </div>

                        {/* Campaign Date */}
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">
                            Campaign Date
                          </label>
                          <input
                            type="date"
                            value={campaignDate}
                            onChange={(e) => setCampaignDate(e.target.value)}
                            className="w-full bg-bg-sidebar border border-border-primary rounded-xl px-3 py-1.5 text-xs text-text-primary outline-none focus:border-purple-500 transition"
                          />
                        </div>

                        {/* Overall Outcome */}
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">
                            Campaign Outcome
                          </label>
                          <select
                            value={campaignOutcome}
                            onChange={(e) => setCampaignOutcome(e.target.value as any)}
                            className="w-full bg-bg-sidebar border border-border-primary rounded-xl px-2 py-2 text-xs text-text-primary outline-none focus:border-purple-500 transition cursor-pointer"
                          >
                            <option value="">Select Outcome...</option>
                            <option value="success">High Return (Success)</option>
                            <option value="neutral">Broke Even (Neutral)</option>
                            <option value="unsuccessful">Low Return (Unsuccessful)</option>
                          </select>
                        </div>
                      </div>

                      {/* Performance Indicators */}
                      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 pt-2">
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold uppercase text-text-muted">Views</label>
                          <input
                            type="number"
                            value={actualViews}
                            onChange={(e) => setActualViews(e.target.value)}
                            placeholder="e.g. 5000"
                            className="w-full bg-bg-sidebar border border-border-primary rounded-lg px-2 py-1.5 text-xs text-text-primary outline-none focus:border-purple-500"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold uppercase text-text-muted">Likes</label>
                          <input
                            type="number"
                            value={actualLikes}
                            onChange={(e) => setActualLikes(e.target.value)}
                            placeholder="e.g. 120"
                            className="w-full bg-bg-sidebar border border-border-primary rounded-lg px-2 py-1.5 text-xs text-text-primary outline-none focus:border-purple-500"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold uppercase text-text-muted">Replies</label>
                          <input
                            type="number"
                            value={actualReplies}
                            onChange={(e) => setActualReplies(e.target.value)}
                            placeholder="e.g. 35"
                            className="w-full bg-bg-sidebar border border-border-primary rounded-lg px-2 py-1.5 text-xs text-text-primary outline-none focus:border-purple-500"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold uppercase text-text-muted">Clicks</label>
                          <input
                            type="number"
                            value={actualClicks}
                            onChange={(e) => setActualClicks(e.target.value)}
                            placeholder="e.g. 85"
                            className="w-full bg-bg-sidebar border border-border-primary rounded-lg px-2 py-1.5 text-xs text-text-primary outline-none focus:border-purple-500"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold uppercase text-text-muted">Conversions</label>
                          <input
                            type="number"
                            value={actualConversions}
                            onChange={(e) => setActualConversions(e.target.value)}
                            placeholder="e.g. 4"
                            className="w-full bg-bg-sidebar border border-border-primary rounded-lg px-2 py-1.5 text-xs text-text-primary outline-none focus:border-purple-500"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold uppercase text-text-muted">Revenue ($)</label>
                          <input
                            type="number"
                            value={actualRevenue}
                            onChange={(e) => setActualRevenue(e.target.value)}
                            placeholder="e.g. 1000"
                            className="w-full bg-bg-sidebar border border-border-primary rounded-lg px-2 py-1.5 text-xs text-text-primary outline-none focus:border-purple-500"
                          />
                        </div>
                      </div>

                      {/* Brief outcome notes */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">
                          Outcome Notes & Performance Insights
                        </label>
                        <textarea
                          rows={2}
                          value={outcomeNotes}
                          onChange={(e) => setOutcomeNotes(e.target.value)}
                          placeholder="What went well? How was the audience response? Was the content copy or timing the deciding factor?"
                          className="w-full bg-bg-sidebar border border-border-primary rounded-xl px-3 py-2 text-xs text-text-primary outline-none focus:border-purple-500 transition resize-none"
                        />
                      </div>

                      <div className="flex justify-end pt-2">
                        <button
                          onClick={handleSaveOutcome}
                          disabled={isLoggingOutcome}
                          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-purple-600/15 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                        >
                          {isLoggingOutcome ? (
                            <>
                              <Sparkles className="w-3.5 h-3.5 animate-spin" />
                              Logging Outcomes...
                            </>
                          ) : (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              Save Outcomes & Train Pricing Engine
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl bg-bg-sidebar/30 border border-border-primary text-center space-y-1.5">
                      <HelpCircle className="w-5 h-5 text-text-muted mx-auto" />
                      <p className="text-xs font-bold text-text-primary">Want to calibrate this pricing engine with real results?</p>
                      <p className="text-[11px] text-text-muted max-w-md mx-auto">
                        Save this creator to your Influencer Database using the save button above. Once saved, you can log actual performance results to automatically calibrate our pricing algorithms.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* SUB TAB: RELEVANCE TO ME */}
              {activeSubTab === "relevance" && (
                <div className="space-y-5 sm:space-y-6 min-w-0">
                  {/* Strategic Why Relevant Callout */}
                  <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-purple-900/20 via-purple-950/10 to-bg-card border border-purple-500/30 space-y-2.5 text-left min-w-0">
                    <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-purple-600 dark:text-purple-300 text-left">
                      <Zap className="w-4 h-4 text-purple-500 shrink-0" />
                      Why This Creator Is Relevant To You
                    </div>
                    <p className="text-xs sm:text-sm leading-relaxed text-text-primary font-medium text-left break-words">
                      {intelligence?.relevanceToMe?.whyRelevant || creator.whyFound || creator.collabRelevance}
                    </p>
                    <div className="text-xs text-text-secondary pt-2 border-t border-purple-500/20 text-left break-words">
                      <span className="font-bold text-text-primary">Overlap Summary: </span>
                      {intelligence?.relevanceToMe?.overlapSummary || creator.collabRelevance}
                    </div>
                  </div>

                  {/* Overlap Breakdown Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 min-w-0">
                    <div className="p-3.5 sm:p-4 rounded-xl bg-bg-card-hover border border-border-primary space-y-2 text-left min-w-0">
                      <div className="text-xs font-bold text-text-secondary uppercase tracking-wider flex items-center gap-2 text-left">
                        <Target className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                        Niche & Positioning Alignment
                      </div>
                      <p className="text-xs text-text-primary leading-relaxed text-left break-words font-sans">
                        {intelligence?.relevanceToMe?.nicheAlignment || "High thematic alignment in creator monetization and digital product workflows."}
                      </p>
                    </div>

                    <div className="p-3.5 sm:p-4 rounded-xl bg-bg-card-hover border border-border-primary space-y-2 text-left min-w-0">
                      <div className="text-xs font-bold text-text-secondary uppercase tracking-wider flex items-center gap-2 text-left">
                        <Users className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                        Audience Intersection
                      </div>
                      <p className="text-xs text-text-primary leading-relaxed text-left break-words font-sans">
                        {intelligence?.relevanceToMe?.audienceIntersection || "Audience consists of active builders and digital entrepreneurs looking to scale content."}
                      </p>
                    </div>

                    <div className="p-3.5 sm:p-4 rounded-xl bg-bg-card-hover border border-border-primary space-y-2 text-left min-w-0">
                      <div className="text-xs font-bold text-text-secondary uppercase tracking-wider flex items-center gap-2 text-left">
                        <TrendingUp className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        Offer & Product Compatibility
                      </div>
                      <p className="text-xs text-text-primary leading-relaxed text-left break-words font-sans">
                        {intelligence?.relevanceToMe?.offerCompatibility || "Their content complements your offer without direct competition."}
                      </p>
                    </div>

                    <div className="p-3.5 sm:p-4 rounded-xl bg-bg-card-hover border border-border-primary space-y-2 text-left min-w-0">
                      <div className="text-xs font-bold text-text-secondary uppercase tracking-wider flex items-center gap-2 text-left">
                        <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        Shared Topics
                      </div>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {(intelligence?.relevanceToMe?.sharedTopics || creator.topics || []).map((topic, i) => (
                          <span
                            key={i}
                            className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-300 break-words max-w-full"
                          >
                            {topic}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* SUB TAB: CONTENT INTELLIGENCE */}
              {activeSubTab === "content" && (
                <div className="space-y-5 sm:space-y-6 min-w-0">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 min-w-0">
                    <div className="p-3.5 sm:p-4 rounded-xl bg-bg-card-hover border border-border-primary space-y-2 text-left min-w-0">
                      <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wider text-left">
                        Recurring Topics & Themes
                      </h4>
                      <div className="flex flex-wrap gap-1.5">
                        {(intelligence?.contentIntelligence?.recurringTopics || creator.topics || []).map((t, i) => (
                          <span key={i} className="text-xs font-mono px-2 py-1 rounded-lg bg-bg-sidebar border border-border-primary text-text-primary break-words max-w-full">
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="p-3.5 sm:p-4 rounded-xl bg-bg-card-hover border border-border-primary space-y-2 text-left min-w-0">
                      <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wider text-left">
                        Content Style & Voice
                      </h4>
                      <p className="text-xs text-text-primary leading-relaxed text-left break-words font-sans">
                        {intelligence?.contentIntelligence?.contentStyle || "Direct, tactical, step-by-step breakdowns with high optical whitespace."}
                      </p>
                    </div>

                    <div className="p-3.5 sm:p-4 rounded-xl bg-bg-card-hover border border-border-primary space-y-2 text-left min-w-0">
                      <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wider text-left">
                        Common Audience Problems Discussed
                      </h4>
                      <ul className="space-y-1 text-left">
                        {(intelligence?.contentIntelligence?.commonProblemsDiscussed || ["Scaling content output", "Audience retention", "Monetization friction"]).map((p, i) => (
                          <li key={i} className="text-xs text-text-secondary flex items-start gap-2 text-left break-words font-sans">
                            <span className="text-purple-500 font-bold shrink-0">•</span>
                            <span>{p}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="p-3.5 sm:p-4 rounded-xl bg-bg-card-hover border border-border-primary space-y-2 text-left min-w-0">
                      <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wider text-left">
                        Potential Collaboration Angles
                      </h4>
                      <ul className="space-y-1 text-left">
                        {(intelligence?.contentIntelligence?.collaborationOpportunities || ["Joint thread series on monetization", "Cross-promotion", "Guest breakdown"]).map((c, i) => (
                          <li key={i} className="text-xs text-purple-600 dark:text-purple-300 flex items-start gap-2 text-left break-words font-sans">
                            <CheckCircle2 className="w-3.5 h-3.5 text-purple-500 shrink-0 mt-0.5" />
                            <span>{c}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* SUB TAB: CREATOR OVERVIEW */}
              {activeSubTab === "overview" && (
                <div className="space-y-5 sm:space-y-6 min-w-0">
                  <div className="p-3.5 sm:p-4 rounded-xl bg-bg-card-hover border border-border-primary space-y-3 text-left min-w-0 w-full max-w-full box-border">
                    <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wider text-left">
                      Recent Content Samples
                    </h4>
                    {creator.recentPosts && creator.recentPosts.length > 0 ? (
                      <div className="space-y-3 w-full max-w-full min-w-0">
                        {creator.recentPosts.map((post, i) => {
                          const isLong = post.text && post.text.length > 180;
                          const isExpanded = Boolean(expandedPosts[i]);

                          return (
                            <div key={i} className="p-3.5 sm:p-4 rounded-xl bg-bg-sidebar border border-border-primary/60 space-y-2.5 text-left w-full max-w-full min-w-0 box-border overflow-hidden">
                              <p className="text-xs text-text-primary font-sans leading-relaxed whitespace-pre-wrap break-words text-left">
                                {isLong && !isExpanded ? `${post.text.slice(0, 180)}...` : post.text}
                              </p>
                              {isLong && (
                                <button
                                  onClick={() => toggleExpandPost(i)}
                                  className="text-[11px] font-bold text-purple-600 dark:text-purple-400 hover:underline text-left inline-block cursor-pointer"
                                >
                                  {isExpanded ? "Show Less" : "Read Full Post"}
                                </button>
                              )}
                              <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-[10px] sm:text-[11px] font-mono text-text-muted pt-1 border-t border-border-primary/40">
                                <span>❤️ {post.likes || 12} likes</span>
                                <span>💬 {post.replies || 4} replies</span>
                                <span>🔄 {post.reposts || 1} reposts</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-text-muted italic text-left">No recent post snippets available.</p>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Fixed Sticky Footer Actions */}
        <div className="sticky bottom-0 z-20 p-3.5 sm:p-4 border-t border-border-primary bg-bg-sidebar/95 backdrop-blur-md flex flex-col sm:flex-row items-center justify-between gap-2.5 sm:gap-4 shrink-0 pb-safe sm:pb-4 w-full box-border">
          <div className="text-[10px] sm:text-xs text-text-muted flex items-center justify-center sm:justify-start gap-1.5 text-center sm:text-left">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span>Grounding in creator profile & ThreadsWorks intelligence</span>
          </div>
          <button
            onClick={() => onOpenDM(creator, intelligence || undefined)}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3 sm:py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition cursor-pointer shadow-lg shadow-purple-600/20 shrink-0 min-h-[44px]"
          >
            <Send className="w-4 h-4 shrink-0" />
            Create Personalized DM
          </button>
        </div>

      </div>
    </div>
  );
}
