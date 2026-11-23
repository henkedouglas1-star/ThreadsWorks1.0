import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { UserProfile } from "../../types";
import {
  AccountAnalyticsSnapshot,
  PostAnalyticsRecord,
  AnalyticsSyncSummary
} from "../../types/analytics";
import {
  getThreadsAccountAnalytics,
  getThreadsPostAnalytics,
  getThreadsAnalyticsSyncStatus,
  syncThreadsAnalytics
} from "../../utils/threadsAnalyticsApi";
import { invalidateThreadsConnectionCache } from "../../utils/threadsApi";
import { auth } from "../../firebase";
import { useThreadsConnection } from "../../context/ThreadsConnectionContext";

import AnalyticsSyncHeader from "./AnalyticsSyncHeader";
import AccountOverviewCards from "./AccountOverviewCards";
import PerformanceTrendsChart from "./PerformanceTrendsChart";
import AnalyticsFilters, { AnalyticsFilterUIState } from "./AnalyticsFilters";
import ContentPerformanceTable from "./ContentPerformanceTable";
import PostDetailModal from "./PostDetailModal";
import { DisconnectedState, AnalyticsLoadingSkeleton } from "./AnalyticsStates";

interface AnalyticsViewProps {
  profile: UserProfile | null;
  subscriptionStatus?: string;
}

export default function AnalyticsView({ profile }: AnalyticsViewProps) {
  const currentUid = auth.currentUser?.uid || profile?.uid || "";
  const {
    loading: loadingConn,
    connected,
    username,
    hasInsightsPermission,
    connectThreads,
    refreshConnection
  } = useThreadsConnection();

  // 1. Connection & Permission States
  const [isConnecting, setIsConnecting] = useState(false);

  // 2. Telemetry & Data States
  const [selectedTimeframe, setSelectedTimeframe] = useState<"1d" | "7d" | "30d">("7d");
  const [loadingData, setLoadingData] = useState(true);
  const [accountData, setAccountData] = useState<AccountAnalyticsSnapshot | null>(null);
  const [posts, setPosts] = useState<PostAnalyticsRecord[]>([]);
  const [totalPostsCount, setTotalPostsCount] = useState(0);
  const [filteredCount, setFilteredCount] = useState(0);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | undefined>(undefined);

  // 3. Sync Execution States
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSummary, setSyncSummary] = useState<AnalyticsSyncSummary | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  // 4. Filter & Pagination States
  const [filters, setFilters] = useState<AnalyticsFilterUIState>({
    page: 1,
    limit: 10,
    sortBy: "views",
    sortDirection: "desc",
    dateRange: "all"
  });
  const [totalPages, setTotalPages] = useState(1);

  // 5. Post Detail Inspection Modal
  const [selectedPost, setSelectedPost] = useState<PostAnalyticsRecord | null>(null);

  // Load Content Pillars from Profile for filter options
  const pillarsList = useMemo(() => {
    if (!profile?.contentPillars) return [];
    return profile.contentPillars
      .map((p: any) => (typeof p === "string" ? p : p.title || p.name || ""))
      .filter(Boolean);
  }, [profile?.contentPillars]);

  // Pending OAuth redirect reference
  const pendingOAuthReturnRef = useRef(false);

  // Check connection status
  const verifyConnection = useCallback(async (forceServerVerification = false) => {
    return refreshConnection(forceServerVerification);
  }, [refreshConnection]);

  // Load Analytics Data
  const loadAnalytics = useCallback(async (customFilters?: AnalyticsFilterUIState, customTimeframe?: "1d" | "7d" | "30d") => {
    if (!currentUid) return;
    const activeFilters = customFilters || filters;
    const activeTimeframe = customTimeframe || selectedTimeframe;
    setLoadingData(true);

    try {
      // Calculate since date if dateRange is set
      let sinceDate: string | undefined = undefined;
      if (activeFilters.dateRange && activeFilters.dateRange !== "all") {
        const now = Date.now();
        const days = activeFilters.dateRange === "7d" ? 7 : activeFilters.dateRange === "30d" ? 30 : 90;
        sinceDate = new Date(now - days * 24 * 60 * 60 * 1000).toISOString();
      }

      const pageNum = activeFilters.page || 1;
      const limitNum = activeFilters.limit || 10;
      const offset = (pageNum - 1) * limitNum;

      // Fetch Account Overview, Sync Status, and Posts
      const [accRes, syncStatusRes, postsRes] = await Promise.all([
        getThreadsAccountAnalytics(currentUid, activeTimeframe),
        getThreadsAnalyticsSyncStatus(currentUid),
        getThreadsPostAnalytics({
          userId: currentUid,
          limit: limitNum,
          offset: offset,
          sortBy: activeFilters.sortBy || "views",
          sortDirection: activeFilters.sortDirection || "desc",
          pillarTitle: activeFilters.pillarTitle,
          topic: activeFilters.topic,
          mediaType: activeFilters.mediaType,
          since: sinceDate
        })
      ]);

      // Process Account Data
      if (accRes.success && accRes.account) {
        setAccountData(accRes.account);
        if (accRes.account.lastSyncedAt) {
          setLastSyncedAt(accRes.account.lastSyncedAt);
        }
      }

      // Process Sync Status
      if (syncStatusRes.success && syncStatusRes.summary) {
        if (syncStatusRes.summary.lastSyncedAt) {
          setLastSyncedAt(syncStatusRes.summary.lastSyncedAt);
        }
      }

      // Process Posts Data
      if (postsRes.success) {
        let loadedPosts = postsRes.posts || [];
        
        // Client-side search filtering if search term provided
        if (activeFilters.search && activeFilters.search.trim()) {
          const q = activeFilters.search.toLowerCase().trim();
          loadedPosts = loadedPosts.filter((p) => 
            p.text?.toLowerCase().includes(q) ||
            p.contentMemoryContext?.hook?.toLowerCase().includes(q) ||
            p.contentMemoryContext?.topic?.toLowerCase().includes(q) ||
            p.contentMemoryContext?.pillarTitle?.toLowerCase().includes(q)
          );
        }

        setPosts(loadedPosts);
        const total = postsRes.total || loadedPosts.length;
        setTotalPostsCount(total);
        setFilteredCount(loadedPosts.length);
        setTotalPages(Math.max(1, Math.ceil(total / limitNum)));
      }
    } catch (err: any) {
      console.error("Error loading analytics data:", err);
    } finally {
      setLoadingData(false);
    }
  }, [currentUid, filters, selectedTimeframe]);

  const handleTimeframeChange = (newTimeframe: "1d" | "7d" | "30d") => {
    setSelectedTimeframe(newTimeframe);
    loadAnalytics(filters, newTimeframe);
  };

  // Initial detection of OAuth redirect parameters
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthStatus = params.get("oauth_status");
    const threadsAuth = params.get("threads_auth");

    if (oauthStatus === "connected" || threadsAuth === "success") {
      pendingOAuthReturnRef.current = true;
      const cleanUrl = window.location.origin + window.location.pathname;
      window.history.replaceState(null, "", cleanUrl);
    }
  }, []);

  // Connection verification on mount and when user ID resolves
  useEffect(() => {
    if (!currentUid) return;

    if (pendingOAuthReturnRef.current) {
      pendingOAuthReturnRef.current = false;
      invalidateThreadsConnectionCache(currentUid);
      verifyConnection(true).then((conn) => {
        if (conn?.connected) {
          handleTriggerSync();
        }
      });
    } else {
      verifyConnection(false);
    }

    const handleConnectionUpdate = () => {
      verifyConnection(true);
      loadAnalytics();
    };

    window.addEventListener("threads-connection-updated", handleConnectionUpdate);
    return () => {
      window.removeEventListener("threads-connection-updated", handleConnectionUpdate);
    };
  }, [currentUid, verifyConnection, loadAnalytics]);

  // When connection is verified, load telemetry
  useEffect(() => {
    if (connected && currentUid) {
      loadAnalytics();
    }
  }, [connected, currentUid, loadAnalytics]);

  // Trigger On-Demand Synchronization
  const handleTriggerSync = async () => {
    if (!currentUid || isSyncing) return;

    setIsSyncing(true);
    setSyncError(null);
    setSyncSummary(null);

    try {
      const res = await syncThreadsAnalytics(currentUid, { forceRefresh: true, maxPosts: 50 });
      if (res.success && res.summary) {
        setSyncSummary(res.summary);
        setLastSyncedAt(res.summary.lastSyncedAt);
        // Refresh local dashboard data
        await loadAnalytics();
      } else {
        setSyncError(res.error || "Analytics synchronization could not complete.");
      }
    } catch (err: any) {
      const errMsg = err?.message || "An unexpected error occurred during synchronization.";
      setSyncError(errMsg);
    } finally {
      setIsSyncing(false);
      refreshConnection(true);
    }
  };

  // Trigger OAuth Handshake or Permission Upgrade Popup
  const handleAuthorizeOAuth = async () => {
    if (!currentUid) return;
    setIsConnecting(true);
    setSyncError(null);

    try {
      const result = await connectThreads("/analytics");

      if (result.success) {
        const conn = await verifyConnection(true);
        if (conn?.connected) {
          await handleTriggerSync();
        }
      } else {
        if (result.error !== "Cancelled") {
          setSyncError(`Threads Connection Failed: ${result.error}`);
        } else {
          console.log("OAuth authorization cancelled by user.");
        }
      }
    } catch (err: any) {
      console.error("Failed to launch Threads authorization:", err);
      setSyncError(err?.message || "Failed to initiate Threads connection.");
    } finally {
      setIsConnecting(false);
    }
  };

  // Filter change handler
  const handleFilterChange = (newFilterPartial: Partial<AnalyticsFilterUIState>) => {
    const updated: AnalyticsFilterUIState = {
      ...filters,
      ...newFilterPartial,
      page: newFilterPartial.page !== undefined ? newFilterPartial.page : 1
    };
    setFilters(updated);
    loadAnalytics(updated);
  };

  // Reset filters handler
  const handleResetFilters = () => {
    const defaultFilters: AnalyticsFilterUIState = {
      page: 1,
      limit: 10,
      sortBy: "views",
      sortDirection: "desc",
      dateRange: "all",
      search: "",
      pillarTitle: undefined,
      topic: undefined,
      mediaType: undefined
    };
    setFilters(defaultFilters);
    loadAnalytics(defaultFilters);
  };

  // Page navigation
  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    handleFilterChange({ page: newPage });
  };

  // Page size adjustment
  const handlePageSizeChange = (newSize: number) => {
    handleFilterChange({ limit: newSize, page: 1 });
  };

  // Loading skeleton when initial connection is resolving
  if (loadingConn) {
    return <AnalyticsLoadingSkeleton />;
  }

  // Not connected state
  if (!connected) {
    return <DisconnectedState onConnect={handleAuthorizeOAuth} isConnecting={isConnecting} />;
  }

  return (
    <div className="space-y-6 animate-fade-in" id="threads-analytics-dashboard">
      {/* 1. Sync & Identity Header */}
      <AnalyticsSyncHeader
        connected={connected}
        username={username}
        hasInsightsPermission={hasInsightsPermission}
        lastSyncedAt={lastSyncedAt}
        isSyncing={isSyncing}
        isVerifying={loadingConn}
        syncSummary={syncSummary}
        syncError={syncError}
        selectedTimeframe={selectedTimeframe}
        totalTrackedPosts={totalPostsCount}
        onTriggerSync={handleTriggerSync}
        onAuthorizeInsights={handleAuthorizeOAuth}
      />

      {/* 2. Account Overview Metrics */}
      <AccountOverviewCards
        account={accountData}
        historicalSnapshotsCount={accountData?.timeSeries?.length || 0}
        selectedTimeframe={selectedTimeframe}
        onTimeframeChange={handleTimeframeChange}
      />

      {/* 3. Performance Trend Visualization */}
      <PerformanceTrendsChart
        timeSeries={accountData?.timeSeries || []}
        dailySnapshots={accountData?.dailySnapshots}
        lastSyncedAt={lastSyncedAt}
      />

      {/* 4. Content Performance Filters */}
      <AnalyticsFilters
        filters={filters}
        onFilterChange={handleFilterChange}
        onResetFilters={handleResetFilters}
        pillarsList={pillarsList}
        totalPostsCount={totalPostsCount}
        filteredCount={filteredCount}
      />

      {/* 5. Post-Level Content Performance Table / Grid */}
      <ContentPerformanceTable
        posts={posts}
        loading={loadingData}
        onSelectPost={(p) => setSelectedPost(p)}
        currentPage={filters.page || 1}
        totalPages={totalPages}
        totalPosts={totalPostsCount}
        pageSize={filters.limit || 10}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
      />

      {/* 6. Post Detail Deep Dive Modal */}
      {selectedPost && (
        <PostDetailModal
          userId={currentUid}
          mediaId={selectedPost.mediaId}
          initialPost={selectedPost}
          onClose={() => setSelectedPost(null)}
        />
      )}
    </div>
  );
}
