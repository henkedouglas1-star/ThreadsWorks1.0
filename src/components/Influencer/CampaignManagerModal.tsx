import React, { useState, useEffect } from "react";
import { CampaignFolder, OutreachObjective } from "../../types/influencer";
import { getCampaignsApi, createCampaignApi } from "../../utils/influencerApi";
import {
  X,
  FolderPlus,
  Folder,
  Sparkles,
  Plus,
  Check,
  Target,
  Layers,
} from "lucide-react";

interface CampaignManagerModalProps {
  userId: string;
  onClose: () => void;
  onSelectCampaign?: (campaignName: string) => void;
}

export default function CampaignManagerModal({
  userId,
  onClose,
  onSelectCampaign,
}: CampaignManagerModalProps) {
  const [campaigns, setCampaigns] = useState<CampaignFolder[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [showCreate, setShowCreate] = useState<boolean>(false);

  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newObj, setNewObj] = useState<OutreachObjective>("collaboration");
  const [isSaving, setIsSaving] = useState(false);

  const fetchCampaigns = async () => {
    setIsLoading(true);
    try {
      const res = await getCampaignsApi(userId);
      if (res.success && res.campaigns) {
        setCampaigns(res.campaigns);
      }
    } catch (err) {
      console.error("[CampaignManagerModal] Error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, [userId]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setIsSaving(true);
    try {
      const res = await createCampaignApi(userId, newName.trim(), newDesc, newObj);
      if (res.success && res.campaign) {
        setCampaigns((prev) => [res.campaign!, ...prev]);
        setNewName("");
        setNewDesc("");
        setShowCreate(false);
      }
    } catch (err) {
      console.error("[CampaignManagerModal] Create failed:", err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-bg-card border border-border-primary rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-primary px-6 py-4 bg-bg-sidebar/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
              <Folder className="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <h2 className="text-base font-bold text-text-primary">Outreach Campaign Folders</h2>
              <p className="text-xs text-text-secondary">Group and track creators by campaign objective and launch focus</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-text-muted hover:text-text-primary hover:bg-bg-card-hover transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary">
              Active Campaigns ({campaigns.length})
            </h3>
            <button
              onClick={() => setShowCreate(!showCreate)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition shadow-md shadow-purple-600/20 cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Create Campaign Folder
            </button>
          </div>

          {/* Create Form */}
          {showCreate && (
            <div className="p-4 rounded-xl bg-bg-sidebar border border-purple-500/30 space-y-3">
              <h4 className="text-xs font-bold text-purple-600 dark:text-purple-300">New Campaign Folder</h4>
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Campaign Name (e.g., Q4 Product Launch)"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-bg-card border border-border-primary text-xs text-text-primary focus:outline-none focus:border-purple-500"
                />
                <input
                  type="text"
                  placeholder="Brief Description or Target Outcome"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-bg-card border border-border-primary text-xs text-text-primary focus:outline-none focus:border-purple-500"
                />
                <div className="flex items-center gap-2">
                  <span className="text-xs text-text-muted">Target Objective:</span>
                  <select
                    value={newObj}
                    onChange={(e) => setNewObj(e.target.value as OutreachObjective)}
                    className="px-2.5 py-1.5 rounded-lg bg-bg-card border border-border-primary text-xs text-text-primary focus:outline-none focus:border-purple-500"
                  >
                    <option value="collaboration">Co-Creation / Collaboration</option>
                    <option value="podcast_interview">Podcast Interview</option>
                    <option value="affiliate_partnership">Affiliate Partnership</option>
                    <option value="promotion">Product Promotion</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setShowCreate(false)}
                  className="px-3 py-1.5 rounded-lg text-xs text-text-muted hover:text-text-primary"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={isSaving || !newName.trim()}
                  className="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition"
                >
                  {isSaving ? "Creating..." : "Save Campaign"}
                </button>
              </div>
            </div>
          )}

          {/* Campaign List */}
          {isLoading ? (
            <div className="py-12 text-center text-xs text-text-muted">Loading campaigns...</div>
          ) : campaigns.length === 0 ? (
            <div className="py-12 text-center text-xs text-text-muted">No campaigns created yet.</div>
          ) : (
            <div className="space-y-3">
              {campaigns.map((camp) => (
                <div
                  key={camp.id}
                  className="p-4 rounded-xl bg-bg-card border border-border-primary hover:border-purple-500/30 transition flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
                      <Folder className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-text-primary">{camp.name}</h4>
                      <p className="text-[11px] text-text-secondary">{camp.description || "No description provided."}</p>
                    </div>
                  </div>

                  {onSelectCampaign && (
                    <button
                      onClick={() => {
                        onSelectCampaign(camp.name);
                        onClose();
                      }}
                      className="px-3 py-1.5 rounded-lg bg-bg-card-hover border border-border-primary text-text-primary hover:text-purple-600 text-xs font-semibold transition cursor-pointer"
                    >
                      Filter by Campaign
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border-primary bg-bg-sidebar/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-bg-card-hover border border-border-primary text-text-primary text-xs font-bold"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function FolderFolder(props: any) {
  return <Folder {...props} />;
}
