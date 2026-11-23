import React, { useState, useEffect } from "react";
import { PostAnalyticsRecord } from "../../types/analytics";
import { SinglePostIntelligenceContext } from "../../types/intelligence";
import { getThreadsSinglePostAnalytics } from "../../utils/threadsAnalyticsApi";
import { getSinglePostPerformanceContext } from "../../utils/threadsIntelligenceApi";
import { 
  X, 
  Eye, 
  Heart, 
  MessageCircle, 
  Repeat, 
  Quote, 
  Sparkles, 
  TrendingUp, 
  TrendingDown,
  Minus,
  ExternalLink, 
  Layers, 
  Compass, 
  Target, 
  Clock, 
  FileText,
  Lightbulb,
  BarChart3
} from "lucide-react";

interface PostDetailModalProps {
  userId: string;
  mediaId: string;
  initialPost?: PostAnalyticsRecord | null;
  onClose: () => void;
}

export default function PostDetailModal({
  userId,
  mediaId,
  initialPost,
  onClose
}: PostDetailModalProps) {
  const [post, setPost] = useState<PostAnalyticsRecord | null>(initialPost || null);
  const [intelContext, setIntelContext] = useState<SinglePostIntelligenceContext | null>(null);
  const [loading, setLoading] = useState(!initialPost);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadFullDetails() {
      if (!userId || !mediaId) return;
      try {
        const [res, intelRes] = await Promise.all([
          getThreadsSinglePostAnalytics(userId, mediaId),
          getSinglePostPerformanceContext(userId, mediaId)
        ]);

        if (res.success && res.post) {
          setPost(res.post);
        } else if (!initialPost) {
          setError(res.error || "Could not retrieve post analytics details.");
        }

        if (intelRes.success && intelRes.context) {
          setIntelContext(intelRes.context);
        }
      } catch (err: any) {
        if (!initialPost) {
          setError(err?.message || "Failed to load post analytics.");
        }
      } finally {
        setLoading(false);
      }
    }

    loadFullDetails();
  }, [userId, mediaId, initialPost]);

  const memory = post?.contentMemoryContext;

  const views = post?.metrics?.views ?? 0;
  const likes = post?.metrics?.likes ?? 0;
  const replies = post?.metrics?.replies ?? 0;
  const reposts = post?.metrics?.reposts ?? 0;
  const quotes = post?.metrics?.quotes ?? 0;
  const totalInteractions = post?.derivedMetrics?.totalInteractions ?? (likes + replies + reposts + quotes);
  const engagementRate = post?.derivedMetrics?.engagementRate ?? (views > 0 ? (totalInteractions / views) * 100 : 0);

  const formattedDate = post?.publishedAt
    ? new Date(post.publishedAt).toLocaleString(undefined, {
        month: "long",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      })
    : "Unknown date";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
      id="post-detail-modal-overlay"
    >
      <div
        className="relative w-full max-w-2xl rounded-2xl border border-border-primary bg-bg-card p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        id="post-detail-modal-container"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-primary pb-4">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-text-primary">Post Performance Telemetry</h3>
              <p className="text-xs text-text-muted">Lifetime metrics and strategic Content Memory context</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="rounded-lg p-2 text-text-muted hover:text-text-primary hover:bg-bg-app transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <div className="space-y-4 py-8 animate-pulse">
            <div className="h-20 bg-bg-app rounded-xl" />
            <div className="grid grid-cols-3 gap-3">
              <div className="h-16 bg-bg-app rounded-xl" />
              <div className="h-16 bg-bg-app rounded-xl" />
              <div className="h-16 bg-bg-app rounded-xl" />
            </div>
          </div>
        ) : error ? (
          <div className="p-4 rounded-xl bg-status-danger-bg border border-status-danger-border text-status-danger-text text-xs font-medium">
            {error}
          </div>
        ) : (
          <div className="space-y-6">
            {/* 1. Post Content & Timestamp */}
            <div className="space-y-2 rounded-xl border border-border-primary bg-bg-app p-4">
              <div className="flex items-center justify-between text-xs text-text-muted">
                <span className="flex items-center gap-1 font-mono text-[11px]">
                  <Clock className="h-3 w-3" />
                  {formattedDate}
                </span>

                {post?.permalink && (
                  <a
                    href={post.permalink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-purple-600 dark:text-purple-400 hover:underline font-semibold"
                  >
                    <span>View on Threads</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>

              <p className="text-sm text-text-primary font-medium leading-relaxed whitespace-pre-wrap pt-1">
                {post?.text || "(Media Post)"}
              </p>
            </div>

            {/* 2. Key Metrics Grid */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
                Lifetime Performance
              </span>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-border-primary bg-bg-app p-3.5 text-center">
                  <span className="text-[10px] text-text-muted uppercase tracking-wider block">Views</span>
                  <span className="text-xl font-bold font-mono text-text-primary">{views.toLocaleString()}</span>
                </div>
                <div className="rounded-xl border border-border-primary bg-bg-app p-3.5 text-center">
                  <span className="text-[10px] text-text-muted uppercase tracking-wider block">Engagements</span>
                  <span className="text-xl font-bold font-mono text-pink-600 dark:text-pink-400">{totalInteractions.toLocaleString()}</span>
                </div>
                <div className="rounded-xl border border-border-primary bg-bg-app p-3.5 text-center">
                  <span className="text-[10px] text-text-muted uppercase tracking-wider block">Eng. Rate</span>
                  <span className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">{engagementRate.toFixed(2)}%</span>
                </div>
              </div>
            </div>

            {/* 3. Detailed Interactions Breakdown */}
            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              <div className="rounded-lg border border-border-primary bg-bg-app p-2.5">
                <span className="text-[10px] text-text-muted flex items-center justify-center gap-1 mb-1">
                  <Heart className="h-3 w-3 text-pink-500" />
                  <span>Likes</span>
                </span>
                <span className="font-mono font-bold text-text-primary">{likes.toLocaleString()}</span>
              </div>

              <div className="rounded-lg border border-border-primary bg-bg-app p-2.5">
                <span className="text-[10px] text-text-muted flex items-center justify-center gap-1 mb-1">
                  <MessageCircle className="h-3 w-3 text-blue-500" />
                  <span>Replies</span>
                </span>
                <span className="font-mono font-bold text-text-primary">{replies.toLocaleString()}</span>
              </div>

              <div className="rounded-lg border border-border-primary bg-bg-app p-2.5">
                <span className="text-[10px] text-text-muted flex items-center justify-center gap-1 mb-1">
                  <Repeat className="h-3 w-3 text-emerald-500" />
                  <span>Reposts</span>
                </span>
                <span className="font-mono font-bold text-text-primary">{reposts.toLocaleString()}</span>
              </div>

              <div className="rounded-lg border border-border-primary bg-bg-app p-2.5">
                <span className="text-[10px] text-text-muted flex items-center justify-center gap-1 mb-1">
                  <Quote className="h-3 w-3 text-amber-500" />
                  <span>Quotes</span>
                </span>
                <span className="font-mono font-bold text-text-primary">{quotes.toLocaleString()}</span>
              </div>
            </div>

            {/* 4. Creator Baseline Intelligence Benchmark */}
            {intelContext && (
              <div className="rounded-xl border border-border-primary bg-bg-app p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-text-primary">
                    <BarChart3 className="h-4 w-4 text-purple-500" />
                    <span className="text-xs font-bold uppercase tracking-wider">Benchmark Intelligence</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {intelContext.viewsVsBaselineDiffPercent > 0 ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-status-success-bg text-status-success-text border border-status-success-border">
                        <TrendingUp className="h-3 w-3" />
                        +{intelContext.viewsVsBaselineDiffPercent.toFixed(1)}% vs Median Baseline
                      </span>
                    ) : intelContext.viewsVsBaselineDiffPercent < 0 ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-status-danger-bg text-status-danger-text border border-status-danger-border">
                        <TrendingDown className="h-3 w-3" />
                        {intelContext.viewsVsBaselineDiffPercent.toFixed(1)}% vs Median Baseline
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-bg-card text-text-secondary border border-border-primary">
                        <Minus className="h-3 w-3" />
                        Near Baseline Median
                      </span>
                    )}
                  </div>
                </div>

                <p className="text-xs text-text-secondary leading-relaxed">
                  {intelContext.factualStatement}
                </p>

                {/* Cohort Medians */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-border-primary/60 text-xs">
                  {intelContext.cohortComparisons.pillarCohort && (
                    <div className="p-2 rounded-lg bg-bg-card border border-border-primary/50">
                      <span className="text-[10px] text-text-muted block">Pillar Cohort Median</span>
                      <span className="font-semibold text-text-primary">
                        {intelContext.cohortComparisons.pillarCohort.cohortMedianViews.toLocaleString()} views
                      </span>
                      <span className="text-[10px] text-text-muted ml-1">
                        ({intelContext.cohortComparisons.pillarCohort.sampleSize} posts)
                      </span>
                    </div>
                  )}

                  {intelContext.cohortComparisons.formatCohort && (
                    <div className="p-2 rounded-lg bg-bg-card border border-border-primary/50">
                      <span className="text-[10px] text-text-muted block">Format Cohort Median</span>
                      <span className="font-semibold text-text-primary">
                        {intelContext.cohortComparisons.formatCohort.cohortMedianViews.toLocaleString()} views
                      </span>
                      <span className="text-[10px] text-text-muted ml-1">
                        ({intelContext.cohortComparisons.formatCohort.sampleSize} posts)
                      </span>
                    </div>
                  )}

                  {intelContext.cohortComparisons.angleCohort && (
                    <div className="p-2 rounded-lg bg-bg-card border border-border-primary/50">
                      <span className="text-[10px] text-text-muted block">Angle Cohort Median</span>
                      <span className="font-semibold text-text-primary">
                        {intelContext.cohortComparisons.angleCohort.cohortMedianViews.toLocaleString()} views
                      </span>
                      <span className="text-[10px] text-text-muted ml-1">
                        ({intelContext.cohortComparisons.angleCohort.sampleSize} posts)
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 4. Strategic Content Memory Context */}
            {memory ? (
              <div className="rounded-xl border border-purple-500/30 bg-purple-500/5 p-4 space-y-3">
                <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400">
                  <Sparkles className="h-4 w-4" />
                  <span className="text-xs font-bold uppercase tracking-wider">Content Memory Association</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {memory.pillarTitle && (
                    <div className="space-y-1">
                      <span className="text-[10px] text-text-muted font-bold flex items-center gap-1">
                        <Layers className="h-3 w-3 text-purple-500" />
                        <span>Content Pillar</span>
                      </span>
                      <p className="font-semibold text-text-primary">{memory.pillarTitle}</p>
                    </div>
                  )}

                  {memory.strategicAngle && (
                    <div className="space-y-1">
                      <span className="text-[10px] text-text-muted font-bold flex items-center gap-1">
                        <Compass className="h-3 w-3 text-pink-500" />
                        <span>Strategic Angle</span>
                      </span>
                      <p className="font-semibold text-text-primary">{memory.strategicAngle}</p>
                    </div>
                  )}

                  {memory.topic && (
                    <div className="space-y-1">
                      <span className="text-[10px] text-text-muted font-bold">Topic</span>
                      <p className="text-text-secondary">{memory.topic}</p>
                    </div>
                  )}

                  {memory.format && (
                    <div className="space-y-1">
                      <span className="text-[10px] text-text-muted font-bold">Format Style</span>
                      <p className="text-text-secondary">{memory.format}</p>
                    </div>
                  )}

                  {memory.cta && (
                    <div className="space-y-1 sm:col-span-2">
                      <span className="text-[10px] text-text-muted font-bold flex items-center gap-1">
                        <Target className="h-3 w-3 text-emerald-500" />
                        <span>Call To Action</span>
                      </span>
                      <p className="text-text-secondary font-mono text-[11px] bg-bg-app p-2 rounded-lg border border-border-primary">
                        {memory.cta}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-border-primary bg-bg-app p-3 text-center text-xs text-text-muted">
                This post was published directly on Threads without an linked Content Memory record in ThreadsWorks.
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end pt-2 border-t border-border-primary">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-bg-app hover:bg-bg-card-hover border border-border-primary px-4 py-2 text-xs font-bold text-text-primary transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
