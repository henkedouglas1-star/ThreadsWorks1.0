import React from "react";
import { Info, Sparkles, Layers, Shield, CheckCircle2, ArrowRight, ExternalLink } from "lucide-react";

interface ContentPaysUsAboutProps {
  onNavigate: (route: string) => void;
}

export function ContentPaysUsAbout({ onNavigate }: ContentPaysUsAboutProps) {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-20">
      
      {/* Header */}
      <div className="text-center max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 text-xs font-semibold mb-4">
          <Info className="h-3.5 w-3.5" />
          <span>About ContentPaysUs</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight mb-6">
          Empowering Creators to Build Sustainable Businesses
        </h1>
        <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
          ContentPaysUs is a unified ecosystem of creator education and AI-powered specialized applications built to help you turn knowledge into useful content, valuable offers, and lasting enterprises.
        </p>
      </div>

      {/* Mission Statement Card */}
      <div className="rounded-3xl border border-indigo-500/30 bg-gradient-to-br from-indigo-950/60 via-slate-900 to-slate-950 p-8 sm:p-14 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-80 h-80 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="max-w-3xl space-y-6">
          <div className="text-xs font-bold uppercase tracking-widest text-indigo-400">Our Core Mission</div>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-white leading-tight">
            Help creators turn knowledge into useful content, valuable offers and sustainable businesses through education and practical technology.
          </h2>
          <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
            For too long, creators have been forced to stitch together dozens of disconnected subscriptions, manual spreadsheets, and brittle tools. ContentPaysUs was founded on a simpler premise: one connected ecosystem, one persistent creator identity, and specialized applications that work together seamlessly.
          </p>
        </div>
      </div>

      {/* Ecosystem & Applications Model */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
        
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 text-purple-400 text-xs font-semibold">
            Umbrella Architecture
          </div>
          <h3 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            ContentPaysUs is the umbrella brand. ThreadsWorks is one application within its broader ecosystem.
          </h3>
          <p className="text-sm text-slate-300 leading-relaxed">
            While ThreadsWorks powers professional Meta Threads creation and scheduling, it operates alongside 15 other specialized applications spanning foundation, attention, monetization, customer success, and expansion.
          </p>
          <div className="pt-2">
            <button
              onClick={() => onNavigate("/applications")}
              className="px-6 py-3 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30 flex items-center gap-2 cursor-pointer"
            >
              Explore All 16 Applications <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-8 space-y-4">
          <h4 className="text-sm font-bold text-white uppercase tracking-wider">Progressive Development Commitment</h4>
          <p className="text-xs text-slate-300 leading-relaxed">
            We believe in transparency. This public website establishes the foundational architecture and roadmap for ContentPaysUs. While flagship tools like ThreadsWorks and ProductWorks are operational or in active development, planned applications are explicitly labeled as such.
          </p>
          <div className="pt-4 border-t border-slate-800/80 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
            <span className="text-xs text-slate-200 font-medium">No inflated claims, fake functionality, or unverified software.</span>
          </div>
        </div>

      </div>

    </div>
  );
}
