import React, { useState } from "react";
import {
  Sparkles,
  Copy,
  Check,
  Share2,
  Zap,
  ArrowRight,
  BookOpen,
  MessageSquare,
  Flame,
  Layers,
  HelpCircle,
  Clock,
  Loader2,
  Calendar,
  BookmarkPlus,
  RefreshCw,
  Sliders,
  CheckCircle2,
  Lightbulb
} from "lucide-react";
import { PartnerProfile, PromoAngle, PromoContentType } from "../../types/partner";
import { generatePromoContent } from "../../services/partnerService";

interface PromoteThreadsWorksTabProps {
  partner: PartnerProfile;
  onSaveToLibrary?: (text: string, title?: string) => void;
}

const PROMO_ANGLES: { id: PromoAngle; label: string; tag: string; description: string }[] = [
  {
    id: "problem-aware",
    label: "Problem-Aware",
    tag: "High Conversion",
    description: "Targets blank-page syndrome and decision fatigue when drafting daily Threads content.",
  },
  {
    id: "educational",
    label: "Educational / Breakdown",
    tag: "Authority",
    description: "Teaches a high-performing content framework while demonstrating ThreadsWorks.",
  },
  {
    id: "personal-experience",
    label: "Personal Creator Experience",
    tag: "Authentic Story",
    description: "Shares your real workflow shift from manual writing to 90-second calibrated drafting.",
  },
  {
    id: "product-demonstration",
    label: "Product Demonstration",
    tag: "Feature Walkthrough",
    description: "Walks through the Voice DNA, multi-part synthesizer, or 1-click scheduling.",
  },
  {
    id: "before-after",
    label: "Before vs. After",
    tag: "Contrast",
    description: "Compares spending 2 hours writing generic posts vs. 10 minutes scheduling 5 posts.",
  },
  {
    id: "workflow-improvement",
    label: "Workflow & Speed",
    tag: "Efficiency",
    description: "Shows how to turn 1 raw daily observation into 5 high-converting Threads posts.",
  },
  {
    id: "creator-productivity",
    label: "Creator Productivity",
    tag: "Output",
    description: "How to stay prolific and post 3-5x daily without burning out.",
  },
  {
    id: "content-consistency",
    label: "Daily Consistency",
    tag: "Algorithm",
    description: "Why publishing daily on Threads drives compound audience growth.",
  },
  {
    id: "content-organization",
    label: "Calendar & Organization",
    tag: "Clarity",
    description: "Managing a month of Threads content in one visual, stress-free dashboard.",
  },
  {
    id: "ai-assisted",
    label: "Voice DNA & Anti-Slop AI",
    tag: "Differentiation",
    description: "Explains why generic ChatGPT fails on Threads and why Voice DNA converts.",
  },
  {
    id: "soft-sell",
    label: "Soft Sell / Hand-Raiser",
    tag: "High Engagement",
    description: "Invites followers to comment 'LINK' or reply to receive your stack breakdown.",
  },
  {
    id: "direct-recommendation",
    label: "Direct $7/Mo Recommendation",
    tag: "Direct Pitch",
    description: "High-conviction, no-nonsense pitch: why ThreadsWorks ($7) is the best ROI software.",
  },
];

const PROMO_CONTENT_TYPES: { id: PromoContentType; label: string; icon: any }[] = [
  { id: "threads-post", label: "Single Threads Post", icon: MessageSquare },
  { id: "hook", label: "3 Scroll-Stopping Hooks", icon: Flame },
  { id: "demo-breakdown", label: "Multi-Part Thread", icon: Layers },
  { id: "reply", label: "Reply Starter & Comments", icon: MessageSquare },
  { id: "soft-cta", label: "Soft Hand-Raiser CTA", icon: Sparkles },
  { id: "direct-cta", label: "Direct Conversion CTA", icon: ArrowRight },
  { id: "objection-response", label: "Objection Buster", icon: HelpCircle },
];

export default function PromoteThreadsWorksTab({ partner, onSaveToLibrary }: PromoteThreadsWorksTabProps) {
  const referralUrl = partner.referralUrl || `https://threadsworks.com/?ref=${partner.referralCode}`;

  // State for AI Generator
  const [selectedAngle, setSelectedAngle] = useState<PromoAngle>("problem-aware");
  const [selectedContentType, setSelectedContentType] = useState<PromoContentType>("threads-post");
  const [audience, setAudience] = useState("Ambitious creators, coaches, and digital entrepreneurs");
  const [tone, setTone] = useState("Authoritative, punchy, conversational");
  const [isDirectSell, setIsDirectSell] = useState(false);
  const [customNote, setCustomNote] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<any>(null);

  // Copy feedback state
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const content = await generatePromoContent({
        angle: selectedAngle,
        contentType: selectedContentType,
        audience,
        tone,
        isDirectSell,
        customNote,
        referralLink: referralUrl,
      });
      setGeneratedContent(content);
    } catch (err: any) {
      console.error("[PROMO_TAB] Generate error:", err);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in" id="promote-threadsworks-tab">
      {/* 1. Quick Start Link Bar */}
      <div className="rounded-2xl border border-purple-500/20 bg-bg-card p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 font-mono">
              Quick Share Your Referral Link
            </span>
            <h3 className="text-lg font-bold text-text-primary">
              Ready to Share ThreadsWorks?
            </h3>
            <p className="text-xs text-text-secondary">
              Drop this link in your Threads bio, post comments, newsletter, or DMs.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => copyToClipboard(referralUrl, "quick-link")}
              className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs sm:text-sm font-bold shadow-md shadow-purple-600/20 flex items-center gap-2 transition cursor-pointer"
            >
              {copiedKey === "quick-link" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              <span>{copiedKey === "quick-link" ? "Copied Link!" : "Copy My Link"}</span>
            </button>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-bg-primary border border-border-primary text-xs font-mono text-text-primary truncate select-all">
          {referralUrl}
        </div>
      </div>

      {/* 2. AI Promotion Assistant */}
      <div className="rounded-2xl border border-border-primary bg-bg-card p-5 sm:p-7 space-y-6 shadow-sm">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-purple-500/10 px-3 py-1 text-xs font-bold text-purple-600 dark:text-purple-400 border border-purple-500/20">
            <Sparkles className="h-3.5 w-3.5" /> AI Promotion Generator
          </div>
          <h2 className="text-xl font-bold text-text-primary">
            Generate High-Converting Threads Promotional Copy
          </h2>
          <p className="text-xs text-text-secondary">
            Calibrated with verified ThreadsWorks facts ($7/month, unlimited generation, authentic Voice DNA, 50% recurring affiliate).
          </p>
        </div>

        {/* Form Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Angle Picker */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-text-primary uppercase tracking-wider font-mono">
              1. Choose Promotion Angle:
            </label>
            <select
              value={selectedAngle}
              onChange={(e) => setSelectedAngle(e.target.value as PromoAngle)}
              className="w-full rounded-xl border border-border-primary bg-bg-primary px-3.5 py-2.5 text-xs text-text-primary focus:outline-none focus:border-purple-500 transition"
            >
              {PROMO_ANGLES.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label} ({a.tag})
                </option>
              ))}
            </select>
            <p className="text-[11px] text-text-muted">
              {PROMO_ANGLES.find((a) => a.id === selectedAngle)?.description}
            </p>
          </div>

          {/* Content Type Picker */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-text-primary uppercase tracking-wider font-mono">
              2. Choose Format:
            </label>
            <select
              value={selectedContentType}
              onChange={(e) => setSelectedContentType(e.target.value as PromoContentType)}
              className="w-full rounded-xl border border-border-primary bg-bg-primary px-3.5 py-2.5 text-xs text-text-primary focus:outline-none focus:border-purple-500 transition"
            >
              {PROMO_CONTENT_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* Target Audience */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-text-primary uppercase tracking-wider font-mono">
              3. Target Audience:
            </label>
            <input
              type="text"
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              placeholder="e.g. B2B consultants, SaaS founders, creators"
              className="w-full rounded-xl border border-border-primary bg-bg-primary px-3.5 py-2.5 text-xs text-text-primary focus:outline-none focus:border-purple-500 transition"
            />
          </div>

          {/* Tone & Sell Type */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold text-text-primary uppercase tracking-wider font-mono">
                4. Tone & Style:
              </label>
              <label className="inline-flex items-center gap-1.5 text-xs text-text-secondary cursor-pointer">
                <input
                  type="checkbox"
                  checked={isDirectSell}
                  onChange={(e) => setIsDirectSell(e.target.checked)}
                  className="rounded text-purple-600 focus:ring-purple-500"
                />
                <span>Direct Pitch</span>
              </label>
            </div>
            <input
              type="text"
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              placeholder="e.g. Direct, punchy, conversational"
              className="w-full rounded-xl border border-border-primary bg-bg-primary px-3.5 py-2.5 text-xs text-text-primary focus:outline-none focus:border-purple-500 transition"
            />
          </div>
        </div>

        {/* Generate Button */}
        <div className="pt-2">
          <button
            id="generate-promo-btn"
            onClick={handleGenerate}
            disabled={generating}
            className="w-full py-3.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm shadow-md shadow-purple-600/20 flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
          >
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Crafting High-Converting Copy...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                <span>Generate Promotional Post</span>
              </>
            )}
          </button>
        </div>

        {/* Output Box */}
        {generatedContent && (
          <div className="rounded-2xl border border-purple-500/25 bg-bg-primary p-5 sm:p-6 space-y-4 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-border-primary">
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 font-mono">
                  {generatedContent.title}
                </span>
                <p className="text-xs text-text-muted italic">
                  {generatedContent.angleExplanation}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => copyToClipboard(generatedContent.body, "ai-output-body")}
                  className="px-3 py-1.5 rounded-lg bg-bg-card border border-border-primary text-text-secondary hover:text-text-primary text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                >
                  {copiedKey === "ai-output-body" ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copiedKey === "ai-output-body" ? "Copied!" : "Copy Post"}</span>
                </button>

                {onSaveToLibrary && (
                  <button
                    onClick={() => {
                      onSaveToLibrary(generatedContent.body, generatedContent.title);
                      setSavedKey("ai-saved");
                      setTimeout(() => setSavedKey(null), 2500);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-purple-600/10 text-purple-600 dark:text-purple-300 border border-purple-500/20 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    {savedKey === "ai-saved" ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <BookmarkPlus className="h-3.5 w-3.5" />}
                    <span>{savedKey === "ai-saved" ? "Saved to Library!" : "Save to Library"}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Hook */}
            <div className="p-3 rounded-xl bg-purple-500/5 border border-purple-500/15 text-xs font-semibold text-text-primary">
              <span className="text-[10px] font-bold uppercase font-mono text-purple-600 dark:text-purple-400 block mb-1">
                Hook (Scroll-Stopper):
              </span>
              "{generatedContent.hook}"
            </div>

            {/* Post Body */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold uppercase font-mono text-text-muted">
                Full Post Body:
              </span>
              <div className="p-4 rounded-xl bg-bg-card border border-border-primary text-xs sm:text-sm text-text-primary whitespace-pre-line leading-relaxed font-sans select-all">
                {generatedContent.body}
              </div>
            </div>

            {/* Multi-part Thread Breakdown (if available) */}
            {generatedContent.fullThread && generatedContent.fullThread.length > 1 && (
              <div className="space-y-2 pt-2 border-t border-border-primary">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase font-mono text-text-muted">
                    Multi-Part Thread Breakdown ({generatedContent.fullThread.length} Posts):
                  </span>
                  <button
                    onClick={() => copyToClipboard(generatedContent.fullThread.join("\n\n---\n\n"), "ai-thread")}
                    className="text-[11px] text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"
                  >
                    <Copy className="h-3 w-3" />
                    <span>{copiedKey === "ai-thread" ? "Copied All!" : "Copy Full Thread"}</span>
                  </button>
                </div>
                <div className="space-y-2">
                  {generatedContent.fullThread.map((part: string, idx: number) => (
                    <div key={idx} className="p-3 rounded-lg bg-bg-card border border-border-primary text-xs text-text-secondary flex gap-3">
                      <span className="font-mono text-purple-500 font-bold shrink-0">{idx + 1}/</span>
                      <p className="whitespace-pre-line">{part}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Disclosure Guidance */}
            <div className="p-3 rounded-xl bg-bg-card border border-border-primary text-[11px] text-text-muted flex items-start gap-2">
              <Lightbulb className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <strong>FTC Disclosure Guidance:</strong> {generatedContent.suggestedDisclosure}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. Ready-to-Use Promotional Templates Vault */}
      <div className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-text-primary">
            Ready-to-Use Threads Post Templates
          </h2>
          <p className="text-xs text-text-secondary">
            Tested, high-converting copy frameworks pre-populated with your referral link.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Template 1: Problem-Aware (Blank-Page) */}
          <div className="p-5 rounded-2xl border border-border-primary bg-bg-card space-y-3 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold font-mono uppercase bg-purple-500/10 text-purple-600 dark:text-purple-300 px-2 py-0.5 rounded">
                  Problem-Aware
                </span>
                <button
                  onClick={() => copyToClipboard(
                    `Most creators fail on Threads because drafting high-conviction posts takes 45 minutes each.\n\nYou sit staring at a blank screen wondering what angle to take.\n\nThen you end up posting a generic tip that gets 0 replies.\n\nThe fix is not working harder.\nIt is using an engine that actually understands your voice and offer.\n\nThreadsWorks costs $7/mo and cuts drafting time down to 90 seconds.\n\nCheck it out here: ${referralUrl}\n\n#partner`,
                    "tpl-problem"
                  )}
                  className="text-xs font-semibold text-text-muted hover:text-text-primary flex items-center gap-1"
                >
                  {copiedKey === "tpl-problem" ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copiedKey === "tpl-problem" ? "Copied!" : "Copy"}</span>
                </button>
              </div>
              <h4 className="text-xs font-bold text-text-primary">The 45-Minute Draft Problem</h4>
              <p className="text-xs text-text-secondary leading-relaxed whitespace-pre-line">
                {`Most creators fail on Threads because drafting high-conviction posts takes 45 minutes each.\n\nYou sit staring at a blank screen wondering what angle to take.\n\nThreadsWorks costs $7/mo and cuts drafting time down to 90 seconds.\n\nLink: ${referralUrl}\n\n#partner`}
              </p>
            </div>
          </div>

          {/* Template 2: 3-Step Daily Stack */}
          <div className="p-5 rounded-2xl border border-border-primary bg-bg-card space-y-3 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold font-mono uppercase bg-blue-500/10 text-blue-600 dark:text-blue-300 px-2 py-0.5 rounded">
                  Workflow
                </span>
                <button
                  onClick={() => copyToClipboard(
                    `How I schedule 5 high-authority Threads posts daily in under 10 minutes:\n\n1. Capture 1 raw observation during the day.\n2. Feed it into ThreadsWorks with my custom Voice DNA enabled.\n3. Review the 5 generated variations, pick the sharpest hook, and queue it on the calendar.\n\nNo overthinking. No generic AI fluff.\n\nBest $7/mo I spend on software: ${referralUrl}\n\n#affiliate`,
                    "tpl-workflow"
                  )}
                  className="text-xs font-semibold text-text-muted hover:text-text-primary flex items-center gap-1"
                >
                  {copiedKey === "tpl-workflow" ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copiedKey === "tpl-workflow" ? "Copied!" : "Copy"}</span>
                </button>
              </div>
              <h4 className="text-xs font-bold text-text-primary">My 10-Minute Daily Scheduling Stack</h4>
              <p className="text-xs text-text-secondary leading-relaxed whitespace-pre-line">
                {`How I schedule 5 high-authority Threads posts daily in under 10 minutes:\n\n1. Capture 1 raw observation.\n2. Pass it through ThreadsWorks with Voice DNA.\n3. 1-click schedule to Meta Threads.\n\nBest $7/mo I spend: ${referralUrl}\n\n#affiliate`}
              </p>
            </div>
          </div>

          {/* Template 3: Soft Hand-Raiser */}
          <div className="p-5 rounded-2xl border border-border-primary bg-bg-card space-y-3 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold font-mono uppercase bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 px-2 py-0.5 rounded">
                  Soft Hand-Raiser
                </span>
                <button
                  onClick={() => copyToClipboard(
                    `I just built my entire weekly Threads content calendar in 12 minutes without writing a single generic sentence.\n\nIf you want the tool I use to calibrate AI around your actual voice and offer, reply 'THREADS' and I will DM you the link.\n\n(Cost: $7/month).`,
                    "tpl-soft"
                  )}
                  className="text-xs font-semibold text-text-muted hover:text-text-primary flex items-center gap-1"
                >
                  {copiedKey === "tpl-soft" ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copiedKey === "tpl-soft" ? "Copied!" : "Copy"}</span>
                </button>
              </div>
              <h4 className="text-xs font-bold text-text-primary">Comment 'THREADS' Hand-Raiser</h4>
              <p className="text-xs text-text-secondary leading-relaxed whitespace-pre-line">
                {`I just built my entire weekly Threads content calendar in 12 minutes without writing a single generic sentence.\n\nIf you want the tool I use to calibrate AI around your actual voice and offer, reply 'THREADS' and I will DM you the link.\n\n(Cost: $7/month).`}
              </p>
            </div>
          </div>

          {/* Template 4: Direct $7 Comparison */}
          <div className="p-5 rounded-2xl border border-border-primary bg-bg-card space-y-3 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold font-mono uppercase bg-pink-500/10 text-pink-600 dark:text-pink-300 px-2 py-0.5 rounded">
                  Direct Comparison
                </span>
                <button
                  onClick={() => copyToClipboard(
                    `A ghostwriter charges $2,500/mo.\nA generic scheduler costs $29/mo and writes nothing.\n\nThreadsWorks is $7/mo and gives you unlimited custom-calibrated Threads posts, multi-part threads, and 1-click scheduling.\n\nTry it here: ${referralUrl}\n\n#partner`,
                    "tpl-compare"
                  )}
                  className="text-xs font-semibold text-text-muted hover:text-text-primary flex items-center gap-1"
                >
                  {copiedKey === "tpl-compare" ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copiedKey === "tpl-compare" ? "Copied!" : "Copy"}</span>
                </button>
              </div>
              <h4 className="text-xs font-bold text-text-primary">$2,500 Ghostwriter vs. $7/Mo Tool</h4>
              <p className="text-xs text-text-secondary leading-relaxed whitespace-pre-line">
                {`A ghostwriter charges $2,500/mo.\nA generic scheduler costs $29/mo and writes nothing.\n\nThreadsWorks is $7/mo with unlimited Voice DNA generation.\n\nTry it: ${referralUrl}\n\n#partner`}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
