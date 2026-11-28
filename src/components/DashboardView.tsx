import React, { useState, useEffect, useRef } from "react";
import { UserProfile } from "../types";
import ThreadsWorksLogo from "./ThreadsWorksLogo";
import { 
  Sparkles, 
  ArrowRight, 
  User, 
  Briefcase, 
  Target, 
  Zap, 
  Calendar, 
  BarChart3, 
  Handshake, 
  LogOut, 
  Sun, 
  Moon, 
  CheckCircle2, 
  AlertCircle, 
  TrendingUp, 
  ChevronRight,
  ShieldCheck,
  Award,
  Clock,
  Layers,
  ArrowLeft,
  LayoutGrid,
  Lightbulb,
  Users,
} from "lucide-react";
import { useContentPersistence } from "../context/ContentPersistenceContext";
import { auth } from "../firebase";
import { signOut } from "firebase/auth";
import { useTheme } from "../context/ThemeContext";
import CharacterAvatarPreview from "./CharacterAvatarPreview";
import { clearThreadsLocalConnection } from "../utils/threadsApi";
import CreateBestPostView from "./CreateBestPostView";
import FunnelConceptView from "../features/funnelworks/FunnelConceptView";
import type { FunnelConcept } from "../features/funnelworks/FunnelConceptView";
import { downloadSlidePng } from "../features/funnelworks/carouselExport";
import { downloadPlaybookPdf } from "../features/funnelworks/playbookExport";
import { downloadCarouselZip, downloadCompanionPostsTxt, downloadStorefrontTxt, downloadCompleteProductWorksZip } from "../features/funnelworks/carouselZip";

interface DashboardViewProps {
  profile: UserProfile | null;
  onRefreshProfile: () => void;
  onNavigateToTab?: (tab: string) => void;
  subscriptionStatus?: string;
}

export default function DashboardView({
  profile,
  onRefreshProfile,
  onNavigateToTab,
  subscriptionStatus
}: DashboardViewProps) {
  const { theme, toggleTheme } = useTheme();
  const { 
    activeIdea, 
    setActiveIdea, 
    customInstruction, 
    rawCreatorThought, 
    setRawCreatorThought,
    postsToCreate,
    setPostsToCreate
  } = useContentPersistence();
  const [activeAppId, setActiveAppId] = useState<string | null>(null);
  const [approvedFunnelConcept, setApprovedFunnelConcept] = useState<FunnelConcept | null>(null);
  const [generatedFunnel, setGeneratedFunnel] = useState<any>(null);
  const [funnelLoading, setFunnelLoading] = useState(false);
  const [savedFunnels, setSavedFunnels] = useState<any[]>([]);
  const [funnelError, setFunnelError] = useState<string | null>(null);

  const loadSavedFunnels = async () => {
    if (!auth.currentUser) return;
    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch("/api/funnelworks/projects", { headers: { Authorization: `Bearer ${token}` } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load projects.");
      setSavedFunnels(data.projects || []);
    } catch (error: any) { setFunnelError(error.message); }
  };

  const generateFunnel = async () => {
    if (!approvedFunnelConcept || funnelLoading) return;
    if (!auth.currentUser) {
      setFunnelError("Please sign in to generate a product package.");
      return;
    }
    setFunnelLoading(true);
    setFunnelError(null);
    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch("/api/funnelworks/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ concept: approvedFunnelConcept })
      });
      const data = await response.json();
      if (!response.ok || !data.funnel) throw new Error(data.error || "Generation failed");
      setGeneratedFunnel(data.funnel);
      setSavedFunnels(previous => [data.funnel, ...previous]);
    } catch (error: any) {
      setFunnelError(error?.message || "Generation failed. Please try again.");
    } finally { setFunnelLoading(false); }
  };



  // Listen for canonical Workspace navigation to always return to Workspace app list
  useEffect(() => {
    const handleReset = () => {
      setActiveAppId(null);
    };
    window.addEventListener("reset-workspace-root", handleReset);
    return () => {
      window.removeEventListener("reset-workspace-root", handleReset);
    };
  }, []);
  const [ideaInput, setIdeaInput] = useState("");

  // Compute REAL application state metrics
  const uid = auth.currentUser?.uid;
  const userEmail = auth.currentUser?.email || "";

  // 1. Voice setup state
  const isVoiceSetup = !!(profile?.writingStyle || profile?.creatorIdentity?.personality || profile?.creatorIdentity?.howYouThink);
  
  // 2. Business setup state
  const isBusinessSetup = !!(profile?.offer && profile?.audience);

  // 3. Strategy setup state
  const isStrategySetup = !!(profile?.contentPillars && profile.contentPillars.length > 0);

  // 4. Threads Meta API connection state
  const [isThreadsConnected, setIsThreadsConnected] = useState<boolean>(() => {
    if (!uid) return false;
    try {
      return localStorage.getItem(`threads_account_connected_${uid}`) === "true";
    } catch {
      return false;
    }
  });

  const [error, setError] = useState<string | null>(null);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  const handleNavigate = (tab: string) => {
    if (onNavigateToTab) {
      onNavigateToTab(tab);
    }
  };

  const handleSignOut = async () => {
    setLogoutError(null);
    try {
      const currentUid = auth.currentUser?.uid;
      clearThreadsLocalConnection(currentUid);
      window.dispatchEvent(new CustomEvent("threadsworks-user-signout"));
      await signOut(auth);
    } catch (err: any) {
      console.error("Logout failed:", err);
      setLogoutError(err?.message || String(err));
    }
  };

  const creatorAppsList = [
    {
      id: "funnelworks",
      name: "ProductWorks",
      tagline: "Turn your knowledge into digital products.",
      description: "Create downloadable playbooks, social media carousels, promotional content, and storefront sales copy from a single idea using AI.",
      category: "AI PRODUCT CREATION",
      badge: "New",
      icon: Layers,
      isCore: false,
      actionType: "internal" as const,
      actionLabel: "Launch ProductWorks"
    },
    {
      id: "create-best-post",
      name: "Create Best Post",
      tagline: "Intelligence-Driven Single Next Post Synthesizer",
      description: "Use your Profile, content history, and performance data to create your strongest next Threads post.",
      category: "CONTENT INTELLIGENCE",
      badge: "Core AI",
      icon: Sparkles,
      isCore: true,
      actionType: "internal" as const
    },
    {
      id: "influencer-intel",
      name: "Influencer Intelligence",
      tagline: "Creator Discovery & Outreach Engine",
      description: "Discover relevant creators, analyze strategic profile overlap, generate personalized DMs, and execute outreach grounded in your ThreadsWorks profile.",
      category: "Outreach & Growth",
      badge: "Intel Engine",
      icon: Users,
      isCore: false,
      actionType: "navigate" as const,
      targetTab: "influencer"
    }
  ];

  // 6. Saved Posts Count in Workspace
  const [savedPostsCount, setSavedPostsCount] = useState<number>(() => {
    if (!uid) return 0;
    try {
      const raw = localStorage.getItem(`threads_saved_offline_library_${uid}`);
      return raw ? JSON.parse(raw).length : 0;
    } catch {
      return 0;
    }
  });

  // Calculate real setup completion score
  const completedStepsCount = [isVoiceSetup, isBusinessSetup, isThreadsConnected].filter(Boolean).length;
  const setupPercentage = Math.round((completedStepsCount / 3) * 100);

  // Determine dynamic Next Strategic Action from real state
  const getNextAction = () => {
    if (!isVoiceSetup) {
      return {
        title: "Calibrate Your Voice",
        description: "Complete Your Voice to improve AI content personalization and style alignment.",
        tab: "identity",
        actionText: "Calibrate Voice →"
      };
    }
    if (!isBusinessSetup) {
      return {
        title: "Define My Business DNA",
        description: "Tell ThreadsWorks about your offer and target audience to unlock high-converting post hooks.",
        tab: "business",
        actionText: "Define Business →"
      };
    }
    if (!isThreadsConnected) {
      return {
        title: "Connect Meta Threads Account",
        description: "Authenticate Meta Threads in Analytics to enable automated posting and real-time insights.",
        tab: "analytics",
        actionText: "Connect Threads →"
      };
    }
    return {
      title: "Create Threads Content",
      description: "Your Creator Operating System is 100% calibrated. Draft your next viral thread now.",
      tab: "engine",
      actionText: "Create Post →"
    };
  };

  const nextAction = getNextAction();




  if (activeAppId === "funnelworks") {
    return (
      <div className="space-y-6 animate-fade-in pb-12 max-w-5xl mx-auto">
        <div className="flex items-center justify-between">
          <button type="button" onClick={() => setActiveAppId(null)} className="text-sm text-text-secondary hover:text-text-primary">← Back to Workspace</button>
          <div className="flex items-center gap-3">
            <button type="button" onClick={loadSavedFunnels} className="rounded-xl border border-border-primary bg-bg-card px-4 py-2 text-sm font-medium text-text-primary hover:bg-bg-card-hover transition cursor-pointer">Load saved products</button>
            {savedFunnels.length > 0 && (
              <select aria-label="Saved product projects" defaultValue="" onChange={e => { const selected = savedFunnels.find(f => f.id === e.target.value); if (selected) { setGeneratedFunnel(selected); setApprovedFunnelConcept({ source: selected.sourceTopic || "Saved product", audience: "Saved project", outcome: selected.storefront?.productTitle || "Saved product", title: selected.storefront?.productTitle || "Saved product", creatorBrand: selected.creatorBrand || "", goal: selected.goal, theme: selected.theme }); } }} className="rounded-xl border border-border-primary bg-bg-card px-3 py-2 text-sm text-text-primary">
                <option value="">Select saved product...</option>
                {savedFunnels.map(f => <option key={f.id} value={f.id}>{f.storefront?.productTitle || f.id}</option>)}
              </select>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-border-primary bg-bg-card p-5 md:p-6 shadow-sm">
          <h2 className="text-xl font-bold text-text-primary">ProductWorks Generator</h2>
          <p className="mt-1 text-sm text-text-secondary">Turn any post or idea into a complete, downloadable product package (carousel slides, playbook PDF, companion posts, and storefront copy kit).</p>
        </div>

        <FunnelConceptView onApprove={(concept) => { setApprovedFunnelConcept(concept); setGeneratedFunnel(null); setFunnelError(null); }} disabled={funnelLoading} />

        {approvedFunnelConcept && (
          <div className="rounded-2xl border border-border-primary bg-bg-card p-6 space-y-4" role="status">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-purple-400">Concept Approved</p>
                <h3 className="text-lg font-bold text-text-primary mt-1">{approvedFunnelConcept.title}</h3>
                <p className="text-sm text-text-secondary">{approvedFunnelConcept.outcome}</p>
              </div>
              {!generatedFunnel && (
                <button type="button" disabled={funnelLoading} onClick={generateFunnel} className="rounded-xl bg-purple-600 hover:bg-purple-500 px-5 py-3 text-sm font-bold text-white shadow-lg transition disabled:opacity-50 cursor-pointer">
                  {funnelLoading ? "Generating product package..." : "Generate Product Package"}
                </button>
              )}
            </div>

            {funnelLoading && (
              <div className="flex items-center gap-3 py-6 justify-center text-purple-400">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
                <span className="text-sm font-medium">Building your slides, playbook, and storefront kit with Gemini AI...</span>
              </div>
            )}

            {funnelError && (
              <div role="alert" className="rounded-xl border border-red-500/30 bg-red-950/30 p-4 text-sm text-red-300">
                ⚠️ {funnelError}
              </div>
            )}

            {generatedFunnel && (
              <div className="space-y-6 pt-4 border-t border-border-primary">
                <div className="flex flex-wrap items-center justify-between gap-3 bg-purple-950/30 border border-purple-500/30 p-4 rounded-xl">
                  <div>
                    <h4 className="font-bold text-purple-200 text-sm">Product Package Ready for Download</h4>
                    <p className="text-xs text-text-secondary mt-0.5">All assets below reflect your current edits. Download individually or as a complete bundle.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => downloadCompleteProductWorksZip(generatedFunnel).catch((err) => setFunnelError(err.message))} className="rounded-xl bg-purple-600 hover:bg-purple-500 px-4 py-2.5 text-xs font-bold text-white shadow transition cursor-pointer">
                      📦 Download Complete Package (ZIP)
                    </button>
                    <button type="button" onClick={() => downloadCarouselZip(generatedFunnel).catch((err) => setFunnelError(err.message))} className="rounded-xl border border-border-primary bg-bg-card hover:bg-bg-card-hover px-3.5 py-2.5 text-xs font-semibold text-text-primary transition cursor-pointer">
                      🖼️ Download 7 Slides (ZIP)
                    </button>
                    <button type="button" onClick={() => downloadPlaybookPdf(generatedFunnel).catch((err) => setFunnelError(err.message))} className="rounded-xl border border-border-primary bg-bg-card hover:bg-bg-card-hover px-3.5 py-2.5 text-xs font-semibold text-text-primary transition cursor-pointer">
                      📄 Download Playbook (PDF)
                    </button>
                    <button type="button" onClick={() => downloadCompanionPostsTxt(generatedFunnel)} className="rounded-xl border border-border-primary bg-bg-card hover:bg-bg-card-hover px-3.5 py-2.5 text-xs font-semibold text-text-primary transition cursor-pointer">
                      💬 Companion Posts (TXT)
                    </button>
                    <button type="button" onClick={() => downloadStorefrontTxt(generatedFunnel)} className="rounded-xl border border-border-primary bg-bg-card hover:bg-bg-card-hover px-3.5 py-2.5 text-xs font-semibold text-text-primary transition cursor-pointer">
                      🛍️ Storefront Copy (TXT)
                    </button>
                  </div>
                </div>

                {/* Editable Carousel Slides Section */}
                <div className="space-y-3">
                  <h4 className="font-bold text-text-primary text-sm uppercase tracking-wider">1. Carousel Slides (Editable 7-Slide Deck)</h4>
                  <div className="grid gap-4 md:grid-cols-2">
                    {(generatedFunnel.slides || []).map((slide: any, index: number) => (
                      <div key={index} className="rounded-xl border border-border-primary bg-bg-main p-4 space-y-3">
                        <div className="flex justify-between items-center text-xs text-text-muted">
                          <span>Slide {index + 1} ({slide.role})</span>
                          <input value={slide.eyebrow || ""} onChange={e => {
                            const updated = { ...generatedFunnel };
                            updated.slides[index].eyebrow = e.target.value;
                            setGeneratedFunnel({ ...updated });
                          }} className="text-xs bg-bg-card border border-border-primary rounded px-2 py-1 text-text-primary w-36" placeholder="Eyebrow" />
                        </div>
                        <input value={slide.headline || ""} onChange={e => {
                          const updated = { ...generatedFunnel };
                          updated.slides[index].headline = e.target.value;
                          setGeneratedFunnel({ ...updated });
                        }} className="w-full font-bold text-text-primary bg-bg-card border border-border-primary rounded-lg p-2 text-sm" placeholder="Slide headline" />
                        <textarea rows={3} value={slide.body || ""} onChange={e => {
                          const updated = { ...generatedFunnel };
                          updated.slides[index].body = e.target.value;
                          setGeneratedFunnel({ ...updated });
                        }} className="w-full text-xs text-text-secondary bg-bg-card border border-border-primary rounded-lg p-2" placeholder="Slide body" />
                        <div className="flex justify-end">
                          <button type="button" className="rounded-lg border border-border-primary px-3 py-1.5 text-xs text-text-primary hover:bg-bg-card-hover transition cursor-pointer" onClick={() => downloadSlidePng(slide, generatedFunnel.theme, generatedFunnel.creatorBrand).catch((err) => setFunnelError(err.message))}>
                            Download Slide {index + 1} (PNG)
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Editable Playbook Section */}
                <div className="space-y-3 pt-4 border-t border-border-primary">
                  <h4 className="font-bold text-text-primary text-sm uppercase tracking-wider">2. Two-Page Playbook (PDF Content)</h4>
                  <div className="rounded-xl border border-border-primary bg-bg-main p-4 space-y-3">
                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="text-xs font-medium text-text-secondary">Playbook Title
                        <input value={generatedFunnel.playbook?.title || ""} onChange={e => {
                          const updated = { ...generatedFunnel };
                          updated.playbook.title = e.target.value;
                          setGeneratedFunnel({ ...updated });
                        }} className="w-full mt-1 rounded-lg border border-border-primary bg-bg-card p-2 text-text-primary text-sm" />
                      </label>
                      <label className="text-xs font-medium text-text-secondary">Playbook Subtitle
                        <input value={generatedFunnel.playbook?.subtitle || ""} onChange={e => {
                          const updated = { ...generatedFunnel };
                          updated.playbook.subtitle = e.target.value;
                          setGeneratedFunnel({ ...updated });
                        }} className="w-full mt-1 rounded-lg border border-border-primary bg-bg-card p-2 text-text-primary text-sm" />
                      </label>
                    </div>
                  </div>
                </div>

                {/* Editable Companion Posts Section */}
                <div className="space-y-3 pt-4 border-t border-border-primary">
                  <h4 className="font-bold text-text-primary text-sm uppercase tracking-wider">3. Social Companion Posts (Threads, X, LinkedIn)</h4>
                  <div className="grid gap-4 md:grid-cols-3">
                    <label className="text-xs font-medium text-text-secondary">Threads Post
                      <textarea rows={4} value={generatedFunnel.companionPosts?.threads || ""} onChange={e => {
                        const updated = { ...generatedFunnel };
                        updated.companionPosts.threads = e.target.value;
                        setGeneratedFunnel({ ...updated });
                      }} className="w-full mt-1 rounded-xl border border-border-primary bg-bg-main p-3 text-text-primary text-xs" />
                    </label>
                    <label className="text-xs font-medium text-text-secondary">X (Twitter) Post
                      <textarea rows={4} value={generatedFunnel.companionPosts?.x || ""} onChange={e => {
                        const updated = { ...generatedFunnel };
                        updated.companionPosts.x = e.target.value;
                        setGeneratedFunnel({ ...updated });
                      }} className="w-full mt-1 rounded-xl border border-border-primary bg-bg-main p-3 text-text-primary text-xs" />
                    </label>
                    <label className="text-xs font-medium text-text-secondary">LinkedIn Post
                      <textarea rows={4} value={generatedFunnel.companionPosts?.linkedin || ""} onChange={e => {
                        const updated = { ...generatedFunnel };
                        updated.companionPosts.linkedin = e.target.value;
                        setGeneratedFunnel({ ...updated });
                      }} className="w-full mt-1 rounded-xl border border-border-primary bg-bg-main p-3 text-text-primary text-xs" />
                    </label>
                  </div>
                </div>

                {/* Editable Storefront Kit Section */}
                <div className="space-y-3 pt-4 border-t border-border-primary">
                  <h4 className="font-bold text-text-primary text-sm uppercase tracking-wider">4. Storefront Kit & Landing Copy</h4>
                  <div className="rounded-xl border border-border-primary bg-bg-main p-4 space-y-3">
                    <div className="grid gap-3 md:grid-cols-3">
                      <label className="text-xs font-medium text-text-secondary">Product Title
                        <input value={generatedFunnel.storefront?.productTitle || ""} onChange={e => {
                          const updated = { ...generatedFunnel };
                          updated.storefront.productTitle = e.target.value;
                          setGeneratedFunnel({ ...updated });
                        }} className="w-full mt-1 rounded-lg border border-border-primary bg-bg-card p-2 text-text-primary text-sm" />
                      </label>
                      <label className="text-xs font-medium text-text-secondary">Suggested Price (Suggestion)
                        <input value={generatedFunnel.storefront?.suggestedPrice || ""} onChange={e => {
                          const updated = { ...generatedFunnel };
                          updated.storefront.suggestedPrice = e.target.value;
                          setGeneratedFunnel({ ...updated });
                        }} className="w-full mt-1 rounded-lg border border-border-primary bg-bg-card p-2 text-text-primary text-sm" placeholder="e.g. $29" />
                      </label>
                      <label className="text-xs font-medium text-text-secondary">CTA Keyword
                        <input value={generatedFunnel.storefront?.ctaKeyword || ""} onChange={e => {
                          const updated = { ...generatedFunnel };
                          updated.storefront.ctaKeyword = e.target.value;
                          setGeneratedFunnel({ ...updated });
                        }} className="w-full mt-1 rounded-lg border border-border-primary bg-bg-card p-2 text-text-primary text-sm" placeholder="e.g. START" />
                      </label>
                    </div>
                    <label className="block text-xs font-medium text-text-secondary">Checkout Description
                      <textarea rows={2} value={generatedFunnel.storefront?.checkoutDescription || ""} onChange={e => {
                        const updated = { ...generatedFunnel };
                        updated.storefront.checkoutDescription = e.target.value;
                        setGeneratedFunnel({ ...updated });
                      }} className="w-full mt-1 rounded-lg border border-border-primary bg-bg-card p-2 text-text-primary text-xs" />
                    </label>
                    <label className="block text-xs font-medium text-text-secondary">Optional Add-On / Order Bump Copy
                      <input value={generatedFunnel.storefront?.orderBumpPitch || ""} onChange={e => {
                        const updated = { ...generatedFunnel };
                        updated.storefront.orderBumpPitch = e.target.value;
                        setGeneratedFunnel({ ...updated });
                      }} className="w-full mt-1 rounded-lg border border-border-primary bg-bg-card p-2 text-text-primary text-xs" placeholder="e.g. Add the VIP Masterclass for $19" />
                    </label>
                  </div>
                </div>

              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  if (activeAppId === "create-best-post") {
    return (
      <div className="space-y-6 animate-fade-in pb-8 max-w-7xl mx-auto" id="create-best-post-app-view">
        <CreateBestPostView
          profile={profile}
          subscriptionStatus={subscriptionStatus}
          onNavigateToTab={handleNavigate}
          onBack={() => setActiveAppId(null)}
          initialTopic={ideaInput}
        />
      </div>
    );
  }

  if (activeAppId === "cta-studio") {
    // Redirect old CTA Studio route directly to Profile -> Your Links
    if (onNavigateToTab) {
      onNavigateToTab("profile");
    }
    return null;
  }

  return (
    <div className="space-y-6 animate-fade-in pb-8 max-w-7xl mx-auto">

      {/* DASHBOARD CONCISE HEADER BAR */}
      <header className="rounded-2xl border border-border-primary dark:border-zinc-800/90 bg-bg-card dark:bg-zinc-950/80 backdrop-blur-2xl p-4 sm:p-5 shadow-sm dark:shadow-2xl dark:shadow-purple-950/10">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          {/* Brand Source of Truth & Concise Value Statement */}
          <div className="flex items-center gap-4">
            <ThreadsWorksLogo variant="full" size="sm" showTagline={false} />
            <div className="hidden sm:block h-8 w-[1px] bg-border-primary dark:bg-zinc-800/80" />
            <p className="hidden sm:block text-xs text-text-secondary max-w-md leading-tight">
              AI operating system to <span className="text-text-primary font-semibold">create, organize, improve, manage & publish</span> Threads content.
            </p>
          </div>

          {/* User Account Controls & Readiness Indicator */}
          <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap justify-between lg:justify-end">
            {/* System Readiness Score */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-brand-border bg-brand-surface dark:bg-purple-950/40 text-xs">
              <Zap className="h-3.5 w-3.5 text-brand-text" />
              <span className="text-text-secondary font-mono text-[11px] uppercase">Readiness:</span>
              <span className="font-mono font-bold text-text-primary text-xs">{setupPercentage}%</span>
            </div>

            {/* Profile Pill */}
            {userEmail && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-bg-app dark:bg-zinc-900/90 border border-border-primary dark:border-zinc-800">
                {profile?.creatorIdentity?.character ? (
                  <CharacterAvatarPreview
                    config={profile.creatorIdentity.character}
                    size="xs"
                    showPropsBadge={false}
                    className="w-5 h-5 rounded-md"
                  />
                ) : (
                  <div className="w-5 h-5 rounded-md bg-brand-surface text-brand-text-strong flex items-center justify-center font-bold text-[10px]">
                    {userEmail.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="text-xs font-semibold text-text-primary max-w-[110px] truncate" title={userEmail}>
                  {userEmail.split("@")[0]}
                </span>
              </div>
            )}

            {/* Theme Selector */}
            <button
              id="dashboard-theme-toggle"
              onClick={toggleTheme}
              title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-border-primary dark:border-zinc-800 bg-bg-app dark:bg-zinc-900/90 text-text-secondary hover:text-text-primary hover:border-purple-400/60 dark:hover:border-zinc-700 transition cursor-pointer"
            >
              {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            </button>

            {/* Account Logout Action */}
            <button
              id="auth-logout-button"
              onClick={handleSignOut}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-status-danger-border bg-status-danger-bg hover:bg-red-100 dark:hover:bg-red-500/20 text-status-danger-text text-xs font-semibold transition cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>

        {logoutError && (
          <div className="mt-2.5 p-2 text-xs text-status-danger-text bg-status-danger-bg border border-status-danger-border rounded-xl font-mono">
            {logoutError}
          </div>
        )}
      </header>

      {/* CREATOR APPS DASHBOARD GRID */}
      <section className="space-y-3" id="apps-dashboard-grid-section">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-mono font-extrabold tracking-widest text-brand-text-strong uppercase flex items-center gap-2">
            <LayoutGrid className="h-3.5 w-3.5" /> CREATOR APPS & MODULAR TOOLS
          </h2>
          <span className="text-[10px] font-mono text-text-muted">{creatorAppsList.length} APPS AVAILABLE</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
          {creatorAppsList.map((app) => {
            const Icon = app.icon;
            const isCore = app.isCore;
            return (
              <div
                key={app.id}
                id={`app-card-${app.id}`}
                onClick={() => {
                  if (app.actionType === "internal") {
                    setActiveAppId(app.id);
                  } else if (app.actionType === "navigate" && app.targetTab) {
                    handleNavigate(app.targetTab);
                  }
                }}
                className={`group relative rounded-2xl p-5 transition-all duration-200 cursor-pointer flex flex-col justify-between hover:scale-[1.01] ${
                  isCore
                    ? "border border-brand-border dark:border-purple-500/50 bg-gradient-to-br from-purple-50 via-white to-white dark:from-purple-950/30 dark:via-zinc-950 dark:to-zinc-950 hover:border-purple-500 dark:hover:border-purple-400 shadow-md dark:shadow-xl dark:shadow-purple-950/20"
                    : "border border-border-primary dark:border-zinc-800 bg-bg-card dark:bg-zinc-950/80 hover:bg-bg-card-hover dark:hover:bg-zinc-900/90 hover:border-purple-500/50 shadow-sm dark:shadow-lg"
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl border transition-transform group-hover:scale-110 ${
                      isCore
                        ? "border-brand-border bg-brand-surface text-brand-text-strong"
                        : "border-border-primary dark:border-zinc-700 bg-bg-app dark:bg-zinc-900 text-brand-text"
                    }`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-md bg-bg-app dark:bg-zinc-900 text-text-secondary border border-border-primary dark:border-zinc-800 uppercase">
                        {app.category}
                      </span>
                      <span className={`text-[9px] font-mono font-black px-2 py-0.5 rounded-md border uppercase ${
                        isCore
                          ? "bg-brand-surface text-brand-text-strong border-brand-border"
                          : "bg-bg-app dark:bg-zinc-900 text-text-primary dark:text-zinc-300 border-border-primary dark:border-zinc-800"
                      }`}>
                        {app.badge}
                      </span>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-text-primary group-hover:text-brand-text-strong transition-colors flex items-center gap-2">
                      <span>{app.name}</span>
                      {isCore && <Sparkles className="h-3.5 w-3.5 text-brand-text animate-pulse" />}
                    </h3>
                    <p className="text-xs text-brand-text-strong font-semibold mt-0.5">{app.tagline}</p>
                    <p className="text-xs text-text-secondary mt-2 leading-relaxed">
                      {app.description}
                    </p>
                  </div>
                </div>

                <div className="pt-4 mt-4 border-t border-border-secondary dark:border-zinc-900 flex items-center justify-between text-xs font-bold text-brand-text-strong">
                  <span>{app.actionLabel || (isCore ? `Open ${app.name}` : "Launch App")}</span>
                  <ArrowRight className="h-4 w-4 transform group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            );
          })}
        </div>
      </section>


      {/* COMPACT NEXT ACTION BANNER & QUICK SYSTEM STATUS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recommended Strategic Next Action */}
        <div className="lg:col-span-2 rounded-2xl border border-brand-border dark:border-purple-500/30 bg-gradient-to-r from-purple-50 via-white to-indigo-50 dark:from-purple-950/40 dark:via-zinc-950 dark:to-indigo-950/30 p-4 sm:p-5 flex items-center justify-between gap-4 shadow-sm dark:shadow-md relative overflow-hidden group">
          <div className="space-y-1 relative z-10">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-brand-surface dark:bg-purple-950/80 border border-brand-border text-brand-text-strong text-[10px] font-mono font-bold uppercase tracking-wide">
                <Zap className="h-3 w-3 text-brand-text" /> RECOMMENDED STEP
              </span>
              <span className="text-xs font-bold text-text-primary">{nextAction.title}</span>
            </div>
            <p className="text-xs text-text-secondary line-clamp-1 max-w-xl">
              {nextAction.description}
            </p>
          </div>

          <button
            onClick={() => handleNavigate(nextAction.tab)}
            className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md shadow-purple-600/30 transition cursor-pointer"
          >
            <span>{nextAction.actionText}</span>
          </button>
        </div>

        {/* Quick System Metrics Row */}
        <div className="rounded-2xl border border-border-primary dark:border-zinc-800 bg-bg-card dark:bg-zinc-950/80 p-4 flex items-center justify-around text-center">
          <div>
            <div className="text-[10px] font-mono text-text-secondary uppercase">Manuscripts</div>
            <div className="text-base font-black text-text-primary">{savedPostsCount}</div>
          </div>
          <div className="h-7 w-[1px] bg-border-primary dark:bg-zinc-800" />
          <div>
            <div className="text-[10px] font-mono text-text-secondary uppercase">Meta API</div>
            <div className={`text-xs font-bold ${isThreadsConnected ? "text-status-success-text" : "text-text-muted"}`}>
              {isThreadsConnected ? "Connected" : "Offline"}
            </div>
          </div>
        </div>
      </div>


      {/* THE 3x3 COMMAND CENTER DASHBOARD GRID */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-mono font-extrabold tracking-widest text-brand-text-strong uppercase flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5" /> COMMAND CENTER MODULES
          </h2>
          <span className="text-[10px] font-mono text-text-muted">CORE MODULES</span>
        </div>

        {/* 2-COLUMN GRID ON TABLET/DESKTOP, 1-COLUMN ON MOBILE */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* CARD 1: Create Content (Primary Creation Workspace) */}
          <div 
            id="module-content-instructions"
            onClick={() => handleNavigate("engine")}
            className="group relative rounded-2xl border border-brand-border dark:border-purple-500/40 bg-gradient-to-b from-purple-50 via-white to-white dark:from-purple-950/30 dark:via-zinc-950 dark:to-zinc-950 hover:border-purple-500 dark:hover:border-purple-400 p-5 transition-all duration-200 cursor-pointer shadow-md dark:shadow-xl dark:shadow-purple-950/20 flex flex-col justify-between hover:scale-[1.015]"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-brand-border bg-brand-surface text-brand-text-strong group-hover:scale-110 transition-transform">
                  <Zap className="h-5 w-5" />
                </div>
                <span className="text-[9px] font-mono font-black px-2 py-0.5 rounded-md bg-brand-surface text-brand-text-strong border border-brand-border uppercase">
                  CREATION WORKSPACE
                </span>
              </div>
              <div>
                <h3 className="text-base font-bold text-text-primary group-hover:text-brand-text-strong transition-colors">
                  Create Content
                </h3>
                <p className="text-xs text-text-secondary mt-1 leading-relaxed">
                  Create Threads content using your voice, business, CTA, and learned intelligence.
                </p>
              </div>
            </div>
            <div className="pt-3 mt-3 border-t border-brand-border/50 flex items-center justify-between text-xs font-bold text-brand-text-strong">
              <span>Create Content</span>
              <ArrowRight className="h-4 w-4 transform group-hover:translate-x-1 transition-transform text-brand-text" />
            </div>
          </div>

          {/* CARD 2: Calendar */}
          <div 
            id="module-calendar"
            onClick={() => handleNavigate("calendar")}
            className="group rounded-2xl border border-border-primary dark:border-zinc-800 bg-bg-card dark:bg-zinc-950/80 hover:bg-bg-card-hover dark:hover:bg-zinc-900/90 hover:border-indigo-500/50 p-5 transition-all duration-200 cursor-pointer shadow-sm dark:shadow-lg dark:hover:shadow-indigo-950/20 flex flex-col justify-between hover:scale-[1.015]"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-status-info-border dark:border-indigo-500/25 bg-status-info-bg dark:bg-indigo-950/40 text-status-info-text dark:text-indigo-400 group-hover:scale-110 transition-transform">
                  <Calendar className="h-5 w-5" />
                </div>
                <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-md bg-bg-app dark:bg-zinc-900 text-text-primary dark:text-zinc-300 border border-border-primary dark:border-zinc-800">
                  {savedPostsCount} Manuscripts
                </span>
              </div>
              <div>
                <h3 className="text-base font-bold text-text-primary group-hover:text-indigo-700 dark:group-hover:text-indigo-300 transition-colors">
                  Calendar
                </h3>
                <p className="text-xs text-text-secondary mt-1 leading-relaxed">
                  Content planning, scheduling queue, and publishing organization.
                </p>
              </div>
            </div>
            <div className="pt-3 mt-3 border-t border-border-secondary dark:border-zinc-900 flex items-center justify-between text-xs font-semibold text-indigo-700 dark:text-indigo-400 group-hover:text-indigo-800 dark:group-hover:text-indigo-300">
              <span>Content Execution</span>
              <ArrowRight className="h-4 w-4 transform group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* CARD 6: Analytics */}
          <div 
            id="module-analytics"
            onClick={() => handleNavigate("analytics")}
            className="group rounded-2xl border border-border-primary dark:border-zinc-800 bg-bg-card dark:bg-zinc-950/80 hover:bg-bg-card-hover dark:hover:bg-zinc-900/90 hover:border-indigo-500/50 p-5 transition-all duration-200 cursor-pointer shadow-sm dark:shadow-lg dark:hover:shadow-indigo-950/20 flex flex-col justify-between hover:scale-[1.015]"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-status-info-border dark:border-indigo-500/25 bg-status-info-bg dark:bg-indigo-950/40 text-status-info-text dark:text-indigo-400 group-hover:scale-110 transition-transform">
                  <BarChart3 className="h-5 w-5" />
                </div>
                <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-md border ${
                  isThreadsConnected 
                    ? "bg-status-success-bg text-status-success-text border-status-success-border" 
                    : "bg-bg-app dark:bg-zinc-900 text-text-secondary border-border-primary dark:border-zinc-800"
                }`}>
                  {isThreadsConnected ? "Meta API Connected" : "Connect Feed"}
                </span>
              </div>
              <div>
                <h3 className="text-base font-bold text-text-primary group-hover:text-indigo-700 dark:group-hover:text-indigo-300 transition-colors">
                  Analytics
                </h3>
                <p className="text-xs text-text-secondary mt-1 leading-relaxed">
                  Post performance, engagement trends, and real-time Meta Threads growth.
                </p>
              </div>
            </div>
            <div className="pt-3 mt-3 border-t border-border-secondary dark:border-zinc-900 flex items-center justify-between text-xs font-semibold text-indigo-700 dark:text-indigo-400 group-hover:text-indigo-800 dark:group-hover:text-indigo-300">
              <span>Performance Feedback</span>
              <ArrowRight className="h-4 w-4 transform group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* CARD 8: Upgrade Pro */}
          <div 
            id="module-upgrade"
            onClick={() => handleNavigate("pricing")}
            className="group rounded-2xl border border-brand-border dark:border-purple-500/40 bg-gradient-to-br from-white via-white to-purple-50 dark:from-zinc-950 dark:via-zinc-950 dark:to-purple-950/30 hover:border-purple-500 dark:hover:border-purple-400 p-5 transition-all duration-200 cursor-pointer shadow-sm dark:shadow-lg dark:hover:shadow-purple-950/20 flex flex-col justify-between hover:scale-[1.015]"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-brand-border bg-brand-surface text-brand-text-strong group-hover:scale-110 transition-transform">
                  <Sparkles className="h-5 w-5" />
                </div>
                <span className={`text-[9px] font-mono font-extrabold px-2 py-0.5 rounded-md border ${
                  subscriptionStatus === "active"
                    ? "bg-brand-surface text-brand-text-strong border-brand-border"
                    : "bg-purple-600 text-white border-purple-500"
                }`}>
                  {subscriptionStatus === "active" ? "PRO ACTIVE" : "UNLOCK PRO"}
                </span>
              </div>
              <div>
                <h3 className="text-base font-bold text-text-primary group-hover:text-brand-text-strong transition-colors">
                  Upgrade Pro
                </h3>
                <p className="text-xs text-text-secondary mt-1 leading-relaxed">
                  Unlock unlimited post generation, auto-scheduling, and premium features.
                </p>
              </div>
            </div>
            <div className="pt-3 mt-3 border-t border-border-secondary dark:border-zinc-900 flex items-center justify-between text-xs font-bold text-brand-text-strong">
              <span>Expanded Capability</span>
              <ArrowRight className="h-4 w-4 transform group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

        </div>
      </section>

    </div>
  );
}
