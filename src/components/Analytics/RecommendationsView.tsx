import React, { useState, useEffect, useCallback } from "react";
import { 
  PerformanceRecommendationsResponse, 
  ContentPerformanceRecommendation,
  RecommendationCategory 
} from "../../types/recommendations";
import { 
  getThreadsPerformanceRecommendations, 
  refreshThreadsPerformanceRecommendations 
} from "../../utils/threadsRecommendationApi";
import RecommendationCard from "./RecommendationCard";
import { 
  Sparkles, 
  RefreshCw, 
  TrendingUp, 
  FlaskConical, 
  Wrench, 
  PieChart, 
  Layers, 
  AlertCircle,
  ShieldCheck,
  BarChart2,
  CheckCircle2,
  Filter
} from "lucide-react";

interface RecommendationsViewProps {
  userId: string;
  onSelectPost?: (mediaId: string) => void;
  onApplyAction?: (action: NonNullable<ContentPerformanceRecommendation["suggestedAction"]>) => void;
  onTriggerSync?: () => void;
}

export default function RecommendationsView({
  userId,
  onSelectPost,
  onApplyAction,
  onTriggerSync
}: RecommendationsViewProps) {
  const [period, setPeriod] = useState<"7d" | "14d" | "30d" | "90d" | "all">("all");
  const [activeCategory, setActiveCategory] = useState<RecommendationCategory | "all">("all");
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [data, setData] = useState<PerformanceRecommendationsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchRecommendations = useCallback(async (
    selectedPeriod: "7d" | "14d" | "30d" | "90d" | "all", 
    selectedCategory: RecommendationCategory | "all",
    force: boolean = false
  ) => {
    if (!userId) return;
    if (force) setIsRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      let res;
      if (force) {
        res = await refreshThreadsPerformanceRecommendations(userId, selectedPeriod);
      } else {
        res = await getThreadsPerformanceRecommendations(userId, selectedPeriod, selectedCategory, false);
      }

      if (res.success && res.data) {
        setData(res.data);
      } else {
        setError(res.error || "Failed loading AI performance recommendations.");
      }
    } catch (err: any) {
      setError(err?.message || "An unexpected error occurred while fetching recommendations.");
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchRecommendations(period, activeCategory);
  }, [period, activeCategory, fetchRecommendations]);

  const handlePeriodChange = (newPeriod: "7d" | "14d" | "30d" | "90d" | "all") => {
    setPeriod(newPeriod);
  };

  const handleRefresh = () => {
    fetchRecommendations(period, activeCategory, true);
  };

  const categories = [
    { id: "all" as const, label: "All Strategic Priorities", icon: Sparkles, count: data?.totalGenerated || 0 },
    { id: "what_to_repeat" as const, label: "What to Repeat", icon: TrendingUp, count: data?.categoriesSummary.whatToRepeatCount || 0 },
    { id: "what_to_test" as const, label: "What to Test", icon: FlaskConical, count: data?.categoriesSummary.whatToTestCount || 0 },
    { id: "what_to_refine" as const, label: "What to Refine", icon: Wrench, count: data?.categoriesSummary.whatToRefineCount || 0 },
    { id: "content_mix" as const, label: "Content Mix", icon: PieChart, count: data?.categoriesSummary.contentMixCount || 0 },
  ];

  if (loading && !data) {
    return (
      <div className="space-y-4 animate-pulse py-4" id="recommendations-loading-skeleton">
        <div className="h-28 bg-bg-card border border-border-primary rounded-xl" />
        <div className="h-44 bg-bg-card border border-border-primary rounded-xl" />
        <div className="h-44 bg-bg-card border border-border-primary rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-bg-card border border-border-primary rounded-xl p-8 text-center shadow-sm">
        <AlertCircle className="w-8 h-8 text-status-danger-text mx-auto mb-3" />
        <h3 className="text-base font-semibold text-text-primary">
          Recommendation Engine Unavailable
        </h3>
        <p className="text-xs text-text-secondary mt-1 max-w-md mx-auto">
          {error}
        </p>
        <button
          onClick={handleRefresh}
          className="mt-4 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
        >
          Retry Analysis
        </button>
      </div>
    );
  }

  if (!data || data.totalPostsAnalyzed < 2) {
    return (
      <div className="bg-bg-card border border-border-primary rounded-xl p-8 text-center shadow-sm">
        <Sparkles className="w-8 h-8 text-brand-text mx-auto mb-3" />
        <h3 className="text-base font-semibold text-text-primary">
          Insufficient Historical Posts for Recommendations
        </h3>
        <p className="text-xs text-text-secondary mt-1 max-w-md mx-auto">
          The recommendation engine requires at least 2 published posts with lifetime analytics to calculate baselines and provide evidence-based guidance.
        </p>
        {onTriggerSync && (
          <button
            onClick={onTriggerSync}
            className="mt-4 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
          >
            Sync Threads Analytics
          </button>
        )}
      </div>
    );
  }

  const filteredRecommendations = activeCategory === "all"
    ? data.recommendations
    : data.recommendations.filter((r) => r.category === activeCategory);

  return (
    <div className="space-y-6" id="ai-performance-recommendations-view">
      {/* Top Banner: Benchmark Summary & Refresh Bar */}
      <div className="bg-bg-card border border-border-primary rounded-xl p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-status-success-text" />
              <h2 className="text-base font-bold text-text-primary tracking-tight">
                AI Content Performance Recommendations
              </h2>
            </div>
            <p className="text-xs text-text-secondary">
              Personalized, evidence-grounded strategic guidance benchmarked against your historical median of <span className="font-semibold text-text-primary font-mono">{data.creatorBaselineMedianViews.toLocaleString()} views</span> across {data.totalPostsAnalyzed} posts.
            </p>
          </div>

          {/* Time Window & Refresh Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="inline-flex bg-bg-app p-1 rounded-lg border border-border-primary">
              {(["7d", "14d", "30d", "90d", "all"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => handlePeriodChange(p)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                    period === p
                      ? "bg-bg-card text-text-primary border border-border-primary shadow-sm"
                      : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  {p === "all" ? "All Time" : p}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-bg-app hover:bg-bg-card-hover border border-border-primary text-text-primary text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
              <span>{isRefreshing ? "Generating..." : "Refresh Insights"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Category Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1" id="recommendation-category-filters">
        {categories.map((cat) => {
          const Icon = cat.icon;
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all whitespace-nowrap cursor-pointer ${
                isActive
                  ? "bg-purple-600 text-white border-purple-600 shadow-sm"
                  : "bg-bg-card text-text-secondary border-border-primary hover:text-text-primary hover:bg-bg-card-hover"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{cat.label}</span>
              {cat.count > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
                  isActive
                    ? "bg-white/20 text-white"
                    : "bg-bg-app text-text-secondary border border-border-primary"
                }`}>
                  {cat.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Recommendations Cards Grid */}
      {filteredRecommendations.length === 0 ? (
        <div className="bg-bg-card border border-border-primary rounded-xl p-8 text-center shadow-sm">
          <Filter className="w-7 h-7 text-text-muted mx-auto mb-2" />
          <h4 className="text-sm font-semibold text-text-primary">
            No Recommendations in this Category
          </h4>
          <p className="text-xs text-text-secondary mt-1">
            Try selecting "All Strategic Priorities" or adjusting the time window.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredRecommendations.map((rec) => (
            <RecommendationCard
              key={rec.id}
              recommendation={rec}
              onApplyAction={onApplyAction}
              onSelectPost={onSelectPost}
            />
          ))}
        </div>
      )}
    </div>
  );
}
