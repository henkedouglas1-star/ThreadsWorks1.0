import React, { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Archive,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Brain,
  CheckCircle2,
  Compass,
  Edit3,
  ExternalLink,
  FolderKanban,
  Layers,
  Loader2,
  Plus,
  RotateCcw,
  Settings,
  Sparkles
} from "lucide-react";
import { addDoc, collection } from "firebase/firestore";
import { db, withTimeout } from "../../firebase";
import { EcosystemProject } from "../../types/sharedProjects";
import {
  PROJECT_DESCRIPTION_MAX_LENGTH,
  PROJECT_NAME_MAX_LENGTH,
  PROJECT_OBJECTIVE_MAX_LENGTH,
  classifyProjectError,
  createUserProject,
  listUserProjects,
  toggleUserProjectArchive,
  updateUserProject,
  validateProjectInput,
  type SharedProjectsClientAdapter
} from "../../services/sharedProjectsService";
import firebaseConfig from "../../../firebase-applet-config.json";
import {
  CONTENT_PAYS_US_APPS,
  EcosystemCategory,
  getAppsByCategory,
  getAvailabilityDotClass,
  getAvailabilityTextClass,
  getEcosystemAppById
} from "../../data/contentPaysUsRegistry";
import { getToolsForApp } from "../../data/ecosystemToolRegistry";
import { PermanentCategoryBar } from "./PermanentCategoryBar";
import { ContentPaysUsAcademyView } from "./ContentPaysUsAcademyView";
import { FirstSaleEnginePanel } from "../ecosystem/FirstSaleEnginePanel";
import { ProductWorksEnhancedPanel } from "../ecosystem/ProductWorksEnhancedPanel";
import { DemandResearchPanel } from "../ecosystem/DemandResearchPanel";
import {
  ToolTransferPayload,
  UniversalToolWorkspace
} from "../ecosystem/UniversalToolWorkspace";
import {
  AffiliateWorksModule,
  AutomationWorksModule,
  CommunityWorksModule,
  DeliveryWorksModule,
  FinanceWorksModule,
  GrowthWorksModule,
  MeetingWorksModule,
  ProofWorksModule,
  SalesWorksCrmModule,
  SharedIntelligenceMemoryPanel,
  StoreWorksModule,
  TeamWorksModule
} from "../ecosystem/OperationalAppModules";

interface ContentPaysUsUnifiedWorkspaceProps {
  user: any;
  profile: any;
  subscriptionStatus: string;
  onNavigateToTab: (tab: string) => void;
  onRefreshProfile: () => void;
  onOpenProductWorksStudio?: () => void;
  /** Optional dependency injection for automated tests */
  projectsAdapter?: SharedProjectsClientAdapter;
}

type WorkspaceSubTab =
  | "first-sale"
  | "applications"
  | "projects"
  | "academy"
  | "memory"
  | "settings";

type ProjectLoadStatus = "idle" | "loading" | "loaded" | "permission_denied" | "error";

export function ContentPaysUsUnifiedWorkspace({
  user,
  profile,
  subscriptionStatus,
  onNavigateToTab,
  onRefreshProfile,
  onOpenProductWorksStudio,
  projectsAdapter
}: ContentPaysUsUnifiedWorkspaceProps) {
  const [activeSubTab, setActiveSubTab] = useState<WorkspaceSubTab>("applications");
  const [activeCategory, setActiveCategory] = useState<EcosystemCategory>("Create & Sell");
  const [activeEcosystemAppId, setActiveEcosystemAppId] = useState<string | null>(null);

  // Preserved unsaved drafts across app switches (strictly cleared on UID switch)
  const [draftCache, setDraftCache] = useState<
    Record<string, { toolId: string; inputs: Record<string, string>; sections: Record<string, string>; title: string }>
  >({});
  const [incomingTransfer, setIncomingTransfer] = useState<ToolTransferPayload | null>(null);

  // Shared projects state (strictly separates empty collection from permission / load errors)
  const [projects, setProjects] = useState<EcosystemProject[]>([]);
  const [projectLoadStatus, setProjectLoadStatus] = useState<ProjectLoadStatus>("idle");
  const [projectLoadError, setProjectLoadError] = useState<string | null>(null);
  const [projectError, setProjectError] = useState<string | null>(null);
  const [projectSuccessMessage, setProjectSuccessMessage] = useState<string | null>(null);

  // Project modal state (Create / Edit) with multi-app association
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState("");
  const [projectObjective, setProjectObjective] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [projectStatus, setProjectStatus] = useState<"active" | "archived" | "completed">("active");
  const [selectedAppIds, setSelectedAppIds] = useState<string[]>(["threadsworks"]);
  const [submittingProject, setSubmittingProject] = useState(false);

  const activeUidRef = useRef<string | null>(user?.uid || null);
  activeUidRef.current = user?.uid || null;
  const projectFetchSeqRef = useRef(0);

  const loadProjectsForUid = async (requestUid: string) => {
    const fetchSeq = ++projectFetchSeqRef.current;
    setProjectLoadStatus("loading");
    setProjectLoadError(null);
    try {
      const list = await listUserProjects(requestUid, projectsAdapter);
      if (activeUidRef.current !== requestUid || projectFetchSeqRef.current !== fetchSeq) return;
      setProjects(list);
      setProjectLoadStatus("loaded");
      setProjectLoadError(null);
    } catch (err: any) {
      if (activeUidRef.current !== requestUid || projectFetchSeqRef.current !== fetchSeq) return;
      const classified = classifyProjectError(err, "Could not load shared projects.");
      setProjects([]);
      setProjectLoadStatus(classified.isPermissionError ? "permission_denied" : "error");
      setProjectLoadError(classified.message);
    }
  };

  // Support deep link ?app=<id> when coming from public /applications/:id
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const requestedApp = params.get("app");
    if (!requestedApp) return;
    if (requestedApp === "threadsworks") {
      onNavigateToTab("engine");
      return;
    }
    const found = getEcosystemAppById(requestedApp);
    if (found) {
      setActiveCategory(found.category);
      setActiveSubTab("applications");
      setActiveEcosystemAppId(found.id);
    }
  }, []);

  // Reset ALL workspace, project, draft cache, and transfer state immediately on UID change
  useEffect(() => {
    const requestUid = user?.uid || null;
    projectFetchSeqRef.current += 1;
    setProjects([]);
    setProjectLoadStatus("idle");
    setProjectLoadError(null);
    setProjectError(null);
    setProjectSuccessMessage(null);
    setShowProjectModal(false);
    setEditingProjectId(null);
    setProjectName("");
    setProjectObjective("");
    setProjectDescription("");
    setProjectStatus("active");
    setSelectedAppIds(["threadsworks"]);
    setSubmittingProject(false);
    setActiveEcosystemAppId(null);
    setDraftCache({});
    setIncomingTransfer(null);
    setActiveSubTab("applications");

    if (!requestUid) {
      return;
    }

    loadProjectsForUid(requestUid);
  }, [user?.uid, projectsAdapter]);

  const handleLaunchApp = (appId: string) => {
    if (appId === "threadsworks") {
      onNavigateToTab("engine");
      return;
    }
    const app = getEcosystemAppById(appId);
    if (app) {
      setActiveCategory(app.category);
    }
    setActiveSubTab("applications");
    setActiveEcosystemAppId(appId);
  };

  const handleTransferToApp = (payload: ToolTransferPayload) => {
    setIncomingTransfer(payload);
    if (payload.targetAppId === "threadsworks") {
      handleSendBriefToThreadsWorks(payload.title, payload.content);
      return;
    }
    handleLaunchApp(payload.targetAppId);
  };

  const handleSendBriefToThreadsWorks = async (title: string, body: string) => {
    const requestUid = user?.uid;
    if (!requestUid) return;
    const now = new Date().toISOString();
    try {
      await withTimeout(
        addDoc(collection(db, "posts"), {
          userId: requestUid,
          title: title.slice(0, 140),
          hook: body.split("\n")[0]?.slice(0, 260) || title,
          singlePost: body.slice(0, 500),
          threadParts: [body.slice(0, 500)],
          topic: title.slice(0, 120),
          stage: "draft",
          status: "draft",
          format: "single",
          notes: "Transferred safely as a draft from ContentPaysUs ecosystem. Review before scheduling or publishing.",
          createdAt: now,
          updatedAt: now
        }),
        5000,
        true
      );
      if (activeUidRef.current !== requestUid) return;
      setProjectSuccessMessage(`Saved "${title}" as a draft in your ThreadsWorks Library (never auto-published).`);
      setTimeout(() => {
        if (activeUidRef.current === requestUid) setProjectSuccessMessage(null);
      }, 4500);
    } catch (err: any) {
      if (activeUidRef.current === requestUid) {
        setProjectError(err?.message || "Could not save draft to ThreadsWorks Library.");
      }
    }
  };

  // Project CRUD handlers
  const handleToggleAppSelection = (appId: string) => {
    setSelectedAppIds((prev) =>
      prev.includes(appId) ? prev.filter((id) => id !== appId) : [...prev, appId]
    );
  };

  const handleOpenCreateModal = () => {
    setEditingProjectId(null);
    setProjectName("");
    setProjectObjective("");
    setProjectDescription("");
    setProjectStatus("active");
    setSelectedAppIds(["threadsworks"]);
    setProjectError(null);
    setShowProjectModal(true);
  };

  const handleOpenEditModal = (proj: EcosystemProject) => {
    setEditingProjectId(proj.id);
    setProjectName(proj.name);
    setProjectObjective(proj.objective);
    setProjectDescription(proj.description || "");
    setProjectStatus(proj.status);
    setSelectedAppIds(
      Array.isArray(proj.associatedAppIds) && proj.associatedAppIds.length > 0
        ? [...proj.associatedAppIds]
        : ["threadsworks"]
    );
    setProjectError(null);
    setShowProjectModal(true);
  };

  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    const requestUid = user?.uid;
    if (!requestUid) {
      setProjectError("Please sign in to save projects.");
      return;
    }

    const validation = validateProjectInput({
      name: projectName,
      objective: projectObjective,
      description: projectDescription,
      status: editingProjectId ? projectStatus : "active",
      associatedAppIds: selectedAppIds
    });

    if (!validation.valid) {
      setProjectError(validation.errors[0] || "Please check your project details.");
      return;
    }

    setSubmittingProject(true);
    setProjectError(null);
    setProjectSuccessMessage(null);

    try {
      if (editingProjectId) {
        const targetId = editingProjectId;
        const patch = await updateUserProject(
          requestUid,
          targetId,
          {
            name: projectName,
            objective: projectObjective,
            description: projectDescription,
            status: projectStatus,
            associatedAppIds: selectedAppIds
          },
          projectsAdapter
        );
        if (activeUidRef.current !== requestUid) return;
        setProjects((prev) =>
          prev.map((p) => (p.id === targetId ? { ...p, ...patch } : p))
        );
        setProjectSuccessMessage("Project updated successfully.");
      } else {
        const created = await createUserProject(
          requestUid,
          {
            name: projectName,
            objective: projectObjective,
            description: projectDescription,
            status: "active",
            associatedAppIds: selectedAppIds
          },
          projectsAdapter
        );
        if (activeUidRef.current !== requestUid) return;
        setProjects((prev) => [created, ...prev]);
        setProjectLoadStatus("loaded");
        setProjectLoadError(null);
        setProjectSuccessMessage("Project created successfully.");
      }
      setShowProjectModal(false);
      setTimeout(() => {
        if (activeUidRef.current === requestUid) setProjectSuccessMessage(null);
      }, 4000);
    } catch (err: any) {
      if (activeUidRef.current !== requestUid) return;
      const classified = classifyProjectError(err, "Failed to save project.");
      setProjectError(classified.message);
    } finally {
      if (activeUidRef.current === requestUid) setSubmittingProject(false);
    }
  };

  const handleToggleArchive = async (projectId: string, currentStatus: EcosystemProject["status"]) => {
    const requestUid = user?.uid;
    if (!requestUid) return;
    setProjectError(null);
    try {
      const patch = await toggleUserProjectArchive(
        requestUid,
        projectId,
        currentStatus,
        projectsAdapter
      );
      if (activeUidRef.current !== requestUid) return;
      setProjects((prev) =>
        prev.map((p) =>
          p.id === projectId ? { ...p, status: patch.status, updatedAt: patch.updatedAt } : p
        )
      );
      setProjectSuccessMessage(
        patch.status === "active" ? "Project restored to active." : "Project archived."
      );
      setTimeout(() => {
        if (activeUidRef.current === requestUid) setProjectSuccessMessage(null);
      }, 3000);
    } catch (err: any) {
      if (activeUidRef.current !== requestUid) return;
      const classified = classifyProjectError(err, "Failed to update project status.");
      setProjectError(classified.message);
    }
  };

  const categoryApps = getAppsByCategory(activeCategory);
  const activeAppObj = activeEcosystemAppId ? getEcosystemAppById(activeEcosystemAppId) : null;
  const activeAppHasAiTools = activeEcosystemAppId
    ? getToolsForApp(activeEcosystemAppId).some((t) => !(t.mode === "operational" && t.outputSchema.length === 0))
    : false;

  const renderOperationalModule = (appId: string) => {
    switch (appId) {
      case "salesworks":
        return <SalesWorksCrmModule onTransferToApp={handleTransferToApp} />;
      case "storeworks":
        return <StoreWorksModule />;
      case "deliveryworks":
        return <DeliveryWorksModule />;
      case "communityworks":
        return <CommunityWorksModule currentUid={user?.uid} />;
      case "meetingworks":
        return <MeetingWorksModule onTransferToApp={handleTransferToApp} />;
      case "proofworks":
        return <ProofWorksModule />;
      case "teamworks":
        return <TeamWorksModule />;
      case "affiliateworks":
        return <AffiliateWorksModule currentUid={user?.uid} />;
      case "growthworks":
        return <GrowthWorksModule />;
      case "automationworks":
        return <AutomationWorksModule />;
      case "financeworks":
        return <FinanceWorksModule issuerEmail={profile?.email || user?.email} />;
      default:
        return null;
    }
  };

  return (
    <div className="cpu-public-site space-y-6 animate-fade-in text-left">
      {/* Unified Ecosystem Header — Light & Dark Mode Parity */}
      <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#111115] p-5 sm:p-6 shadow-sm space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-wider text-indigo-700 dark:text-indigo-400">
              <Sparkles className="h-3.5 w-3.5" />
              <span>ContentPaysUs Unified Creator Workspace</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-950 dark:text-white tracking-tight">
              Welcome back, {(profile?.email || user?.email || "Creator").split("@")[0]}
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 max-w-2xl">
              20 connected creator applications organized into Create &amp; Sell, Connect &amp; Grow, and Automate &amp; Scale—powered by one shared creator identity and memory layer.
            </p>
          </div>

          {/* Primary Workspace Sub-Navigation */}
          <div className="flex flex-wrap gap-1.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-[#09090b] p-1">
            {[
              { id: "applications", label: "Applications (20)", icon: Layers },
              { id: "first-sale", label: "First Sale Engine", icon: Compass },
              { id: "projects", label: `Projects (${projects.filter((p) => p.status === "active").length})`, icon: FolderKanban },
              { id: "academy", label: "Academy", icon: BookOpen },
              { id: "memory", label: "Memory", icon: Brain },
              { id: "settings", label: "Settings", icon: Settings }
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeSubTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  aria-label={`Navigate to ${tab.label}`}
                  onClick={() => {
                    setActiveSubTab(tab.id as WorkspaceSubTab);
                    if (tab.id !== "applications") setActiveEcosystemAppId(null);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    isActive
                      ? "bg-indigo-600 dark:bg-indigo-500 text-white shadow-sm"
                      : "text-slate-700 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-900"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Permanent Sticky 3-Category Bar (Always Visible While Scrolling) */}
      <PermanentCategoryBar
        variant="workspace"
        stickyTopClass="top-0"
        activeCategory={activeCategory}
        onSelectCategory={(cat) => {
          setActiveCategory(cat);
          setActiveSubTab("applications");
          setActiveEcosystemAppId(null);
        }}
        firstSaleActive={activeSubTab === "first-sale"}
        onOpenFirstSaleEngine={() => {
          setActiveSubTab("first-sale");
          setActiveEcosystemAppId(null);
        }}
        academyActive={activeSubTab === "academy"}
        onOpenAcademy={() => {
          setActiveSubTab("academy");
          setActiveEcosystemAppId(null);
        }}
      />

      {/* Notifications */}
      {projectSuccessMessage && (
        <div className="flex items-center gap-2 p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs font-semibold">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{projectSuccessMessage}</span>
        </div>
      )}
      {projectError && (
        <div className="flex items-center gap-2 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-300 dark:border-rose-500/30 text-rose-800 dark:text-rose-300 text-xs font-semibold">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{projectError}</span>
        </div>
      )}

      {/* TAB: APPLICATIONS (Grid OR Active Launched App) */}
      {activeSubTab === "applications" && (
        <div className="space-y-6">
          {activeAppObj ? (
            <div className="space-y-6">
              {/* Active App Header Bar */}
              <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#111115] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => setActiveEcosystemAppId(null)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-400 hover:underline cursor-pointer"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" /> Back to {activeAppObj.category}
                    </button>
                    <span className="text-slate-300 dark:text-zinc-700">/</span>
                    <span className="font-mono text-xs text-slate-500 dark:text-zinc-400">{activeAppObj.category}</span>
                    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${getAvailabilityTextClass(activeAppObj.availability)}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${getAvailabilityDotClass(activeAppObj.availability)}`} />
                      {activeAppObj.availability}
                    </span>
                  </div>
                  <h2 className="text-xl font-extrabold text-slate-950 dark:text-white">{activeAppObj.name}</h2>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400">{activeAppObj.headline}</p>
                </div>

                {/* Quick App Switcher for Connected Apps */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {activeAppObj.connectedAppIds.slice(0, 3).map((connId) => {
                    const conn = getEcosystemAppById(connId);
                    if (!conn) return null;
                    return (
                      <button
                        key={conn.id}
                        type="button"
                        onClick={() => handleLaunchApp(conn.id)}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-900 text-[11px] font-semibold text-slate-700 dark:text-zinc-300 hover:border-indigo-400 cursor-pointer"
                      >
                        → {conn.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {activeAppObj.id === "demandworks" && <DemandResearchPanel />}

              {/* ProductWorks Special Full Studio */}
              {activeAppObj.id === "productworks" && (
                <ProductWorksEnhancedPanel
                  onNavigateToThreadsWorksLibrary={() => onNavigateToTab("calendar")}
                  onOpenOriginalStudio={onOpenProductWorksStudio}
                />
              )}

              {/* Dedicated Operational Module (if applicable) */}
              {renderOperationalModule(activeAppObj.id)}

              {/* Companion Universal AI Studio (if app has registered AI tools) */}
              {activeAppHasAiTools && (
                <UniversalToolWorkspace
                  key={activeAppObj.id}
                  appId={activeAppObj.id}
                  projects={projects}
                  draftCache={draftCache}
                  onUpdateDraftCache={(id, draft) =>
                    setDraftCache((prev) => ({ ...prev, [id]: draft }))
                  }
                  incomingTransfer={
                    incomingTransfer && incomingTransfer.targetAppId === activeAppObj.id
                      ? incomingTransfer
                      : null
                  }
                  onConsumeTransfer={() => setIncomingTransfer(null)}
                  onTransferToApp={handleTransferToApp}
                  onSendBriefToThreadsWorks={handleSendBriefToThreadsWorks}
                  onProfileSynced={onRefreshProfile}
                />
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
                <div>
                  <h2 className="text-lg font-extrabold text-slate-950 dark:text-white">
                    {activeCategory} ({categoryApps.length} Applications)
                  </h2>
                  <p className="text-xs text-slate-600 dark:text-zinc-400">
                    Launch any application below. Your profile, saved projects, and Shared Intelligence context travel automatically.
                  </p>
                </div>
                <span className="font-mono text-xs text-slate-500 dark:text-zinc-400">
                  20 Total Apps · 3 Permanent Categories
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {categoryApps.map((app) => (
                  <div
                    key={app.id}
                    className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#111115] p-5 flex flex-col justify-between gap-4 hover:border-indigo-400 dark:hover:border-indigo-500/60 transition-colors"
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                          {app.category}
                        </span>
                        <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold ${getAvailabilityTextClass(app.availability)}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${getAvailabilityDotClass(app.availability)}`} />
                          {app.availability}
                        </span>
                      </div>

                      <div>
                        <h3 className="text-base font-bold text-slate-950 dark:text-white">{app.name}</h3>
                        <p className="text-xs font-medium text-indigo-700 dark:text-indigo-400 mt-0.5">{app.headline}</p>
                      </div>

                      <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                        {app.shortDescription}
                      </p>

                      {app.availabilityNote && (
                        <p className="text-[11px] text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/25 border border-amber-200 dark:border-amber-500/20 rounded-lg px-2.5 py-1.5">
                          {app.availabilityNote}
                        </p>
                      )}
                    </div>

                    <div className="pt-3 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        aria-label={`Launch ${app.name}`}
                        onClick={() => handleLaunchApp(app.id)}
                        className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                          app.id === "threadsworks"
                            ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                            : "bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400 text-white"
                        }`}
                      >
                        {app.id === "threadsworks" ? "Open Studio" : `Launch ${app.name}`}
                        {app.id === "threadsworks" ? <ExternalLink className="h-3.5 w-3.5" /> : <ArrowRight className="h-3.5 w-3.5" />}
                      </button>

                      {draftCache[app.id] && (
                        <span className="font-mono text-[10px] text-indigo-700 dark:text-indigo-400">
                          Draft saved
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB: FIRST SALE ENGINE */}
      {activeSubTab === "first-sale" && (
        <FirstSaleEnginePanel
          onLaunchApp={handleLaunchApp}
          onLaunchThreadsWorks={() => onNavigateToTab("engine")}
        />
      )}

      {/* TAB: CONTENTPAYSUS ACADEMY */}
      {activeSubTab === "academy" && (
        <ContentPaysUsAcademyView
          isAuthenticated={Boolean(user?.uid)}
          onLaunchApp={handleLaunchApp}
        />
      )}

      {/* TAB: SHARED INTELLIGENCE MEMORY */}
      {activeSubTab === "memory" && <SharedIntelligenceMemoryPanel />}

      {/* TAB: SHARED PROJECTS */}
      {activeSubTab === "projects" && (
        <div className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-extrabold text-slate-950 dark:text-white">Shared Creator Projects</h2>
              <p className="text-xs text-slate-600 dark:text-zinc-400">
                Persistent project records shared across every ContentPaysUs application.
              </p>
            </div>
            <button
              type="button"
              aria-label="Create New Ecosystem Project"
              onClick={handleOpenCreateModal}
              className="px-4 py-2.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="h-4 w-4" /> New Project
            </button>
          </div>

          {projectLoadStatus === "loading" ? (
            <div className="flex items-center gap-2 py-8 text-xs text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin text-indigo-600" /> Loading projects...
            </div>
          ) : projectLoadStatus === "permission_denied" ? (
            <div
              role="alert"
              data-projects-state="permission-denied"
              className="rounded-2xl border border-rose-300 dark:border-rose-500/40 bg-rose-50 dark:bg-rose-950/25 p-6 space-y-3"
            >
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <div className="space-y-1.5">
                  <h3 className="text-sm font-bold text-rose-900 dark:text-rose-200">
                    Unable to access Shared Creator Projects — {projectLoadError || "Missing or insufficient permissions."}
                  </h3>
                  <p className="text-xs text-rose-800 dark:text-rose-300 leading-relaxed">
                    Your account is authenticated, but Firestore denied access to the <code className="font-mono">/projects</code> collection on database{" "}
                    <code className="font-mono">{(firebaseConfig as any).firestoreDatabaseId || "(default)"}</code> (project{" "}
                    <code className="font-mono">{firebaseConfig.projectId}</code>). This is a Firestore security rules permission error, not an empty project list.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 pl-8">
                <button
                  type="button"
                  onClick={() => user?.uid && loadProjectsForUid(user.uid)}
                  className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-rose-700 hover:bg-rose-800 text-white cursor-pointer"
                >
                  Retry Loading Projects
                </button>
              </div>
            </div>
          ) : projectLoadStatus === "error" ? (
            <div
              role="alert"
              data-projects-state="load-error"
              className="rounded-2xl border border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-950/25 p-6 space-y-3"
            >
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-amber-950 dark:text-amber-200">
                    Could not retrieve Shared Creator Projects
                  </h3>
                  <p className="text-xs text-amber-900 dark:text-amber-300">
                    {projectLoadError || "A network or database error prevented loading your projects."}
                  </p>
                </div>
              </div>
              <div className="pl-8">
                <button
                  type="button"
                  onClick={() => user?.uid && loadProjectsForUid(user.uid)}
                  className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-amber-700 hover:bg-amber-800 text-white cursor-pointer"
                >
                  Retry Loading Projects
                </button>
              </div>
            </div>
          ) : projects.length === 0 ? (
            <div
              data-projects-state="empty"
              className="rounded-2xl border border-dashed border-slate-300 dark:border-zinc-700 bg-white dark:bg-[#111115] p-10 text-center space-y-3"
            >
              <FolderKanban className="h-8 w-8 text-slate-400 mx-auto" />
              <h3 className="text-sm font-bold text-slate-950 dark:text-white">No projects created yet</h3>
              <p className="text-xs text-slate-600 dark:text-zinc-400 max-w-sm mx-auto">
                Create your first ecosystem project so your offer, product, and content stay aligned across apps.
              </p>
              <button
                type="button"
                onClick={handleOpenCreateModal}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-indigo-600 text-white cursor-pointer inline-flex items-center gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" /> Create Project
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {projects.map((proj) => (
                <div
                  key={proj.id}
                  className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#111115] p-5 flex flex-col justify-between gap-4"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span
                        className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold uppercase ${
                          proj.status === "active"
                            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"
                            : "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400"
                        }`}
                      >
                        {proj.status}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Updated {new Date(proj.updatedAt).toLocaleDateString()}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-slate-950 dark:text-white">{proj.name}</h3>
                    <p className="text-xs font-medium text-indigo-700 dark:text-indigo-400 mt-1">{proj.objective}</p>
                    {proj.description && (
                      <p className="text-xs text-slate-600 dark:text-zinc-400 mt-2">{proj.description}</p>
                    )}
                  </div>
                  <div className="pt-3 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-between">
                    <div className="flex flex-wrap gap-1.5">
                      {proj.associatedAppIds?.map((id) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => handleLaunchApp(id)}
                          className="px-2 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-mono text-[10px] uppercase hover:text-indigo-600 cursor-pointer"
                        >
                          {id}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(proj)}
                        className="text-xs text-indigo-700 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer font-semibold"
                      >
                        <Edit3 className="h-3.5 w-3.5" /> Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleArchive(proj.id, proj.status)}
                        className="text-xs text-slate-600 dark:text-zinc-400 hover:text-slate-950 dark:hover:text-white flex items-center gap-1 cursor-pointer font-semibold"
                      >
                        {proj.status === "archived" ? (
                          <>
                            <RotateCcw className="h-3.5 w-3.5 text-emerald-600" /> Restore
                          </>
                        ) : (
                          <>
                            <Archive className="h-3.5 w-3.5 text-rose-600" /> Archive
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {showProjectModal && (
            <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#111115] p-6 max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-2xl space-y-4">
                <h3 className="text-lg font-bold text-slate-950 dark:text-white">
                  {editingProjectId ? "Edit Ecosystem Project" : "Create Ecosystem Project"}
                </h3>
                {projectError && (
                  <div
                    role="alert"
                    className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-300 dark:border-rose-500/30 text-rose-800 dark:text-rose-300 text-xs font-semibold"
                  >
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{projectError}</span>
                  </div>
                )}
                <form onSubmit={handleSaveProject} className="space-y-3.5">
                  <div>
                    <label
                      htmlFor="project-name-input"
                      className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1"
                    >
                      Project Name (max {PROJECT_NAME_MAX_LENGTH} chars)
                    </label>
                    <input
                      id="project-name-input"
                      type="text"
                      required
                      maxLength={PROJECT_NAME_MAX_LENGTH}
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                      placeholder="e.g. First Digital Playbook Launch"
                      className="w-full rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-[#09090b] px-3 py-2 text-xs text-slate-900 dark:text-zinc-100"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="project-objective-input"
                      className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1"
                    >
                      Primary Objective (max {PROJECT_OBJECTIVE_MAX_LENGTH} chars)
                    </label>
                    <input
                      id="project-objective-input"
                      type="text"
                      maxLength={PROJECT_OBJECTIVE_MAX_LENGTH}
                      value={projectObjective}
                      onChange={(e) => setProjectObjective(e.target.value)}
                      placeholder="e.g. Earn first verified sale from Meta Threads audience"
                      className="w-full rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-[#09090b] px-3 py-2 text-xs text-slate-900 dark:text-zinc-100"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="project-description-input"
                      className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1"
                    >
                      Description (Optional, max {PROJECT_DESCRIPTION_MAX_LENGTH} chars)
                    </label>
                    <textarea
                      id="project-description-input"
                      rows={3}
                      maxLength={PROJECT_DESCRIPTION_MAX_LENGTH}
                      value={projectDescription}
                      onChange={(e) => setProjectDescription(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-[#09090b] p-3 text-xs text-slate-900 dark:text-zinc-100"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                        Associated Applications ({selectedAppIds.length} selected)
                      </label>
                      <span className="text-[11px] text-slate-500 dark:text-zinc-400">
                        Select one or more apps
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-44 overflow-y-auto rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-[#09090b] p-2">
                      {CONTENT_PAYS_US_APPS.map((app) => {
                        const checked = selectedAppIds.includes(app.id);
                        return (
                          <label
                            key={app.id}
                            className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-[11px] font-medium cursor-pointer border transition-colors ${
                              checked
                                ? "bg-indigo-50 dark:bg-indigo-950/40 border-indigo-400 dark:border-indigo-500/60 text-indigo-900 dark:text-indigo-200"
                                : "bg-white dark:bg-[#111115] border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 hover:border-slate-300"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => handleToggleAppSelection(app.id)}
                              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            <span className="truncate">{app.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                  {editingProjectId && (
                    <div>
                      <label
                        htmlFor="project-status-select"
                        className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1"
                      >
                        Status
                      </label>
                      <select
                        id="project-status-select"
                        value={projectStatus}
                        onChange={(e) => setProjectStatus(e.target.value as any)}
                        className="w-full rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-[#09090b] px-3 py-2 text-xs text-slate-900 dark:text-zinc-100"
                      >
                        <option value="active">Active</option>
                        <option value="archived">Archived</option>
                        <option value="completed">Completed</option>
                      </select>
                    </div>
                  )}
                  <div className="pt-3 border-t border-slate-200 dark:border-zinc-800 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowProjectModal(false)}
                      className="px-4 py-2 rounded-lg text-xs font-semibold border border-slate-300 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submittingProject || selectedAppIds.length === 0}
                      className="px-4 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
                    >
                      {submittingProject && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      {editingProjectId ? "Save Changes" : "Create Project"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB: SETTINGS */}
      {activeSubTab === "settings" && (
        <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#111115] p-6 max-w-3xl space-y-5">
          <div>
            <h2 className="text-lg font-extrabold text-slate-950 dark:text-white">Creator Identity &amp; Plan</h2>
            <p className="text-xs text-slate-600 dark:text-zinc-400">
              One shared account, subscription entitlement, and voice profile across all 20 ContentPaysUs applications.
            </p>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-[#0d0d11]">
              <div>
                <div className="text-xs font-bold text-slate-950 dark:text-white">{profile?.email || user?.email}</div>
                <div className="text-[11px] font-mono text-slate-500">UID: {user?.uid}</div>
              </div>
              <span className="px-2.5 py-1 rounded-full font-mono text-[11px] font-bold uppercase bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-500/20">
                {subscriptionStatus || "free"}
              </span>
            </div>
            <div className="flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-[#0d0d11]">
              <div>
                <div className="text-xs font-bold text-slate-950 dark:text-white">Creator Voice, Offer &amp; Business DNA</div>
                <div className="text-xs text-slate-600 dark:text-zinc-400">Shared automatically with ThreadsWorks and all ContentPaysUs AI tools.</div>
              </div>
              <button
                type="button"
                onClick={() => onNavigateToTab("profile")}
                className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer"
              >
                Edit Profile
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
