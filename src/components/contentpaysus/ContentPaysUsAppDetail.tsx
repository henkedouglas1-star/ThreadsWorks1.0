import React from "react";
import { ArrowLeft, ExternalLink, Sparkles, CheckCircle2, Layers, Compass } from "lucide-react";
import { CONTENT_PAYS_US_APPS, EcosystemApp } from "../../data/contentPaysUsRegistry";

interface ContentPaysUsAppDetailProps {
  appId: string;
  onNavigate: (route: string) => void;
}

export function ContentPaysUsAppDetail({ appId, onNavigate }: ContentPaysUsAppDetailProps) {
  const app = CONTENT_PAYS_US_APPS.find((a) => a.id === appId);

  if (!app) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-24 text-center space-y-6">
        <h1 className="text-2xl font-bold text-white">Application Not Found</h1>
        <p className="text-sm text-slate-400">The requested application does not exist in the ContentPaysUs registry.</p>
        <button
          onClick={() => onNavigate("/applications")}
          className="px-6 py-3 rounded-xl text-xs font-bold bg-indigo-600 text-white cursor-pointer"
        >
          Back to Applications Directory
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-12">
      
      {/* Back Button */}
      <button
        onClick={() => onNavigate("/applications")}
        className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Applications Directory
      </button>

      {/* Hero Header */}
      <div className="rounded-3xl border border-slate-800 bg-gradient-to-b from-slate-900 to-slate-950 p-8 sm:p-12 shadow-2xl relative overflow-hidden">
        
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <span className={`px-3 py-1 rounded-full text-xs font-bold border ${app.badgeColor}`}>
            {app.availability}
          </span>
          <span className="px-3 py-1 rounded-full bg-slate-800 text-slate-300 text-xs font-semibold">
            {app.category} Tier
          </span>
        </div>

        <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight mb-4">
          {app.name}
        </h1>

        <p className="text-lg font-medium text-indigo-300 mb-6">
          {app.headline}
        </p>

        <p className="text-sm sm:text-base text-slate-300 leading-relaxed mb-8">
          {app.shortDescription}
        </p>

        {app.externalLink && (
          <div className="pt-6 border-t border-slate-800/80 flex items-center gap-4">
            <button
              onClick={() => onNavigate(app.externalLink!)}
              className="px-6 py-3.5 rounded-xl text-xs font-bold bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-600/30 flex items-center gap-2 cursor-pointer"
            >
              Launch {app.name} <ExternalLink className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Purpose & Problem Solved */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-8">
          <div className="text-xs font-bold uppercase tracking-wider text-indigo-400 mb-3">Core Purpose</div>
          <p className="text-sm text-slate-200 leading-relaxed">
            {app.purpose}
          </p>
        </div>

        <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-8">
          <div className="text-xs font-bold uppercase tracking-wider text-purple-400 mb-3">Problem Solved</div>
          <p className="text-sm text-slate-200 leading-relaxed">
            {app.problemSolved}
          </p>
        </div>

      </div>

      {/* Intended Outputs */}
      <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-8 sm:p-10 space-y-6">
        <h3 className="text-lg font-bold text-white">Intended Outputs & Deliverables</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {app.intendedOutputs.map((output, idx) => (
            <div key={idx} className="flex items-start gap-3 bg-slate-950/60 border border-slate-800 p-4 rounded-2xl">
              <CheckCircle2 className="h-5 w-5 text-indigo-400 shrink-0 mt-0.5" />
              <span className="text-xs sm:text-sm text-slate-200 font-medium">{output}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Ecosystem Relationship */}
      <div className="rounded-3xl border border-indigo-500/30 bg-gradient-to-r from-indigo-950/50 via-slate-900 to-slate-950 p-8 sm:p-10 space-y-4">
        <div className="text-xs font-bold uppercase tracking-wider text-indigo-300">Ecosystem Integration</div>
        <h3 className="text-xl font-bold text-white">Relationship to ContentPaysUs</h3>
        <p className="text-sm text-slate-300 leading-relaxed">
          {app.ecosystemRelationship}
        </p>
      </div>

      {/* Navigation Footer */}
      <div className="pt-8 border-t border-slate-800 flex items-center justify-between">
        <button
          onClick={() => onNavigate("/applications")}
          className="text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1.5 cursor-pointer"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to all 16 applications
        </button>
        <button
          onClick={() => onNavigate("/")}
          className="text-xs font-bold text-slate-400 hover:text-slate-200 flex items-center gap-1.5 cursor-pointer"
        >
          Return to Ecosystem Home <Compass className="h-3.5 w-3.5" />
        </button>
      </div>

    </div>
  );
}
