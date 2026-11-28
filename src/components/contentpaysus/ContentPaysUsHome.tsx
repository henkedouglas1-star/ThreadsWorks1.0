import React, { useState } from "react";
import { Sparkles, ArrowRight, Layers, BookOpen, Compass, CheckCircle2, Shield, Zap, Users, Target, BarChart3, ExternalLink } from "lucide-react";
import { CONTENT_PAYS_US_APPS } from "../../data/contentPaysUsRegistry";

interface ContentPaysUsHomeProps {
  onNavigate: (route: string) => void;
}

export function ContentPaysUsHome({ onNavigate }: ContentPaysUsHomeProps) {
  const [activeJourneyStep, setActiveJourneyStep] = useState(0);

  const journeyStages = [
    {
      number: "01",
      title: "Build your brand",
      category: "Foundation",
      description: "Establish your core positioning, audience focus, and brand voice before producing content.",
      connection: "Feeds clear positioning into content strategy and offer design.",
      apps: ["CreatorWorks"]
    },
    {
      number: "02",
      title: "Discover buyer demand",
      category: "Foundation",
      description: "Find and validate real problems your audience is actively struggling with.",
      connection: "Ensures what you build solves verified market pain points rather than guesswork.",
      apps: ["DemandWorks"]
    },
    {
      number: "03",
      title: "Earn attention",
      category: "Attention",
      description: "Build content strategies, draft posts, and cultivate two-way audience relationships.",
      connection: "Drives consistent audience engagement and trust across social channels.",
      apps: ["ContentWorks", "ThreadsWorks", "CommunityWorks"]
    },
    {
      number: "04",
      title: "Create an offer",
      category: "Monetization",
      description: "Shape your knowledge into clear offers and generate downloadable digital products behind them.",
      connection: "Translates audience attention into structured commercial value and revenue.",
      apps: ["OfferWorks", "ProductWorks", "FunnelWorks", "SalesWorks"]
    },
    {
      number: "05",
      title: "Deliver customer value",
      category: "Customer Success",
      description: "Fulfill offers, onboard customers smoothly, and organize authentic proof and testimonials.",
      connection: "Builds long-term customer satisfaction and brand reputation.",
      apps: ["DeliveryWorks", "ProofWorks"]
    },
    {
      number: "06",
      title: "Grow your business",
      category: "Expansion",
      description: "Analyze performance data, support paid distribution, and scale through affiliate networks.",
      connection: "Compounds success into a sustainable, growing creator enterprise.",
      apps: ["GrowthWorks", "AdsWorks", "TeamWorks", "AffiliateWorks", "Project Z"]
    }
  ];

  return (
    <div className="space-y-24 pb-20">
      
      {/* Hero Section */}
      <section className="relative pt-20 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center">
        {/* Background glow effects */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-indigo-600/15 blur-[120px] rounded-full pointer-events-none -z-10"></div>
        <div className="absolute top-1/3 left-1/4 w-[300px] h-[200px] bg-purple-600/10 blur-[100px] rounded-full pointer-events-none -z-10"></div>

        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-xs font-semibold mb-8 shadow-sm">
          <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
          <span>The Unified Creator Ecosystem</span>
        </div>

        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold text-white tracking-tight max-w-4xl mx-auto leading-[1.1] mb-6">
          Turn what you know into a <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">business.</span>
        </h1>

        <p className="text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed mb-10">
          Learn, create, monetize and grow with one connected ecosystem of AI-powered tools and creator education.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-md mx-auto">
          <button
            onClick={() => onNavigate("/applications")}
            className="w-full sm:w-auto px-8 py-4 rounded-xl text-sm font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white shadow-xl shadow-indigo-600/30 hover:shadow-indigo-600/50 hover:scale-[1.02] transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            Explore Applications <ArrowRight className="h-4 w-4" />
          </button>
          <button
            onClick={() => onNavigate("/learn")}
            className="w-full sm:w-auto px-8 py-4 rounded-xl text-sm font-bold bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-slate-200 transition-all cursor-pointer shadow-sm flex items-center justify-center gap-2"
          >
            Learn How It Works
          </button>
        </div>

        {/* Quick Ecosystem Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto mt-20 pt-12 border-t border-slate-900">
          <div className="text-center">
            <div className="text-2xl sm:text-3xl font-extrabold text-white mb-1">16</div>
            <div className="text-xs font-medium text-slate-400">Specialized Applications</div>
          </div>
          <div className="text-center">
            <div className="text-2xl sm:text-3xl font-extrabold text-indigo-400 mb-1">6 Stages</div>
            <div className="text-xs font-medium text-slate-400">Connected Creator Journey</div>
          </div>
          <div className="text-center">
            <div className="text-2xl sm:text-3xl font-extrabold text-purple-400 mb-1">1 Identity</div>
            <div className="text-xs font-medium text-slate-400">Shared Intelligence Layer</div>
          </div>
          <div className="text-center">
            <div className="text-2xl sm:text-3xl font-extrabold text-emerald-400 mb-1">Active</div>
            <div className="text-xs font-medium text-slate-400">ThreadsWorks & ProductWorks</div>
          </div>
        </div>
      </section>

      {/* Ecosystem Architecture Principle */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-slate-800 bg-gradient-to-b from-slate-900/80 to-slate-950 p-8 sm:p-12 relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 -mt-12 -mr-12 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
          
          <div className="max-w-3xl mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 text-xs font-semibold mb-4">
              Governing Principles
            </div>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight mb-4">
              One connected ecosystem. Zero fragmented tools.
            </h2>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              ContentPaysUs brings together creator education, specialized AI applications, and a shared intelligence layer so your brand voice, audience insights, and commercial offers flow seamlessly from one app to the next.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
              <div className="h-10 w-10 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center mb-4 font-bold">
                01
              </div>
              <h3 className="text-base font-bold text-white mb-2">One Creator Identity</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Your voice settings, audience pillars, and business offers remain synchronized across every specialized application in the ecosystem.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
              <div className="h-10 w-10 rounded-xl bg-purple-600/20 text-purple-400 flex items-center justify-center mb-4 font-bold">
                02
              </div>
              <h3 className="text-base font-bold text-white mb-2">Shared Creator Projects</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Move insights from demand discovery directly into content creation, digital products, and storefront sales copy without starting from scratch.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
              <div className="h-10 w-10 rounded-xl bg-pink-600/20 text-pink-400 flex items-center justify-center mb-4 font-bold">
                03
              </div>
              <h3 className="text-base font-bold text-white mb-2">Measurable Outcomes</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Every application is engineered around tangible creator milestones—from drafting posts to launching monetized digital products.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Creator Journey Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 text-purple-400 text-xs font-semibold mb-4">
            The Creator Journey
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-4">
            How creators build sustainable businesses
          </h2>
          <p className="text-sm sm:text-base text-slate-300">
            Explore the six interconnected stages of the creator journey. Enter at any relevant stage and let ContentPaysUs guide your progress.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Stage Selector List */}
          <div className="lg:col-span-5 space-y-3">
            {journeyStages.map((stage, idx) => {
              const isSelected = activeJourneyStep === idx;
              return (
                <button
                  key={stage.number}
                  onClick={() => setActiveJourneyStep(idx)}
                  className={`w-full text-left p-5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between group ${
                    isSelected
                      ? "bg-indigo-600/15 border-indigo-500/50 text-white shadow-lg shadow-indigo-500/10"
                      : "bg-slate-900/60 border-slate-800/80 text-slate-400 hover:bg-slate-900 hover:text-slate-200"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <span className={`text-xs font-extrabold px-2.5 py-1 rounded-lg ${
                      isSelected ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-300"
                    }`}>
                      {stage.number}
                    </span>
                    <div>
                      <h3 className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors">
                        {stage.title}
                      </h3>
                      <span className="text-[11px] text-slate-400 font-medium">Stage category: {stage.category}</span>
                    </div>
                  </div>
                  <ArrowRight className={`h-4 w-4 transition-transform ${isSelected ? "text-indigo-400 translate-x-1" : "text-slate-600"}`} />
                </button>
              );
            })}
          </div>

          {/* Active Stage Details Card */}
          <div className="lg:col-span-7">
            <div className="rounded-3xl border border-indigo-500/30 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/40 p-8 sm:p-10 shadow-2xl relative">
              
              <div className="absolute top-6 right-6 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-bold uppercase tracking-wider">
                Stage {journeyStages[activeJourneyStep].number} of 06
              </div>

              <div className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-2">
                {journeyStages[activeJourneyStep].category} Tier
              </div>

              <h3 className="text-2xl sm:text-3xl font-extrabold text-white mb-4">
                {journeyStages[activeJourneyStep].title}
              </h3>

              <p className="text-sm sm:text-base text-slate-300 leading-relaxed mb-8">
                {journeyStages[activeJourneyStep].description}
              </p>

              <div className="space-y-4 pt-6 border-t border-slate-800/80 mb-8">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Ecosystem Connection</div>
                <p className="text-xs text-indigo-200 bg-indigo-950/60 border border-indigo-500/20 p-3.5 rounded-xl leading-relaxed">
                  {journeyStages[activeJourneyStep].connection}
                </p>
              </div>

              <div className="space-y-3">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Associated Specialized Applications</div>
                <div className="flex flex-wrap gap-2">
                  {journeyStages[activeJourneyStep].apps.map((appName) => (
                    <span 
                      key={appName}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold"
                    >
                      {appName}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-10 pt-6 border-t border-slate-800 flex items-center justify-between">
                <button
                  onClick={() => onNavigate("/applications")}
                  className="text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1.5 cursor-pointer"
                >
                  View applications in this tier <ArrowRight className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => onNavigate("/learn")}
                  className="text-xs font-bold text-slate-400 hover:text-slate-200 flex items-center gap-1.5 cursor-pointer"
                >
                  Read educational guide <BookOpen className="h-3.5 w-3.5" />
                </button>
              </div>

            </div>
          </div>

        </div>
      </section>

      {/* Featured Applications Highlight Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-semibold mb-3">
              Operational & In Development
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Flagship ecosystem applications
            </h2>
          </div>
          <button
            onClick={() => onNavigate("/applications")}
            className="mt-4 md:mt-0 text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1.5 cursor-pointer"
          >
            Browse all 16 applications <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* ThreadsWorks Card */}
          <div className="rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-slate-900 to-emerald-950/20 p-8 flex flex-col justify-between shadow-xl">
            <div>
              <div className="flex items-center justify-between mb-6">
                <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-bold border border-emerald-500/20">
                  Available (Operational)
                </span>
                <span className="text-xs font-semibold text-slate-400">Attention Tier</span>
              </div>
              <h3 className="text-2xl font-extrabold text-white mb-3">ThreadsWorks</h3>
              <p className="text-sm text-slate-300 leading-relaxed mb-6">
                Draft AI-powered Meta Threads posts, develop stronger hooks, manage your content library, and schedule automated publishing through official Meta OAuth.
              </p>
            </div>
            <div className="pt-6 border-t border-slate-800 flex items-center justify-between">
              <button
                onClick={() => onNavigate("/applications/threadsworks")}
                className="text-xs font-bold text-slate-300 hover:text-white cursor-pointer"
              >
                Learn details
              </button>
              <button
                onClick={() => onNavigate("/create")}
                className="px-4 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 shadow-lg shadow-emerald-600/25 cursor-pointer"
              >
                Launch ThreadsWorks <ExternalLink className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* ProductWorks Card */}
          <div className="rounded-3xl border border-indigo-500/30 bg-gradient-to-br from-slate-900 to-indigo-950/20 p-8 flex flex-col justify-between shadow-xl">
            <div>
              <div className="flex items-center justify-between mb-6">
                <span className="px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 text-xs font-bold border border-indigo-500/20">
                  In Development
                </span>
                <span className="text-xs font-semibold text-slate-400">Monetization Tier</span>
              </div>
              <h3 className="text-2xl font-extrabold text-white mb-3">ProductWorks</h3>
              <p className="text-sm text-slate-300 leading-relaxed mb-6">
                Create downloadable digital products behind offers. Generate professional PDF playbooks, 7-slide social carousels, and storefront sales copy from a single idea using AI.
              </p>
            </div>
            <div className="pt-6 border-t border-slate-800 flex items-center justify-between">
              <button
                onClick={() => onNavigate("/applications/productworks")}
                className="text-xs font-bold text-slate-300 hover:text-white cursor-pointer"
              >
                Learn details
              </button>
              <button
                onClick={() => onNavigate("/productworks")}
                className="px-4 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-1.5 shadow-lg shadow-indigo-600/25 cursor-pointer"
              >
                Explore ProductWorks <ExternalLink className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

        </div>
      </section>

    </div>
  );
}
