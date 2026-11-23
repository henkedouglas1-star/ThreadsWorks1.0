import React, { useState, useMemo } from "react";
import { AccountTimeSeriesPoint } from "../../types/analytics";
import { TrendingUp, Activity, Eye, Heart, MessageCircle, Repeat, Quote, Users, Info } from "lucide-react";

interface PerformanceTrendsChartProps {
  timeSeries: AccountTimeSeriesPoint[];
  dailySnapshots?: Record<string, any>;
  lastSyncedAt?: string;
}

type SelectedMetric = "all" | "views" | "likes" | "replies" | "reposts" | "quotes" | "followers_count";

interface MetricConfig {
  key: SelectedMetric;
  label: string;
  color: string;
  gradientStart: string;
  gradientEnd: string;
  icon: React.ComponentType<{ className?: string }>;
}

const METRIC_CONFIGS: MetricConfig[] = [
  {
    key: "views",
    label: "Views",
    color: "#8b5cf6", // Purple
    gradientStart: "rgba(139, 92, 246, 0.35)",
    gradientEnd: "rgba(139, 92, 246, 0.0)",
    icon: Eye
  },
  {
    key: "likes",
    label: "Likes",
    color: "#ec4899", // Pink
    gradientStart: "rgba(236, 72, 153, 0.35)",
    gradientEnd: "rgba(236, 72, 153, 0.0)",
    icon: Heart
  },
  {
    key: "replies",
    label: "Replies",
    color: "#3b82f6", // Blue
    gradientStart: "rgba(59, 130, 246, 0.35)",
    gradientEnd: "rgba(59, 130, 246, 0.0)",
    icon: MessageCircle
  },
  {
    key: "reposts",
    label: "Reposts",
    color: "#10b981", // Emerald
    gradientStart: "rgba(16, 185, 129, 0.35)",
    gradientEnd: "rgba(16, 185, 129, 0.0)",
    icon: Repeat
  },
  {
    key: "quotes",
    label: "Quotes",
    color: "#f59e0b", // Amber
    gradientStart: "rgba(245, 158, 11, 0.35)",
    gradientEnd: "rgba(245, 158, 11, 0.0)",
    icon: Quote
  },
  {
    key: "followers_count",
    label: "Followers",
    color: "#06b6d4", // Cyan
    gradientStart: "rgba(6, 182, 212, 0.35)",
    gradientEnd: "rgba(6, 182, 212, 0.0)",
    icon: Users
  }
];

export default function PerformanceTrendsChart({ timeSeries, dailySnapshots }: PerformanceTrendsChartProps) {
  const [selectedMetric, setSelectedMetric] = useState<SelectedMetric>("views");
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);

  // Extract and normalize unique sorted chronological data points
  const chartData = useMemo(() => {
    if (!timeSeries || timeSeries.length === 0) {
      if (dailySnapshots && Object.keys(dailySnapshots).length > 0) {
        const sortedDates = Object.keys(dailySnapshots).sort();
        return sortedDates.map((d) => {
          const snap = dailySnapshots[d] || {};
          return {
            dateKey: d,
            views: snap.views ?? 0,
            likes: snap.likes ?? 0,
            replies: snap.replies ?? 0,
            reposts: snap.reposts ?? 0,
            quotes: snap.quotes ?? 0,
            followers_count: snap.followersCount ?? 0,
            formattedDate: new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" })
          };
        });
      }
      return [];
    }

    // Group time series by dateKey
    const byDate: Record<string, Record<string, number>> = {};
    for (const pt of timeSeries) {
      const dateKey = pt.dateKey || (pt.endTime ? pt.endTime.split("T")[0] : "unknown");
      if (!byDate[dateKey]) byDate[dateKey] = {};
      byDate[dateKey][pt.metric] = pt.value;
    }

    const sortedDates = Object.keys(byDate).sort();
    return sortedDates.map((d) => {
      const metricsObj = byDate[d] || {};
      return {
        dateKey: d,
        views: metricsObj["views"] ?? 0,
        likes: metricsObj["likes"] ?? 0,
        replies: metricsObj["replies"] ?? 0,
        reposts: metricsObj["reposts"] ?? 0,
        quotes: metricsObj["quotes"] ?? 0,
        followers_count: metricsObj["followers_count"] ?? 0,
        formattedDate: new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" })
      };
    });
  }, [timeSeries, dailySnapshots]);

  const activeConfig = METRIC_CONFIGS.find((m) => m.key === selectedMetric) || METRIC_CONFIGS[0];

  // Calculate SVG dimensions and coordinate paths
  const width = 800;
  const height = 240;
  const paddingX = 45;
  const paddingTop = 25;
  const paddingBottom = 40;

  const innerWidth = width - paddingX * 2;
  const innerHeight = height - paddingTop - paddingBottom;

  const values = chartData.map((d) => (d as any)[selectedMetric] ?? 0);
  const maxValue = Math.max(...values, 10);
  const minValue = 0;

  const points = useMemo(() => {
    if (chartData.length === 0) return [];
    if (chartData.length === 1) {
      return [{
        x: width / 2,
        y: height / 2,
        value: values[0],
        item: chartData[0]
      }];
    }

    return chartData.map((item, idx) => {
      const val = (item as any)[selectedMetric] ?? 0;
      const x = paddingX + (idx / (chartData.length - 1)) * innerWidth;
      const y = paddingTop + innerHeight - ((val - minValue) / (maxValue - minValue)) * innerHeight;
      return { x, y, value: val, item };
    });
  }, [chartData, selectedMetric, maxValue, minValue, innerWidth, innerHeight, paddingX, paddingTop, width, height, values]);

  const linePath = useMemo(() => {
    if (points.length <= 1) return "";
    return points.reduce((acc, curr, idx) => {
      if (idx === 0) return `M ${curr.x} ${curr.y}`;
      // Smooth cubic bezier spline
      const prev = points[idx - 1];
      const cx = (prev.x + curr.x) / 2;
      return `${acc} C ${cx} ${prev.y}, ${cx} ${curr.y}, ${curr.x} ${curr.y}`;
    }, "");
  }, [points]);

  const areaPath = useMemo(() => {
    if (points.length <= 1 || !linePath) return "";
    const first = points[0];
    const last = points[points.length - 1];
    const bottomY = paddingTop + innerHeight;
    return `${linePath} L ${last.x} ${bottomY} L ${first.x} ${bottomY} Z`;
  }, [linePath, points, innerHeight, paddingTop]);

  const yTicks = [
    maxValue,
    Math.round(maxValue * 0.75),
    Math.round(maxValue * 0.5),
    Math.round(maxValue * 0.25),
    0
  ];

  return (
    <div className="rounded-2xl border border-border-primary bg-bg-card p-5 md:p-6 shadow-sm space-y-5" id="performance-trends-card">
      {/* Header & Metric Selection Pills */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <TrendingUp className="h-4 w-4" />
            </div>
            <h3 className="text-sm md:text-base font-bold text-text-primary tracking-tight">Performance Trend</h3>
          </div>
          <p className="text-xs text-text-muted mt-0.5">Historical account trajectory from Meta Graph Insights</p>
        </div>

        {/* Metric Switcher Controls */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-bg-app border border-border-primary">
          {METRIC_CONFIGS.map((cfg) => {
            const Icon = cfg.icon;
            const isSelected = selectedMetric === cfg.key;
            return (
              <button
                key={cfg.key}
                id={`metric-btn-${cfg.key}`}
                type="button"
                onClick={() => setSelectedMetric(cfg.key)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer min-h-[36px] md:min-h-0 ${
                  isSelected
                    ? "bg-bg-card text-text-primary shadow-sm border border-border-primary font-bold"
                    : "text-text-muted hover:text-text-secondary hover:bg-bg-card/50"
                }`}
              >
                <Icon className={`h-3.5 w-3.5 ${isSelected ? "text-purple-600 dark:text-purple-400" : ""}`} />
                <span>{cfg.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Visualization Canvas */}
      {chartData.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-14 text-center rounded-xl bg-bg-app border border-dashed border-border-primary p-6 space-y-2">
          <Activity className="h-8 w-8 text-text-muted/60" />
          <p className="text-xs font-bold text-text-primary">No Historical Time-Series Available Yet</p>
          <p className="text-[11px] text-text-muted max-w-sm">
            Meta Insights accumulates historical daily metrics over time. Check back after your next sync or trigger an on-demand sync above.
          </p>
        </div>
      ) : chartData.length === 1 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center rounded-xl bg-bg-app border border-border-primary p-6 space-y-3">
          <div className="p-3 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400">
            <activeConfig.icon className="h-6 w-6" />
          </div>
          <div>
            <div className="text-2xl font-extrabold text-text-primary">
              {Number(chartData[0][selectedMetric] || 0).toLocaleString()}
            </div>
            <div className="text-xs font-semibold text-text-muted uppercase tracking-wider mt-0.5">
              Current {activeConfig.label} recorded for {chartData[0].formattedDate}
            </div>
          </div>
          <p className="text-[11px] text-text-muted max-w-sm">
            A single daily snapshot is indexed. Additional daily points will connect into an interactive trend curve automatically as syncs occur.
          </p>
        </div>
      ) : (
        <div className="relative w-full overflow-hidden">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-auto select-none overflow-visible"
            onMouseLeave={() => setHoveredPointIndex(null)}
          >
            <defs>
              <linearGradient id={`gradient-${selectedMetric}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={activeConfig.color} stopOpacity="0.25" />
                <stop offset="100%" stopColor={activeConfig.color} stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Horizontal Grid lines */}
            {yTicks.map((tVal, i) => {
              const y = paddingTop + innerHeight - ((tVal - minValue) / (maxValue - minValue)) * innerHeight;
              return (
                <g key={i} className="transition-all">
                  <line
                    x1={paddingX}
                    y1={y}
                    x2={width - paddingX}
                    y2={y}
                    stroke="currentColor"
                    strokeOpacity="0.08"
                    strokeDasharray="4 4"
                  />
                  <text
                    x={paddingX - 8}
                    y={y + 3.5}
                    textAnchor="end"
                    fontSize="10"
                    fill="currentColor"
                    className="text-text-muted font-mono"
                    opacity="0.9"
                  >
                    {tVal >= 1000 ? `${(tVal / 1000).toFixed(1)}k` : tVal}
                  </text>
                </g>
              );
            })}

            {/* Filled Area */}
            {areaPath && (
              <path
                d={areaPath}
                fill={`url(#gradient-${selectedMetric})`}
              />
            )}

            {/* Line Path */}
            {linePath && (
              <path
                d={linePath}
                fill="none"
                stroke={activeConfig.color}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Data Points */}
            {points.map((pt, idx) => {
              const isHovered = hoveredPointIndex === idx;
              return (
                <g
                  key={idx}
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredPointIndex(idx)}
                >
                  {/* Invisible broad touch target */}
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={16}
                    fill="transparent"
                  />

                  {/* Active Point Circle */}
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={isHovered ? 6 : 3.5}
                    fill={isHovered ? "#ffffff" : activeConfig.color}
                    stroke={activeConfig.color}
                    strokeWidth={isHovered ? 2.5 : 1.5}
                    className="transition-all duration-150"
                  />

                  {/* X-axis date labels */}
                  <text
                    x={pt.x}
                    y={height - 12}
                    textAnchor="middle"
                    fontSize="10"
                    fill="currentColor"
                    className={`font-mono transition-colors ${
                      isHovered ? "text-text-primary font-bold" : "text-text-muted opacity-70"
                    }`}
                  >
                    {pt.item.formattedDate}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Floating Hover Tooltip */}
          {hoveredPointIndex !== null && points[hoveredPointIndex] && (
            <div
              className="absolute z-20 pointer-events-none rounded-xl border border-border-primary bg-bg-card p-3 shadow-xl backdrop-blur-md transition-all text-xs"
              style={{
                left: `${(points[hoveredPointIndex].x / width) * 100}%`,
                top: `${Math.max(10, (points[hoveredPointIndex].y / height) * 100 - 30)}%`,
                transform: "translate(-50%, -100%)"
              }}
            >
              <div className="font-mono text-[10px] text-text-muted uppercase tracking-wider mb-1">
                {points[hoveredPointIndex].item.dateKey}
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: activeConfig.color }} />
                <span className="font-bold text-text-primary">
                  {Number(points[hoveredPointIndex].value).toLocaleString()}
                </span>
                <span className="text-text-secondary lowercase">{activeConfig.label}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Chart Footer Indicator */}
      <div className="flex items-center justify-between pt-3 border-t border-border-primary text-[11px] text-text-muted">
        <div className="flex items-center gap-1.5">
          <Info className="h-3.5 w-3.5 text-text-muted/80" />
          <span>Metrics update daily based on Meta Threads Graph API Insights.</span>
        </div>
        <div className="font-mono text-[10px]">
          {chartData.length} data {chartData.length === 1 ? "point" : "points"}
        </div>
      </div>
    </div>
  );
}
