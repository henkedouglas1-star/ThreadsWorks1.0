import React from "react";
import { Cpu, Sparkles, ExternalLink, ArrowRight, Layers, CheckCircle2 } from "lucide-react";

interface ContentPaysUsWorkspaceProps {
  onNavigate: (route: string) => void;
}

export function ContentPaysUsWorkspace({ onNavigate }: ContentPaysUsWorkspaceProps) {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20 space-y-12">
      
      {/* Status Card */}
      <div className="rounded-3xl border border-amber-500/30 bg-gradient-to-b from-slate-900 via-slate-900 to-amber-950/20 p-8 sm:p-14 text-center shadow-2xl relative overflow-hidden">
        
        <div className="absolute top-6 right-6 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold uppercase tracking-wider border border-amber-500/30">
          In Development
        </div>

        <div className="h-16 w-16 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-6 shadow-xl border border-amber-500/30">
          <Cpu className="h-8 w-8 animate-pulse" />
        </div>

        <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight mb-4">
          Unified ContentPaysUs Workspace
        </h1>

        <p className="text-base sm:text-lg text-amber-200/90 max-w-2xl mx-auto mb-8 font-medium leading-relaxed">
          The centralized shared intelligence layer and multi-app creator workspace are currently in progressive development.
        </p>

        <p className="text-xs sm:text-sm text-slate-300 max-w-xl mx-auto leading-relaxed mb-10">
          While the unified ContentPaysUs workspace is being built, you can immediately access operational applications like ThreadsWorks and ProductWorks through their dedicated production routes.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            onClick={() => onNavigate("/create")}
            className="w-full sm:w-auto px-8 py-4 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 cursor-pointer"
          >
            Launch ThreadsWorks Workspace <ExternalLink className="h-4 w-4" />
          </button>
          <button
            onClick={() => onNavigate("/applications")}
            className="w-full sm:w-auto px-8 py-4 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 flex items-center justify-center gap-2 cursor-pointer"
          >
            Explore All 16 Applications <ArrowRight className="h-4 w-4" />
          </button>
        </div>

      </div>

      {/* Roadmap Preview */}
      <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-8 sm:p-10 space-y-6">
        <h3 className="text-lg font-bold text-white">What to Expect in Future Phases</h3>
        <div className="space-y-4">
          <div className="flex items-start gap-3 bg-slate-950/60 border border-slate-800 p-4 rounded-2xl">
            <CheckCircle2 className="h-5 w-5 text-indigo-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-white mb-1">Single Sign-On & Creator Identity</h4>
              <p className="text-xs text-slate-400 leading-relaxed">Unified authentication across all 16 ContentPaysUs specialized applications with synchronized voice and brand context.</p>
            </div>
          </div>

          <div className="flex items-start gap-3 bg-slate-950/60 border border-slate-800 p-4 rounded-2xl">
            <CheckCircle2 className="h-5 w-5 text-purple-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-white mb-1">Shared Intelligence & Cross-App Projects</h4>
              <p className="text-xs text-slate-400 leading-relaxed">Seamless data flow connecting audience demand research in DemandWorks directly to content drafting in ThreadsWorks and product creation in ProductWorks.</p>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
