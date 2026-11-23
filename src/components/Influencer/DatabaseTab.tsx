import React, { useState, useEffect, useMemo } from "react";
import {
  SavedInfluencer,
  CreatorProfileData,
  CreatorIntelligenceProfile,
  InfluencerRelationshipStatus,
} from "../../types/influencer";
import {
  updateSavedInfluencerApi,
  deleteSavedInfluencerApi,
  buildThreadsProfileUrl,
  getThreadsProfileUrl,
  normalizeThreadsUsername,
  seedFeaturedCreatorsApi,
  quickAddCreatorApi,
  getVerifiedDirectoryApi,
} from "../../utils/influencerApi";
import {
  Search,
  Filter,
  Trash2,
  Send,
  Info,
  Bookmark,
  ExternalLink,
  MessageSquare,
  Clock,
  CheckCircle,
  Tag,
  Edit2,
  ChevronDown,
  Sparkles,
  CheckSquare,
  Square,
  Download,
  FolderPlus,
  Layers,
  Users,
  UserPlus,
  Plus,
} from "lucide-react";

interface DatabaseTabProps {
  userId: string;
  savedInfluencers: SavedInfluencer[];
  isLoading: boolean;
  onRefreshSaved: () => void;
  onOpenIntelligence: (creator: CreatorProfileData, intelligence?: CreatorIntelligenceProfile, savedRecord?: SavedInfluencer) => void;
  onOpenDM: (creator: CreatorProfileData, intelligence?: CreatorIntelligenceProfile, savedRecord?: SavedInfluencer) => void;
  onOpenBulkDM?: (creators: CreatorProfileData[]) => void;
  onOpenCampaignManager?: () => void;
  onOpenCreatorOutreach?: (creators: CreatorProfileData[]) => void;
}

export default function DatabaseTab({
  userId,
  savedInfluencers,
  isLoading,
  onRefreshSaved,
  onOpenIntelligence,
  onOpenDM,
  onOpenBulkDM,
  onOpenCampaignManager,
  onOpenCreatorOutreach,
}: DatabaseTabProps) {
  const [activeStatus, setActiveStatus] = useState<"all" | InfluencerRelationshipStatus>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [campaignFilter, setCampaignFilter] = useState("all");
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [tempNotes, setTempNotes] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Quick Add & Seed states
  const [isSeeding, setIsSeeding] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickAddHandle, setQuickAddHandle] = useState("");
  const [isQuickAdding, setIsQuickAdding] = useState(false);
  const [quickAddError, setQuickAddError] = useState<string | null>(null);

  // Verified directory state for instant discovery & search
  const [directoryCreators, setDirectoryCreators] = useState<CreatorProfileData[]>([]);
  const [isLoadingDirectory, setIsLoadingDirectory] = useState(false);

  useEffect(() => {
    let mounted = true;
    const fetchDir = async () => {
      setIsLoadingDirectory(true);
      try {
        const res = await getVerifiedDirectoryApi();
        if (mounted && res.success && res.creators) {
          setDirectoryCreators(res.creators);
        }
      } catch (err) {
        console.warn("[DatabaseTab] Failed fetching directory:", err);
      } finally {
        if (mounted) setIsLoadingDirectory(false);
      }
    };
    fetchDir();
    return () => {
      mounted = false;
    };
  }, []);

  const handleAddFromDirectoryAndOutreach = async (creator: CreatorProfileData) => {
    const handle = creator.threadsUsername || creator.username;
    if (!handle) return;
    setIsQuickAdding(true);
    try {
      const res = await quickAddCreatorApi(userId, handle);
      if (res.success) {
        onRefreshSaved();
        if (onOpenCreatorOutreach) {
          onOpenCreatorOutreach([res.creator || creator]);
        }
      }
    } catch (err) {
      console.error("[DatabaseTab] Add from directory failed:", err);
    } finally {
      setIsQuickAdding(false);
    }
  };

  const handleSeedFeatured = async () => {
    setIsSeeding(true);
    try {
      const res = await seedFeaturedCreatorsApi(userId);
      if (res.success) {
        onRefreshSaved();
      }
    } catch (err) {
      console.error("[DatabaseTab] Seed featured failed:", err);
    } finally {
      setIsSeeding(false);
    }
  };

  const handleQuickAdd = async (handleToUse = quickAddHandle) => {
    const handle = handleToUse.trim();
    if (!handle) return;
    setIsQuickAdding(true);
    setQuickAddError(null);
    try {
      const res = await quickAddCreatorApi(userId, handle);
      if (res.success) {
        setQuickAddHandle("");
        setShowQuickAdd(false);
        onRefreshSaved();
      } else {
        setQuickAddError(res.error || "Could not add creator");
      }
    } catch (err: any) {
      setQuickAddError(err.message || "Failed to add creator");
    } finally {
      setIsQuickAdding(false);
    }
  };

  const statusOptions: Array<{ id: "all" | InfluencerRelationshipStatus; label: string; count: number }> = [
    { id: "all", label: "All Creators", count: savedInfluencers.length },
    { id: "new", label: "New", count: savedInfluencers.filter((i) => i.relationshipStatus === "new").length },
    { id: "shortlisted", label: "Shortlisted", count: savedInfluencers.filter((i) => i.relationshipStatus === "shortlisted").length },
    { id: "contacted", label: "Contacted", count: savedInfluencers.filter((i) => i.relationshipStatus === "contacted").length },
    { id: "responded", label: "Responded", count: savedInfluencers.filter((i) => i.relationshipStatus === "responded").length },
    { id: "active", label: "Active Deal", count: savedInfluencers.filter((i) => i.relationshipStatus === "active").length },
    { id: "completed", label: "Completed", count: savedInfluencers.filter((i) => i.relationshipStatus === "completed").length },
    { id: "archived", label: "Archived", count: savedInfluencers.filter((i) => i.relationshipStatus === "archived").length },
  ];

  const uniqueCampaigns = Array.from(
    new Set(savedInfluencers.map((i) => i.campaign).filter(Boolean) as string[])
  );

  const filteredInfluencers = savedInfluencers.filter((inf) => {
    // Status filter
    if (activeStatus !== "all" && inf.relationshipStatus !== activeStatus) {
      return false;
    }
    // Campaign filter
    if (campaignFilter !== "all" && inf.campaign !== campaignFilter) {
      return false;
    }
    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = inf.creator?.name?.toLowerCase().includes(q);
      const matchUser = inf.creator?.username?.toLowerCase().includes(q);
      const matchBio = inf.creator?.bio?.toLowerCase().includes(q);
      const matchNiche = inf.creator?.niche?.toLowerCase().includes(q);
      const matchNotes = inf.notes?.toLowerCase().includes(q);
      return matchName || matchUser || matchBio || matchNiche || matchNotes;
    }
    return true;
  });

  const directoryMatches = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().replace(/^@/, "");
    const savedHandles = new Set(
      savedInfluencers.map((s) => (s.creator?.threadsUsername || s.creator?.username || "").toLowerCase())
    );

    return directoryCreators.filter((c) => {
      const handle = (c.threadsUsername || c.username || "").toLowerCase();
      if (savedHandles.has(handle)) return false;
      return (
        c.name?.toLowerCase().includes(q) ||
        handle.includes(q) ||
        c.niche?.toLowerCase().includes(q) ||
        c.bio?.toLowerCase().includes(q) ||
        c.topics?.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [directoryCreators, searchQuery, savedInfluencers]);

  const handleStatusChange = async (id: string, newStatus: InfluencerRelationshipStatus) => {
    try {
      await updateSavedInfluencerApi(id, { relationshipStatus: newStatus });
      onRefreshSaved();
    } catch (err) {
      console.error("[DatabaseTab] Status update failed:", err);
    }
  };

  const handleSaveNotes = async (id: string) => {
    try {
      await updateSavedInfluencerApi(id, { notes: tempNotes });
      setEditingNotesId(null);
      onRefreshSaved();
    } catch (err) {
      console.error("[DatabaseTab] Notes save failed:", err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to remove this creator from your database?")) return;
    try {
      await deleteSavedInfluencerApi(id);
      onRefreshSaved();
    } catch (err) {
      console.error("[DatabaseTab] Delete failed:", err);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredInfluencers.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredInfluencers.map((i) => i.id)));
    }
  };

  const toggleSelectOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleExportCsv = () => {
    const creatorsToExport = savedInfluencers.filter((i) =>
      selectedIds.size > 0 ? selectedIds.has(i.id) : true
    );

    if (creatorsToExport.length === 0) return;

    const rows = [
      ["Handle", "Name", "Niche", "Category", "Status", "Campaign", "Notes", "Follower Count"].join(","),
      ...creatorsToExport.map((i) =>
        [
          `"${i.creator.username}"`,
          `"${i.creator.name}"`,
          `"${i.creator.niche}"`,
          `"${i.creator.category}"`,
          `"${i.relationshipStatus}"`,
          `"${i.campaign || ""}"`,
          `"${(i.notes || "").replace(/"/g, '""')}"`,
          `"${i.creator.followerCount || ""}"`,
        ].join(",")
      ),
    ];

    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `threads_creators_crm_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusBadge = (status: InfluencerRelationshipStatus) => {
    switch (status) {
      case "new":
        return "bg-status-info-bg text-status-info-text border-status-info-border";
      case "shortlisted":
        return "bg-brand-surface text-brand-text border-brand-border";
      case "contacted":
        return "bg-status-warning-bg text-status-warning-text border-status-warning-border";
      case "responded":
        return "bg-status-success-bg text-status-success-text border-status-success-border";
      case "active":
        return "bg-status-active-bg text-status-active-text border-status-active-border";
      case "completed":
        return "bg-bg-app text-text-secondary border-border-primary";
      case "archived":
        return "bg-status-danger-bg text-status-danger-text border-status-danger-border";
      default:
        return "bg-bg-sidebar text-text-muted border-border-primary";
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Status Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none border-b border-border-primary">
        {statusOptions.map((st) => (
          <button
            key={st.id}
            onClick={() => setActiveStatus(st.id)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer border ${
              activeStatus === st.id
                ? "bg-purple-600 text-white border-purple-600 shadow-sm"
                : "bg-bg-card border-border-primary text-text-secondary hover:bg-bg-card-hover hover:text-text-primary"
            }`}
          >
            <span>{st.label}</span>
            <span
              className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${
                activeStatus === st.id
                  ? "bg-white/20 text-white"
                  : "bg-bg-sidebar text-text-muted border border-border-primary"
              }`}
            >
              {st.count}
            </span>
          </button>
        ))}
      </div>

      {/* Search & Campaign Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search saved creators by name, handle, niche, or notes..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-bg-card border border-border-primary text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-purple-500"
          />
        </div>

        <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
          {uniqueCampaigns.length > 0 && (
            <select
              value={campaignFilter}
              onChange={(e) => setCampaignFilter(e.target.value)}
              className="px-3 py-2 rounded-xl bg-bg-card border border-border-primary text-xs text-text-primary focus:outline-none focus:border-purple-500 cursor-pointer"
            >
              <option value="all">All Campaigns</option>
              {uniqueCampaigns.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}

          <button
            onClick={() => setShowQuickAdd(!showQuickAdd)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition cursor-pointer ${
              showQuickAdd
                ? "bg-purple-600 text-white border-purple-600 shadow-sm"
                : "bg-bg-card-hover border-border-primary text-text-primary hover:text-purple-600 dark:hover:text-purple-300"
            }`}
          >
            <UserPlus className="w-3.5 h-3.5 text-purple-500" />
            + Add Creator
          </button>

          {savedInfluencers.length === 0 && (
            <button
              onClick={handleSeedFeatured}
              disabled={isSeeding}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition shadow-sm cursor-pointer"
            >
              <Sparkles className={`w-3.5 h-3.5 ${isSeeding ? "animate-spin" : ""}`} />
              {isSeeding ? "Importing..." : "Import Featured"}
            </button>
          )}

          {onOpenCampaignManager && (
            <button
              onClick={onOpenCampaignManager}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-bg-card-hover border border-border-primary text-text-primary hover:text-purple-600 dark:hover:text-purple-300 text-xs font-semibold transition cursor-pointer"
            >
              <FolderPlus className="w-3.5 h-3.5 text-purple-500" />
              Campaigns
            </button>
          )}

          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-bg-card-hover border border-border-primary text-text-primary hover:text-purple-600 dark:hover:text-purple-300 text-xs font-semibold transition cursor-pointer"
            title="Export CRM data to CSV"
          >
            <Download className="w-3.5 h-3.5 text-blue-500" />
            Export CRM
          </button>
        </div>
      </div>

      {/* Quick Add Inline Bar */}
      {showQuickAdd && (
        <div className="p-4 rounded-2xl bg-bg-card border border-purple-500/30 shadow-md space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-text-primary flex items-center gap-1.5">
              <UserPlus className="w-4 h-4 text-purple-500" />
              Add Any Threads Creator by @username
            </span>
            <button
              onClick={() => {
                setShowQuickAdd(false);
                setQuickAddError(null);
              }}
              className="text-[11px] text-text-muted hover:text-text-primary"
            >
              Cancel
            </button>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={quickAddHandle}
                onChange={(e) => setQuickAddHandle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleQuickAdd()}
                placeholder="Enter Threads username, e.g. @zuck, @mosseri, @shaanpuri..."
                className="w-full px-3.5 py-2 rounded-xl bg-bg-input border border-border-primary text-xs text-text-primary focus:outline-none focus:border-purple-500"
              />
            </div>
            <button
              onClick={() => handleQuickAdd()}
              disabled={isQuickAdding || !quickAddHandle.trim()}
              className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold text-xs transition cursor-pointer shrink-0"
            >
              {isQuickAdding ? "Adding..." : "Add to Database"}
            </button>
          </div>
          {quickAddError && (
            <p className="text-[11px] text-red-500 font-semibold">{quickAddError}</p>
          )}
        </div>
      )}

      {/* Batch Selection Action Bar */}
      {filteredInfluencers.length > 0 && (
        <div className="p-3.5 rounded-xl bg-bg-sidebar border border-border-primary flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <button
              onClick={toggleSelectAll}
              className="flex items-center gap-1.5 font-semibold text-text-primary hover:text-purple-600 transition cursor-pointer"
            >
              {selectedIds.size === filteredInfluencers.length && filteredInfluencers.length > 0 ? (
                <CheckSquare className="w-4 h-4 text-purple-500" />
              ) : (
                <Square className="w-4 h-4 text-text-muted" />
              )}
              {selectedIds.size > 0 ? `${selectedIds.size} Selected` : "Select All"}
            </button>
            <span className="text-text-muted">({filteredInfluencers.length} Total in View)</span>
          </div>

          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2">
              {onOpenCreatorOutreach && (
                <button
                  onClick={() => {
                    const selectedCreators = savedInfluencers
                      .filter((i) => selectedIds.has(i.id))
                      .map((i) => i.creator);
                    onOpenCreatorOutreach(selectedCreators);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition shadow-md shadow-purple-600/20 cursor-pointer"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  Creator Outreach ({selectedIds.size})
                </button>
              )}

              {onOpenBulkDM && (
                <button
                  onClick={() => {
                    const selectedCreators = savedInfluencers
                      .filter((i) => selectedIds.has(i.id))
                      .map((i) => i.creator);
                    onOpenBulkDM(selectedCreators);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-bg-card border border-border-primary text-text-primary hover:bg-bg-card-hover text-xs font-semibold transition cursor-pointer"
                >
                  <Users className="w-3.5 h-3.5" />
                  Batch DMs ({selectedIds.size})
                </button>
              )}

              <button
                onClick={handleExportCsv}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-bg-card border border-border-primary text-text-primary hover:bg-bg-card-hover text-xs font-semibold transition cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-blue-500" />
                Export Selected
              </button>
            </div>
          )}
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="py-12 text-center text-xs text-text-muted space-y-2">
          <Sparkles className="w-6 h-6 text-purple-500 animate-spin mx-auto" />
          <p>Loading creator database...</p>
        </div>
      )}

      {/* Empty State / Unmatched Search */}
      {!isLoading && filteredInfluencers.length === 0 && !searchQuery.trim() && (
        <div className="py-14 text-center space-y-4 bg-bg-card rounded-2xl border border-border-primary p-8 max-w-xl mx-auto">
          <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center mx-auto">
            <Bookmark className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-text-primary">Your Creator Database is Empty</h3>
            <p className="text-xs text-text-secondary mt-1 max-w-md mx-auto">
              Import 12 featured high-signal Threads creators with live post histories to start tracking and launching Creator Outreach immediately.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            <button
              onClick={handleSeedFeatured}
              disabled={isSeeding}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition shadow-md shadow-purple-600/20 cursor-pointer"
            >
              <Sparkles className={`w-4 h-4 ${isSeeding ? "animate-spin" : ""}`} />
              <span>{isSeeding ? "Importing 12 Creators..." : "Import 12 Featured Creators"}</span>
            </button>
            <button
              onClick={() => setShowQuickAdd(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-bg-sidebar border border-border-primary hover:bg-bg-card-hover text-text-primary font-bold text-xs transition cursor-pointer"
            >
              <UserPlus className="w-4 h-4 text-purple-500" />
              <span>Add by @username</span>
            </button>
          </div>
        </div>
      )}

      {/* No Saved Creators match search query */}
      {!isLoading && filteredInfluencers.length === 0 && searchQuery.trim() && directoryMatches.length === 0 && (
        <div className="py-12 text-center space-y-3 bg-bg-card rounded-2xl border border-border-primary p-6 max-w-lg mx-auto">
          <Search className="w-8 h-8 text-text-muted mx-auto" />
          <h3 className="text-sm font-bold text-text-primary">No creators match "{searchQuery}"</h3>
          <p className="text-xs text-text-secondary max-w-sm mx-auto">
            Target this creator directly by username to fetch recent posts and start outreach.
          </p>
          <div className="pt-2 flex items-center justify-center gap-2">
            <button
              onClick={() => handleQuickAdd(searchQuery)}
              disabled={isQuickAdding}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition shadow-sm cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Add @{searchQuery.replace(/^@/, "")} to Database & Outreach</span>
            </button>
            <button
              onClick={() => setSearchQuery("")}
              className="px-3 py-2 rounded-xl bg-bg-sidebar border border-border-primary text-xs font-semibold text-text-secondary hover:text-text-primary transition cursor-pointer"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Verified Directory Matches Section when searching */}
      {!isLoading && directoryMatches.length > 0 && searchQuery.trim() && (
        <div className="p-5 rounded-2xl bg-purple-500/[0.03] border border-purple-500/20 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-purple-500" />
                Found in Verified Threads Directory ({directoryMatches.length})
              </span>
              <span className="text-[11px] text-text-muted">— Click to add to database and launch outreach</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {directoryMatches.slice(0, 6).map((c) => (
              <div
                key={c.id || c.username}
                className="p-4 rounded-xl bg-bg-card border border-border-primary flex flex-col justify-between gap-3 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <img
                    src={c.profilePicUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${c.username}`}
                    alt={c.name}
                    className="w-10 h-10 rounded-xl object-cover shrink-0 border border-border-primary"
                  />
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-text-primary truncate">{c.name}</h4>
                    <p className="text-[11px] font-mono text-purple-600 dark:text-purple-400 truncate">
                      @{c.threadsUsername || c.username}
                    </p>
                    <span className="text-[10px] text-text-muted bg-bg-sidebar px-1.5 py-0.5 rounded">
                      {c.niche || "Creator"}
                    </span>
                  </div>
                </div>

                {c.bio && (
                  <p className="text-[11px] text-text-secondary line-clamp-2 leading-relaxed">
                    {c.bio}
                  </p>
                )}

                <div className="flex items-center gap-2 pt-2 border-t border-border-primary">
                  <button
                    onClick={() => handleAddFromDirectoryAndOutreach(c)}
                    disabled={isQuickAdding}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition shadow-sm cursor-pointer"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Add & Outreach</span>
                  </button>
                  <a
                    href={buildThreadsProfileUrl(c.threadsUsername || c.username)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-lg bg-bg-sidebar border border-border-primary text-text-muted hover:text-purple-500 transition"
                    title="View Threads profile"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Database Creator Grid */}
      {!isLoading && filteredInfluencers.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredInfluencers.map((inf) => {
            const creator = inf.creator;
            const isEditingNotes = editingNotesId === inf.id;

            const isSelected = selectedIds.has(inf.id);

            return (
              <div
                key={inf.id}
                className={`p-5 rounded-2xl bg-bg-card border transition shadow-sm space-y-4 flex flex-col justify-between ${
                  isSelected ? "border-purple-500/70 bg-purple-500/[0.02]" : "border-border-primary hover:border-purple-500/30"
                }`}
              >
                <div className="space-y-3">
                  {/* Top Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => toggleSelectOne(inf.id)}
                        className="text-text-muted hover:text-purple-500 transition cursor-pointer shrink-0"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-purple-500" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>

                      <img
                        src={creator.profilePicUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${creator.username}`}
                        alt={creator.name}
                        className="w-11 h-11 rounded-xl border border-purple-500/20 object-cover shrink-0"
                      />
                      <div>
                        <h4 className="text-sm font-bold text-text-primary leading-tight">{creator.name}</h4>
                        {(() => {
                          const handle = normalizeThreadsUsername(creator.threadsUsername || creator.username);
                          const profileUrl = creator.threadsProfileUrl || buildThreadsProfileUrl(handle);
                          return profileUrl && handle ? (
                            <a
                              href={profileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs font-mono text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1 mt-0.5"
                              onClick={(e) => e.stopPropagation()}
                            >
                              @{handle}
                              <ExternalLink className="w-3 h-3 shrink-0" />
                            </a>
                          ) : (
                            <span className="text-xs font-mono text-text-muted mt-0.5 block">
                              Profile not verified
                            </span>
                          );
                        })()}
                      </div>
                    </div>

                    <button
                      onClick={() => handleDelete(inf.id)}
                      className="p-1.5 rounded-lg text-text-muted hover:text-red-500 hover:bg-red-500/10 transition"
                      title="Remove from database"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Bio */}
                  <p className="text-xs text-text-secondary line-clamp-2">{creator.bio}</p>

                  {/* Relationship Status Selector & Campaign Tag */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <div className="relative">
                      <select
                        value={inf.relationshipStatus}
                        onChange={(e) => handleStatusChange(inf.id, e.target.value as InfluencerRelationshipStatus)}
                        className={`text-[11px] font-mono px-2.5 py-1 rounded-lg border focus:outline-none cursor-pointer ${getStatusBadge(
                          inf.relationshipStatus
                        )}`}
                      >
                        <option value="new">New</option>
                        <option value="shortlisted">Shortlisted</option>
                        <option value="contacted">Contacted</option>
                        <option value="responded">Responded</option>
                        <option value="active">Active Deal</option>
                        <option value="completed">Completed</option>
                        <option value="archived">Archived</option>
                      </select>
                    </div>

                    {inf.campaign && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-300">
                        {inf.campaign}
                      </span>
                    )}
                  </div>

                  {/* Notes Section */}
                  <div className="p-3 rounded-xl bg-bg-sidebar border border-border-primary/60 space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] font-mono uppercase text-text-muted">
                      <span>Relationship Notes</span>
                      {!isEditingNotes && (
                        <button
                          onClick={() => {
                            setEditingNotesId(inf.id);
                            setTempNotes(inf.notes || "");
                          }}
                          className="text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"
                        >
                          <Edit2 className="w-3 h-3" /> Edit
                        </button>
                      )}
                    </div>

                    {isEditingNotes ? (
                      <div className="space-y-1.5">
                        <textarea
                          value={tempNotes}
                          onChange={(e) => setTempNotes(e.target.value)}
                          rows={2}
                          className="w-full p-2 rounded-lg bg-bg-card border border-border-primary text-xs text-text-primary focus:outline-none focus:border-purple-500"
                          placeholder="Add relationship notes..."
                        />
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setEditingNotesId(null)}
                            className="px-2 py-0.5 text-[10px] text-text-muted hover:text-text-primary"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleSaveNotes(inf.id)}
                            className="px-2.5 py-1 text-[10px] font-bold rounded-md bg-purple-600 text-white"
                          >
                            Save Notes
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-text-secondary italic">
                        {inf.notes || "No notes added yet."}
                      </p>
                    )}
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="flex items-center gap-1.5 pt-2 border-t border-border-primary/50">
                  <button
                    onClick={() => onOpenIntelligence(creator, inf.intelligence, inf)}
                    className="flex-1 flex items-center justify-center gap-1 px-2 py-2 rounded-xl bg-bg-card-hover border border-border-primary text-text-primary text-[11px] font-semibold hover:bg-bg-sidebar transition cursor-pointer"
                    title="View Strategic Intelligence"
                  >
                    <Info className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                    <span>Intel</span>
                  </button>

                  {onOpenCreatorOutreach && (
                    <button
                      onClick={() => onOpenCreatorOutreach([creator])}
                      className="flex-1 flex items-center justify-center gap-1 px-2 py-2 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 dark:text-purple-300 border border-purple-500/20 text-[11px] font-bold transition cursor-pointer"
                      title="Leave a comment on recent Threads posts"
                    >
                      <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                      <span>Outreach</span>
                    </button>
                  )}

                  <button
                    onClick={() => onOpenDM(creator, inf.intelligence, inf)}
                    className="flex-1 flex items-center justify-center gap-1 px-2 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-bold transition shadow-sm cursor-pointer"
                    title="Send or draft a direct message"
                  >
                    <Send className="w-3.5 h-3.5 shrink-0" />
                    <span>{inf.relationshipStatus === "contacted" ? "Follow-Up" : "DM"}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
