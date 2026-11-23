import React, { useState } from "react";
import {
  SavedInfluencer,
  CreatorProfileData,
  CreatorIntelligenceProfile,
  InfluencerRelationshipStatus,
} from "../../types/influencer";
import { updateSavedInfluencerApi, buildThreadsProfileUrl, getThreadsProfileUrl, normalizeThreadsUsername } from "../../utils/influencerApi";
import {
  Kanban,
  Search,
  Filter,
  Send,
  Info,
  Clock,
  AlertCircle,
  DollarSign,
  CheckCircle2,
  ChevronRight,
  MoreVertical,
  Plus,
  Sparkles,
  ArrowRight,
  UserCheck,
  ExternalLink,
} from "lucide-react";

interface PipelineKanbanTabProps {
  userId: string;
  savedInfluencers: SavedInfluencer[];
  isLoading: boolean;
  onRefreshSaved: () => void;
  onOpenIntelligence: (creator: CreatorProfileData, intelligence?: CreatorIntelligenceProfile, savedRecord?: SavedInfluencer) => void;
  onOpenDM: (creator: CreatorProfileData, intelligence?: CreatorIntelligenceProfile, savedRecord?: SavedInfluencer) => void;
}

const KANBAN_COLUMNS: Array<{
  id: InfluencerRelationshipStatus;
  title: string;
  description: string;
  color: string;
}> = [
  {
    id: "shortlisted",
    title: "1. Shortlisted / Target",
    description: "Identified creators ready for initial DM outreach",
    color: "border-blue-500/30 bg-blue-500/[0.02] text-blue-600 dark:text-blue-400",
  },
  {
    id: "contacted",
    title: "2. Outreach Active",
    description: "Initial DM or follow-up sequence sent",
    color: "border-purple-500/30 bg-purple-500/[0.02] text-purple-600 dark:text-purple-400",
  },
  {
    id: "responded",
    title: "3. In Discussion",
    description: "Creator replied & aligning on scope or terms",
    color: "border-amber-500/30 bg-amber-500/[0.02] text-amber-600 dark:text-amber-400",
  },
  {
    id: "active",
    title: "4. Agreed / Scheduled",
    description: "Co-creation or deal confirmed and scheduled",
    color: "border-emerald-500/30 bg-emerald-500/[0.02] text-emerald-600 dark:text-emerald-400",
  },
  {
    id: "completed",
    title: "5. Completed / Archived",
    description: "Live thread published & outcomes logged",
    color: "border-slate-500/30 bg-slate-500/[0.02] text-slate-600 dark:text-slate-400",
  },
];

export default function PipelineKanbanTab({
  userId,
  savedInfluencers,
  isLoading,
  onRefreshSaved,
  onOpenIntelligence,
  onOpenDM,
}: PipelineKanbanTabProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const handleStatusChange = async (id: string, newStatus: InfluencerRelationshipStatus) => {
    setUpdatingId(id);
    try {
      await updateSavedInfluencerApi(id, { relationshipStatus: newStatus });
      onRefreshSaved();
    } catch (err) {
      console.error("[PipelineKanbanTab] Status update failed:", err);
    } finally {
      setUpdatingId(null);
    }
  };

  const isStale = (updatedAtStr: string) => {
    if (!updatedAtStr) return false;
    const diffDays = (Date.now() - new Date(updatedAtStr).getTime()) / (1000 * 3600 * 24);
    return diffDays > 5;
  };

  const filteredInfluencers = savedInfluencers.filter((i) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      i.creator.name.toLowerCase().includes(query) ||
      i.creator.username.toLowerCase().includes(query) ||
      i.creator.niche.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl bg-bg-card border border-border-primary">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
            <Kanban className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-text-primary">Outreach Pipeline</h2>
            <p className="text-xs text-text-secondary">Track creators through the deal pipeline from discovery to completed post</p>
          </div>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
          <input
            type="text"
            placeholder="Search pipeline creators..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-bg-sidebar border border-border-primary text-xs text-text-primary focus:outline-none focus:border-purple-500"
          />
        </div>
      </div>

      {/* Kanban Board Container */}
      {isLoading ? (
        <div className="py-20 text-center text-xs text-text-muted">Loading pipeline board...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 overflow-x-auto pb-6">
          {KANBAN_COLUMNS.map((col) => {
            const columnItems = filteredInfluencers.filter((inf) => {
              if (col.id === "shortlisted") return inf.relationshipStatus === "new" || inf.relationshipStatus === "shortlisted";
              return inf.relationshipStatus === col.id;
            });

            return (
              <div
                key={col.id}
                className="flex flex-col rounded-2xl bg-bg-sidebar/60 border border-border-primary p-3 space-y-3 min-w-[240px]"
              >
                {/* Column Header */}
                <div className="flex items-center justify-between pb-2 border-b border-border-primary shrink-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-lg border ${col.color}`}>
                      {col.title}
                    </span>
                  </div>
                  <span className="text-xs font-mono font-bold text-text-muted px-2 py-0.5 rounded-full bg-bg-card border border-border-primary">
                    {columnItems.length}
                  </span>
                </div>

                {/* Column Cards */}
                <div className="space-y-3 flex-1 overflow-y-auto max-h-[650px] pr-1">
                  {columnItems.length === 0 ? (
                    <div className="py-8 text-center text-[11px] text-text-muted border border-dashed border-border-primary/60 rounded-xl">
                      No creators in this stage
                    </div>
                  ) : (
                    columnItems.map((item) => {
                      const creator = item.creator;
                      const stale = isStale(item.updatedAt);

                      return (
                        <div
                          key={item.id}
                          className="p-3.5 rounded-xl bg-bg-card border border-border-primary hover:border-purple-500/40 transition shadow-sm space-y-3 relative group"
                        >
                          {/* Stale Alert */}
                          {stale && item.relationshipStatus !== "completed" && (
                            <div className="flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                              <AlertCircle className="w-3 h-3" />
                              <span>Stale (&gt;5d inactive)</span>
                            </div>
                          )}

                          {/* Creator Info */}
                          <div className="flex items-center gap-2.5">
                            <img
                              src={creator.profilePicUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${creator.username}`}
                              alt={creator.name}
                              className="w-8 h-8 rounded-full object-cover border border-border-primary shrink-0"
                            />
                            <div className="min-w-0 flex-1">
                              <h4 className="text-xs font-bold text-text-primary truncate">{creator.name}</h4>
                              {(() => {
                                const handle = normalizeThreadsUsername(creator.threadsUsername || creator.username);
                                const profileUrl = creator.threadsProfileUrl || buildThreadsProfileUrl(handle);
                                return profileUrl && handle ? (
                                  <a
                                    href={profileUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-[11px] text-purple-600 dark:text-purple-400 font-medium truncate hover:underline inline-flex items-center gap-0.5"
                                  >
                                    @{handle}
                                    <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                                  </a>
                                ) : (
                                  <p className="text-[11px] text-text-muted font-medium truncate">
                                    Profile not verified
                                  </p>
                                );
                              })()}
                            </div>
                          </div>

                          {/* Niche & Followers */}
                          <div className="flex items-center justify-between text-[10px] text-text-secondary bg-bg-sidebar px-2 py-1 rounded-lg border border-border-primary">
                            <span className="truncate max-w-[110px]">{creator.niche}</span>
                            <span className="font-mono font-semibold">{creator.followerCount ? `${(creator.followerCount / 1000).toFixed(1)}k` : "Organic"}</span>
                          </div>

                          {/* Move Stage Selector */}
                          <div className="pt-1 flex items-center justify-between gap-1">
                            <button
                              onClick={() => onOpenDM(creator, item.intelligence, item)}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 dark:text-purple-300 text-[10px] font-bold transition cursor-pointer border border-purple-500/20"
                              title="Personalize DM or Follow-up"
                            >
                              <Send className="w-3 h-3" />
                              <span>DM</span>
                            </button>

                            <button
                              onClick={() => onOpenIntelligence(creator, item.intelligence, item)}
                              className="p-1 rounded-lg bg-bg-card-hover border border-border-primary text-text-muted hover:text-text-primary transition cursor-pointer"
                              title="View Intelligence Profile"
                            >
                              <Info className="w-3 h-3" />
                            </button>

                            {/* Stage Move Dropdown */}
                            <select
                              value={item.relationshipStatus}
                              onChange={(e) => handleStatusChange(item.id, e.target.value as InfluencerRelationshipStatus)}
                              disabled={updatingId === item.id}
                              className="text-[10px] px-1.5 py-1 rounded-lg bg-bg-sidebar border border-border-primary text-text-primary focus:outline-none focus:border-purple-500 cursor-pointer max-w-[90px]"
                            >
                              <option value="shortlisted">Target</option>
                              <option value="contacted">Contacted</option>
                              <option value="responded">Discussion</option>
                              <option value="active">Agreed</option>
                              <option value="completed">Done</option>
                            </select>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
