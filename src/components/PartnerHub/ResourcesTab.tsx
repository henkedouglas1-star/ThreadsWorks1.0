import React from "react";
import {
  BookOpen,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  Zap,
  Sparkles,
  ArrowRight,
  Info,
  DollarSign
} from "lucide-react";

export default function ResourcesTab() {
  return (
    <div className="space-y-6 animate-fade-in" id="partner-resources-tab">
      {/* Header */}
      <div className="space-y-1">
        <h2 className="text-xl font-bold text-text-primary">
          Partner Enablement & Brand Guidelines
        </h2>
        <p className="text-xs text-text-secondary">
          Approved product messaging, verified claims, and FTC compliance guidelines to maximize your conversions.
        </p>
      </div>

      {/* Product Fact Sheet */}
      <div className="rounded-2xl border border-purple-500/20 bg-bg-card p-6 space-y-4 shadow-sm">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-purple-500" />
          <h3 className="text-base font-bold text-text-primary">ThreadsWorks Product Fact Sheet</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-bg-primary border border-border-primary space-y-1.5">
            <span className="font-bold text-text-primary block font-mono text-[11px] uppercase text-purple-600 dark:text-purple-400">
              Pricing & Terms
            </span>
            <p className="text-text-secondary">
              <strong>$7 / month</strong> recurring or $59 / year. Instant cancellation at any time with no lock-in.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-bg-primary border border-border-primary space-y-1.5">
            <span className="font-bold text-text-primary block font-mono text-[11px] uppercase text-purple-600 dark:text-purple-400">
              Core Capabilities
            </span>
            <p className="text-text-secondary">
              AI Voice DNA cloning, multi-angle post synthesizer, multi-part threads generator, and 1-click publishing.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-bg-primary border border-border-primary space-y-1.5">
            <span className="font-bold text-text-primary block font-mono text-[11px] uppercase text-purple-600 dark:text-purple-400">
              Target Audience
            </span>
            <p className="text-text-secondary">
              Creators, B2B founders, agency owners, coaches, and consultants building an audience on Meta Threads.
            </p>
          </div>
        </div>
      </div>

      {/* Approved Claims vs Prohibited Claims */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Approved Claims */}
        <div className="p-6 rounded-2xl border border-emerald-500/20 bg-bg-card space-y-4">
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-sm">
            <CheckCircle2 className="h-4 w-4" />
            <span>Approved & Verified Claims</span>
          </div>

          <ul className="space-y-2.5 text-xs text-text-secondary">
            <li className="flex items-start gap-2">
              <span className="text-status-success-text font-bold">✓</span>
              <span>"ThreadsWorks turns 1 idea into 5 high-converting Threads posts in under 90 seconds."</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-status-success-text font-bold">✓</span>
              <span>"Calibrates AI output around your real tone with Voice DNA rather than generic ChatGPT slop."</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-status-success-text font-bold">✓</span>
              <span>"Affordable $7/month creator pricing with unlimited drafts and batch generation."</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-status-success-text font-bold">✓</span>
              <span>"Visual content calendar and direct publishing connection to Meta Threads."</span>
            </li>
          </ul>
        </div>

        {/* Prohibited Claims */}
        <div className="p-6 rounded-2xl border border-red-500/20 bg-bg-card space-y-4">
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400 font-bold text-sm">
            <XCircle className="h-4 w-4" />
            <span>Prohibited / False Claims</span>
          </div>

          <ul className="space-y-2.5 text-xs text-text-secondary">
            <li className="flex items-start gap-2">
              <span className="text-status-danger-text font-bold">✗</span>
              <span>Do not claim ThreadsWorks guarantees viral followers, overnight riches, or bot views.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-status-danger-text font-bold">✗</span>
              <span>Do not use spammy DM bots or unsolicited cold DM blasting.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-status-danger-text font-bold">✗</span>
              <span>Do not bid on branded Google/Meta search ads (e.g., 'ThreadsWorks', 'ThreadsWorks review').</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-status-danger-text font-bold">✗</span>
              <span>Do not disguise referral links without clear FTC affiliate disclosures.</span>
            </li>
          </ul>
        </div>
      </div>

      {/* FTC Affiliate Compliance */}
      <div className="rounded-2xl border border-border-primary bg-bg-card p-6 space-y-3">
        <div className="flex items-center gap-2 text-status-warning-text font-bold text-sm">
          <ShieldAlert className="h-4 w-4" />
          <span>FTC Affiliate Disclosure Mandate</span>
        </div>
        <p className="text-xs text-text-secondary leading-relaxed">
          Federal Trade Commission (FTC) guidelines require clear and conspicuous disclosure whenever you share an affiliate link. When posting on Threads or social channels, simply include:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div className="p-3 rounded-xl bg-bg-primary border border-border-primary text-xs font-mono text-text-primary">
            #partner or #affiliate at the end of your Threads post.
          </div>
          <div className="p-3 rounded-xl bg-bg-primary border border-border-primary text-xs font-mono text-text-primary">
            "I earn a commission if you subscribe through my link at no extra cost to you."
          </div>
        </div>
      </div>
    </div>
  );
}
