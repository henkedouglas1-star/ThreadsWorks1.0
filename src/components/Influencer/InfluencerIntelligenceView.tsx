import React, { useState, useEffect } from "react";
import {
  CreatorProfileData,
  CreatorIntelligenceProfile,
  SavedInfluencer,
} from "../../types/influencer";
import { getSavedInfluencersApi, saveInfluencerApi } from "../../utils/influencerApi";
import DiscoverTab from "./DiscoverTab";
import DatabaseTab from "./DatabaseTab";
import OutcomesTab from "./OutcomesTab";
import PipelineKanbanTab from "./PipelineKanbanTab";
import CreatorIntelligenceModal from "./CreatorIntelligenceModal";
import PersonalizedDMModal from "./PersonalizedDMModal";
import BulkDMModal from "./BulkDMModal";
import CampaignManagerModal from "./CampaignManagerModal";
import CoCreationStudioModal from "./CoCreationStudioModal";
import CreatorOutreachTab from "./CreatorOutreachTab";
import {
  Users,
  Search,
  Database,
  TrendingUp,
  Sparkles,
  Zap,
  BookmarkCheck,
  Target,
  Send,
  Kanban,
  MessageSquare,
} from "lucide-react";

interface InfluencerIntelligenceViewProps {
  userId: string;
  userContext?: any;
}

export default function InfluencerIntelligenceView({
  userId,
  userContext,
}: InfluencerIntelligenceViewProps) {
  const [activeTab, setActiveTab] = useState<"discover" | "database" | "pipeline" | "outreach" | "outcomes">("discover");

  const [savedInfluencers, setSavedInfluencers] = useState<SavedInfluencer[]>([]);
  const [isLoadingSaved, setIsLoadingSaved] = useState<boolean>(true);
  const [outreachSelectedCreators, setOutreachSelectedCreators] = useState<CreatorProfileData[]>([]);

  // Modal states
  const [selectedCreatorForIntelligence, setSelectedCreatorForIntelligence] = useState<CreatorProfileData | null>(null);
  const [selectedCreatorIntelligence, setSelectedCreatorIntelligence] = useState<CreatorIntelligenceProfile | null>(null);
  const [selectedCreatorSavedRecord, setSelectedCreatorSavedRecord] = useState<SavedInfluencer | null>(null);

  const [selectedCreatorForDM, setSelectedCreatorForDM] = useState<CreatorProfileData | null>(null);
  const [dmModalIntelligence, setDmModalIntelligence] = useState<CreatorIntelligenceProfile | null>(null);
  const [dmModalSavedRecord, setDmModalSavedRecord] = useState<SavedInfluencer | null>(null);

  const [bulkDMCreators, setBulkDMCreators] = useState<CreatorProfileData[] | null>(null);
  const [showCampaignManager, setShowCampaignManager] = useState<boolean>(false);
  const [coCreationCreator, setCoCreationCreator] = useState<CreatorProfileData | null>(null);
  const [coCreationIntelligence, setCoCreationIntelligence] = useState<CreatorIntelligenceProfile | null>(null);

  const fetchSaved = async () => {
    if (!userId) return;
    setIsLoadingSaved(true);
    try {
      const res = await getSavedInfluencersApi(userId);
      if (res.success && res.influencers) {
        setSavedInfluencers(res.influencers);
      }
    } catch (err) {
      console.error("[InfluencerIntelligenceView] Failed to fetch saved creators:", err);
    } finally {
      setIsLoadingSaved(false);
    }
  };

  useEffect(() => {
    fetchSaved();
  }, [userId]);

  const handleOpenIntelligence = (
    creator: CreatorProfileData,
    intelligence?: CreatorIntelligenceProfile,
    savedRecord?: SavedInfluencer
  ) => {
    setSelectedCreatorForIntelligence(creator);
    setSelectedCreatorIntelligence(intelligence || null);
    setSelectedCreatorSavedRecord(savedRecord || null);
  };

  const handleOpenDM = (
    creator: CreatorProfileData,
    intelligence?: CreatorIntelligenceProfile,
    savedRecord?: SavedInfluencer
  ) => {
    setSelectedCreatorForDM(creator);
    setDmModalIntelligence(intelligence || null);
    setDmModalSavedRecord(savedRecord || null);
  };

  const handleSaveCreator = async (creator: CreatorProfileData, intelligence?: CreatorIntelligenceProfile) => {
    try {
      await saveInfluencerApi(userId, creator, intelligence);
      fetchSaved();
    } catch (err) {
      console.error("[InfluencerIntelligenceView] Save creator failed:", err);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8 pb-24">
      {/* App Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-6 border-b border-border-primary">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 px-2.5 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20">
              Creator Operating System
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-text-primary mt-1 flex items-center gap-2.5">
            Influencer Intelligence
          </h1>
          <p className="text-xs sm:text-sm text-text-secondary mt-1 max-w-2xl">
            Discover relevant creators, analyze strategic overlap with your profile, generate personalized DMs, and feed outcomes back into ThreadsWorks intelligence.
          </p>
        </div>

        {/* 3 Core Capabilities Header Badge */}
        <div className="flex items-center gap-2 bg-bg-card p-2 rounded-2xl border border-border-primary text-xs font-mono shrink-0">
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-300">
            <Search className="w-3.5 h-3.5" />
            <span>Discover</span>
          </div>
          <span className="text-text-muted">→</span>
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-300">
            <Target className="w-3.5 h-3.5" />
            <span>Understand</span>
          </div>
          <span className="text-text-muted">→</span>
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">
            <Send className="w-3.5 h-3.5" />
            <span>Execute</span>
          </div>
        </div>
      </div>

      {/* Main Tab Switcher */}
      <div className="flex items-center gap-2 border-b border-border-primary pb-3">
        <button
          onClick={() => setActiveTab("discover")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer border ${
            activeTab === "discover"
              ? "bg-purple-600 text-white border-purple-600 shadow-md shadow-purple-600/20"
              : "bg-bg-card border-border-primary text-text-secondary hover:bg-bg-card-hover hover:text-text-primary"
          }`}
        >
          <Search className="w-4 h-4" />
          <span>Discover Creators</span>
        </button>

        <button
          onClick={() => setActiveTab("database")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer border ${
            activeTab === "database"
              ? "bg-purple-600 text-white border-purple-600 shadow-md shadow-purple-600/20"
              : "bg-bg-card border-border-primary text-text-secondary hover:bg-bg-card-hover hover:text-text-primary"
          }`}
        >
          <Database className="w-4 h-4" />
          <span>Saved Database</span>
          <span
            className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
              activeTab === "database"
                ? "bg-white/20 text-white"
                : "bg-bg-sidebar text-text-muted border border-border-primary"
            }`}
          >
            {savedInfluencers.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("outreach")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer border ${
            activeTab === "outreach"
              ? "bg-purple-600 text-white border-purple-600 shadow-md shadow-purple-600/20"
              : "bg-bg-card border-border-primary text-text-secondary hover:bg-bg-card-hover hover:text-text-primary"
          }`}
        >
          <MessageSquare className={`w-4 h-4 ${activeTab === "outreach" ? "text-white" : "text-brand-text"}`} />
          <span>Creator Outreach</span>
          <span
            className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded-full font-bold ${
              activeTab === "outreach"
                ? "bg-white/20 text-white"
                : "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20"
            }`}
          >
            New
          </span>
        </button>

        <button
          onClick={() => setActiveTab("pipeline")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer border ${
            activeTab === "pipeline"
              ? "bg-purple-600 text-white border-purple-600 shadow-md shadow-purple-600/20"
              : "bg-bg-card border-border-primary text-text-secondary hover:bg-bg-card-hover hover:text-text-primary"
          }`}
        >
          <Kanban className="w-4 h-4" />
          <span>Outreach Pipeline</span>
        </button>

        <button
          onClick={() => setActiveTab("outcomes")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer border ${
            activeTab === "outcomes"
              ? "bg-purple-600 text-white border-purple-600 shadow-md shadow-purple-600/20"
              : "bg-bg-card border-border-primary text-text-secondary hover:bg-bg-card-hover hover:text-text-primary"
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>Outcomes Intelligence</span>
        </button>
      </div>

      {/* Main Tab Content */}
      <div>
        {activeTab === "discover" && (
          <DiscoverTab
            userId={userId}
            userContext={userContext}
            savedInfluencers={savedInfluencers}
            onOpenIntelligence={(c, i) => handleOpenIntelligence(c, i)}
            onOpenDM={(c, i) => handleOpenDM(c, i)}
            onRefreshSaved={fetchSaved}
            onAddToOutreach={(creator) => {
              setOutreachSelectedCreators([creator]);
              setActiveTab("outreach");
            }}
          />
        )}

        {activeTab === "database" && (
          <DatabaseTab
            userId={userId}
            savedInfluencers={savedInfluencers}
            isLoading={isLoadingSaved}
            onRefreshSaved={fetchSaved}
            onOpenIntelligence={(c, i, s) => handleOpenIntelligence(c, i, s)}
            onOpenDM={(c, i, s) => handleOpenDM(c, i, s)}
            onOpenBulkDM={(creators) => setBulkDMCreators(creators)}
            onOpenCampaignManager={() => setShowCampaignManager(true)}
            onOpenCreatorOutreach={(creators) => {
              setOutreachSelectedCreators(creators);
              setActiveTab("outreach");
            }}
          />
        )}

        {activeTab === "outreach" && (
          <CreatorOutreachTab
            userId={userId}
            userContext={userContext}
            savedInfluencers={savedInfluencers}
            initialSelectedCreators={outreachSelectedCreators}
            onRefreshSaved={fetchSaved}
          />
        )}

        {activeTab === "pipeline" && (
          <PipelineKanbanTab
            userId={userId}
            savedInfluencers={savedInfluencers}
            isLoading={isLoadingSaved}
            onRefreshSaved={fetchSaved}
            onOpenIntelligence={(c, i, s) => handleOpenIntelligence(c, i, s)}
            onOpenDM={(c, i, s) => handleOpenDM(c, i, s)}
          />
        )}

        {activeTab === "outcomes" && <OutcomesTab userId={userId} />}
      </div>

      {/* Modals */}
      {selectedCreatorForIntelligence && (
        <CreatorIntelligenceModal
          creator={selectedCreatorForIntelligence}
          intelligence={selectedCreatorIntelligence}
          savedRecord={selectedCreatorSavedRecord}
          onClose={() => setSelectedCreatorForIntelligence(null)}
          onSaveCreator={(c, i) => handleSaveCreator(c, i)}
          onOpenDM={(c, i) => {
            setSelectedCreatorForIntelligence(null);
            handleOpenDM(c, i, selectedCreatorSavedRecord || undefined);
          }}
          onOpenCoCreationStudio={(c, i) => {
            setSelectedCreatorForIntelligence(null);
            setCoCreationCreator(c);
            setCoCreationIntelligence(i || null);
          }}
        />
      )}

      {coCreationCreator && (
        <CoCreationStudioModal
          creator={coCreationCreator}
          intelligence={coCreationIntelligence}
          userContext={userContext}
          onClose={() => setCoCreationCreator(null)}
          onOpenDM={() => {
            const creator = coCreationCreator;
            const intel = coCreationIntelligence;
            setCoCreationCreator(null);
            handleOpenDM(creator, intel || undefined);
          }}
        />
      )}

      {selectedCreatorForDM && (
        <PersonalizedDMModal
          creator={selectedCreatorForDM}
          intelligence={dmModalIntelligence}
          userId={userId}
          userContext={userContext}
          savedInfluencerId={dmModalSavedRecord?.id}
          isFollowUpMode={dmModalSavedRecord?.relationshipStatus === "contacted"}
          originalDmText={dmModalSavedRecord?.outreachHistory?.[dmModalSavedRecord.outreachHistory.length - 1]?.dmText}
          onClose={() => setSelectedCreatorForDM(null)}
          onOutreachRecorded={fetchSaved}
        />
      )}

      {bulkDMCreators && bulkDMCreators.length > 0 && (
        <BulkDMModal
          selectedCreators={bulkDMCreators}
          userId={userId}
          userContext={userContext}
          onClose={() => setBulkDMCreators(null)}
          onRefreshSaved={fetchSaved}
        />
      )}

      {showCampaignManager && (
        <CampaignManagerModal
          userId={userId}
          onClose={() => setShowCampaignManager(false)}
        />
      )}
    </div>
  );
}
