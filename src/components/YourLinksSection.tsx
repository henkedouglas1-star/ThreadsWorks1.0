import React, { useState } from "react";
import { Link as LinkIcon, Plus, Trash2, Edit3, ExternalLink, AlertCircle, CheckCircle2, X } from "lucide-react";
import { ContentDestination } from "../types";

interface YourLinksSectionProps {
  destinations: ContentDestination[];
  onChangeDestinations: (destinations: ContentDestination[]) => void;
  disabled?: boolean;
}

export const YourLinksSection: React.FC<YourLinksSectionProps> = ({
  destinations = [],
  onChangeDestinations,
  disabled = false
}) => {
  // Add state
  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [purpose, setPurpose] = useState("");
  const [addError, setAddError] = useState<string | null>(null);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [editPurpose, setEditPurpose] = useState("");
  const [editError, setEditError] = useState<string | null>(null);

  // Delete confirmation state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Helper to validate and normalize URL
  const validateAndNormalizeUrl = (inputUrl: string): { isValid: boolean; normalizedUrl: string; error?: string } => {
    let trimmed = inputUrl.trim();
    if (!trimmed) {
      return { isValid: false, normalizedUrl: "", error: "Please enter a destination URL." };
    }

    // Auto-prefix https:// if missing protocol
    if (!/^https?:\/\//i.test(trimmed)) {
      trimmed = `https://${trimmed}`;
    }

    try {
      const parsed = new URL(trimmed);
      // Ensure it has a valid hostname with at least one dot (e.g. domain.com) or localhost
      if (!parsed.hostname || (!parsed.hostname.includes(".") && parsed.hostname !== "localhost")) {
        return { isValid: false, normalizedUrl: "", error: "Please enter a valid web domain (e.g. https://yourwebsite.com)." };
      }
      return { isValid: true, normalizedUrl: parsed.toString() };
    } catch {
      return { isValid: false, normalizedUrl: "", error: "Invalid URL format. Please enter a valid URL." };
    }
  };

  const handleStartAdd = () => {
    setIsAdding(true);
    setName("");
    setUrl("");
    setPurpose("");
    setAddError(null);
  };

  const handleCancelAdd = () => {
    setIsAdding(false);
    setName("");
    setUrl("");
    setPurpose("");
    setAddError(null);
  };

  const handleSaveNewLink = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setAddError(null);

    const cleanName = name.trim();
    if (!cleanName) {
      setAddError("Please enter a link name.");
      return;
    }

    const urlResult = validateAndNormalizeUrl(url);
    if (!urlResult.isValid) {
      setAddError(urlResult.error || "Please enter a valid destination URL.");
      return;
    }

    // Check for duplicate URL
    const isDuplicate = destinations.some(d => d.url.toLowerCase() === urlResult.normalizedUrl.toLowerCase());
    if (isDuplicate) {
      setAddError("A link with this destination URL already exists.");
      return;
    }

    const newLink: ContentDestination = {
      id: `link_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: cleanName,
      url: urlResult.normalizedUrl,
      purpose: purpose.trim() || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    onChangeDestinations([...destinations, newLink]);
    setIsAdding(false);
    setName("");
    setUrl("");
    setPurpose("");
    setAddError(null);
  };

  const handleStartEdit = (link: ContentDestination) => {
    setEditingId(link.id);
    setEditName(link.name);
    setEditUrl(link.url);
    setEditPurpose(link.purpose || "");
    setEditError(null);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditName("");
    setEditUrl("");
    setEditPurpose("");
    setEditError(null);
  };

  const handleSaveEdit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!editingId) return;
    setEditError(null);

    const cleanName = editName.trim();
    if (!cleanName) {
      setEditError("Please enter a link name.");
      return;
    }

    const urlResult = validateAndNormalizeUrl(editUrl);
    if (!urlResult.isValid) {
      setEditError(urlResult.error || "Please enter a valid destination URL.");
      return;
    }

    // Check duplicate URL against other links
    const isDuplicate = destinations.some(d => d.id !== editingId && d.url.toLowerCase() === urlResult.normalizedUrl.toLowerCase());
    if (isDuplicate) {
      setEditError("A link with this destination URL already exists.");
      return;
    }

    const updated = destinations.map(d => {
      if (d.id === editingId) {
        return {
          ...d,
          name: cleanName,
          url: urlResult.normalizedUrl,
          purpose: editPurpose.trim() || undefined,
          updatedAt: new Date().toISOString()
        };
      }
      return d;
    });

    onChangeDestinations(updated);
    setEditingId(null);
    setEditName("");
    setEditUrl("");
    setEditPurpose("");
    setEditError(null);
  };

  const handleDelete = (id: string) => {
    const updated = destinations.filter(d => d.id !== id);
    onChangeDestinations(updated);
    setDeletingId(null);
  };

  return (
    <div className="rounded-3xl border border-border-primary bg-bg-card p-6 md:p-8 space-y-6 shadow-sm" id="your-links-section">
      {/* Header & Subtitle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border-primary">
        <div>
          <div className="flex items-center gap-2">
            <LinkIcon className="h-5 w-5 text-brand-text" />
            <h2 className="text-base md:text-lg font-bold text-text-primary font-display">
              Your Links
            </h2>
          </div>
          <p className="text-xs text-text-muted mt-1 leading-relaxed max-w-2xl">
            Save the links, offers, and destinations ThreadsWorks can use when creating content and calls to action.
          </p>
        </div>

        {!isAdding && (
          <button
            type="button"
            onClick={handleStartAdd}
            disabled={disabled}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md shadow-purple-500/20 transition cursor-pointer disabled:opacity-50 shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>Add Link</span>
          </button>
        )}
      </div>

      {/* Add Link Form */}
      {isAdding && (
        <form onSubmit={handleSaveNewLink} className="p-5 rounded-2xl border border-brand-border bg-brand-surface space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-brand-text-strong font-mono">
              Add New Link
            </h3>
            <button
              type="button"
              onClick={handleCancelAdd}
              className="text-text-muted hover:text-text-primary p-1 rounded-lg transition"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {addError && (
            <div className="p-3 rounded-xl bg-status-danger-bg border border-status-danger-border text-status-danger-text text-xs font-medium flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{addError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary">
                Link Name <span className="text-status-danger-text">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Primary Offer, Booking Page, Lead Magnet"
                className="w-full rounded-xl border border-border-primary bg-bg-input px-3.5 py-2.5 text-xs text-text-primary placeholder-text-muted outline-none focus:border-purple-500 transition"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary">
                URL <span className="text-status-danger-text">*</span>
              </label>
              <input
                type="text"
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="e.g. https://yourwebsite.com/offer"
                className="w-full rounded-xl border border-border-primary bg-bg-input px-3.5 py-2.5 text-xs text-text-primary placeholder-text-muted outline-none focus:border-purple-500 transition"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text-secondary">
              Purpose / Description <span className="text-text-muted font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              value={purpose}
              onChange={e => setPurpose(e.target.value)}
              placeholder="e.g. 1-on-1 strategy call booking, Free newsletter sign-up"
              className="w-full rounded-xl border border-border-primary bg-bg-input px-3.5 py-2.5 text-xs text-text-primary placeholder-text-muted outline-none focus:border-purple-500 transition"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={handleCancelAdd}
              className="px-4 py-2 rounded-xl border border-border-primary text-xs font-bold text-text-secondary hover:text-text-primary transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition cursor-pointer"
            >
              Save Link
            </button>
          </div>
        </form>
      )}

      {/* Saved Links List or Empty State */}
      {destinations.length === 0 && !isAdding ? (
        <div className="p-8 rounded-2xl border border-dashed border-border-primary bg-bg-app text-center space-y-3">
          <div className="w-10 h-10 rounded-full bg-brand-surface text-brand-text flex items-center justify-center mx-auto border border-brand-border">
            <LinkIcon className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-text-primary">No links saved yet.</h3>
            <p className="text-xs text-text-muted mt-1">Add the destinations ThreadsWorks can use when relevant.</p>
          </div>
          <button
            type="button"
            onClick={handleStartAdd}
            disabled={disabled}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-surface hover:bg-brand-surface-hover border border-brand-border text-brand-text-strong font-bold text-xs transition cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Your First Link</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {destinations.map(link => {
            const isEditing = editingId === link.id;

            if (isEditing) {
              return (
                <form key={link.id} onSubmit={handleSaveEdit} className="p-4 rounded-2xl border border-brand-border bg-brand-surface space-y-3 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-brand-text-strong font-mono">
                      Edit Link
                    </span>
                    <button type="button" onClick={handleCancelEdit} className="text-text-muted hover:text-text-primary p-1">
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  {editError && (
                    <div className="p-2.5 rounded-xl bg-status-danger-bg border border-status-danger-border text-status-danger-text text-xs font-medium flex items-center gap-2">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      <span>{editError}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input
                      type="text"
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      placeholder="Link Name"
                      className="w-full rounded-xl border border-border-primary bg-bg-input px-3.5 py-2 text-xs text-text-primary outline-none focus:border-purple-500"
                    />
                    <input
                      type="text"
                      value={editUrl}
                      onChange={e => setEditUrl(e.target.value)}
                      placeholder="URL"
                      className="w-full rounded-xl border border-border-primary bg-bg-input px-3.5 py-2 text-xs text-text-primary outline-none focus:border-purple-500"
                    />
                  </div>

                  <input
                    type="text"
                    value={editPurpose}
                    onChange={e => setEditPurpose(e.target.value)}
                    placeholder="Purpose / Description (Optional)"
                    className="w-full rounded-xl border border-border-primary bg-bg-input px-3.5 py-2 text-xs text-text-primary outline-none focus:border-purple-500"
                  />

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="px-3.5 py-1.5 rounded-xl border border-border-primary text-xs font-bold text-text-secondary hover:text-text-primary"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs"
                    >
                      Save Changes
                    </button>
                  </div>
                </form>
              );
            }

            return (
              <div
                key={link.id}
                className="p-4 rounded-2xl border border-border-primary bg-bg-app hover:border-border-primary/80 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-text-primary truncate">
                      {link.name}
                    </span>
                    {link.purpose && (
                      <span className="px-2 py-0.5 rounded-md bg-brand-surface border border-brand-border text-brand-text-strong text-[10px] font-mono font-semibold truncate max-w-xs">
                        {link.purpose}
                      </span>
                    )}
                  </div>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-brand-text hover:text-brand-text-strong font-mono flex items-center gap-1 truncate transition max-w-full"
                  >
                    <span className="truncate">{link.url}</span>
                    <ExternalLink className="h-3 w-3 shrink-0" />
                  </a>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  <button
                    type="button"
                    onClick={() => handleStartEdit(link)}
                    disabled={disabled}
                    className="p-2 rounded-xl border border-border-primary bg-bg-card hover:bg-bg-card-hover text-text-secondary hover:text-text-primary transition cursor-pointer"
                    title="Edit Link"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                  </button>

                  {deletingId === link.id ? (
                    <div className="flex items-center gap-1.5 animate-fade-in">
                      <span className="text-[10px] text-status-danger-text font-bold">Confirm delete?</span>
                      <button
                        type="button"
                        onClick={() => handleDelete(link.id)}
                        className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold transition"
                      >
                        Yes
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingId(null)}
                        className="px-2 py-1 rounded-lg border border-border-primary text-text-secondary hover:text-text-primary text-[10px] font-bold transition"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setDeletingId(link.id)}
                      disabled={disabled}
                      className="p-2 rounded-xl border border-border-primary bg-bg-card hover:bg-status-danger-bg hover:border-status-danger-border text-text-secondary hover:text-status-danger-text transition cursor-pointer"
                      title="Delete Link"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default YourLinksSection;
