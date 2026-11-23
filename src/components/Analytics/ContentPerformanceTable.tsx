import React, { useState } from "react";
import { PostAnalyticsRecord } from "../../types/analytics";
import { 
  Eye, 
  Heart, 
  MessageCircle, 
  Repeat, 
  Quote, 
  Sparkles, 
  TrendingUp, 
  ExternalLink, 
  Layers, 
  Compass, 
  ChevronLeft, 
  ChevronRight,
  LayoutGrid,
  List,
  FileText
} from "lucide-react";

interface ContentPerformanceTableProps {
  posts: PostAnalyticsRecord[];
  loading?: boolean;
  onSelectPost: (post: PostAnalyticsRecord) => void;
  currentPage: number;
  totalPages: number;
  totalPosts: number;
  pageSize: number;
  onPageChange: (newPage: number) => void;
  onPageSizeChange: (newSize: number) => void;
}

export default function ContentPerformanceTable({
  posts,
  loading = false,
  onSelectPost,
  currentPage,
  totalPages,
  totalPosts,
  pageSize,
  onPageChange,
  onPageSizeChange
}: ContentPerformanceTableProps) {
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");

  if (loading) {
    return (
      <div className="rounded-2xl border border-border-primary bg-bg-card p-6 shadow-sm space-y-4">
        <div className="h-6 w-48 bg-bg-app rounded animate-pulse" />
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 w-full bg-bg-app rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!posts || posts.length === 0) {
    return (
      <div className="rounded-2xl border border-border-primary bg-bg-card p-10 text-center space-y-3">
        <div className="mx-auto w-12 h-12 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-2xl flex items-center justify-center">
          <FileText className="h-6 w-6" />
        </div>
        <h3 className="text-sm font-bold text-text-primary">No Published Posts Found</h3>
        <p className="text-xs text-text-muted max-w-sm mx-auto">
          No published posts matched your search filters or no historical posts have been synchronized yet.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border-primary bg-bg-card p-4 md:p-6 shadow-sm space-y-4" id="content-performance-section">
      {/* Header with Title and Table/Grid Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border-primary">
        <div>
          <h3 className="text-sm md:text-base font-bold text-text-primary">Content Performance</h3>
          <p className="text-xs text-text-muted">Post-level telemetry connected to Content Memory strategy</p>
        </div>

        <div className="flex items-center gap-2">
          {/* View Mode Toggle Buttons */}
          <div className="flex items-center rounded-xl bg-bg-app border border-border-primary p-1">
            <button
              type="button"
              onClick={() => setViewMode("table")}
              title="Table View"
              className={`p-1.5 rounded-lg transition cursor-pointer ${
                viewMode === "table"
                  ? "bg-bg-card text-text-primary shadow-sm"
                  : "text-text-muted hover:text-text-primary"
              }`}
            >
              <List className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              title="Card Grid View"
              className={`p-1.5 rounded-lg transition cursor-pointer ${
                viewMode === "grid"
                  ? "bg-bg-card text-text-primary shadow-sm"
                  : "text-text-muted hover:text-text-primary"
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Mode A: Table View */}
      {viewMode === "table" ? (
        <div className="overflow-x-auto -mx-4 md:mx-0">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border-primary text-text-muted font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Post & Strategy</th>
                <th className="py-3 px-3 text-right">Views</th>
                <th className="py-3 px-3 text-right">Engagements</th>
                <th className="py-3 px-3 text-right">Eng. Rate</th>
                <th className="py-3 px-3 text-right hidden sm:table-cell">Likes</th>
                <th className="py-3 px-3 text-right hidden md:table-cell">Replies</th>
                <th className="py-3 px-3 text-right hidden md:table-cell">Reposts</th>
                <th className="py-3 px-4 text-right">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-primary/60">
              {posts.map((post) => {
                const views = post.metrics?.views ?? 0;
                const likes = post.metrics?.likes ?? 0;
                const replies = post.metrics?.replies ?? 0;
                const reposts = post.metrics?.reposts ?? 0;
                const quotes = post.metrics?.quotes ?? 0;
                const totalInteractions = post.derivedMetrics?.totalInteractions ?? (likes + replies + reposts + quotes);
                const engagementRate = post.derivedMetrics?.engagementRate ?? (views > 0 ? (totalInteractions / views) * 100 : 0);
                const memory = post.contentMemoryContext;

                const formattedDate = post.publishedAt
                  ? new Date(post.publishedAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric"
                    })
                  : "—";

                return (
                  <tr
                    key={post.id || post.mediaId}
                    onClick={() => onSelectPost(post)}
                    className="hover:bg-bg-card-hover/80 transition cursor-pointer group"
                  >
                    {/* Post Snippet & Strategy Metadata */}
                    <td className="py-3.5 px-4 max-w-xs md:max-w-md">
                      <div className="space-y-1.5">
                        <p className="text-xs text-text-primary line-clamp-2 font-medium leading-relaxed">
                          {post.text || "(Media Post)"}
                        </p>

                        {/* Content Memory Strategic Badges */}
                        {memory ? (
                          <div className="flex flex-wrap items-center gap-1.5">
                            {memory.pillarTitle && (
                              <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 font-semibold border border-purple-500/20">
                                <Layers className="h-2.5 w-2.5" />
                                <span>{memory.pillarTitle}</span>
                              </span>
                            )}
                            {memory.strategicAngle && (
                              <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md bg-pink-500/10 text-pink-600 dark:text-pink-400 font-semibold border border-pink-500/20">
                                <Compass className="h-2.5 w-2.5" />
                                <span>{memory.strategicAngle}</span>
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[10px] text-text-muted italic">Organic Threads post</span>
                        )}
                      </div>
                    </td>

                    {/* Views */}
                    <td className="py-3.5 px-3 text-right font-mono font-bold text-text-primary">
                      {views.toLocaleString()}
                    </td>

                    {/* Engagements */}
                    <td className="py-3.5 px-3 text-right font-mono font-semibold text-pink-600 dark:text-pink-400">
                      {totalInteractions.toLocaleString()}
                    </td>

                    {/* Engagement Rate */}
                    <td className="py-3.5 px-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {engagementRate.toFixed(1)}%
                    </td>

                    {/* Likes */}
                    <td className="py-3.5 px-3 text-right font-mono text-text-secondary hidden sm:table-cell">
                      {likes.toLocaleString()}
                    </td>

                    {/* Replies */}
                    <td className="py-3.5 px-3 text-right font-mono text-text-secondary hidden md:table-cell">
                      {replies.toLocaleString()}
                    </td>

                    {/* Reposts */}
                    <td className="py-3.5 px-3 text-right font-mono text-text-secondary hidden md:table-cell">
                      {reposts.toLocaleString()}
                    </td>

                    {/* Date & Link */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <span className="text-text-muted font-mono text-[11px]">{formattedDate}</span>
                        {post.permalink && (
                          <a
                            href={post.permalink}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-text-muted hover:text-purple-500 p-1 transition"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* Mode B: Card Grid View */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {posts.map((post) => {
            const views = post.metrics?.views ?? 0;
            const likes = post.metrics?.likes ?? 0;
            const replies = post.metrics?.replies ?? 0;
            const reposts = post.metrics?.reposts ?? 0;
            const quotes = post.metrics?.quotes ?? 0;
            const totalInteractions = post.derivedMetrics?.totalInteractions ?? (likes + replies + reposts + quotes);
            const engagementRate = post.derivedMetrics?.engagementRate ?? (views > 0 ? (totalInteractions / views) * 100 : 0);
            const memory = post.contentMemoryContext;

            const formattedDate = post.publishedAt
              ? new Date(post.publishedAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric"
                })
              : "Unknown date";

            return (
              <div
                key={post.id || post.mediaId}
                onClick={() => onSelectPost(post)}
                className="rounded-xl border border-border-primary bg-bg-app p-4 shadow-sm hover:border-purple-500/40 transition cursor-pointer flex flex-col justify-between space-y-3 group"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-text-muted">
                    <span className="font-mono">{formattedDate}</span>
                    {post.permalink && (
                      <a
                        href={post.permalink}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="hover:text-purple-500 p-0.5 transition flex items-center gap-1"
                      >
                        <span className="text-[10px]">Threads</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>

                  <p className="text-xs text-text-primary line-clamp-3 font-medium leading-relaxed">
                    {post.text || "(Media Post)"}
                  </p>

                  {/* Content Memory Tags */}
                  {memory && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      {memory.pillarTitle && (
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 font-semibold border border-purple-500/20">
                          {memory.pillarTitle}
                        </span>
                      )}
                      {memory.strategicAngle && (
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-pink-500/10 text-pink-600 dark:text-pink-400 font-semibold border border-pink-500/20">
                          {memory.strategicAngle}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Metrics Bar */}
                <div className="pt-2 border-t border-border-primary/60 grid grid-cols-4 gap-2 text-center text-xs">
                  <div>
                    <span className="text-[10px] text-text-muted uppercase tracking-wider block">Views</span>
                    <span className="font-mono font-bold text-text-primary">{views.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-text-muted uppercase tracking-wider block">Engaged</span>
                    <span className="font-mono font-semibold text-pink-600 dark:text-pink-400">{totalInteractions.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-text-muted uppercase tracking-wider block">Rate</span>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{engagementRate.toFixed(1)}%</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-text-muted uppercase tracking-wider block">Likes</span>
                    <span className="font-mono text-text-secondary">{likes.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-border-primary text-xs">
        <div className="flex items-center gap-2 text-text-muted">
          <span>Rows per page:</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            aria-label="Posts per page"
            className="rounded-lg border border-border-primary bg-bg-app px-2 py-1 text-xs text-text-primary outline-none cursor-pointer"
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
          <span className="font-mono text-[11px]">
            Page {currentPage} of {Math.max(1, totalPages)} ({totalPosts} total)
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            aria-label="Previous Page"
            className="p-2 rounded-lg border border-border-primary bg-bg-app text-text-secondary hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          
          <span className="px-3 font-mono font-bold text-text-primary">
            {currentPage}
          </span>

          <button
            type="button"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            aria-label="Next Page"
            className="p-2 rounded-lg border border-border-primary bg-bg-app text-text-secondary hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
