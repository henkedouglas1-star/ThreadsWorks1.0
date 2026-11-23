import React, { useState, useMemo } from "react";
import {
  CreatorProfileData,
  CreatorIntelligenceProfile,
  InfluencerSearchFilters,
  SavedInfluencer,
} from "../../types/influencer";
import {
  searchCreatorsApi,
  analyzeCreatorApi,
  saveInfluencerApi,
  buildThreadsProfileUrl,
  normalizeThreadsUsername,
} from "../../utils/influencerApi";
import {
  Search,
  Sparkles,
  Users,
  Target,
  Bookmark,
  BookmarkCheck,
  Send,
  SlidersHorizontal,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  RotateCcw,
  Info,
  ShieldCheck,
  MessageSquare,
  Eye,
  X,
  Flame,
  CheckCircle2,
} from "lucide-react";

interface DiscoverTabProps {
  userId: string;
  userContext?: any;
  savedInfluencers: SavedInfluencer[];
  onOpenIntelligence: (creator: CreatorProfileData, intelligence?: CreatorIntelligenceProfile) => void;
  onOpenDM: (creator: CreatorProfileData, intelligence?: CreatorIntelligenceProfile) => void;
  onRefreshSaved: () => void;
  onAddToOutreach?: (creator: CreatorProfileData) => void;
}

type SortOption = "most_relevant" | "recently_active" | "verified" | "emerging" | "largest_audience";

const PAGE_CHUNK_SIZE = 24;

export default function DiscoverTab({
  userId,
  userContext,
  savedInfluencers,
  onOpenIntelligence,
  onOpenDM,
  onRefreshSaved,
  onAddToOutreach,
}: DiscoverTabProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [activeSortBy, setActiveSortBy] = useState<SortOption>("most_relevant");
  const [filters, setFilters] = useState<InfluencerSearchFilters>({
    niche: "",
    category: "",
    keywords: "",
    audienceSize: "all",
    creatorType: "",
    topics: "",
    minEngagement: "",
  });

  const [allResults, setAllResults] = useState<CreatorProfileData[]>([]);
  const [visibleCount, setVisibleCount] = useState<number>(PAGE_CHUNK_SIZE);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [isSearching, setIsSearching] = useState(false);
  const [searchStage, setSearchStage] = useState<"finding" | "verifying" | "analyzing" | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [queryExpansions, setQueryExpansions] = useState<string[]>([]);
  const [discoveryStats, setDiscoveryStats] = useState<any>(null);

  const [analyzingUsername, setAnalyzingUsername] = useState<string | null>(null);
  const [previewPostsCreator, setPreviewPostsCreator] = useState<CreatorProfileData | null>(null);
  const [addedOutreachSet, setAddedOutreachSet] = useState<Set<string>>(new Set());

  const savedUsernames = useMemo(() => {
    return new Set(savedInfluencers.map((s) => s.creator?.username?.toLowerCase()).filter(Boolean));
  }, [savedInfluencers]);

  const exampleQueries = [
    "SaaS founders",
    "AI creators",
    "fitness coaches",
    "marketing experts",
    "creator economy",
    "Lex Fridman",
    "@lexfridman",
    "podcasters talking about AI",
    "people posting about Threads growth",
  ];

  const handleSearch = async (queryToUse = searchQuery, sortOption = activeSortBy) => {
    const cleanQuery = queryToUse.trim();
    if (!cleanQuery) return;

    setIsSearching(true);
    setSearchError(null);
    setSearchStage("finding");
    setVisibleCount(PAGE_CHUNK_SIZE);

    const timer1 = setTimeout(() => setSearchStage("verifying"), 900);
    const timer2 = setTimeout(() => setSearchStage("analyzing"), 2200);

    try {
      const res = await searchCreatorsApi(
        cleanQuery,
        {
          ...filters,
          sortBy: sortOption,
          limit: 100, // Return up to 100 creators target
        },
        userContext
      );

      clearTimeout(timer1);
      clearTimeout(timer2);

      if (res.success && res.creators) {
        setAllResults(res.creators);
        setTotalCount(res.total ?? res.creators.length);
        setQueryExpansions(res.queryExpansions || []);
        setDiscoveryStats(res.discoveryStats || null);

        if (res.creators.length === 0) {
          setSearchError(`No relevant creators discovered matching "${cleanQuery}". Try a broader topic keyword or check the handle spelling.`);
        }
      } else {
        setSearchError(res.error || "Creator discovery was unavailable. Please try again.");
      }
    } catch (err: any) {
      clearTimeout(timer1);
      clearTimeout(timer2);
      setSearchError(err.message || "An unexpected error occurred during creator discovery.");
    } finally {
      setIsSearching(false);
      setSearchStage(null);
    }
  };

  const handleSortChange = (newSort: SortOption) => {
    setActiveSortBy(newSort);
    // Sort local pool immediately for instantaneous UX
    const sorted = [...allResults];
    if (newSort === "recently_active") {
      sorted.sort((a, b) => new Date(b.lastDiscoveredAt || 0).getTime() - new Date(a.lastDiscoveredAt || 0).getTime());
    } else if (newSort === "verified") {
      sorted.sort((a, b) => Number(b.isVerifiedProfile ?? b.verified ?? 0) - Number(a.isVerifiedProfile ?? a.verified ?? 0));
    } else if (newSort === "emerging") {
      sorted.sort((a, b) => (a.followerCount || 5000) - (b.followerCount || 5000));
    } else if (newSort === "largest_audience") {
      sorted.sort((a, b) => (b.followerCount || 0) - (a.followerCount || 0));
    } else {
      // most_relevant
      sorted.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
    }
    setAllResults(sorted);
  };

  const handleLoadMore = () => {
    setVisibleCount((prev) => Math.min(prev + PAGE_CHUNK_SIZE, allResults.length));
  };

  const handleSave = async (creator: CreatorProfileData) => {
    try {
      const res = await saveInfluencerApi(userId, creator);
      if (res.success) {
        onRefreshSaved();
      }
    } catch (err) {
      console.error("[DiscoverTab] Failed to save creator:", err);
    }
  };

  const handleAddToOutreach = (creator: CreatorProfileData) => {
    const handle = (creator.threadsUsername || creator.username || "").toLowerCase();
    setAddedOutreachSet((prev) => new Set([...prev, handle]));
    if (onAddToOutreach) {
      onAddToOutreach(creator);
    }
  };

  const handleViewIntelligence = async (creator: CreatorProfileData) => {
    setAnalyzingUsername(creator.username);
    try {
      const res = await analyzeCreatorApi(creator, userContext, userId);
      if (res.success && res.intelligence) {
        onOpenIntelligence(creator, res.intelligence);
      } else {
        onOpenIntelligence(creator);
      }
    } catch (_) {
      onOpenIntelligence(creator);
    } finally {
      setAnalyzingUsername(null);
    }
  };

  const visibleCreators = allResults.slice(0, visibleCount);

  return (
    <div className="space-y-6">
      {/* Search Header Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-br from-purple-900/15 via-bg-card to-bg-card border border-border-primary space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-500" />
              Discover Creators Across Threads
            </h2>
            <p className="text-xs text-text-secondary mt-0.5">
              Dynamically searches public Threads content, author profiles, biographies, and recent conversations
            </p>
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer self-start sm:self-auto ${
              showFilters || Object.values(filters).some((v) => v && v !== "all")
                ? "bg-purple-600/10 border-purple-500/30 text-purple-600 dark:text-purple-300"
                : "bg-bg-card-hover border-border-primary text-text-secondary hover:text-text-primary"
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filters {Object.values(filters).filter((v) => v && v !== "all").length > 0 && "•"}
          </button>
        </div>

        {/* Search Input Bar */}
        <div className="relative flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Search creators, topics, industries, biographies, or conversations..."
              className="w-full pl-11 pr-4 py-3 rounded-xl bg-bg-sidebar border border-border-primary text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-purple-500 shadow-inner"
            />
          </div>

          <button
            onClick={() => handleSearch()}
            disabled={isSearching || !searchQuery.trim()}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-bold transition shadow-lg shadow-purple-600/25 cursor-pointer shrink-0"
          >
            {isSearching ? <Sparkles className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {isSearching ? "Discovering..." : "Search"}
          </button>
        </div>

        {/* Collapsible Structured Filters */}
        {showFilters && (
          <div className="p-4 rounded-xl bg-bg-sidebar border border-border-primary space-y-3 pt-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-[10px] font-mono uppercase text-text-muted block mb-1">Niche</label>
                <input
                  type="text"
                  placeholder="e.g. AI & Automation"
                  value={filters.niche || ""}
                  onChange={(e) => setFilters({ ...filters, niche: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-bg-card border border-border-primary text-xs text-text-primary focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono uppercase text-text-muted block mb-1">Category</label>
                <input
                  type="text"
                  placeholder="e.g. SaaS / Software"
                  value={filters.category || ""}
                  onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-bg-card border border-border-primary text-xs text-text-primary focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono uppercase text-text-muted block mb-1">Audience Tier</label>
                <select
                  value={filters.audienceSize || "all"}
                  onChange={(e) => setFilters({ ...filters, audienceSize: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-bg-card border border-border-primary text-xs text-text-primary focus:outline-none focus:border-purple-500"
                >
                  <option value="all">All Audiences (Top Relevance)</option>
                  <option value="micro">Micro (&lt; 25k)</option>
                  <option value="mid">Mid-Tier (25k - 100k)</option>
                  <option value="macro">Macro (100k+)</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-mono uppercase text-text-muted block mb-1">Creator Type</label>
                <input
                  type="text"
                  placeholder="e.g. Founder / Educator"
                  value={filters.creatorType || ""}
                  onChange={(e) => setFilters({ ...filters, creatorType: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-bg-card border border-border-primary text-xs text-text-primary focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-primary/50">
              <button
                onClick={() => setFilters({ niche: "", category: "", keywords: "", audienceSize: "all", creatorType: "", topics: "", minEngagement: "" })}
                className="text-xs text-text-muted hover:text-text-primary flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" /> Reset Filters
              </button>
            </div>
          </div>
        )}

        {/* Quick Example Intent Chips */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[10px] font-mono text-text-muted uppercase">Example Searches:</span>
          {exampleQueries.map((ex, i) => (
            <button
              key={i}
              onClick={() => {
                setSearchQuery(ex);
                handleSearch(ex);
              }}
              className="text-[11px] px-2.5 py-1 rounded-full bg-bg-card-hover hover:bg-purple-500/10 hover:border-purple-500/30 border border-border-primary text-text-secondary hover:text-purple-600 dark:hover:text-purple-300 transition cursor-pointer"
            >
              {ex}
            </button>
          ))}
        </div>
      </div>

      {/* Error Notice */}
      {searchError && (
        <div className="p-4 rounded-xl bg-status-danger-bg border border-status-danger-border text-status-danger-text text-xs font-mono flex items-center justify-between">
          <span>{searchError}</span>
          <button
            onClick={() => setSearchError(null)}
            className="text-status-danger-text hover:opacity-75 ml-2 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Loading State & Progress Stages */}
      {isSearching && (
        <div className="space-y-4">
          <div className="p-6 rounded-2xl bg-bg-card border border-border-primary flex flex-col items-center justify-center text-center space-y-3 shadow-sm">
            <Sparkles className="w-8 h-8 text-purple-500 animate-spin" />
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-text-primary">
                {searchStage === "finding" && "🔍 Searching public Threads content & posts..."}
                {searchStage === "verifying" && "🛡️ Extracting author candidates & verifying profile data..."}
                {searchStage === "analyzing" && "🧠 Scoring topic relevance, biographies & recent posts..."}
                {!searchStage && "⚡ Gathering creator candidates across Threads..."}
              </h4>
              <p className="text-[10px] font-mono text-text-muted">
                THREADS DATA STREAM • UP TO 100 CREATORS EVALUATED
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="p-5 rounded-2xl bg-bg-card border border-border-primary space-y-3 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-bg-sidebar" />
                  <div className="space-y-1.5 flex-1">
                    <div className="h-4 w-32 bg-bg-sidebar rounded" />
                    <div className="h-3 w-20 bg-bg-sidebar rounded" />
                  </div>
                </div>
                <div className="h-12 bg-bg-sidebar rounded" />
                <div className="h-8 w-full bg-bg-sidebar rounded" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Results Toolbar: Found Count + Filter Pills */}
      {!isSearching && allResults.length > 0 && (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 rounded-xl bg-bg-card border border-border-primary">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-text-primary">
              {totalCount} Creators Found
            </h3>
            {queryExpansions.length > 1 && (
              <span className="text-[10px] font-mono text-purple-600 dark:text-purple-300 px-2 py-0.5 rounded-md bg-purple-500/10 border border-purple-500/20">
                Expanded: {queryExpansions.join(", ")}
              </span>
            )}
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-mono text-text-muted uppercase mr-1">Sort:</span>
            {[
              { id: "most_relevant", label: "Most Relevant" },
              { id: "recently_active", label: "Recently Active" },
              { id: "verified", label: "Verified" },
              { id: "emerging", label: "Emerging Creators" },
              { id: "largest_audience", label: "Largest Audience" },
            ].map((sortItem) => {
              const active = activeSortBy === sortItem.id;
              return (
                <button
                  key={sortItem.id}
                  onClick={() => handleSortChange(sortItem.id as SortOption)}
                  className={`text-xs px-3 py-1.5 rounded-lg font-medium transition cursor-pointer border ${
                    active
                      ? "bg-purple-600 text-white border-purple-600 shadow-sm"
                      : "bg-bg-sidebar border-border-primary text-text-secondary hover:text-text-primary hover:bg-bg-card-hover"
                  }`}
                >
                  {sortItem.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Initial Empty State Before Search */}
      {!isSearching && allResults.length === 0 && (
        <div className="py-16 text-center space-y-3 bg-bg-card rounded-2xl border border-border-primary/50 p-8">
          <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 flex items-center justify-center mx-auto">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-text-primary">Search Across Real Threads Creators</h3>
          <p className="text-xs text-text-secondary max-w-md mx-auto">
            Search creators by industry, topic, biography, or handle. ThreadsWorks dynamically gathers public Threads content, extracts authors, and ranks up to 100 relevant creators for outreach.
          </p>
        </div>
      )}

      {/* Creator Cards Grid */}
      {!isSearching && visibleCreators.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {visibleCreators.map((creator) => {
            const handle = normalizeThreadsUsername(creator.threadsUsername || creator.username);
            const isSaved = savedUsernames.has(handle.toLowerCase());
            const isAddedToOutreach = addedOutreachSet.has(handle.toLowerCase());
            const isAnalyzing = analyzingUsername === creator.username;
            const profileUrl = creator.threadsProfileUrl || creator.profileUrl || buildThreadsProfileUrl(handle);
            const recentPostSnippet = creator.recentPosts?.[0]?.text || creator.discoveryPostTexts?.[0];

            return (
              <div
                key={creator.id || handle}
                className="p-5 rounded-2xl bg-bg-card border border-border-primary hover:border-purple-500/40 transition shadow-sm flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  {/* Top Bar: Avatar, Names, Verified & Save Bookmark */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={creator.profilePicUrl || creator.profileImageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${handle}`}
                        alt={creator.name}
                        className="w-12 h-12 rounded-2xl border border-purple-500/20 object-cover shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-sm font-bold text-text-primary leading-tight truncate">
                            {creator.displayName || creator.name}
                          </h4>
                          {(creator.isVerifiedProfile ?? creator.verified) && (
                            <span title="Verified Creator" className="shrink-0 text-blue-500">
                              <ShieldCheck className="w-4 h-4" />
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 mt-0.5">
                          <a
                            href={profileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-mono text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            @{handle}
                            <ExternalLink className="w-3 h-3 shrink-0" />
                          </a>

                          {creator.relevanceScore && (
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-purple-500/10 text-purple-600 dark:text-purple-300 font-bold">
                              {creator.relevanceScore}% match
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleSave(creator)}
                      className={`p-2 rounded-xl border transition cursor-pointer shrink-0 ${
                        isSaved
                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                          : "bg-bg-card-hover border-border-primary text-text-muted hover:text-text-primary"
                      }`}
                      title={isSaved ? "Saved in database" : "Save / Track Creator"}
                    >
                      {isSaved ? <BookmarkCheck className="w-4 h-4 text-emerald-500" /> : <Bookmark className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Biography */}
                  <p className="text-xs text-text-secondary leading-relaxed line-clamp-2">
                    {creator.biography || creator.bio || "Active Threads content creator."}
                  </p>

                  {/* Tags & Public Metrics */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-300 border border-purple-500/20">
                      {creator.niche || "Creator"}
                    </span>
                    {creator.category && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-bg-card-hover border border-border-primary text-text-secondary">
                        {creator.category}
                      </span>
                    )}
                    {creator.followerCount && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-bg-sidebar border border-border-primary text-text-muted">
                        👥 {creator.followerCount.toLocaleString()}
                      </span>
                    )}
                  </div>

                  {/* "Why They Matched" Callout */}
                  <div className="p-3 rounded-xl bg-brand-surface border border-brand-border space-y-1">
                    <div className="text-[10px] font-mono uppercase font-bold text-brand-text flex items-center gap-1">
                      <Target className="w-3 h-3" /> WHY THEY MATCHED
                    </div>
                    <p className="text-[11px] text-text-primary leading-normal">
                      {creator.whyFound || creator.matchReason || `Matched based on relevance to your search inquiry.`}
                    </p>
                  </div>

                  {/* Recent Threads Content Snippet */}
                  {recentPostSnippet && (
                    <div className="p-2.5 rounded-xl bg-bg-sidebar/80 border border-border-primary/60 text-[11px] text-text-secondary space-y-1">
                      <div className="text-[9px] font-mono uppercase text-text-muted flex items-center gap-1">
                        <MessageSquare className="w-2.5 h-2.5" /> Recent Threads Content
                      </div>
                      <p className="line-clamp-2 italic text-text-primary/90">
                        "{recentPostSnippet}"
                      </p>
                    </div>
                  )}
                </div>

                {/* Bottom Action Strip */}
                <div className="flex items-center gap-2 pt-2 border-t border-border-primary/50">
                  {/* View Recent Posts Modal Trigger */}
                  <button
                    onClick={() => setPreviewPostsCreator(creator)}
                    className="flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-xl bg-bg-sidebar border border-border-primary hover:bg-bg-card-hover text-xs font-semibold text-text-secondary hover:text-text-primary transition cursor-pointer"
                    title="View Recent Posts"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Posts</span>
                  </button>

                  {/* View Deep Intelligence */}
                  <button
                    onClick={() => handleViewIntelligence(creator)}
                    disabled={isAnalyzing}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-bg-card-hover border border-border-primary text-text-primary hover:bg-bg-sidebar text-xs font-semibold transition cursor-pointer"
                  >
                    {isAnalyzing ? (
                      <Sparkles className="w-3.5 h-3.5 text-purple-500 animate-spin" />
                    ) : (
                      <Info className="w-3.5 h-3.5 text-purple-500" />
                    )}
                    Intelligence
                  </button>

                  {/* Add To Outreach Primary Action */}
                  <button
                    onClick={() => handleAddToOutreach(creator)}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition shadow-md shadow-purple-600/20 cursor-pointer"
                  >
                    {isAddedToOutreach ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
                    <span>{isAddedToOutreach ? "In Outreach" : "Add To Outreach"}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Load More Pagination */}
      {!isSearching && visibleCount < allResults.length && (
        <div className="pt-4 pb-2 text-center">
          <button
            onClick={handleLoadMore}
            className="px-6 py-2.5 rounded-xl bg-bg-card border border-border-primary hover:border-purple-500/40 text-text-primary text-xs font-bold transition shadow-sm cursor-pointer inline-flex items-center gap-2"
          >
            <span>Load More Creators (Showing {visibleCount} of {allResults.length})</span>
            <ChevronRight className="w-4 h-4 text-purple-500" />
          </button>
        </div>
      )}

      {/* Recent Posts Modal */}
      {previewPostsCreator && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-2xl bg-bg-card border border-border-primary shadow-2xl p-6 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-border-primary pb-3">
              <div className="flex items-center gap-3">
                <img
                  src={previewPostsCreator.profilePicUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${previewPostsCreator.username}`}
                  alt={previewPostsCreator.name}
                  className="w-10 h-10 rounded-xl object-cover border border-purple-500/20"
                />
                <div>
                  <h3 className="text-sm font-bold text-text-primary">{previewPostsCreator.name}</h3>
                  <a
                    href={previewPostsCreator.threadsProfileUrl || buildThreadsProfileUrl(previewPostsCreator.username)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-mono text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"
                  >
                    @{previewPostsCreator.username}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
              <button
                onClick={() => setPreviewPostsCreator(null)}
                className="p-1.5 rounded-lg hover:bg-bg-sidebar text-text-muted hover:text-text-primary"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 overflow-y-auto pr-1 flex-1">
              <div className="text-xs font-mono font-bold uppercase text-text-muted">
                Recent Public Threads Content ({previewPostsCreator.recentPosts?.length || 0})
              </div>

              {(!previewPostsCreator.recentPosts || previewPostsCreator.recentPosts.length === 0) && (
                <div className="p-4 rounded-xl bg-bg-sidebar text-center text-xs text-text-secondary">
                  No post snippets cached yet. Click "Add To Outreach" to retrieve full live posts with official Threads media IDs.
                </div>
              )}

              {previewPostsCreator.recentPosts?.map((post, idx) => (
                <div key={post.id || idx} className="p-4 rounded-xl bg-bg-sidebar border border-border-primary space-y-2">
                  <div className="flex items-center justify-between text-[10px] font-mono text-text-muted">
                    <span>{post.publishedAt || "Recently posted"}</span>
                    {post.url && (
                      <a
                        href={post.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"
                      >
                        View Post <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    )}
                  </div>
                  <p className="text-xs text-text-primary whitespace-pre-wrap leading-relaxed">
                    {post.text}
                  </p>
                  {(post.likes || post.replies) && (
                    <div className="flex items-center gap-3 text-[10px] font-mono text-text-muted pt-1">
                      {post.likes && <span>❤️ {post.likes.toLocaleString()} likes</span>}
                      {post.replies && <span>💬 {post.replies.toLocaleString()} replies</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-border-primary">
              <button
                onClick={() => setPreviewPostsCreator(null)}
                className="px-4 py-2 rounded-xl bg-bg-sidebar hover:bg-bg-card-hover text-xs text-text-secondary cursor-pointer"
              >
                Close
              </button>
              <button
                onClick={() => {
                  const creator = previewPostsCreator;
                  setPreviewPostsCreator(null);
                  handleAddToOutreach(creator);
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition shadow-sm cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Add To Outreach</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
