import React, { useState } from "react";
import { ArrowRight, BookOpen, Check, Layers, ExternalLink } from "lucide-react";
import {
  AppAvailabilityStatus,
  CONTENT_PAYS_US_APPS,
  EcosystemCategory,
  getAppsByCategory,
  getAvailabilityDotClass,
  getAvailabilityTextClass
} from "../../data/contentPaysUsRegistry";
import { PermanentCategoryBar } from "./PermanentCategoryBar";

interface ContentPaysUsHomeProps {
  onNavigate: (route: string) => void;
  onOpenAuth?: (mode: "signin" | "signup") => void;
  isAuthenticated?: boolean;
}

interface CustomerGoal {
  number: string;
  goal: string;
  outcome: string;
  destinationLabel: string;
  path: string;
  availability: AppAvailabilityStatus;
}

interface JourneyStage {
  number: string;
  name: string;
  summary: string;
  howItConnects: string;
  primaryPath: string;
  primaryActionLabel: string;
  status: AppAvailabilityStatus;
  capabilities: string[];
}

const productWorksAvailability = CONTENT_PAYS_US_APPS.find(app => app.id === "productworks")!.availability;

const CUSTOMER_GOALS: CustomerGoal[] = [
  {
    number: "01",
    goal: "Grow my audience.",
    outcome: "Turn everyday observations into sharper Meta Threads posts and hooks people reply to.",
    destinationLabel: "ThreadsWorks AI Post Generator",
    path: "/ai-threads-post-generator",
    availability: "Available"
  },
  {
    number: "02",
    goal: "Create content consistently.",
    outcome: "Draft ahead in your own voice, organize your library, and schedule posts automatically.",
    destinationLabel: "ThreadsWorks Scheduler",
    path: "/threads-scheduler",
    availability: "Available"
  },
  {
    number: "03",
    goal: "Discover what people will buy.",
    outcome: "Research real audience friction, draft interview scripts, and validate buyer demand before investing weeks building.",
    destinationLabel: "DemandWorks",
    path: "/applications/demandworks",
    availability: "In Development"
  },
  {
    number: "04",
    goal: "Build my personal brand.",
    outcome: "Clarify your positioning, audience focus, and voice guidelines across every project.",
    destinationLabel: "CreatorWorks",
    path: "/applications/creatorworks",
    availability: "Available"
  },
  {
    number: "05",
    goal: "Create a digital product.",
    outcome: "Turn an idea or post into a downloadable PDF playbook, 7-slide carousel, storefront copy, and promo drafts.",
    destinationLabel: "ProductWorks",
    path: "/productworks",
    availability: productWorksAvailability
  },
  {
    number: "06",
    goal: "Find paying customers.",
    outcome: "Connect helpful public content to clear opt-ins, email sequences, CRM tracking, and transparent buying steps.",
    destinationLabel: "FunnelWorks & SalesWorks",
    path: "/applications/funnelworks",
    availability: "In Development"
  },
  {
    number: "07",
    goal: "Make my first sale.",
    outcome: "Follow a focused zero-to-one cross-app workflow from offer validation to your first verified customer.",
    destinationLabel: "First Sale Engine Workflow",
    path: "/workspace",
    availability: "Available"
  },
  {
    number: "08",
    goal: "Learn new business skills.",
    outcome: "Study practical creator fundamentals for free with our interactive flagship course 'How to Get Your First Sale'.",
    destinationLabel: "ContentPaysUs Academy",
    path: "/learn",
    availability: "Available"
  },
  {
    number: "09",
    goal: "Connect with other creators.",
    outcome: "Join the internal creator network to share posts, exchange feedback, message peers, and collaborate.",
    destinationLabel: "CommunityWorks",
    path: "/applications/communityworks",
    availability: "Available"
  },
  {
    number: "10",
    goal: "Save time with AI.",
    outcome: "Write faster in your authentic voice with 60 free monthly Threads posts and reusable Shared Intelligence.",
    destinationLabel: "Open ThreadsWorks",
    path: "/create",
    availability: "Available"
  }
];

const CREATOR_JOURNEY_STAGES: JourneyStage[] = [
  {
    number: "01",
    name: "Learn",
    summary: "Build practical business skills without paying for theory-heavy courses before you earn.",
    howItConnects:
      "Free interactive lessons, assignments, and worksheets in ContentPaysUs Academy connect straight into your creator projects.",
    primaryPath: "/learn",
    primaryActionLabel: "Open ContentPaysUs Academy",
    status: "Available",
    capabilities: ["ContentPaysUs Academy (Independent)", "How to Get Your First Sale (Free Course)"]
  },
  {
    number: "02",
    name: "Identify",
    summary: "Clarify your positioning and pinpoint concrete problems your audience is willing to pay to solve.",
    howItConnects:
      "Your shared creator profile and documented audience questions carry automatically into your writing and offer planning.",
    primaryPath: "/applications/creatorworks",
    primaryActionLabel: "Explore CreatorWorks & DemandWorks",
    status: "Available",
    capabilities: ["CreatorWorks (Available)", "DemandWorks (In Development)"]
  },
  {
    number: "03",
    name: "Build",
    summary: "Package what you know into a clear offer and downloadable digital assets customers can use right away.",
    howItConnects:
      "OfferWorks shapes your promise and pricing; ProductWorks builds PDF playbooks, carousels, and auto-prepares Threads promo drafts.",
    primaryPath: "/productworks",
    primaryActionLabel: "Explore ProductWorks",
    status: productWorksAvailability,
    capabilities: ["OfferWorks (Available)", `ProductWorks (${productWorksAvailability})`]
  },
  {
    number: "04",
    name: "Attract",
    summary: "Publish clear, voice-preserved content consistently so the right people discover your expertise.",
    howItConnects:
      "ContentWorks plans pillars and calendars while ThreadsWorks drafts, locks hooks, and schedules directly to Meta Threads.",
    primaryPath: "/ai-threads-post-generator",
    primaryActionLabel: "Explore ThreadsWorks",
    status: "Available",
    capabilities: ["ThreadsWorks (Available)", "ContentWorks (Available)"]
  },
  {
    number: "05",
    name: "Connect",
    summary: "Move beyond one-way broadcasting into real conversations, peer creator networks, and direct relationships.",
    howItConnects:
      "Shared context links your public posts with CommunityWorks discussions, FunnelWorks email sequences, and MeetingWorks sessions.",
    primaryPath: "/applications/communityworks",
    primaryActionLabel: "Explore CommunityWorks",
    status: "Available",
    capabilities: ["CommunityWorks (Available)", "MeetingWorks (In Development)"]
  },
  {
    number: "06",
    name: "Sell",
    summary: "Present your offer transparently, manage leads cleanly, and help buyers make confident decisions.",
    howItConnects:
      "First Sale Engine guides you across FunnelWorks, SalesWorks CRM, and StoreWorks without hype or manipulative scripts.",
    primaryPath: "/applications/salesworks",
    primaryActionLabel: "Explore SalesWorks & StoreWorks",
    status: "Available",
    capabilities: ["First Sale Engine (Guided Workflow)", "FunnelWorks", "SalesWorks", "StoreWorks"]
  },
  {
    number: "07",
    name: "Deliver",
    summary: "Onboard every customer smoothly, fulfill what you promised, and document genuine outcomes.",
    howItConnects:
      "DeliveryWorks fulfills digital products and courses while ProofWorks organizes verification-tagged customer outcomes.",
    primaryPath: "/applications/deliveryworks",
    primaryActionLabel: "Explore DeliveryWorks & ProofWorks",
    status: "Available",
    capabilities: ["DeliveryWorks (Available)", "ProofWorks (Available)"]
  },
  {
    number: "08",
    name: "Grow",
    summary: "Double down on what drives real customer outcomes through real analytics, automation, and partnerships.",
    howItConnects:
      "Real Firestore metrics, safe internal workflows, transparent finances, and partner referrals compound your momentum.",
    primaryPath: "/applications/growthworks",
    primaryActionLabel: "Explore Growth & Scale Apps",
    status: "Available",
    capabilities: ["GrowthWorks", "TeamWorks", "AffiliateWorks", "AutomationWorks", "FinanceWorks", "AdsWorks", "Project Z"]
  }
];

export function ContentPaysUsHome({
  onNavigate,
  onOpenAuth,
  isAuthenticated = false
}: ContentPaysUsHomeProps) {
  const [activeStageIndex, setActiveStageIndex] = useState(0);
  const [selectedStage, setSelectedStage] = useState(0);
  const [activeEcosystemCategory, setActiveEcosystemCategory] = useState<EcosystemCategory>("Create & Sell");

  const currentStage = CREATOR_JOURNEY_STAGES[selectedStage] || CREATOR_JOURNEY_STAGES[activeStageIndex];
  const categoryApps = getAppsByCategory(activeEcosystemCategory);

  const handleLink = (e: React.MouseEvent<HTMLAnchorElement>, path: string) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    onNavigate(path);
  };

  const handlePrimaryCta = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    if (isAuthenticated) {
      onNavigate("/workspace");
    } else if (onOpenAuth) {
      onOpenAuth("signup");
    } else {
      onNavigate("/?auth=signup");
    }
  };

  return (
    <div className="divide-y divide-slate-200/80 dark:divide-zinc-800/80">
      {/* 1. HERO SECTION — Customer Outcome First */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(ellipse_75%_60%_at_50%_-10%,rgba(79,70,229,0.12),transparent_70%)] dark:bg-[radial-gradient(ellipse_75%_60%_at_50%_-10%,rgba(99,102,241,0.22),transparent_70%)]"
        />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-20 sm:pt-24 sm:pb-28">
          <div className="cpu-center max-w-3xl mx-auto">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-indigo-700 dark:text-indigo-400">
              ContentPaysUs · Home of ThreadsWorks
            </p>

            <h1 className="mt-5 text-[clamp(2.5rem,5.2vw,4.25rem)] font-bold tracking-tight text-slate-950 dark:text-white leading-[1.06]">
              Turn your ideas into Threads content.
            </h1>

            <p className="mt-6 text-lg sm:text-xl leading-relaxed text-slate-700 dark:text-zinc-300 max-w-2xl">
              Create, organize, schedule, and publish your content with one AI-powered workspace.
            </p>

            <p className="mt-3 text-sm sm:text-base font-medium text-slate-500 dark:text-zinc-400">
              Create · Organize · Publish
            </p>

            <div className="mt-9 flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5">
              <a
                href={isAuthenticated ? "/workspace" : "/?auth=signup"}
                onClick={handlePrimaryCta}
                id="hero-get-started-cta"
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-lg text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400 text-white transition-colors"
              >
                {isAuthenticated ? "Open Your Workspace" : "Get Started Free"}
                <ArrowRight className="h-4 w-4" />
              </a>
              <a
                href="/ai-threads-post-generator"
                onClick={(e) => handleLink(e, "/ai-threads-post-generator")}
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-lg text-sm font-semibold border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors"
              >
                Explore ThreadsWorks
              </a>
            </div>

            <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-600 dark:text-zinc-400">
              <span className="inline-flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400" aria-hidden="true" />
                <strong className="font-semibold text-slate-900 dark:text-zinc-200">ThreadsWorks:</strong> Available today (60 free posts/month)
              </span>

              <a
                href="/create"
                onClick={(e) => handleLink(e, "/create")}
                className="font-semibold text-indigo-700 dark:text-indigo-400 hover:underline underline-offset-4 inline-flex items-center gap-1"
              >
                Existing ThreadsWorks user? Launch Workspace <ArrowRight className="h-3 w-3" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* 2. CUSTOMER-CENTERED GOALS — "What are you trying to accomplish?" */}
      <section id="goals" className="bg-white dark:bg-[#0c0c0f]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-18 sm:py-24">
          <div className="max-w-2xl">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-indigo-700 dark:text-indigo-400">
              Start with your goal
            </p>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight text-slate-950 dark:text-white">
              What are you trying to accomplish?
            </h2>
            <p className="mt-3 text-base leading-relaxed text-slate-600 dark:text-zinc-400">
              Choose the outcome that matters most right now. Every goal connects directly to live tools available today or an honestly labeled capability on our roadmap.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-4">
            {CUSTOMER_GOALS.map((item) => (
              <a
                key={item.number}
                href={item.path}
                onClick={(e) => handleLink(e, item.path)}
                className="group rounded-xl border border-slate-200 dark:border-zinc-800 bg-[#fafaf9] dark:bg-[#111115] p-5 sm:p-6 hover:border-indigo-400 dark:hover:border-indigo-500/60 transition-colors flex flex-col justify-between gap-4"
              >
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono text-xs font-semibold text-slate-400 dark:text-zinc-500">
                      {item.number}
                    </span>
                    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${getAvailabilityTextClass(item.availability)}`}>
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${getAvailabilityDotClass(item.availability)}`}
                        aria-hidden="true"
                      />
                      {item.availability}
                    </span>
                  </div>
                  <h3 className="mt-2.5 text-lg font-bold text-slate-950 dark:text-white group-hover:text-indigo-700 dark:group-hover:text-indigo-300 transition-colors">
                    {item.goal}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-zinc-400">
                    {item.outcome}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-200/80 dark:border-zinc-800/80 flex items-center justify-between text-xs font-semibold">
                  <span className="text-slate-700 dark:text-zinc-300">{item.destinationLabel}</span>
                  <span className="inline-flex items-center gap-1 text-indigo-700 dark:text-indigo-400 group-hover:translate-x-0.5 transition-transform">
                    {item.availability === "Available"
                      ? "Start now"
                      : item.availability === "In Development"
                      ? "Explore"
                      : "View plan"}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* 3. CONNECTED CREATOR JOURNEY — 8 Stages */}
      <section id="journey" className="bg-[#fafaf9] dark:bg-[#09090b]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-18 sm:py-24">
          <div className="cpu-center max-w-3xl mx-auto">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-indigo-700 dark:text-indigo-400">
              The Connected Creator Journey
            </p>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight text-slate-950 dark:text-white">
              Learn → Identify → Build → Attract → Connect → Sell → Deliver → Grow
            </h2>
            <p className="mt-3 text-base leading-relaxed text-slate-600 dark:text-zinc-400">
              You shouldn’t have to memorize twenty app names or repeat your brand story across disconnected tools. ContentPaysUs connects education, community, shared projects, and AI intelligence across eight clear stages.
            </p>
          </div>

          {/* 8-Stage Interactive Flow Strip */}
          <div
            role="tablist"
            aria-label="Creator journey stages"
            className="mt-10 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2"
          >
            {CREATOR_JOURNEY_STAGES.map((stage, index) => {
              const isSelected = selectedStage === index;
              return (
                <button
                  key={stage.name}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => {
                    setSelectedStage(index);
                    setActiveStageIndex(index);
                  }}
                  className={`p-3.5 rounded-lg border text-left transition-colors cursor-pointer ${
                    isSelected
                      ? "border-indigo-600 dark:border-indigo-400 bg-indigo-600 text-white"
                      : "border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#111115] text-slate-800 dark:text-zinc-200 hover:border-slate-300 dark:hover:border-zinc-700"
                  }`}
                >
                  <span
                    className={`block font-mono text-[11px] font-semibold ${
                      isSelected ? "text-indigo-100" : "text-slate-400 dark:text-zinc-500"
                    }`}
                  >
                    {stage.number}
                  </span>
                  <span className="mt-1 block text-sm font-bold">{stage.name}</span>
                </button>
              );
            })}
          </div>

          {/* Active Stage Breakdown */}
          <div className="mt-5 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#111115] p-6 sm:p-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              <div className="lg:col-span-7 space-y-4">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span className="font-mono text-xs font-semibold uppercase tracking-wider text-indigo-700 dark:text-indigo-400">
                    Stage {currentStage.number} of 08
                  </span>
                  <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${getAvailabilityTextClass(currentStage.status)}`}>
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${getAvailabilityDotClass(currentStage.status)}`}
                      aria-hidden="true"
                    />
                    {currentStage.status}
                  </span>
                </div>

                <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-950 dark:text-white">
                  {currentStage.name}
                </h3>

                <p className="text-base leading-relaxed text-slate-700 dark:text-zinc-300">
                  {currentStage.summary}
                </p>

                <p className="text-sm leading-relaxed text-slate-600 dark:text-zinc-400 pt-3 border-t border-slate-200/80 dark:border-zinc-800/80">
                  <strong className="font-semibold text-slate-900 dark:text-zinc-200">How ContentPaysUs connects it: </strong>
                  {currentStage.howItConnects}
                </p>
              </div>

              <div className="lg:col-span-5 lg:border-l lg:border-slate-200 lg:dark:border-zinc-800 lg:pl-8 space-y-5">
                <div>
                  <p className="font-mono text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                    Supporting capabilities
                  </p>
                  <ul className="mt-3 space-y-2 text-sm text-slate-800 dark:text-zinc-200">
                    {currentStage.capabilities.map((cap) => (
                      <li key={cap} className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                        <span>{cap}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="pt-2">
                  <a
                    href={currentStage.primaryPath}
                    onClick={(e) => handleLink(e, currentStage.primaryPath)}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-700 dark:text-indigo-400 hover:underline underline-offset-4"
                  >
                    {currentStage.primaryActionLabel} <ArrowRight className="h-4 w-4" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3B. PERMANENT 3-CATEGORY ECOSYSTEM DIRECTORY PREVIEW */}
      <section id="ecosystem-categories" className="bg-white dark:bg-[#0c0c0f]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-18 sm:pt-24 pb-8">
          <div className="cpu-center max-w-3xl mx-auto">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-indigo-700 dark:text-indigo-400">
              20 Specialized Applications · 3 Permanent Categories
            </p>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight text-slate-950 dark:text-white">
              Switch seamlessly across Create &amp; Sell, Connect &amp; Grow, and Automate &amp; Scale.
            </h2>
            <p className="mt-3 text-base leading-relaxed text-slate-600 dark:text-zinc-400">
              All three categories remain permanently accessible on both our website and inside your workspace—alongside free education in ContentPaysUs Academy and the guided First Sale Engine.
            </p>
          </div>
        </div>

        <PermanentCategoryBar
          activeCategory={activeEcosystemCategory}
          onSelectCategory={setActiveEcosystemCategory}
          onOpenAcademy={() => onNavigate("/learn")}
          onOpenFirstSaleEngine={() => onNavigate("/workspace")}
          stickyTopClass="top-16"
          variant="public"
        />

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 pb-20">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {categoryApps.map((app) => (
              <a
                key={app.id}
                href={`/applications/${app.id}`}
                onClick={(e) => handleLink(e, `/applications/${app.id}`)}
                className="group rounded-xl border border-slate-200 dark:border-zinc-800 bg-[#fafaf9] dark:bg-[#111115] p-5 flex flex-col justify-between gap-3 hover:border-indigo-400 dark:hover:border-indigo-500/60 transition-colors"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-base font-bold text-slate-950 dark:text-white group-hover:text-indigo-700 dark:group-hover:text-indigo-300">
                      {app.name}
                    </h3>
                    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${getAvailabilityTextClass(app.availability)}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${getAvailabilityDotClass(app.availability)}`} aria-hidden="true" />
                      {app.availability}
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-zinc-400">
                    {app.headline}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-700 dark:text-indigo-400">
                  Explore {app.name} <ArrowRight className="h-3 w-3" />
                </span>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* 4. BRAND RELATIONSHIP & ORIGIN STORY — "It started with a thread." */}
      <section id="story" className="bg-white dark:bg-[#0c0c0f]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-18 sm:py-24">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
            {/* Exact Narrative Story */}
            <div className="lg:col-span-7 space-y-5">
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-indigo-700 dark:text-indigo-400">
                Why ThreadsWorks &amp; ContentPaysUs belong together
              </p>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-950 dark:text-white">
                It started with a thread.
              </h2>

              <div className="space-y-4 text-base sm:text-lg leading-relaxed text-slate-700 dark:text-zinc-300">
                <p>
                  ThreadsWorks began with a simple purpose: helping creators turn their ideas into content.
                </p>
                <p>
                  But creating content is only part of building a successful creator business.
                </p>
                <p>
                  Creators also need to understand their audience, discover demand, build valuable products, find customers and make sales.
                </p>
                <p>
                  That is why ThreadsWorks is evolving into ContentPaysUs — a connected ecosystem designed to support the entire creator journey.
                </p>
                <p className="font-semibold text-slate-950 dark:text-white pt-1">
                  ThreadsWorks is where it started. ContentPaysUs is what we’re building together.
                </p>
              </div>

              <p className="text-sm text-slate-500 dark:text-zinc-400 pt-2">
                ThreadsWorks.com remains our official website—one home, one creator account, and one connected workspace as the ecosystem grows.
              </p>
            </div>

            {/* Live & Active Today Cards for Existing & New Customers */}
            <div className="lg:col-span-5 space-y-4">
              <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-[#fafaf9] dark:bg-[#111115] p-6">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                    Original Application
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400" aria-hidden="true" />
                    Available
                  </span>
                </div>
                <h3 className="mt-2.5 text-xl font-bold text-slate-950 dark:text-white">ThreadsWorks</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-zinc-400">
                  Write voice-preserved Meta Threads posts and multi-part threads, lock stronger hooks, organize your library, and schedule publishing via official Meta OAuth.
                </p>
                <div className="mt-5 flex items-center gap-4">
                  <a
                    href="/create"
                    onClick={(e) => handleLink(e, "/create")}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-slate-950 dark:bg-white text-white dark:text-slate-950 hover:opacity-90 transition-opacity"
                  >
                    Launch ThreadsWorks <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                  <a
                    href="/pricing"
                    onClick={(e) => handleLink(e, "/pricing")}
                    className="text-xs font-semibold text-slate-600 dark:text-zinc-300 hover:text-slate-950 dark:hover:text-white"
                  >
                    View Free &amp; Pro Plans
                  </a>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-[#fafaf9] dark:bg-[#111115] p-6">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                    Digital Product Assets
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-indigo-600 dark:bg-indigo-400" aria-hidden="true" />
                    {productWorksAvailability}
                  </span>
                </div>
                <h3 className="mt-2.5 text-xl font-bold text-slate-950 dark:text-white">ProductWorks</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-zinc-400">
                  Turn an idea or existing post into downloadable 2-page PDF playbooks, 7-slide carousels, companion posts, and storefront sales copy.
                </p>
                <div className="mt-5 flex items-center gap-4">
                  <a
                    href="/productworks"
                    onClick={(e) => handleLink(e, "/productworks")}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-400 hover:underline underline-offset-4"
                  >
                    Explore ProductWorks <ArrowRight className="h-3.5 w-3.5" />
                  </a>
                  <a
                    href="/applications"
                    onClick={(e) => handleLink(e, "/applications")}
                    className="text-xs font-semibold text-slate-600 dark:text-zinc-300 hover:text-slate-950 dark:hover:text-white"
                  >
                    View all 20 roadmap apps
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. MISSION SECTION — "1,000 creators. 1,000 first sales." */}
      <section id="mission" className="bg-[#fafaf9] dark:bg-[#09090b]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-18 sm:py-24">
          <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#111115] p-8 sm:p-12 lg:p-14">
            <div className="cpu-center max-w-3xl mx-auto">
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-indigo-700 dark:text-indigo-400">
                Our Mission
              </p>
              <h2 className="mt-3 text-3xl sm:text-5xl font-bold tracking-tight text-slate-950 dark:text-white leading-[1.08]">
                1,000 creators. 1,000 first sales.
              </h2>
              <p className="mt-5 text-lg sm:text-xl leading-relaxed text-slate-700 dark:text-zinc-300">
                Our goal is to help 1,000 creators achieve their first verified sale through ContentPaysUs.
              </p>
              <p className="mt-4 text-base leading-relaxed text-slate-600 dark:text-zinc-400">
                Creator success should be measured by meaningful business outcomes—helping real people solve real problems and earning real revenue—not just chasing follower counts, vanity impressions, or collecting more software subscriptions.
              </p>
              <p className="mt-6 pt-5 border-t border-slate-200 dark:border-zinc-800 text-xs leading-relaxed text-slate-500 dark:text-zinc-400">
                Transparency note: This is our guiding mission and long-term goal—not a claim of achieved results or a guarantee of income. Individual outcomes depend on each creator’s work, audience, and offer.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 6. CONTENTPAYSUS ACADEMY SECTION */}
      <section id="academy" className="bg-white dark:bg-[#0c0c0f]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-18 sm:py-24">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
            <div className="lg:col-span-6 space-y-4">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-indigo-700 dark:text-indigo-400">
                  ContentPaysUs Academy · Independent Learning Destination
                </p>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400" aria-hidden="true" />
                  Available Free
                </span>
              </div>

              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-950 dark:text-white">
                Learn for free. Build with AI. Grow together.
              </h2>

              <p className="text-base leading-relaxed text-slate-600 dark:text-zinc-400">
                ContentPaysUs Academy is our free learning destination designed to teach the practical fundamentals of audience building, offer creation, and earning your first sale—without locking foundational education behind expensive paywalls.
              </p>

              <p className="text-base leading-relaxed text-slate-600 dark:text-zinc-400">
                Start our interactive flagship course today, download structured worksheets, save progress in your account, and jump straight into the connected ecosystem tools.
              </p>

              <div className="pt-2">
                <a
                  href="/learn"
                  onClick={(e) => handleLink(e, "/learn")}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-700 dark:text-indigo-400 hover:underline underline-offset-4"
                >
                  <BookOpen className="h-4 w-4" />
                  Start ContentPaysUs Academy Free
                  <ArrowRight className="h-4 w-4" />
                </a>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-[#fafaf9] dark:bg-[#111115] p-6 sm:p-8 space-y-5">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                    Official Flagship Course
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400" aria-hidden="true" />
                    Available · Free
                  </span>
                </div>

                <div>
                  <h3 className="text-2xl font-bold text-slate-950 dark:text-white">
                    How to Get Your First Sale
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-zinc-400">
                    A practical, zero-fluff interactive course covering how to identify a real buyer problem, build a focused starter product, communicate its value clearly, and earn your first verified customer.
                  </p>
                </div>

                <ul className="space-y-2.5 pt-4 border-t border-slate-200 dark:border-zinc-800 text-sm text-slate-700 dark:text-zinc-300">
                  <li className="flex items-start gap-2.5">
                    <Check className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                    <span>Free to access today with downloadable worksheets and saved lesson progress.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                    <span>Direct links from every lesson straight into ThreadsWorks, ProductWorks, and SalesWorks.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                    <span>Clear separation between official ContentPaysUs curriculum and future community courses.</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 7. CLOSING CTA SECTION */}
      <section className="bg-[#fafaf9] dark:bg-[#09090b]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-18 sm:py-24">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#111115] p-8 sm:p-12">
            <div className="max-w-2xl">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-950 dark:text-white">
                Start creating today with ThreadsWorks. Grow into ContentPaysUs.
              </h2>
              <p className="mt-3 text-base leading-relaxed text-slate-600 dark:text-zinc-400">
                Create your free account to write, organize, and schedule Meta Threads posts today.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
              <a
                href={isAuthenticated ? "/workspace" : "/?auth=signup"}
                onClick={handlePrimaryCta}
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-lg text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400 text-white transition-colors"
              >
                {isAuthenticated ? "Open Workspace" : "Get Started Free"}
                <ArrowRight className="h-4 w-4" />
              </a>
              <a
                href="/applications"
                onClick={(e) => handleLink(e, "/applications")}
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-lg text-sm font-semibold border border-slate-300 dark:border-zinc-700 text-slate-900 dark:text-zinc-100 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors"
              >
                <Layers className="h-4 w-4" />
                View 20-App Roadmap
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
