import React, { useState, useEffect } from "react";
import { 
  Compass, 
  FolderKanban, 
  Layers, 
  Settings, 
  Sparkles, 
  Plus, 
  ExternalLink, 
  CheckCircle2, 
  Archive, 
  RotateCcw,
  Edit3, 
  Trash2, 
  Shield, 
  User, 
  Zap, 
  ArrowRight,
  Bookmark,
  Loader2,
  AlertCircle
} from "lucide-react";
import { db, withTimeout, handleFirestoreError, OperationType } from "../../firebase";
import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { EcosystemProject } from "../../types/sharedProjects";
import { CONTENT_PAYS_US_APPS } from "../../data/contentPaysUsRegistry";

interface ContentPaysUsUnifiedWorkspaceProps {
  user: any;
  profile: any;
  subscriptionStatus: string;
  onNavigateToTab: (tab: string) => void;
  onRefreshProfile: () => void;
}

export function ContentPaysUsUnifiedWorkspace({
  user,
  profile,
  subscriptionStatus,
  onNavigateToTab,
  onRefreshProfile
}: ContentPaysUsUnifiedWorkspaceProps) {
  const [activeSubTab, setActiveSubTab] = useState<"home" | "projects" | "applications" | "settings">("home");
  const [projects, setProjects] = useState<EcosystemProject[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [projectError, setProjectError] = useState<string | null>(null);
  const [projectSuccessMessage, setProjectSuccessMessage] = useState<string | null>(null);
  
  // Project Modal state (Create / Edit)
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState("");
  const [projectObjective, setProjectObjective] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [projectStatus, setProjectStatus] = useState<"active" | "archived" | "completed">("active");
  const [selectedAppId, setSelectedAppId] = useState("threadsworks");
  const [submittingProject, setSubmittingProject] = useState(false);

  // Clear project state immediately when authenticated account changes (prevent stale async leakage)
  useEffect(() => {
    if (!user || !user.uid) {
      setProjects([]);
      setLoadingProjects(false);
      return;
    }

    let isMounted = true;
    const fetchProjects = async () => {
      setLoadingProjects(true);
      setProjectError(null);
      try {
        const q = query(collection(db, "projects"), where("userId", "==", user.uid));
        const snapshot = await withTimeout(getDocs(q), 5000, true);
        if (!isMounted) return; // Ignore stale asynchronous results if user changed
        
        const list: EcosystemProject[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...docSnap.data() } as EcosystemProject);
        });
        list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        setProjects(list);
      } catch (err: any) {
        if (!isMounted) return;
        console.warn("Failed to load ecosystem projects:", err);
        setProjectError("Could not load projects. Please check your connection.");
      } finally {
        if (isMounted) setLoadingProjects(false);
      }
    };

    fetchProjects();

    return () => {
      isMounted = false;
    };
  }, [user?.uid]);

  const handleOpenCreateModal = () => {
    setEditingProjectId(null);
    setProjectName("");
    setProjectObjective("");
    setProjectDescription("");
    setProjectStatus("active");
    setSelectedAppId("threadsworks");
    setProjectError(null);
    setShowProjectModal(true);
  };

  const handleOpenEditModal = (proj: EcosystemProject) => {
    setEditingProjectId(proj.id);
    setProjectName(proj.name);
    setProjectObjective(proj.objective);
    setProjectDescription(proj.description || "");
    setProjectStatus(proj.status);
    setSelectedAppId(proj.associatedAppIds?.[0] || "threadsworks");
    setProjectError(null);
    setShowProjectModal(true);
  };

  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !projectName.trim()) return;
    setSubmittingProject(true);
    setProjectError(null);
    setProjectSuccessMessage(null);

    try {
      const now = new Date().toISOString();
      if (editingProjectId) {
        // Edit existing project
        const projRef = doc(db, "projects", editingProjectId);
        const payload = {
          name: projectName.trim(),
          objective: projectObjective.trim() || "Grow creator brand and monetize knowledge",
          description: projectDescription.trim(),
          status: projectStatus,
          associatedAppIds: [selectedAppId],
          updatedAt: now
        };
        await withTimeout(updateDoc(projRef, payload), 4000, true);
        setProjects(projects.map(p => p.id === editingProjectId ? { ...p, ...payload } : p));
        setProjectSuccessMessage("Project updated successfully.");
      } else {
        // Create new project
        const payload = {
          userId: user.uid,
          name: projectName.trim(),
          objective: projectObjective.trim() || "Grow creator brand and monetize knowledge",
          description: projectDescription.trim(),
          status: "active" as const,
          associatedAppIds: [selectedAppId],
          createdAt: now,
          updatedAt: now
        };
        const docRef = await withTimeout(addDoc(collection(db, "projects"), payload), 4000, true);
        const newProj = { id: docRef.id, ...payload };
        setProjects([newProj, ...projects]);
        setProjectSuccessMessage("Project created successfully.");
      }
      setShowProjectModal(false);
      setTimeout(() => setProjectSuccessMessage(null), 4000);
    } catch (err: any) {
      console.error("Error saving project:", err);
      setProjectError(err?.message || "Failed to save project due to security rules or network error.");
    } finally {
      setSubmittingProject(false);
    }
  };

  const handleToggleArchive = async (projectId: string, currentStatus: string) => {
    const nextStatus = currentStatus === "archived" ? "active" : "archived";
    setProjectError(null);
    try {
      const projRef = doc(db, "projects", projectId);
      const now = new Date().toISOString();
      await withTimeout(updateDoc(projRef, { status: nextStatus, updatedAt: now }), 4000, true);
      setProjects(projects.map(p => p.id === projectId ? { ...p, status: nextStatus, updatedAt: now } : p));
      setProjectSuccessMessage(nextStatus === "active" ? "Project restored to active." : "Project archived.");
      setTimeout(() => setProjectSuccessMessage(null), 3000);
    } catch (err: any) {
      console.warn("Failed to update project status:", err);
      setProjectError("Failed to update project status.");
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      
      {/* Ecosystem Unified Header */}
      <div className="rounded-3xl border border-slate-800 bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 p-6 sm:p-8 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 text-xs font-semibold mb-3">
            <Sparkles className="h-3.5 w-3.5" />
            <span>ContentPaysUs Unified Workspace</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-2">
            Welcome back, {profile?.email || user?.email || "Creator"}
          </h1>
          <p className="text-xs sm:text-sm text-slate-300">
            Manage your shared creator identity, ecosystem projects, and specialized applications from one hub.
          </p>
        </div>

        {/* Primary Ecosystem Navigation Tabs */}
        <div className="flex flex-wrap gap-1.5 bg-slate-950/80 border border-slate-800 p-1.5 rounded-2xl">
          {[
            { id: "home", label: "Home", icon: Compass },
            { id: "projects", label: "Projects", icon: FolderKanban },
            { id: "applications", label: "Applications", icon: Layers },
            { id: "settings", label: "Settings", icon: Settings }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                role="button"
                aria-label={`Navigate to ${tab.label}`}
                onClick={() => setActiveSubTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  isActive
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
                    : "text-slate-400 hover:text-white hover:bg-slate-900"
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Success / Error Notification Banners */}
      {projectSuccessMessage && (
        <div className="flex items-center gap-2 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{projectSuccessMessage}</span>
        </div>
      )}

      {projectError && (
        <div className="flex items-center gap-2 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{projectError}</span>
        </div>
      )}

      {/* Tab 1: Home Dashboard */}
      {activeSubTab === "home" && (
        <div className="space-y-8 animate-fade-in">
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* ThreadsWorks Quick Launch */}
            <div className="rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-slate-900 to-emerald-950/20 p-6 flex flex-col justify-between shadow-xl">
              <div>
                <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-bold border border-emerald-500/20 mb-4 inline-block">
                  Flagship App
                </span>
                <h3 className="text-xl font-bold text-white mb-2">ThreadsWorks Studio</h3>
                <p className="text-xs text-slate-300 leading-relaxed mb-6">
                  Draft AI Threads posts, develop stronger hooks, and manage your content calendar.
                </p>
              </div>
              <button
                role="button"
                aria-label="Launch ThreadsWorks Content Engine"
                onClick={() => onNavigateToTab("engine")}
                className="w-full py-3 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 cursor-pointer"
              >
                Launch ThreadsWorks <ExternalLink className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* ProductWorks Quick Launch */}
            <div className="rounded-3xl border border-indigo-500/30 bg-gradient-to-br from-slate-900 to-indigo-950/20 p-6 flex flex-col justify-between shadow-xl">
              <div>
                <span className="px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-300 text-xs font-bold border border-indigo-500/20 mb-4 inline-block">
                  In Development
                </span>
                <h3 className="text-xl font-bold text-white mb-2">ProductWorks</h3>
                <p className="text-xs text-slate-300 leading-relaxed mb-6">
                  Create downloadable PDF playbooks, 7-slide social carousels, and storefront sales copy.
                </p>
              </div>
              <button
                role="button"
                aria-label="Launch ProductWorks Digital Product Generator"
                onClick={() => {
                  if (typeof window !== "undefined") {
                    window.location.href = "/productworks";
                  }
                }}
                className="w-full py-3 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2 cursor-pointer"
              >
                Launch ProductWorks <ExternalLink className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Ecosystem Projects Summary */}
            <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 flex flex-col justify-between shadow-xl">
              <div>
                <span className="px-3 py-1 rounded-full bg-purple-500/10 text-purple-400 text-xs font-bold border border-purple-500/20 mb-4 inline-block">
                  Active Projects
                </span>
                <h3 className="text-xl font-bold text-white mb-2">{projects.filter(p => p.status === "active").length} Projects</h3>
                <p className="text-xs text-slate-300 leading-relaxed mb-6">
                  Manage your shared creator projects across the ContentPaysUs ecosystem.
                </p>
              </div>
              <button
                role="button"
                aria-label="Manage Ecosystem Projects"
                onClick={() => setActiveSubTab("projects")}
                className="w-full py-3 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center justify-center gap-2 cursor-pointer"
              >
                View Projects <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>

          </div>

        </div>
      )}

      {/* Tab 2: Shared Projects */}
      {activeSubTab === "projects" && (
        <div className="space-y-6 animate-fade-in">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-white">Shared Creator Projects</h2>
              <p className="text-xs text-slate-400">Persistent project records referenced across ecosystem applications.</p>
            </div>
            <button
              role="button"
              aria-label="Create New Ecosystem Project"
              onClick={handleOpenCreateModal}
              className="px-5 py-3 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 flex items-center gap-2 cursor-pointer"
            >
              <Plus className="h-4 w-4" /> New Project
            </button>
          </div>

          {/* Project List */}
          {loadingProjects ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="h-6 w-6 text-indigo-400 animate-spin" />
              <span className="text-xs text-slate-400 font-medium">Loading ecosystem projects...</span>
            </div>
          ) : projects.length === 0 ? (
            <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-12 text-center space-y-4">
              <FolderKanban className="h-10 w-10 text-slate-600 mx-auto" />
              <h3 className="text-sm font-bold text-white">No projects created yet</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">Create your first ecosystem project to organize your brand objectives and associated applications.</p>
              <button
                role="button"
                aria-label="Create Your First Project"
                onClick={handleOpenCreateModal}
                className="px-4 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 text-white cursor-pointer inline-flex items-center gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" /> Create Project
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {projects.map((proj) => (
                <div key={proj.id} className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 flex flex-col justify-between shadow-xl">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className={`px-2.5 py-0.5 rounded text-[11px] font-bold uppercase ${
                        proj.status === "active" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-slate-800 text-slate-400"
                      }`}>
                        {proj.status}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Updated {new Date(proj.updatedAt).toLocaleDateString()}
                      </span>
                    </div>

                    <h3 className="text-lg font-bold text-white mb-2">{proj.name}</h3>
                    <p className="text-xs font-medium text-indigo-300 mb-2">{proj.objective}</p>
                    {proj.description && (
                      <p className="text-xs text-slate-300 mb-4">{proj.description}</p>
                    )}
                  </div>

                  <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      {proj.associatedAppIds?.map(appId => (
                        <span key={appId} className="px-2 py-1 rounded bg-slate-800 text-slate-300 text-[10px] font-semibold uppercase">
                          {appId}
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        role="button"
                        aria-label={`Edit project ${proj.name}`}
                        onClick={() => handleOpenEditModal(proj)}
                        className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer font-semibold"
                      >
                        <Edit3 className="h-3.5 w-3.5" /> Edit
                      </button>
                      <button
                        role="button"
                        aria-label={`${proj.status === "archived" ? "Restore" : "Archive"} project ${proj.name}`}
                        onClick={() => handleToggleArchive(proj.id, proj.status)}
                        className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 cursor-pointer font-semibold"
                      >
                        {proj.status === "archived" ? (
                          <>
                            <RotateCcw className="h-3.5 w-3.5 text-emerald-400" /> Restore
                          </>
                        ) : (
                          <>
                            <Archive className="h-3.5 w-3.5 text-rose-400" /> Archive
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Project Modal (Create & Edit) */}
          {showProjectModal && (
            <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="rounded-3xl border border-slate-800 bg-slate-900 p-8 max-w-lg w-full shadow-2xl space-y-6">
                <h3 className="text-lg font-bold text-white">
                  {editingProjectId ? "Edit Ecosystem Project" : "Create Ecosystem Project"}
                </h3>
                <form onSubmit={handleSaveProject} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Project Name (max 100 chars)</label>
                    <input
                      type="text"
                      required
                      maxLength={100}
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                      placeholder="e.g. Q4 Creator Knowledge Monetization"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Primary Objective (max 200 chars)</label>
                    <input
                      type="text"
                      maxLength={200}
                      value={projectObjective}
                      onChange={(e) => setProjectObjective(e.target.value)}
                      placeholder="e.g. Launch PDF playbook and grow Threads audience"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Description (Optional)</label>
                    <textarea
                      value={projectDescription}
                      onChange={(e) => setProjectDescription(e.target.value)}
                      placeholder="Brief notes or scope..."
                      rows={3}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">Primary Associated App</label>
                      <select
                        value={selectedAppId}
                        onChange={(e) => setSelectedAppId(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                      >
                        <option value="threadsworks">ThreadsWorks (Attention)</option>
                        <option value="productworks">ProductWorks (Monetization)</option>
                        <option value="creatorworks">CreatorWorks (Foundation)</option>
                        <option value="offerworks">OfferWorks (Monetization)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">Status</label>
                      <select
                        value={projectStatus}
                        onChange={(e) => setProjectStatus(e.target.value as any)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                      >
                        <option value="active">Active</option>
                        <option value="archived">Archived</option>
                        <option value="completed">Completed</option>
                      </select>
                    </div>
                  </div>
                  <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
                    <button
                      type="button"
                      role="button"
                      aria-label="Cancel project operation"
                      onClick={() => setShowProjectModal(false)}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 text-slate-300 hover:bg-slate-700 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      role="button"
                      aria-label="Save ecosystem project"
                      disabled={submittingProject}
                      className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30 cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
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

      {/* Tab 3: Applications Directory (All 16 Apps) */}
      {activeSubTab === "applications" && (
        <div className="space-y-6 animate-fade-in">
          <div>
            <h2 className="text-xl font-bold text-white">Ecosystem Applications Directory</h2>
            <p className="text-xs text-slate-400">All 16 specialized applications across foundation, attention, monetization, success, and expansion.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {CONTENT_PAYS_US_APPS.map((app) => (
              <div key={app.id} className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 flex flex-col justify-between shadow-xl">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${app.badgeColor}`}>
                      {app.availability}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-400 uppercase">{app.category}</span>
                  </div>

                  <h3 className="text-lg font-bold text-white mb-2">{app.name}</h3>
                  <p className="text-xs font-medium text-indigo-300 mb-2">{app.headline}</p>
                  <p className="text-xs text-slate-300 leading-relaxed mb-6">{app.shortDescription}</p>
                </div>

                <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between">
                  {app.id === "threadsworks" ? (
                    <button
                      role="button"
                      aria-label="Launch ThreadsWorks App"
                      onClick={() => onNavigateToTab("engine")}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 cursor-pointer"
                    >
                      Launch Workspace <ExternalLink className="h-3 w-3" />
                    </button>
                  ) : app.id === "productworks" ? (
                    <button
                      role="button"
                      aria-label="Launch ProductWorks App"
                      onClick={() => {
                        if (typeof window !== "undefined") {
                          window.location.href = "/productworks";
                        }
                      }}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-1.5 cursor-pointer"
                    >
                      Launch ProductWorks <ExternalLink className="h-3 w-3" />
                    </button>
                  ) : (
                    <span className="text-[11px] font-semibold text-slate-500">Planned Ecosystem Tool</span>
                  )}
                  <button
                    role="button"
                    aria-label={`View details for ${app.name}`}
                    onClick={() => {
                      if (typeof window !== "undefined") {
                        window.location.href = `/applications/${app.id}`;
                      }
                    }}
                    className="text-xs font-semibold text-indigo-400 hover:underline cursor-pointer"
                  >
                    View Details
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 4: Settings & Profile */}
      {activeSubTab === "settings" && (
        <div className="space-y-6 animate-fade-in max-w-3xl">
          <div>
            <h2 className="text-xl font-bold text-white">Creator Identity & Settings</h2>
            <p className="text-xs text-slate-400">Manage your shared creator profile, subscription entitlement, and connected accounts.</p>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-8 space-y-6 shadow-xl">
            <div className="flex items-center gap-4 pb-6 border-b border-slate-800">
              <div className="h-12 w-12 rounded-2xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center font-bold text-lg">
                {(profile?.email || user?.email || "C")[0].toUpperCase()}
              </div>
              <div>
                <h3 className="text-base font-bold text-white">{profile?.email || user?.email}</h3>
                <span className="text-xs text-slate-400 font-mono">UID: {user?.uid}</span>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-950 border border-slate-800">
                <div>
                  <div className="text-xs font-bold text-white mb-0.5">Subscription Status</div>
                  <div className="text-xs text-slate-400">Current plan entitlement across ecosystem apps</div>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                  subscriptionStatus === "active" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-slate-800 text-slate-300"
                }`}>
                  {subscriptionStatus}
                </span>
              </div>

              <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-950 border border-slate-800">
                <div>
                  <div className="text-xs font-bold text-white mb-0.5">Creator Voice & Offer</div>
                  <div className="text-xs text-slate-400">Synchronized shared identity profile</div>
                </div>
                <button
                  role="button"
                  aria-label="Navigate to Profile Settings"
                  onClick={() => onNavigateToTab("profile")}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 text-slate-200 hover:bg-slate-700 cursor-pointer"
                >
                  Edit Profile
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
