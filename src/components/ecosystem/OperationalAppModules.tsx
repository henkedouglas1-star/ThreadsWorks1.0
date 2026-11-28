import React, { useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  Brain,
  Calendar,
  CheckCircle2,
  Download,
  Flag,
  Heart,
  Link2,
  Loader2,
  MessageSquare,
  Package,
  Play,
  Plus,
  Repeat2,
  Send,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Store,
  Trash2,
  Users,
  Video,
  Wallet
} from "lucide-react";
import { ecosystemFetch, exportInvoiceHtml, exportStructuredAsset } from "../../services/ecosystemClient";
import type { ToolTransferPayload } from "./UniversalToolWorkspace";

const CARD_CLS =
  "rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#111115] p-5 sm:p-6 space-y-4";
const INPUT_CLS =
  "w-full rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-[#09090b] px-3 py-2 text-xs sm:text-sm text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-indigo-500";
const BTN_PRIMARY =
  "inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400 text-white transition-colors cursor-pointer disabled:opacity-50";
const BTN_SECONDARY =
  "inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-800 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer disabled:opacity-50";

function formatCents(cents: number): string {
  return `$${((cents || 0) / 100).toFixed(2)}`;
}

// =========================================================================
// 1. SALESWORKS CRM MODULE
// =========================================================================
export function SalesWorksCrmModule({
  onTransferToApp
}: {
  onTransferToApp?: (payload: ToolTransferPayload) => void;
}) {
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [handle, setHandle] = useState("");
  const [offerInterest, setOfferInterest] = useState("");
  const [dealDollars, setDealDollars] = useState("");
  const [stage, setStage] = useState("lead");
  const [nextAction, setNextAction] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await ecosystemFetch<{ contacts: any[] }>("/api/ecosystem/crm/contacts");
      setContacts(data.contacts || []);
    } catch (err: any) {
      setError(err?.message || "Could not load CRM contacts.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const data = await ecosystemFetch<{ contact: any }>("/api/ecosystem/crm/contacts", {
        method: "POST",
        body: {
          name: name.trim(),
          email: email.trim(),
          handle: handle.trim(),
          offerInterest: offerInterest.trim(),
          dealValueCents: Math.round((Number(dealDollars) || 0) * 100),
          stage,
          nextAction: nextAction.trim()
        }
      });
      setContacts((prev) => [data.contact, ...prev]);
      setName("");
      setEmail("");
      setHandle("");
      setOfferInterest("");
      setDealDollars("");
      setNextAction("");
    } catch (err: any) {
      setError(err?.message || "Failed to save contact.");
    } finally {
      setSaving(false);
    }
  };

  const updateStage = async (id: string, nextStage: string) => {
    try {
      const data = await ecosystemFetch<{ contact: any }>(`/api/ecosystem/crm/contacts/${id}`, {
        method: "PUT",
        body: { stage: nextStage }
      });
      setContacts((prev) => prev.map((c) => (c.id === id ? data.contact : c)));
    } catch (err: any) {
      setError(err?.message || "Failed to update stage.");
    }
  };

  const remove = async (id: string) => {
    try {
      await ecosystemFetch(`/api/ecosystem/crm/contacts/${id}`, { method: "DELETE" });
      setContacts((prev) => prev.filter((c) => c.id !== id));
    } catch (err: any) {
      setError(err?.message || "Failed to delete contact.");
    }
  };

  return (
    <div className={CARD_CLS}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-bold text-slate-950 dark:text-white flex items-center gap-2">
            <Users className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            SalesWorks Creator CRM Pipeline
          </h3>
          <p className="text-xs text-slate-600 dark:text-zinc-400">
            Track real leads, follow-ups, booked calls, and verified sales. Records persist per account.
          </p>
        </div>
        <button
          type="button"
          onClick={() =>
            exportStructuredAsset(
              "csv",
              "salesworks-crm-contacts",
              contacts.map((c) => ({
                label: `${c.name} (${c.stage})`,
                value: `${c.email || "No email"} | ${c.handle || "No handle"} | ${c.offerInterest || ""} | ${formatCents(c.dealValueCents)} | Next: ${c.nextAction || ""}`
              })),
              { appId: "salesworks", provenance: "user_provided_fact" }
            )
          }
          className={BTN_SECONDARY}
        >
          <Download className="h-3.5 w-3.5" /> Export CSV
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-300 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-950/30 p-3 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-slate-200 dark:border-zinc-800">
        <input className={INPUT_CLS} placeholder="Lead / buyer name *" value={name} onChange={(e) => setName(e.target.value)} required />
        <input className={INPUT_CLS} placeholder="Email (optional)" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className={INPUT_CLS} placeholder="@handle (optional)" value={handle} onChange={(e) => setHandle(e.target.value)} />
        <input className={INPUT_CLS} placeholder="Offer interest" value={offerInterest} onChange={(e) => setOfferInterest(e.target.value)} />
        <input className={INPUT_CLS} type="number" min="0" step="1" placeholder="Deal value ($ USD)" value={dealDollars} onChange={(e) => setDealDollars(e.target.value)} />
        <select className={INPUT_CLS} value={stage} onChange={(e) => setStage(e.target.value)}>
          <option value="lead">Lead</option>
          <option value="qualified">Qualified</option>
          <option value="meeting_booked">Meeting Booked</option>
          <option value="proposal_sent">Proposal Sent</option>
          <option value="won_verified">Won (Verified)</option>
          <option value="closed_lost">Closed Lost</option>
        </select>
        <input className={INPUT_CLS} placeholder="Next follow-up action" value={nextAction} onChange={(e) => setNextAction(e.target.value)} />
        <button type="submit" disabled={saving} className={BTN_PRIMARY}>
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          Add Contact
        </button>
      </form>

      {loading ? (
        <div className="text-xs text-slate-500 flex items-center gap-2 py-4">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading CRM pipeline...
        </div>
      ) : contacts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 dark:border-zinc-700 p-6 text-xs text-slate-600 dark:text-zinc-400">
          No CRM contacts recorded yet. Add your first real conversation or inquiry above.
        </div>
      ) : (
        <div className="space-y-2.5">
          {contacts.map((c) => (
            <div key={c.id} className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-[#0d0d11] p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold text-slate-950 dark:text-white">{c.name}</span>
                  {c.handle && <span className="text-xs font-mono text-indigo-700 dark:text-indigo-400">{c.handle}</span>}
                  {c.dealValueCents > 0 && (
                    <span className="text-xs font-mono font-semibold text-emerald-700 dark:text-emerald-400">
                      {formatCents(c.dealValueCents)}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-600 dark:text-zinc-400">
                  {[c.email, c.offerInterest, c.nextAction ? `Next: ${c.nextAction}` : ""].filter(Boolean).join(" · ") || "No additional details"}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  aria-label={`Stage for ${c.name}`}
                  value={c.stage}
                  onChange={(e) => updateStage(c.id, e.target.value)}
                  className="rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-xs text-slate-800 dark:text-zinc-200"
                >
                  <option value="lead">Lead</option>
                  <option value="qualified">Qualified</option>
                  <option value="meeting_booked">Meeting Booked</option>
                  <option value="proposal_sent">Proposal Sent</option>
                  <option value="won_verified">Won (Verified)</option>
                  <option value="closed_lost">Closed Lost</option>
                </select>
                {onTransferToApp && (
                  <button
                    type="button"
                    onClick={() =>
                      onTransferToApp({
                        sourceAppId: "salesworks",
                        targetAppId: "meetingworks",
                        title: `Discovery Call: ${c.name}`,
                        content: `Lead: ${c.name}\nOffer Interest: ${c.offerInterest || "General"}\nNext Action: ${c.nextAction || ""}`
                      })
                    }
                    className={BTN_SECONDARY}
                  >
                    Book in MeetingWorks <ArrowRight className="h-3 w-3" />
                  </button>
                )}
                <button type="button" onClick={() => remove(c.id)} aria-label={`Delete ${c.name}`} className="p-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg cursor-pointer">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// =========================================================================
// 2. STOREWORKS LISTINGS & DISCOUNTS (Stripe Connect Honestly Gated)
// =========================================================================
export function StoreWorksModule() {
  const [listings, setListings] = useState<any[]>([]);
  const [stripeConnectConfigured, setStripeConnectConfigured] = useState(false);
  const [statusNote, setStatusNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priceDollars, setPriceDollars] = useState("29");
  const [discountCode, setDiscountCode] = useState("");
  const [discountPercent, setDiscountPercent] = useState("0");
  const [isBundle, setIsBundle] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    ecosystemFetch<{ listings: any[]; stripeConnectConfigured: boolean; marketplaceStatusNote: string }>(
      "/api/ecosystem/store/listings"
    )
      .then((d) => {
        setListings(d.listings || []);
        setStripeConnectConfigured(Boolean(d.stripeConnectConfigured));
        setStatusNote(d.marketplaceStatusNote || "");
      })
      .catch((e) => setError(e?.message || "Failed to load StoreWorks catalog."))
      .finally(() => setLoading(false));
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const data = await ecosystemFetch<{ listing: any }>("/api/ecosystem/store/listings", {
        method: "POST",
        body: {
          title: title.trim(),
          description: description.trim(),
          priceCents: Math.round((Number(priceDollars) || 0) * 100),
          discountCode: discountCode.trim(),
          discountPercent: Number(discountPercent) || 0,
          isBundle,
          status: "published"
        }
      });
      setListings((prev) => [data.listing, ...prev]);
      setTitle("");
      setDescription("");
      setDiscountCode("");
      setDiscountPercent("0");
    } catch (err: any) {
      setError(err?.message || "Failed to save listing.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await ecosystemFetch(`/api/ecosystem/store/listings/${id}`, { method: "DELETE" });
      setListings((prev) => prev.filter((l) => l.id !== id));
    } catch (err: any) {
      setError(err?.message || "Failed to remove listing.");
    }
  };

  return (
    <div className={CARD_CLS}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-slate-950 dark:text-white flex items-center gap-2">
            <Store className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            StoreWorks Product Catalog & Pricing
          </h3>
          <p className="text-xs text-slate-600 dark:text-zinc-400">
            Configure creator product listings, bundles, pricing tiers, and discount codes.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
          {stripeConnectConfigured ? "Stripe Connect Ready" : "In Development · Checkout Gated"}
        </span>
      </div>

      {!stripeConnectConfigured && (
        <div className="rounded-xl border border-amber-300 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-950/25 p-3.5 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
          <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
          <span>
            {statusNote ||
              "Catalog listings, bundles, and discount codes are live and persistent. Live buyer card checkout & seller payouts require Stripe Connect provisioning (separate from your ThreadsWorks subscription billing)."}
          </span>
        </div>
      )}

      {error && <div className="text-xs text-rose-600 dark:text-rose-400">{error}</div>}

      <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2 border-t border-slate-200 dark:border-zinc-800">
        <input className={INPUT_CLS} placeholder="Product / Offer title *" value={title} onChange={(e) => setTitle(e.target.value)} required />
        <input className={INPUT_CLS} type="number" min="0" step="1" placeholder="Price ($ USD)" value={priceDollars} onChange={(e) => setPriceDollars(e.target.value)} />
        <div className="flex gap-2">
          <input className={INPUT_CLS} placeholder="Promo code (e.g. LAUNCH20)" value={discountCode} onChange={(e) => setDiscountCode(e.target.value)} />
          <input className={`${INPUT_CLS} w-24`} type="number" min="0" max="90" placeholder="%" value={discountPercent} onChange={(e) => setDiscountPercent(e.target.value)} />
        </div>
        <input className={`${INPUT_CLS} sm:col-span-2`} placeholder="Concise product promise / deliverables" value={description} onChange={(e) => setDescription(e.target.value)} />
        <div className="flex items-center justify-between gap-2">
          <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-zinc-300 cursor-pointer">
            <input type="checkbox" checked={isBundle} onChange={(e) => setIsBundle(e.target.checked)} />
            Bundle offer
          </label>
          <button type="submit" disabled={saving} className={BTN_PRIMARY}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Save Listing
          </button>
        </div>
      </form>

      {loading ? (
        <div className="text-xs text-slate-500 flex items-center gap-2 py-3"><Loader2 className="h-4 w-4 animate-spin" /> Loading catalog...</div>
      ) : listings.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 dark:border-zinc-700 p-5 text-xs text-slate-600 dark:text-zinc-400">
          No storefront listings created yet. Add your first digital product or service offer above.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {listings.map((item) => (
            <div key={item.id} className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-[#0d0d11] p-4 flex flex-col justify-between gap-3">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-slate-950 dark:text-white">{item.title}</span>
                  <span className="font-mono text-sm font-bold text-emerald-700 dark:text-emerald-400">{formatCents(item.priceCents)}</span>
                </div>
                {item.description && <p className="text-xs text-slate-600 dark:text-zinc-400 mt-1">{item.description}</p>}
                <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-mono text-slate-500 dark:text-zinc-400">
                  {item.isBundle && <span>BUNDLE</span>}
                  {item.discountCode && <span>CODE: {item.discountCode} ({item.discountPercent}% off)</span>}
                  <span>CHECKOUT: {stripeConnectConfigured ? "LIVE" : "AWAITING STRIPE CONNECT"}</span>
                </div>
              </div>
              <div className="flex justify-end">
                <button type="button" onClick={() => remove(item.id)} className="text-xs text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1 cursor-pointer">
                  <Trash2 className="h-3.5 w-3.5" /> Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// =========================================================================
// 3. DELIVERYWORKS DIGITAL PORTAL & COURSE HOSTING
// =========================================================================
export function DeliveryWorksModule() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [deliveryType, setDeliveryType] = useState<"digital_download" | "course">("digital_download");
  const [welcomeNote, setWelcomeNote] = useState("");
  const [accessInstructions, setAccessInstructions] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    ecosystemFetch<{ items: any[] }>("/api/ecosystem/delivery/items")
      .then((d) => setItems(d.items || []))
      .catch((e) => setError(e?.message || "Failed to load delivery items."))
      .finally(() => setLoading(false));
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const data = await ecosystemFetch<{ item: any }>("/api/ecosystem/delivery/items", {
        method: "POST",
        body: { title: title.trim(), deliveryType, welcomeNote: welcomeNote.trim(), accessInstructions: accessInstructions.trim() }
      });
      setItems((prev) => [data.item, ...prev]);
      setTitle("");
      setWelcomeNote("");
      setAccessInstructions("");
    } catch (err: any) {
      setError(err?.message || "Failed to save delivery package.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    await ecosystemFetch(`/api/ecosystem/delivery/items/${id}`, { method: "DELETE" });
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  return (
    <div className={CARD_CLS}>
      <div>
        <h3 className="text-base font-bold text-slate-950 dark:text-white flex items-center gap-2">
          <Package className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          DeliveryWorks Digital Fulfillment & Course Portal
        </h3>
        <p className="text-xs text-slate-600 dark:text-zinc-400">
          Create buyer welcome portals, access tokens, and structured delivery checklists for your digital products.
        </p>
      </div>

      {error && <div className="text-xs text-rose-600 dark:text-rose-400">{error}</div>}

      <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-slate-200 dark:border-zinc-800">
        <input className={INPUT_CLS} placeholder="Delivery package title *" value={title} onChange={(e) => setTitle(e.target.value)} required />
        <select className={INPUT_CLS} value={deliveryType} onChange={(e) => setDeliveryType(e.target.value as any)}>
          <option value="digital_download">Digital Download Portal</option>
          <option value="course">Mini-Course / Cohort Portal</option>
        </select>
        <textarea rows={2} className={INPUT_CLS} placeholder="Buyer welcome message" value={welcomeNote} onChange={(e) => setWelcomeNote(e.target.value)} />
        <textarea rows={2} className={INPUT_CLS} placeholder="Download / access instructions & next steps" value={accessInstructions} onChange={(e) => setAccessInstructions(e.target.value)} />
        <div className="md:col-span-2 flex justify-end">
          <button type="submit" disabled={saving} className={BTN_PRIMARY}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Create Delivery Package
          </button>
        </div>
      </form>

      {loading ? (
        <div className="text-xs text-slate-500 flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading fulfillment packages...</div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 dark:border-zinc-700 p-5 text-xs text-slate-600 dark:text-zinc-400">
          No delivery portals configured yet.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-[#0d0d11] p-4 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold text-slate-950 dark:text-white">{item.title}</span>
                  <span className="font-mono text-[11px] text-indigo-700 dark:text-indigo-400 uppercase">{item.deliveryType}</span>
                  <span className="font-mono text-[11px] text-slate-500">TOKEN: {item.accessToken}</span>
                </div>
                {item.welcomeNote && <p className="text-xs text-slate-700 dark:text-zinc-300">{item.welcomeNote}</p>}
                {item.accessInstructions && <p className="text-xs text-slate-500 dark:text-zinc-400">{item.accessInstructions}</p>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() =>
                    exportStructuredAsset(
                      "html",
                      `${item.title}-buyer-portal`,
                      [
                        { label: "Welcome", value: item.welcomeNote || "Thank you for your purchase." },
                        { label: "Access Instructions", value: item.accessInstructions || "" },
                        { label: "Access Token", value: item.accessToken || "" }
                      ],
                      { appId: "deliveryworks" }
                    )
                  }
                  className={BTN_SECONDARY}
                >
                  <Download className="h-3.5 w-3.5" /> Portal HTML
                </button>
                <button type="button" onClick={() => remove(item.id)} className="p-2 text-rose-600 dark:text-rose-400 cursor-pointer">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// =========================================================================
// 4. COMMUNITYWORKS INTERNAL CREATOR SOCIAL NETWORK
// =========================================================================
export function CommunityWorksModule({ currentUid }: { currentUid?: string }) {
  const [posts, setPosts] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("Discussion");
  const [groupName, setGroupName] = useState("");
  const [commentTextByPost, setCommentTextByPost] = useState<Record<string, string>>({});
  const [dmRecipient, setDmRecipient] = useState("");
  const [dmText, setDmText] = useState("");
  const [subTab, setSubTab] = useState<"feed" | "groups" | "messages">("feed");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await ecosystemFetch<{ posts: any[]; groups: any[]; messages: any[] }>("/api/ecosystem/community/feed");
      setPosts(d.posts || []);
      setGroups(d.groups || []);
      setMessages(d.messages || []);
    } catch (err: any) {
      setError(err?.message || "Failed to load CommunityWorks.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const createPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    try {
      const data = await ecosystemFetch<{ post: any }>("/api/ecosystem/community/posts", {
        method: "POST",
        body: { body: body.trim(), category }
      });
      setPosts((prev) => [data.post, ...prev]);
      setBody("");
    } catch (err: any) {
      setError(err?.message || "Failed to publish post.");
    }
  };

  const interact = async (postId: string, action: "like" | "save" | "repost" | "comment") => {
    try {
      const text = commentTextByPost[postId] || "";
      const data = await ecosystemFetch<any>(`/api/ecosystem/community/posts/${postId}/interact`, {
        method: "POST",
        body: action === "comment" ? { action, text } : { action }
      });
      setPosts((prev) =>
        prev.map((p) => {
          if (p.id !== postId) return p;
          if (action === "like") return { ...p, likedBy: data.likedBy };
          if (action === "save") return { ...p, savedBy: data.savedBy };
          if (action === "repost") return { ...p, repostedBy: data.repostedBy };
          return { ...p, comments: data.comments };
        })
      );
      if (action === "comment") {
        setCommentTextByPost((prev) => ({ ...prev, [postId]: "" }));
      }
    } catch (err: any) {
      setError(err?.message || "Action failed.");
    }
  };

  const moderate = async (action: "report" | "block", targetPostId: string, targetUid: string) => {
    try {
      await ecosystemFetch("/api/ecosystem/community/moderate", {
        method: "POST",
        body: { action, targetPostId, targetUid, reason: "Creator moderation request" }
      });
      if (action === "block") {
        setPosts((prev) => prev.filter((p) => p.authorId !== targetUid));
      }
    } catch (err: any) {
      setError(err?.message || "Moderation failed.");
    }
  };

  const createGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) return;
    const data = await ecosystemFetch<{ group: any }>("/api/ecosystem/community/groups", {
      method: "POST",
      body: { name: groupName.trim(), description: "Peer creator accountability group" }
    });
    setGroups((prev) => [data.group, ...prev]);
    setGroupName("");
  };

  const sendDm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dmRecipient.trim() || !dmText.trim()) return;
    const data = await ecosystemFetch<{ message: any }>("/api/ecosystem/community/messages", {
      method: "POST",
      body: { recipientId: dmRecipient.trim(), text: dmText.trim() }
    });
    setMessages((prev) => [data.message, ...prev]);
    setDmText("");
  };

  return (
    <div className={CARD_CLS}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-slate-950 dark:text-white flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            CommunityWorks Creator Network
          </h3>
          <p className="text-xs text-slate-600 dark:text-zinc-400">
            Internal creator feed, discussions, peer groups, direct messaging, and moderation controls.
          </p>
        </div>
        <div className="flex gap-1.5">
          {(["feed", "groups", "messages"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setSubTab(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize cursor-pointer ${
                subTab === t
                  ? "bg-indigo-600 text-white"
                  : "border border-slate-300 dark:border-zinc-700 text-slate-700 dark:text-zinc-300"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="text-xs text-rose-600 dark:text-rose-400">{error}</div>}

      {subTab === "feed" && (
        <div className="space-y-4">
          <form onSubmit={createPost} className="space-y-2.5 pt-2 border-t border-slate-200 dark:border-zinc-800">
            <textarea
              rows={3}
              className={INPUT_CLS}
              placeholder="Share a win, ask for feedback on an offer, or share a lesson learned..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
            <div className="flex items-center justify-between gap-3">
              <select className={`${INPUT_CLS} max-w-[200px]`} value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="Discussion">Discussion</option>
                <option value="Feedback Request">Feedback Request</option>
                <option value="First Sale Milestone">First Sale Milestone</option>
                <option value="Collaboration">Collaboration</option>
              </select>
              <button type="submit" className={BTN_PRIMARY}>
                <Send className="h-3.5 w-3.5" /> Publish to Feed
              </button>
            </div>
          </form>

          {loading ? (
            <div className="text-xs text-slate-500 flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading creator feed...</div>
          ) : posts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 dark:border-zinc-700 p-5 text-xs text-slate-600 dark:text-zinc-400">
              The community feed is ready for the first creator post.
            </div>
          ) : (
            <div className="space-y-3">
              {posts.map((p) => (
                <div key={p.id} className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-[#0d0d11] p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-950 dark:text-white">{p.authorName}</span>
                      <span className="font-mono text-[10px] uppercase text-indigo-700 dark:text-indigo-400">{p.category}</span>
                    </div>
                    {p.authorId !== currentUid && (
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => moderate("report", p.id, p.authorId)} className="text-[11px] text-slate-500 hover:text-amber-600 flex items-center gap-1 cursor-pointer">
                          <Flag className="h-3 w-3" /> Report
                        </button>
                        <button type="button" onClick={() => moderate("block", p.id, p.authorId)} className="text-[11px] text-slate-500 hover:text-rose-600 cursor-pointer">
                          Block
                        </button>
                      </div>
                    )}
                  </div>
                  <p className="text-xs sm:text-sm text-slate-800 dark:text-zinc-200 whitespace-pre-wrap">{p.body}</p>
                  <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-200 dark:border-zinc-800">
                    <button type="button" onClick={() => interact(p.id, "like")} className="text-xs text-slate-600 dark:text-zinc-400 hover:text-indigo-600 flex items-center gap-1 cursor-pointer">
                      <Heart className="h-3.5 w-3.5" /> {(p.likedBy || []).length}
                    </button>
                    <button type="button" onClick={() => interact(p.id, "repost")} className="text-xs text-slate-600 dark:text-zinc-400 hover:text-emerald-600 flex items-center gap-1 cursor-pointer">
                      <Repeat2 className="h-3.5 w-3.5" /> {(p.repostedBy || []).length}
                    </button>
                    <span className="text-xs text-slate-500">{(p.comments || []).length} replies</span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      className={INPUT_CLS}
                      placeholder="Write a helpful reply..."
                      value={commentTextByPost[p.id] || ""}
                      onChange={(e) => setCommentTextByPost((prev) => ({ ...prev, [p.id]: e.target.value }))}
                    />
                    <button type="button" onClick={() => interact(p.id, "comment")} className={BTN_SECONDARY}>
                      Reply
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {subTab === "groups" && (
        <div className="space-y-4">
          <form onSubmit={createGroup} className="flex gap-2">
            <input className={INPUT_CLS} placeholder="New peer group name (e.g. First Sale Sprint)" value={groupName} onChange={(e) => setGroupName(e.target.value)} />
            <button type="submit" className={BTN_PRIMARY}><Plus className="h-3.5 w-3.5" /> Create Group</button>
          </form>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {groups.map((g) => (
              <div key={g.id} className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-[#0d0d11] p-4">
                <div className="text-sm font-bold text-slate-950 dark:text-white">{g.name}</div>
                <p className="text-xs text-slate-600 dark:text-zinc-400 mt-1">{g.description}</p>
                <div className="text-[11px] font-mono text-slate-500 mt-2">{(g.memberIds || []).length} member(s)</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {subTab === "messages" && (
        <div className="space-y-4">
          <form onSubmit={sendDm} className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <input className={INPUT_CLS} placeholder="Recipient creator UID" value={dmRecipient} onChange={(e) => setDmRecipient(e.target.value)} />
            <input className={INPUT_CLS} placeholder="Direct message text" value={dmText} onChange={(e) => setDmText(e.target.value)} />
            <button type="submit" className={BTN_PRIMARY}><Send className="h-3.5 w-3.5" /> Send Message</button>
          </form>
          <div className="space-y-2">
            {messages.map((m) => (
              <div key={m.id} className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-[#0d0d11] p-3 text-xs">
                <span className="font-mono text-slate-500">{m.senderId === currentUid ? "You" : m.senderId} → {m.recipientId}: </span>
                <span className="text-slate-800 dark:text-zinc-200">{m.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// =========================================================================
// 5. MEETINGWORKS ROOMS, SCHEDULER & CHAT (WebRTC Honestly Gated)
// =========================================================================
export function MeetingWorksModule({
  onTransferToApp
}: {
  onTransferToApp?: (payload: ToolTransferPayload) => void;
}) {
  const [meetings, setMeetings] = useState<any[]>([]);
  const [mediaNote, setMediaNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [scheduledFor, setScheduledFor] = useState("");
  const [agenda, setAgenda] = useState("");
  const [productLink, setProductLink] = useState("");
  const [chatByMeeting, setChatByMeeting] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    ecosystemFetch<{ meetings: any[]; liveMediaStatusNote: string }>("/api/ecosystem/meetings")
      .then((d) => {
        setMeetings(d.meetings || []);
        setMediaNote(d.liveMediaStatusNote || "");
      })
      .catch((e) => setError(e?.message || "Failed to load MeetingWorks."))
      .finally(() => setLoading(false));
  }, []);

  const createMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    try {
      const data = await ecosystemFetch<{ meeting: any }>("/api/ecosystem/meetings", {
        method: "POST",
        body: { title: title.trim(), scheduledFor: scheduledFor || new Date().toISOString(), agenda: agenda.trim(), productLink: productLink.trim() }
      });
      setMeetings((prev) => [data.meeting, ...prev]);
      setTitle("");
      setAgenda("");
      setProductLink("");
    } catch (err: any) {
      setError(err?.message || "Failed to create meeting room.");
    }
  };

  const sendRoomChat = async (meetingId: string) => {
    const msg = (chatByMeeting[meetingId] || "").trim();
    if (!msg) return;
    const data = await ecosystemFetch<{ meeting: any }>(`/api/ecosystem/meetings/${meetingId}`, {
      method: "PUT",
      body: { newChatMessage: msg }
    });
    setMeetings((prev) => prev.map((m) => (m.id === meetingId ? data.meeting : m)));
    setChatByMeeting((prev) => ({ ...prev, [meetingId]: "" }));
  };

  return (
    <div className={CARD_CLS}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-slate-950 dark:text-white flex items-center gap-2">
            <Video className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            MeetingWorks Rooms, Appointments & In-Room Chat
          </h3>
          <p className="text-xs text-slate-600 dark:text-zinc-400">
            Schedule discovery calls and workshops with persistent agendas, shareable invite codes, product links, and chat notes.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
          In Development · Live Audio/Video Gated
        </span>
      </div>

      <div className="rounded-xl border border-amber-300 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-950/25 p-3.5 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
        <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
        <span>
          {mediaNote ||
            "Persistent rooms, scheduling, invitations, agendas, in-room chat, and AI post-call summaries are live. Browser-native live audio/video/screen sharing requires external WebRTC SFU/TURN infrastructure."}
        </span>
      </div>

      {error && <div className="text-xs text-rose-600 dark:text-rose-400">{error}</div>}

      <form onSubmit={createMeeting} className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-slate-200 dark:border-zinc-800">
        <input className={INPUT_CLS} placeholder="Meeting / Workshop title *" value={title} onChange={(e) => setTitle(e.target.value)} required />
        <input className={INPUT_CLS} type="datetime-local" value={scheduledFor} onChange={(e) => setScheduledFor(e.target.value)} />
        <input className={INPUT_CLS} placeholder="Meeting agenda" value={agenda} onChange={(e) => setAgenda(e.target.value)} />
        <input className={INPUT_CLS} placeholder="Optional product / offer link to share in-room" value={productLink} onChange={(e) => setProductLink(e.target.value)} />
        <div className="md:col-span-2 flex justify-end">
          <button type="submit" className={BTN_PRIMARY}>
            <Calendar className="h-3.5 w-3.5" /> Create Persistent Room
          </button>
        </div>
      </form>

      {loading ? (
        <div className="text-xs text-slate-500 flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading rooms...</div>
      ) : (
        <div className="space-y-3">
          {meetings.map((m) => (
            <div key={m.id} className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-[#0d0d11] p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-bold text-slate-950 dark:text-white">{m.title}</div>
                  <div className="text-[11px] font-mono text-slate-500">Invite Code: {m.inviteCode} · {m.scheduledFor}</div>
                </div>
                {onTransferToApp && (
                  <button
                    type="button"
                    onClick={() =>
                      onTransferToApp({
                        sourceAppId: "meetingworks",
                        targetAppId: "meetingworks",
                        title: `Summary: ${m.title}`,
                        content: `Agenda: ${m.agenda}\nChat Notes:\n${(m.chatMessages || []).map((c: any) => `${c.sender}: ${c.text}`).join("\n")}`
                      })
                    }
                    className={BTN_SECONDARY}
                  >
                    Send Notes to AI Summary <ArrowRight className="h-3 w-3" />
                  </button>
                )}
              </div>
              {m.agenda && <p className="text-xs text-slate-700 dark:text-zinc-300">Agenda: {m.agenda}</p>}
              {(m.chatMessages || []).length > 0 && (
                <div className="rounded-lg bg-white dark:bg-[#09090b] border border-slate-200 dark:border-zinc-800 p-2.5 space-y-1 max-h-36 overflow-y-auto">
                  {m.chatMessages.map((msg: any) => (
                    <div key={msg.id} className="text-xs text-slate-700 dark:text-zinc-300">
                      <span className="font-semibold text-indigo-700 dark:text-indigo-400">{msg.sender}:</span> {msg.text}
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <input
                  className={INPUT_CLS}
                  placeholder="Log meeting note or in-room chat message..."
                  value={chatByMeeting[m.id] || ""}
                  onChange={(e) => setChatByMeeting((prev) => ({ ...prev, [m.id]: e.target.value }))}
                />
                <button type="button" onClick={() => sendRoomChat(m.id)} className={BTN_SECONDARY}>
                  Send
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// =========================================================================
// 6. PROOFWORKS EVIDENCE LIBRARY
// =========================================================================
export function ProofWorksModule() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [customerName, setCustomerName] = useState("");
  const [outcomeSummary, setOutcomeSummary] = useState("");
  const [quote, setQuote] = useState("");
  const [verificationTier, setVerificationTier] = useState("self_reported");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    ecosystemFetch<{ items: any[] }>("/api/ecosystem/proof")
      .then((d) => setItems(d.items || []))
      .catch((e) => setError(e?.message || "Failed to load proof library."))
      .finally(() => setLoading(false));
  }, []);

  const addProof = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim() || !outcomeSummary.trim()) return;
    const data = await ecosystemFetch<{ item: any }>("/api/ecosystem/proof", {
      method: "POST",
      body: { customerName: customerName.trim(), outcomeSummary: outcomeSummary.trim(), quote: quote.trim(), verificationTier }
    });
    setItems((prev) => [data.item, ...prev]);
    setCustomerName("");
    setOutcomeSummary("");
    setQuote("");
  };

  const remove = async (id: string) => {
    await ecosystemFetch(`/api/ecosystem/proof/${id}`, { method: "DELETE" });
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  return (
    <div className={CARD_CLS}>
      <div>
        <h3 className="text-base font-bold text-slate-950 dark:text-white flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          ProofWorks Verified Evidence Library
        </h3>
        <p className="text-xs text-slate-600 dark:text-zinc-400">
          Store real customer outcomes with explicit verification tags. Never fabricate unverified testimonials.
        </p>
      </div>
      {error && <div className="text-xs text-rose-600">{error}</div>}
      <form onSubmit={addProof} className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-slate-200 dark:border-zinc-800">
        <input className={INPUT_CLS} placeholder="Customer name or role *" value={customerName} onChange={(e) => setCustomerName(e.target.value)} required />
        <select className={INPUT_CLS} value={verificationTier} onChange={(e) => setVerificationTier(e.target.value)}>
          <option value="self_reported">Self-Reported</option>
          <option value="evidence_supported">Evidence-Supported (Screenshot / Link)</option>
          <option value="transaction_verified">Transaction-Verified Buyer</option>
        </select>
        <input className={INPUT_CLS} placeholder="Verified outcome summary *" value={outcomeSummary} onChange={(e) => setOutcomeSummary(e.target.value)} required />
        <input className={INPUT_CLS} placeholder="Direct customer quote (optional)" value={quote} onChange={(e) => setQuote(e.target.value)} />
        <div className="md:col-span-2 flex justify-end">
          <button type="submit" className={BTN_PRIMARY}><Plus className="h-3.5 w-3.5" /> Record Proof</button>
        </div>
      </form>
      {!loading && (
        <div className="space-y-2.5">
          {items.map((item) => (
            <div key={item.id} className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-[#0d0d11] p-4 flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold text-slate-950 dark:text-white">{item.customerName}</span>
                  <span className="font-mono text-[10px] uppercase px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                    {item.verificationTier}
                  </span>
                </div>
                <p className="text-xs text-slate-700 dark:text-zinc-300">{item.outcomeSummary}</p>
                {item.quote && <p className="text-xs italic text-slate-500 dark:text-zinc-400">"{item.quote}"</p>}
              </div>
              <button type="button" onClick={() => remove(item.id)} className="text-rose-600 p-1.5 cursor-pointer"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// =========================================================================
// 7. TEAMWORKS WORKSPACES, TASKS & APPROVALS
// =========================================================================
export function TeamWorksModule() {
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [memberEmail, setMemberEmail] = useState("");

  useEffect(() => {
    ecosystemFetch<{ workspaces: any[] }>("/api/ecosystem/team/workspaces")
      .then((d) => setWorkspaces(d.workspaces || []))
      .catch(() => {});
  }, []);

  const createWs = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const d = await ecosystemFetch<{ workspace: any }>("/api/ecosystem/team/workspaces", {
      method: "POST",
      body: { name: name.trim() }
    });
    setWorkspaces((prev) => [d.workspace, ...prev]);
    setName("");
  };

  const addTask = async (ws: any) => {
    if (!taskTitle.trim()) return;
    const tasks = [...(ws.tasks || []), { id: Date.now().toString(), title: taskTitle.trim(), status: "open" }];
    const d = await ecosystemFetch<{ workspace: any }>(`/api/ecosystem/team/workspaces/${ws.id}`, {
      method: "PUT",
      body: { tasks }
    });
    setWorkspaces((prev) => prev.map((w) => (w.id === ws.id ? d.workspace : w)));
    setTaskTitle("");
  };

  const addMember = async (ws: any) => {
    if (!memberEmail.trim()) return;
    const members = [...(ws.members || []), { email: memberEmail.trim(), role: "editor", addedAt: new Date().toISOString() }];
    const d = await ecosystemFetch<{ workspace: any }>(`/api/ecosystem/team/workspaces/${ws.id}`, {
      method: "PUT",
      body: { members }
    });
    setWorkspaces((prev) => prev.map((w) => (w.id === ws.id ? d.workspace : w)));
    setMemberEmail("");
  };

  return (
    <div className={CARD_CLS}>
      <h3 className="text-base font-bold text-slate-950 dark:text-white flex items-center gap-2">
        <Users className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
        TeamWorks Shared Workspaces & Tasks
      </h3>
      <form onSubmit={createWs} className="flex gap-2">
        <input className={INPUT_CLS} placeholder="New team workspace name *" value={name} onChange={(e) => setName(e.target.value)} required />
        <button type="submit" className={BTN_PRIMARY}><Plus className="h-3.5 w-3.5" /> Create Workspace</button>
      </form>
      <div className="space-y-4">
        {workspaces.map((ws) => (
          <div key={ws.id} className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-[#0d0d11] p-4 space-y-3">
            <div className="text-sm font-bold text-slate-950 dark:text-white">{ws.name}</div>
            <div className="flex flex-wrap gap-2 text-xs text-slate-600 dark:text-zinc-400">
              {(ws.members || []).map((m: any, idx: number) => (
                <span key={idx} className="px-2 py-0.5 rounded bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 font-mono text-[11px]">
                  {m.email} ({m.role})
                </span>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="flex gap-2">
                <input className={INPUT_CLS} placeholder="Add collaborator email" value={memberEmail} onChange={(e) => setMemberEmail(e.target.value)} />
                <button type="button" onClick={() => addMember(ws)} className={BTN_SECONDARY}>Invite</button>
              </div>
              <div className="flex gap-2">
                <input className={INPUT_CLS} placeholder="Add launch task" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} />
                <button type="button" onClick={() => addTask(ws)} className={BTN_SECONDARY}>Add Task</button>
              </div>
            </div>
            {(ws.tasks || []).length > 0 && (
              <ul className="space-y-1 text-xs text-slate-700 dark:text-zinc-300">
                {ws.tasks.map((t: any) => (
                  <li key={t.id} className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-indigo-500" /> {t.title}</li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// =========================================================================
// 8. AFFILIATEWORKS PROGRAMS & SELF-REFERRAL GUARD
// =========================================================================
export function AffiliateWorksModule({ currentUid }: { currentUid?: string }) {
  const [programs, setPrograms] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [commissionPercent, setCommissionPercent] = useState("30");
  const [referralCode, setReferralCode] = useState("");
  const [guardCheckResult, setGuardCheckResult] = useState<string | null>(null);

  useEffect(() => {
    ecosystemFetch<{ programs: any[] }>("/api/ecosystem/affiliates")
      .then((d) => setPrograms(d.programs || []))
      .catch(() => {});
  }, []);

  const createProgram = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const d = await ecosystemFetch<{ program: any }>("/api/ecosystem/affiliates", {
      method: "POST",
      body: { name: name.trim(), commissionPercent: Number(commissionPercent) || 30, referralCode: referralCode.trim() }
    });
    setPrograms((prev) => [d.program, ...prev]);
    setName("");
    setReferralCode("");
  };

  const testSelfReferralGuard = async () => {
    setGuardCheckResult(null);
    try {
      await ecosystemFetch("/api/ecosystem/affiliates/validate-referral", {
        method: "POST",
        body: { referrerUid: currentUid || "self", buyerUid: currentUid || "self" }
      });
      setGuardCheckResult("Allowed");
    } catch (err: any) {
      setGuardCheckResult(`Blocked as expected: ${err?.message || "Self-referral rejected"}`);
    }
  };

  return (
    <div className={CARD_CLS}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-bold text-slate-950 dark:text-white flex items-center gap-2">
            <Link2 className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            AffiliateWorks Partner Programs & Self-Referral Guard
          </h3>
          <p className="text-xs text-slate-600 dark:text-zinc-400">
            Configure partner commission rates and shareable referral codes. Self-referrals are automatically blocked server-side.
          </p>
        </div>
        <button type="button" onClick={testSelfReferralGuard} className={BTN_SECONDARY}>
          <Shield className="h-3.5 w-3.5" /> Verify Self-Referral Block
        </button>
      </div>
      {guardCheckResult && (
        <div className="rounded-lg border border-emerald-300 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/25 p-3 text-xs text-emerald-800 dark:text-emerald-300">
          {guardCheckResult}
        </div>
      )}
      <form onSubmit={createProgram} className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-200 dark:border-zinc-800">
        <input className={INPUT_CLS} placeholder="Program name *" value={name} onChange={(e) => setName(e.target.value)} required />
        <input className={INPUT_CLS} type="number" min="1" max="80" placeholder="Commission %" value={commissionPercent} onChange={(e) => setCommissionPercent(e.target.value)} />
        <input className={INPUT_CLS} placeholder="Custom code (optional)" value={referralCode} onChange={(e) => setReferralCode(e.target.value)} />
        <button type="submit" className={BTN_PRIMARY}><Plus className="h-3.5 w-3.5" /> Create Program</button>
      </form>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {programs.map((p) => (
          <div key={p.id} className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-[#0d0d11] p-4 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-950 dark:text-white">{p.name}</span>
              <span className="font-mono text-xs font-bold text-emerald-700 dark:text-emerald-400">{p.commissionPercent}%</span>
            </div>
            <div className="font-mono text-[11px] text-indigo-700 dark:text-indigo-400">
              {p.destinationUrl}?ref={p.referralCode}
            </div>
            <div className="text-[11px] text-slate-500">Self-referral protection: Active</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// =========================================================================
// 9. GROWTHWORKS REAL ANALYTICS SUMMARY (ZERO FABRICATED NUMBERS)
// =========================================================================
export function GrowthWorksModule() {
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    ecosystemFetch("/api/ecosystem/growth/summary")
      .then(setSummary)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className={CARD_CLS}>
      <div>
        <h3 className="text-base font-bold text-slate-950 dark:text-white flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          GrowthWorks Verified Ecosystem Metrics
        </h3>
        <p className="text-xs text-slate-600 dark:text-zinc-400">
          Strictly calculated from your real Firestore workspace records. Unsynced external metrics display explicitly as not yet connected—never fabricated.
        </p>
      </div>
      {loading ? (
        <div className="text-xs text-slate-500 flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading real metrics...</div>
      ) : summary ? (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-[#0d0d11] p-3.5">
            <div className="font-mono text-[10px] uppercase text-slate-500">Threads Views</div>
            <div className="text-lg font-extrabold text-slate-950 dark:text-white mt-1">
              {summary.hasSyncedThreadsMetrics ? summary.totalThreadsViews : "Not Synced"}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-[#0d0d11] p-3.5">
            <div className="font-mono text-[10px] uppercase text-slate-500">Saved Posts</div>
            <div className="text-lg font-extrabold text-slate-950 dark:text-white mt-1">{summary.savedPostsCount}</div>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-[#0d0d11] p-3.5">
            <div className="font-mono text-[10px] uppercase text-slate-500">CRM Contacts</div>
            <div className="text-lg font-extrabold text-slate-950 dark:text-white mt-1">{summary.crmContactsCount}</div>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-[#0d0d11] p-3.5">
            <div className="font-mono text-[10px] uppercase text-slate-500">Saved Assets</div>
            <div className="text-lg font-extrabold text-slate-950 dark:text-white mt-1">{summary.savedEcosystemAssetsCount}</div>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-[#0d0d11] p-3.5">
            <div className="font-mono text-[10px] uppercase text-slate-500">Verified Revenue</div>
            <div className="text-lg font-extrabold text-emerald-700 dark:text-emerald-400 mt-1">
              {formatCents(summary.verifiedRevenueCents)}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// =========================================================================
// 10. AUTOMATIONWORKS WORKFLOWS & SAFE IDEMPOTENT EXECUTION
// =========================================================================
export function AutomationWorksModule() {
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [runs, setRuns] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [trigger, setTrigger] = useState("product_created");
  const [actionType, setActionType] = useState("prepare_promo_brief");
  const [requiresApproval, setRequiresApproval] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    ecosystemFetch<{ workflows: any[]; runs: any[] }>("/api/ecosystem/automations")
      .then((d) => {
        setWorkflows(d.workflows || []);
        setRuns(d.runs || []);
      })
      .catch(() => {});
  }, []);

  const createWorkflow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const d = await ecosystemFetch<{ workflow: any }>("/api/ecosystem/automations", {
      method: "POST",
      body: { name: name.trim(), trigger, actionType, requiresApproval, maxRetries: 2 }
    });
    setWorkflows((prev) => [d.workflow, ...prev]);
    setName("");
  };

  const triggerRun = async (wfId: string, approvedByUser: boolean) => {
    setStatusMessage(null);
    try {
      const d = await ecosystemFetch<{ run: any; idempotentHit: boolean }>(`/api/ecosystem/automations/${wfId}/run`, {
        method: "POST",
        body: { approvedByUser }
      });
      setRuns((prev) => [d.run, ...prev]);
      setStatusMessage(`Run ${d.run.status}: ${d.run.reason}`);
    } catch (err: any) {
      setStatusMessage(`Policy Guard: ${err?.message || "External action blocked"}`);
    }
  };

  return (
    <div className={CARD_CLS}>
      <div>
        <h3 className="text-base font-bold text-slate-950 dark:text-white flex items-center gap-2">
          <Play className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          AutomationWorks Safe Workflow Engine
        </h3>
        <p className="text-xs text-slate-600 dark:text-zinc-400">
          Build trigger → condition → action automations with approval gates, bounded retries (max 3), and strict external-action blocks.
        </p>
      </div>

      {statusMessage && (
        <div className="rounded-lg border border-indigo-300 dark:border-indigo-500/30 bg-indigo-50 dark:bg-indigo-950/30 p-3 text-xs text-indigo-900 dark:text-indigo-200">
          {statusMessage}
        </div>
      )}

      <form onSubmit={createWorkflow} className="grid grid-cols-1 md:grid-cols-4 gap-2.5 pt-2 border-t border-slate-200 dark:border-zinc-800">
        <input className={INPUT_CLS} placeholder="Workflow name *" value={name} onChange={(e) => setName(e.target.value)} required />
        <select className={INPUT_CLS} value={trigger} onChange={(e) => setTrigger(e.target.value)}>
          <option value="product_created">When ProductWorks package created</option>
          <option value="lead_added">When SalesWorks lead added</option>
          <option value="sale_verified">When First Sale verified</option>
        </select>
        <select className={INPUT_CLS} value={actionType} onChange={(e) => setActionType(e.target.value)}>
          <option value="prepare_promo_brief">Prepare Product Promo Brief (Safe)</option>
          <option value="create_crm_followup">Create SalesWorks Follow-Up (Safe)</option>
          <option value="prepare_delivery_welcome">Prepare Delivery Welcome (Safe)</option>
          <option value="publish_to_threads_external">Auto-Publish Externally (Policy Blocked)</option>
        </select>
        <div className="flex items-center justify-between gap-2">
          <label className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-zinc-300 cursor-pointer">
            <input type="checkbox" checked={requiresApproval} onChange={(e) => setRequiresApproval(e.target.checked)} />
            Approval gate
          </label>
          <button type="submit" className={BTN_PRIMARY}><Plus className="h-3.5 w-3.5" /> Add</button>
        </div>
      </form>

      <div className="space-y-2.5">
        {workflows.map((wf) => (
          <div key={wf.id} className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-[#0d0d11] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-sm font-bold text-slate-950 dark:text-white">{wf.name}</div>
              <div className="text-[11px] font-mono text-slate-500">
                {wf.trigger} → {wf.actionType} · Approval: {wf.requiresApproval ? "Required" : "Direct"} · Retries: {wf.maxRetries}
              </div>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => triggerRun(wf.id, false)} className={BTN_SECONDARY}>Test Unapproved</button>
              <button type="button" onClick={() => triggerRun(wf.id, true)} className={BTN_PRIMARY}>Run Approved</button>
            </div>
          </div>
        ))}
      </div>

      {runs.length > 0 && (
        <div className="pt-2 border-t border-slate-200 dark:border-zinc-800 space-y-1.5">
          <div className="font-mono text-[11px] uppercase text-slate-500">Recent Execution Log</div>
          {runs.slice(0, 6).map((r) => (
            <div key={r.id} className="text-xs text-slate-700 dark:text-zinc-300 flex items-center justify-between gap-2">
              <span><strong>{r.workflowName}</strong> · {r.status}</span>
              <span className="font-mono text-[10px] text-slate-500">{r.executedAt?.slice(0, 19)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// =========================================================================
// 11. FINANCEWORKS LEDGER, P&L & DOWNLOADABLE INVOICES
// =========================================================================
export function FinanceWorksModule({ issuerEmail }: { issuerEmail?: string }) {
  const [entries, setEntries] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [type, setType] = useState<"verified_sale" | "expense" | "invoice" | "refund" | "commission">("verified_sale");
  const [description, setDescription] = useState("");
  const [amountDollars, setAmountDollars] = useState("");
  const [clientName, setClientName] = useState("");
  const [isTestTransaction, setIsTestTransaction] = useState(false);

  const load = () => {
    ecosystemFetch<{ entries: any[]; summary: any }>("/api/ecosystem/finance/entries")
      .then((d) => {
        setEntries(d.entries || []);
        setSummary(d.summary || null);
      })
      .catch(() => {});
  };

  useEffect(() => {
    load();
  }, []);

  const addEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || Number(amountDollars) <= 0) return;
    await ecosystemFetch("/api/ecosystem/finance/entries", {
      method: "POST",
      body: {
        type,
        description: description.trim(),
        amountCents: Math.round(Number(amountDollars) * 100),
        clientName: clientName.trim(),
        isTestTransaction
      }
    });
    setDescription("");
    setAmountDollars("");
    setClientName("");
    setIsTestTransaction(false);
    load();
  };

  const remove = async (id: string) => {
    await ecosystemFetch(`/api/ecosystem/finance/entries/${id}`, { method: "DELETE" });
    load();
  };

  return (
    <div className={CARD_CLS}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-bold text-slate-950 dark:text-white flex items-center gap-2">
            <Wallet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            FinanceWorks Real Creator Ledger, P&amp;L &amp; Invoices
          </h3>
          <p className="text-xs text-slate-600 dark:text-zinc-400">
            Record real verified creator sales, business expenses, refunds, and downloadable invoices. Test transactions are strictly excluded from First Sale totals.
          </p>
        </div>
        <button
          type="button"
          onClick={() =>
            exportStructuredAsset(
              "csv",
              "financeworks-ledger",
              entries.map((en) => ({
                label: `${en.type} (${en.createdAt?.slice(0, 10)})`,
                value: `${en.description} | ${formatCents(en.amountCents)} | ${en.isTestTransaction ? "TEST EXCLUDED" : en.status}`
              })),
              { appId: "financeworks", provenance: "user_provided_fact" }
            )
          }
          className={BTN_SECONDARY}
        >
          <Download className="h-3.5 w-3.5" /> Export Ledger CSV
        </button>
      </div>

      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-[#0d0d11] p-3">
            <div className="font-mono text-[10px] uppercase text-slate-500">Verified Revenue</div>
            <div className="text-lg font-extrabold text-emerald-700 dark:text-emerald-400">{formatCents(summary.verifiedRevenueCents)}</div>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-[#0d0d11] p-3">
            <div className="font-mono text-[10px] uppercase text-slate-500">Expenses</div>
            <div className="text-lg font-extrabold text-slate-950 dark:text-white">{formatCents(summary.totalExpensesCents)}</div>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-[#0d0d11] p-3">
            <div className="font-mono text-[10px] uppercase text-slate-500">Refunds &amp; Commissions</div>
            <div className="text-lg font-extrabold text-slate-950 dark:text-white">{formatCents(summary.totalRefundsCents + summary.totalCommissionsCents)}</div>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-[#0d0d11] p-3">
            <div className="font-mono text-[10px] uppercase text-slate-500">Net Profit</div>
            <div className="text-lg font-extrabold text-indigo-700 dark:text-indigo-400">{formatCents(summary.netProfitCents)}</div>
          </div>
        </div>
      )}

      <form onSubmit={addEntry} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 pt-2 border-t border-slate-200 dark:border-zinc-800">
        <select className={INPUT_CLS} value={type} onChange={(e) => setType(e.target.value as any)}>
          <option value="verified_sale">Verified Creator Sale</option>
          <option value="expense">Business Expense</option>
          <option value="invoice">Client Invoice</option>
          <option value="refund">Refund</option>
          <option value="commission">Affiliate Commission</option>
        </select>
        <input className={INPUT_CLS} placeholder="Description *" value={description} onChange={(e) => setDescription(e.target.value)} required />
        <input className={INPUT_CLS} type="number" min="0.01" step="0.01" placeholder="Amount ($ USD) *" value={amountDollars} onChange={(e) => setAmountDollars(e.target.value)} required />
        <input className={INPUT_CLS} placeholder="Client / buyer name" value={clientName} onChange={(e) => setClientName(e.target.value)} />
        <div className="flex items-center justify-between gap-2">
          <label className="flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-zinc-400 cursor-pointer">
            <input type="checkbox" checked={isTestTransaction} onChange={(e) => setIsTestTransaction(e.target.checked)} />
            Test
          </label>
          <button type="submit" className={BTN_PRIMARY}><Plus className="h-3.5 w-3.5" /> Record</button>
        </div>
      </form>

      <div className="space-y-2">
        {entries.map((en) => (
          <div key={en.id} className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-[#0d0d11] p-3.5 flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] uppercase px-2 py-0.5 rounded bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">{en.type}</span>
                <span className="text-xs font-bold text-slate-950 dark:text-white">{en.description}</span>
                {en.isTestTransaction && <span className="font-mono text-[10px] text-amber-600">TEST (EXCLUDED)</span>}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">{en.clientName || "Direct"} · {en.createdAt?.slice(0, 10)}</div>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-slate-950 dark:text-white">{formatCents(en.amountCents)}</span>
              {(en.type === "invoice" || en.type === "verified_sale") && (
                <button
                  type="button"
                  onClick={() =>
                    exportInvoiceHtml({
                      invoiceNumber: en.invoiceNumber || `REC-${en.id.slice(0, 6)}`,
                      clientName: en.clientName || "Customer",
                      description: en.description,
                      amountCents: en.amountCents,
                      createdAt: en.createdAt || new Date().toISOString(),
                      issuerName: issuerEmail || "ContentPaysUs Creator"
                    })
                  }
                  className={BTN_SECONDARY}
                >
                  <Download className="h-3 w-3" /> Invoice
                </button>
              )}
              <button type="button" onClick={() => remove(en.id)} className="text-rose-600 p-1 cursor-pointer"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// =========================================================================
// 12. SHARED INTELLIGENCE MEMORY CONTROLS (Creator Inspect & Delete)
// =========================================================================
export function SharedIntelligenceMemoryPanel() {
  const [contributions, setContributions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    ecosystemFetch<{ contributions: any[] }>("/api/intelligence/contributions")
      .then((d) => setContributions(d.contributions || []))
      .catch((e) => setError(e?.message || "Failed to load shared memory records."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const remove = async (id: string) => {
    await ecosystemFetch(`/api/intelligence/contributions/${id}`, { method: "DELETE" });
    setContributions((prev) => prev.filter((c) => c.id !== id));
  };

  return (
    <div className={CARD_CLS}>
      <div>
        <h3 className="text-base font-bold text-slate-950 dark:text-white flex items-center gap-2">
          <Brain className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          Shared Intelligence Memory Controls
        </h3>
        <p className="text-xs text-slate-600 dark:text-zinc-400">
          Inspect and delete facts saved across ContentPaysUs applications. Project Z sandbox experiments are strictly isolated and never pollute your production memory.
        </p>
      </div>
      {error && <div className="text-xs text-rose-600">{error}</div>}
      {loading ? (
        <div className="text-xs text-slate-500 flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading shared memory...</div>
      ) : contributions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 dark:border-zinc-700 p-5 text-xs text-slate-600 dark:text-zinc-400">
          No cross-app Shared Intelligence contributions saved yet. When you save assets in CreatorWorks, DemandWorks, OfferWorks, or ProductWorks, verified summaries appear here for full inspection and deletion control.
        </div>
      ) : (
        <div className="space-y-2.5">
          {contributions.map((c) => (
            <div key={c.id} className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-[#0d0d11] p-4 flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[10px] uppercase px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-700 dark:text-indigo-400">{c.sourceAppId}</span>
                  <span className="font-mono text-[10px] uppercase text-slate-500">{c.category} · {c.provenance || "user_provided_fact"}</span>
                </div>
                <div className="text-xs font-bold text-slate-950 dark:text-white">{c.data?.title || c.factType}</div>
                {c.data?.summary && <p className="text-xs text-slate-600 dark:text-zinc-400 line-clamp-2">{c.data.summary}</p>}
              </div>
              <button type="button" onClick={() => remove(c.id)} aria-label="Delete memory record" className="text-rose-600 dark:text-rose-400 p-1.5 cursor-pointer shrink-0">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
