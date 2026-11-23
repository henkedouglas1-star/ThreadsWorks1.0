import React, { useState, Component, ErrorInfo, ReactNode } from "react";
import { Monitor, Tablet, Smartphone, RotateCcw, Maximize2, Minimize2, AlertCircle, Sparkles, ExternalLink, Check, ShieldCheck, Eye } from "lucide-react";
import { UserProfile } from "../types";

interface PreviewErrorBoundaryProps {
  children: ReactNode;
  onReset?: () => void;
}

interface PreviewErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class PreviewErrorBoundary extends Component<PreviewErrorBoundaryProps, PreviewErrorBoundaryState> {
  constructor(props: PreviewErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): PreviewErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[PreviewErrorBoundary] Caught preview render failure:", error, errorInfo);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[420px] p-8 text-center bg-bg-card rounded-2xl border border-red-500/20 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center text-red-500 mb-4">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-text-primary mb-1">Preview failed to load</h3>
          <p className="text-xs text-text-secondary max-w-md mb-6">
            The preview surface encountered a rendering error. ThreadsWorks core systems, authentication, and content operations remain safe and unaffected.
          </p>
          <div className="bg-status-danger-bg rounded-lg p-3 text-[11px] font-mono text-status-danger-text mb-6 max-w-lg overflow-x-auto text-left w-full border border-status-danger-border">
            {this.state.error?.message || "Unknown rendering exception"}
          </div>
          <button
            type="button"
            onClick={this.handleReload}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors shadow-sm cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reload Preview
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

interface PreviewEditionViewProps {
  profile: UserProfile | null;
  subscriptionStatus?: string;
  onNavigateToTab?: (tab: string) => void;
  renderComponent?: ReactNode;
}

type DeviceMode = "desktop" | "tablet" | "mobile";

export default function PreviewEditionView({
  profile,
  subscriptionStatus,
  onNavigateToTab,
  renderComponent
}: PreviewEditionViewProps) {
  const [device, setDevice] = useState<DeviceMode>("desktop");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [previewKey, setPreviewKey] = useState<number>(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [previewTab, setPreviewTab] = useState<"app" | "post_card" | "threads_mock">("app");

  const handleLocalReload = () => {
    setIsRefreshing(true);
    setPreviewKey((k) => k + 1);
    setTimeout(() => {
      setIsRefreshing(false);
    }, 400);
  };

  const getDeviceDimensions = () => {
    switch (device) {
      case "mobile":
        return "w-[390px] h-[780px] max-h-[85vh]";
      case "tablet":
        return "w-[768px] h-[860px] max-h-[88vh]";
      case "desktop":
      default:
        return "w-full h-[780px] max-h-[85vh]";
    }
  };

  return (
    <div className={`space-y-4 ${isFullscreen ? "fixed inset-0 z-50 bg-bg-primary p-4 overflow-auto" : ""}`}>
      {/* Top Header & Viewport Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-bg-card border border-border-primary rounded-2xl p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-purple-600/10 border border-purple-500/20 flex items-center justify-center text-purple-600 dark:text-purple-400">
            <Eye className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-extrabold tracking-tight text-text-primary">Preview Edition</h2>
              <span className="px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wider bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-full border border-purple-500/20">
                Live Surface
              </span>
            </div>
            <p className="text-xs text-text-secondary">
              Isolated live application rendering and responsive device viewport inspection.
            </p>
          </div>
        </div>

        {/* Viewport and Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Device Viewport Selector */}
          <div className="inline-flex items-center p-1 bg-bg-input rounded-xl border border-border-primary">
            <button
              type="button"
              onClick={() => setDevice("desktop")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                device === "desktop"
                  ? "bg-bg-card text-purple-600 dark:text-purple-400 font-semibold shadow-xs"
                  : "text-text-secondary hover:text-text-primary"
              }`}
              title="Desktop View (100% Fluid)"
            >
              <Monitor className="w-3.5 h-3.5" />
              <span>Desktop</span>
            </button>
            <button
              type="button"
              onClick={() => setDevice("tablet")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                device === "tablet"
                  ? "bg-bg-card text-purple-600 dark:text-purple-400 font-semibold shadow-xs"
                  : "text-text-secondary hover:text-text-primary"
              }`}
              title="Tablet View (768px)"
            >
              <Tablet className="w-3.5 h-3.5" />
              <span>Tablet</span>
            </button>
            <button
              type="button"
              onClick={() => setDevice("mobile")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                device === "mobile"
                  ? "bg-bg-card text-purple-600 dark:text-purple-400 font-semibold shadow-xs"
                  : "text-text-secondary hover:text-text-primary"
              }`}
              title="Mobile View (390px)"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Mobile</span>
            </button>
          </div>

          {/* Local Reload Action */}
          <button
            type="button"
            onClick={handleLocalReload}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3 py-2 bg-bg-card hover:bg-bg-card-hover border border-border-primary rounded-xl text-xs font-medium text-text-secondary hover:text-text-primary transition cursor-pointer disabled:opacity-50"
            title="Reload Preview Surface only (preserves session)"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-purple-500" : ""}`} />
            <span>Reload</span>
          </button>

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="flex items-center gap-1.5 px-3 py-2 bg-bg-card hover:bg-bg-card-hover border border-border-primary rounded-xl text-xs font-medium text-text-secondary hover:text-text-primary transition cursor-pointer"
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen Preview"}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            <span>{isFullscreen ? "Exit" : "Fullscreen"}</span>
          </button>
        </div>
      </div>

      {/* Safety & Isolation Guarantee Badge */}
      <div className="flex items-center justify-between px-3 py-2 bg-purple-500/5 border border-purple-500/10 rounded-xl text-xs text-text-secondary">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>
            <strong>Isolated Runtime:</strong> Preview does not trigger external Threads OAuth or modify live publishing/analytics credentials.
          </span>
        </div>
        <span className="hidden sm:inline-block text-[11px] font-mono text-text-muted">
          Viewport: {device === "desktop" ? "100% Fluid" : device === "tablet" ? "768px" : "390px"}
        </span>
      </div>

      {/* Preview Canvas Stage */}
      <div className="flex justify-center items-start min-h-[600px] p-4 bg-bg-input/40 border border-border-primary rounded-2xl overflow-auto">
        <div
          className={`transition-all duration-300 bg-bg-card border border-border-primary rounded-2xl shadow-xl overflow-hidden flex flex-col ${getDeviceDimensions()}`}
          style={{ transitionProperty: "width, height, max-width" }}
        >
          {/* Simulated Browser Frame Bar for Tablet & Mobile */}
          {device !== "desktop" && (
            <div className="flex items-center justify-between px-4 py-2.5 bg-bg-sidebar border-b border-border-primary shrink-0 select-none">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-400/80" />
                <div className="w-2.5 h-2.5 rounded-full bg-amber-400/80" />
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400/80" />
              </div>
              <div className="text-[11px] font-mono font-medium text-text-muted bg-bg-card px-3 py-0.5 rounded-md border border-border-primary truncate max-w-[200px]">
                threadsworks.com/preview
              </div>
              <div className="w-8" />
            </div>
          )}

          {/* Live Render Surface within Error Boundary */}
          <div className="flex-1 overflow-auto p-4 md:p-6">
            <PreviewErrorBoundary key={previewKey} onReset={handleLocalReload}>
              {renderComponent ? (
                renderComponent
              ) : (
                <div className="space-y-6">
                  {/* Creator Profile Summary Preview */}
                  <div className="p-5 rounded-2xl border border-border-primary bg-bg-sidebar/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-purple-600/10 border border-purple-500/20 flex items-center justify-center text-purple-600 dark:text-purple-400 font-extrabold text-base">
                        {(profile?.creatorIdentity?.character?.name || profile?.email || "T").charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-sm font-extrabold text-text-primary flex items-center gap-2">
                          {profile?.creatorIdentity?.character?.name || profile?.email?.split("@")[0] || "ThreadsWorks Creator"}
                          <span className="px-2 py-0.5 text-[10px] font-bold bg-status-success-bg text-status-success-text rounded-full border border-status-success-border">
                            Active
                          </span>
                        </div>
                        <div className="text-xs text-text-secondary">
                          {profile?.audience ? `Targeting: ${profile.audience.slice(0, 45)}...` : "Creator Profile Context Active"}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onNavigateToTab?.("engine")}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white transition cursor-pointer"
                      >
                        Open Content Engine
                      </button>
                    </div>
                  </div>

                  {/* Sample Post Thread Presentation Mock */}
                  <div className="space-y-3">
                    <div className="text-xs font-bold tracking-wider text-text-muted uppercase font-mono">
                      Live Output Simulation
                    </div>

                    <div className="border border-border-primary rounded-2xl p-4 bg-bg-card space-y-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-purple-600/20 flex items-center justify-center text-purple-500 font-bold text-xs">
                          {(profile?.creatorIdentity?.character?.name || profile?.email || "T").charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-text-primary">
                            {profile?.creatorIdentity?.character?.name || profile?.email?.split("@")[0] || "threads_creator"}
                          </div>
                          <div className="text-[10px] text-text-muted">Threads Post • Preview</div>
                        </div>
                      </div>

                      <div className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap font-sans">
                        Most creators spend 80% of their time wondering what to post and 20% executing.
                        {"\n\n"}
                        When you connect your creator identity, business context, and audience intelligence into one continuous engine, the entire workflow flips.
                        {"\n\n"}
                        Less hesitation. More authority. Consistent outcomes.
                      </div>

                      <div className="pt-2 border-t border-border-primary/60 flex items-center justify-between text-xs text-text-muted">
                        <span>3-part thread preview</span>
                        <span className="text-status-success-text font-semibold text-[11px]">Ready to Publish</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </PreviewErrorBoundary>
          </div>
        </div>
      </div>
    </div>
  );
}
