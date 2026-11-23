import React, { useState, useEffect, useCallback } from "react";
import { 
  ContentPerformanceIntelligenceSummary,
  PerformanceDimension
} from "../../types/intelligence";
import { getThreadsPerformanceIntelligence } from "../../utils/threadsIntelligenceApi";
import CreatorBaselineCard from "./CreatorBaselineCard";
import StrategicDimensionCard from "./StrategicDimensionCard";
import MultiDimensionalPatternList from "./MultiDimensionalPatternList";
import PerformanceOutlierList from "./PerformanceOutlierList";
import StrategicObservationsCard from "./StrategicObservationsCard";
import { 
  BrainCircuit, 
  RefreshCw, 
  Calendar, 
  Layers, 
  Compass, 
  FileText, 
  Tag, 
  Send, 
  Video, 
  AlertCircle,
  Sparkles,
  ArrowRight
} from "lucide-react";

interface PerformanceIntelligenceViewProps {
  userId: string;
  onSelectPost?: (mediaId: string) => void;
  onTriggerSync?: () => void;
  onNavigateToRecommendations?: () => void;
}

export default function PerformanceIntelligenceView({
  userId,
  onSelectPost,
  onTriggerSync,
  onNavigateToRecommendations
}: PerformanceIntelligenceViewProps) {
  const [period, setPeriod] = useState<"7d" | "14d" | "30d" | "90d" | "all">("all");
  const [activeDimension, setActiveDimension] = useState<PerformanceDimension>("pillar");
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [intelligence, setIntelligence] = useState<ContentPerformanceIntelligenceSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchIntelligence = useCallback(async (selectedPeriod: "7d" | "14d" | "30d" | "90d" | "all", force: boolean = false) => {
    if (!userId) return;
    if (force) setIsRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const res = await getThreadsPerformanceIntelligence(userId, selectedPeriod, force);
      if (res.success && res.intelligence) {
        setIntelligence(res.intelligence);
      } else {
        setError(res.error || "Failed loading performance intelligence data.");
      }
    } catch (err: any) {
      setError(err?.message || "An error occurred while fetching performance intelligence.");
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchIntelligence(period);
  }, [period, fetchIntelligence]);

  const handlePeriodChange = (newPeriod: "7d" | "14d" | "30d" | "90d" | "all") => {
    setPeriod(newPeriod);
  };

  const handleManualRefresh = () => {
    fetchIntelligence(period, true);
  };

  const dimensionTabs = [
    { id: "pillar" as PerformanceDimension, label: "Content Pillars", icon: Layers, count: intelligence?.dimensionAggregates.pillar.length || 0 },
    { id: "angle" as PerformanceDimension, label: "Strategic Angles", icon: Compass, count: intelligence?.dimensionAggregates.angle.length || 0 },
    { id: "format" as PerformanceDimension, label: "Formats", icon: FileText, count: intelligence?.dimensionAggregates.format.length || 0 },
    { id: "topic" as PerformanceDimension, label: "Topics", icon: Tag, count: intelligence?.dimensionAggregates.topic.length || 0 },
    { id: "cta" as PerformanceDimension, label: "Calls to Action", icon: Send, count: intelligence?.dimensionAggregates.cta.length || 0 },
    { id: "mediaType" as PerformanceDimension, label: "Media Types", icon: Video, count: intelligence?.dimensionAggregates.mediaType.length || 0 },
  ];

  const currentDimensionConfig = {
    pillar: {
      title: "Content Pillar Performance",
      description: "Comparing historical views and engagement across your core content pillars.",
      data: intelligence?.dimensionAggregates.pillar || []
    },
    angle: {
      title: "Strategic Angle Performance",
      description: "Evaluating how different narrative and psychological angles perform relative to your baseline.",
      data: intelligence?.dimensionAggregates.angle || []
    },
    format: {
      title: "Content Format Performance",
      description: "Measuring Single Posts, Step-by-Step Breakdowns, Story Threads, and Question prompts.",
      data: intelligence?.dimensionAggregates.format || []
    },
    topic: {
      title: "Topic Subject Performance",
      description: "Analyzing engagement across specific subject categories and domains.",
      data: intelligence?.dimensionAggregates.topic || []
    },
    cta: {
      title: "Call to Action (CTA) Performance",
      description: "Tracking conversation and hand-raiser responses across different CTA strategies.",
      data: intelligence?.dimensionAggregates.cta || []
    },
    mediaType: {
      title: "Media Type Distribution",
      description: "Measuring standard text posts vs image or video attachments.",
      data: intelligence?.dimensionAggregates.mediaType || []
    }
  }[activeDimension];

  if (loading && !intelligence) {
    return (
      <div className="space-y-6 animate-pulse py-4" id="intelligence-loading-skeleton">
        <div className="h-40 bg-bg-card border border-border-primary rounded-xl" />
        <div className="h-64 bg-bg-card border border-border-primary rounded-xl" />
        <div className="h-48 bg-bg-card border border-border-primary rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-bg-card border border-border-primary rounded-xl p-8 text-center shadow-sm">
        <AlertCircle className="w-8 h-8 text-status-danger-text mx-auto mb-3" />
        <h3 className="text-base font-semibold text-text-primary">
          Intelligence Data Unavailable
        </h3>
        <p className="text-xs text-text-secondary mt-1 max-w-md mx-auto">
          {error}
        </p>
        <button
          onClick={() => fetchIntelligence(period, true)}
          className="mt-4 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
        >
          Retry Calculation
        </button>
      </div>
    );
  }

  if (!intelligence || intelligence.totalPostsAnalyzed === 0) {
    return (
      <div className="bg-bg-card border border-border-primary rounded-xl p-8 text-center shadow-sm">
        <BrainCircuit className="w-8 h-8 text-brand-text mx-auto mb-3" />
        <h3 className="text-base font-semibold text-text-primary">
          No Historical Posts for Intelligence Analysis
        </h3>
        <p className="text-xs text-text-secondary mt-1 max-w-md mx-auto">
          Synchronize your Threads posts to analyze the relationship between your content strategy and performance.
        </p>
        {onTriggerSync && (
          <button
            onClick={onTriggerSync}
            className="mt-4 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
          >
            Sync Latest Analytics
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6" id="content-performance-intelligence-section">
      {/* 1. Time-Period Controls & Recalculate Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-bg-card border border-border-primary rounded-xl shadow-sm">
        <div className="flex items-center gap-2 flex-wrap">
          <BrainCircuit className="w-4 h-4 text-brand-text" />
          <span className="text-xs font-semibold text-text-primary">
            Time Window Analysis:
          </span>
          <div className="flex items-center gap-1 bg-bg-app border border-border-primary p-1 rounded-lg">
            {(["all", "90d", "30d", "14d", "7d"] as const).map((p) => {
              const label = {
                all: "All History",
                "90d": "90 Days",
                "30d": "30 Days",
                "14d": "14 Days",
                "7d": "7 Days"
              }[p];
              const isActive = period === p;
              return (
                <button
                  key={p}
                  onClick={() => handlePeriodChange(p)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                    isActive
                      ? "bg-bg-card text-text-primary border border-border-primary shadow-xs font-semibold"
                      : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-3 self-end sm:self-center">
          <span className="text-[11px] text-text-muted">
            {intelligence.totalPostsAnalyzed} posts analyzed
          </span>
          <button
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-bg-app hover:bg-bg-card-hover border border-border-primary text-text-primary transition-colors disabled:opacity-50 cursor-pointer"
            title="Recalculate intelligence from latest post dataset"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            <span>{isRefreshing ? "Calculating..." : "Recalculate"}</span>
          </button>
        </div>
      </div>

      {/* 2. Creator Baseline Benchmark */}
      <CreatorBaselineCard
        baseline={intelligence.baseline}
        period={period}
      />

      {/* 3. Strategic Observations Digest */}
      <StrategicObservationsCard
        observations={intelligence.observations}
      />

      {/* 4. Strategic Dimension Selector & Distribution Cards */}
      <div className="space-y-4">
        {/* Dimension Sub-Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {dimensionTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeDimension === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveDimension(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-lg border whitespace-nowrap transition-colors cursor-pointer ${
                  isActive
                    ? "bg-purple-600 text-white border-purple-600 shadow-xs font-semibold"
                    : "bg-bg-card text-text-secondary border-border-primary hover:bg-bg-card-hover hover:text-text-primary"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
                {tab.count > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    isActive ? "bg-white/20 text-white" : "bg-bg-app text-text-secondary border border-border-primary"
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Selected Dimension Detail Card */}
        <StrategicDimensionCard
          aggregates={currentDimensionConfig.data}
          dimension={activeDimension}
          dimensionTitle={currentDimensionConfig.title}
          dimensionDescription={currentDimensionConfig.description}
          baselineMedianViews={intelligence.baseline.medianViews}
          onSelectPost={onSelectPost}
        />
      </div>

      {/* 5. Multi-Dimensional Attribute Combinations */}
      {intelligence.topCombinations.length > 0 && (
        <MultiDimensionalPatternList
          combinations={intelligence.topCombinations}
          baselineMedianViews={intelligence.baseline.medianViews}
        />
      )}

      {/* 6. Performance Outlier Analysis */}
      {intelligence.outliers.length > 0 && (
        <PerformanceOutlierList
          outliers={intelligence.outliers}
          baselineMedianViews={intelligence.baseline.medianViews}
          onSelectPost={onSelectPost}
        />
      )}

      {/* 6b. Weak Patterns & Negative Evidence (What to Avoid) */}
      {((intelligence.weakPatterns && intelligence.weakPatterns.length > 0) || (intelligence.patternFatigueSignals && intelligence.patternFatigueSignals.length > 0)) && (
        <div className="bg-bg-card border border-status-warning-border rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-status-warning-text" />
            <h3 className="text-sm font-semibold text-text-primary">
              Negative Evidence & Pattern Fatigue Signals
            </h3>
          </div>
          <p className="text-xs text-text-secondary">
            Identifying consistently underperforming formats and declining pattern momentum so generation can avoid repeating weak approaches.
          </p>
          
          <div className="space-y-2">
            {intelligence.weakPatterns?.map((wp, idx) => (
              <div key={idx} className="p-3 bg-status-warning-bg border border-status-warning-border rounded-lg text-xs text-text-primary flex items-start gap-2">
                <span className="font-semibold text-status-warning-text shrink-0 mt-0.5">Underperforming:</span>
                <span>{wp.factualStatement}</span>
              </div>
            ))}
            {intelligence.patternFatigueSignals?.map((pf, idx) => (
              <div key={idx} className="p-3 bg-status-danger-bg border border-status-danger-border rounded-lg text-xs text-text-primary flex items-start gap-2">
                <span className="font-semibold text-status-danger-text shrink-0 mt-0.5">Pattern Fatigue:</span>
                <span>{pf.factualStatement}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 7. Actionable Next Steps / Recommendations Link Banner */}
      {onNavigateToRecommendations && (
        <div className="p-5 bg-gradient-to-r from-purple-700 to-indigo-700 dark:from-zinc-900 dark:to-zinc-800 border border-purple-600/40 dark:border-zinc-700 text-white rounded-xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-300" />
              <h3 className="text-sm font-bold text-white">
                Turn Performance Evidence into Next Actions
              </h3>
            </div>
            <p className="text-xs text-purple-100 dark:text-zinc-300">
              View personalized recommendations for what to repeat, what to test, and what to refine next.
            </p>
          </div>
          <button
            type="button"
            onClick={onNavigateToRecommendations}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-400 hover:bg-emerald-300 text-slate-950 text-xs font-bold rounded-lg transition-colors whitespace-nowrap self-start sm:self-auto cursor-pointer"
          >
            <span>View AI Recommendations</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>

  );
}
