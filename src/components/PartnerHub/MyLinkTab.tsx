import React, { useState } from "react";
import {
  Copy,
  Check,
  Share2,
  ExternalLink,
  ShieldCheck,
  Sliders,
  Sparkles,
  Layers,
  ArrowRight
} from "lucide-react";
import { PartnerProfile } from "../../types/partner";

interface MyLinkTabProps {
  partner: PartnerProfile;
}

export default function MyLinkTab({ partner }: MyLinkTabProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [campaignSource, setCampaignSource] = useState("");
  const [targetDestination, setTargetDestination] = useState<"/" | "/pricing">("/");

  const baseOrigin = typeof window !== "undefined" && window.location.origin
    ? window.location.origin
    : "https://threadsworks.com";

  const primaryReferralUrl = `${baseOrigin}${targetDestination}?ref=${encodeURIComponent(partner.referralCode)}${
    campaignSource ? `&src=${encodeURIComponent(campaignSource)}` : ""
  }`;

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const handleShareToX = () => {
    const text = encodeURIComponent(
      `I use ThreadsWorks to write high-converting Meta Threads posts in under 90 seconds. Try it for $7/mo: ${primaryReferralUrl} #partner`
    );
    window.open(`https://twitter.com/intent/tweet?text=${text}`, "_blank");
  };

  const handleShareToLinkedIn = () => {
    window.open(
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(primaryReferralUrl)}`,
      "_blank"
    );
  };

  return (
    <div className="space-y-6 animate-fade-in" id="my-link-tab">
      {/* 1. Primary Referral Link Card */}
      <div className="rounded-2xl border border-purple-500/25 bg-bg-card p-6 space-y-5 shadow-sm">
        <div className="space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 font-mono">
            Canonical Referral URL
          </span>
          <h2 className="text-xl font-bold text-text-primary">
            Your Dedicated Referral Link
          </h2>
          <p className="text-xs text-text-secondary">
            Any visitor who lands on ThreadsWorks through this link is tracked for 60 days. When they register, they are permanently attributed to you.
          </p>
        </div>

        {/* Link Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="flex-1 rounded-xl border border-border-primary bg-bg-primary px-4 py-3 text-xs sm:text-sm font-mono text-text-primary truncate select-all">
            {primaryReferralUrl}
          </div>
          <button
            onClick={() => copyToClipboard(primaryReferralUrl, "main-link")}
            className={`px-5 py-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition cursor-pointer shrink-0 ${
              copiedKey === "main-link"
                ? "bg-emerald-600 text-white"
                : "bg-purple-600 hover:bg-purple-700 text-white shadow-md shadow-purple-600/20"
            }`}
          >
            {copiedKey === "main-link" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            <span>{copiedKey === "main-link" ? "Copied to Clipboard!" : "Copy Link"}</span>
          </button>
        </div>

        {/* Quick Social Share Buttons */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border-primary">
          <span className="text-xs text-text-muted font-bold font-mono uppercase mr-1">
            Quick Share:
          </span>
          <button
            onClick={handleShareToX}
            className="px-3 py-1.5 rounded-lg border border-border-primary bg-bg-primary hover:bg-bg-card-hover text-xs font-semibold text-text-secondary hover:text-text-primary flex items-center gap-1.5 transition cursor-pointer"
          >
            <Share2 className="h-3.5 w-3.5" />
            <span>Share on X</span>
          </button>
          <button
            onClick={handleShareToLinkedIn}
            className="px-3 py-1.5 rounded-lg border border-border-primary bg-bg-primary hover:bg-bg-card-hover text-xs font-semibold text-text-secondary hover:text-text-primary flex items-center gap-1.5 transition cursor-pointer"
          >
            <Share2 className="h-3.5 w-3.5" />
            <span>Share on LinkedIn</span>
          </button>
        </div>
      </div>

      {/* 2. Custom Campaign Link Builder */}
      <div className="rounded-2xl border border-border-primary bg-bg-card p-6 space-y-4">
        <div className="space-y-1">
          <h3 className="text-base font-bold text-text-primary flex items-center gap-2">
            <Sliders className="h-4 w-4 text-purple-500" />
            Campaign Tag & Destination Customizer
          </h3>
          <p className="text-xs text-text-secondary">
            Add campaign identifiers to track where your highest converting traffic originates.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold font-mono text-text-secondary uppercase">
              Target Landing Page:
            </label>
            <select
              value={targetDestination}
              onChange={(e) => setTargetDestination(e.target.value as any)}
              className="w-full rounded-xl border border-border-primary bg-bg-primary px-3.5 py-2.5 text-xs text-text-primary focus:outline-none focus:border-purple-500"
            >
              <option value="/">Home / App Entry (/) </option>
              <option value="/pricing">Pricing & Checkout (/pricing) </option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold font-mono text-text-secondary uppercase">
              Traffic Source Tag (Optional):
            </label>
            <input
              type="text"
              value={campaignSource}
              onChange={(e) => setCampaignSource(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))}
              placeholder="e.g. threads_bio, newsletter, youtube"
              className="w-full rounded-xl border border-border-primary bg-bg-primary px-3.5 py-2.5 text-xs text-text-primary focus:outline-none focus:border-purple-500"
            />
          </div>
        </div>
      </div>

      {/* 3. Attribution Architecture Guarantee */}
      <div className="rounded-2xl border border-border-primary bg-bg-card p-6 space-y-4">
        <h3 className="text-base font-bold text-text-primary flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-emerald-500" />
          Durable Attribution Architecture
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-bg-primary border border-border-primary space-y-1.5">
            <h4 className="font-bold text-text-primary">1. 60-Day Browser Window</h4>
            <p className="text-text-muted leading-relaxed">
              When a visitor clicks your link, a 60-day attribution cookie is stored locally so you get credit even if they return weeks later.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-bg-primary border border-border-primary space-y-1.5">
            <h4 className="font-bold text-text-primary">2. Account Binding</h4>
            <p className="text-text-muted leading-relaxed">
              When the user creates an account, your partner ID is linked to their profile in Firestore.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-bg-primary border border-border-primary space-y-1.5">
            <h4 className="font-bold text-text-primary">3. Lifetime Recurring Rule</h4>
            <p className="text-text-muted leading-relaxed">
              Every monthly invoice processed by Stripe generates an instant 50% commission for as long as they stay subscribed.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
