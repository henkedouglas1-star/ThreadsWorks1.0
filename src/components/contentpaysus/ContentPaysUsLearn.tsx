import React from "react";
import { BookOpen, Sparkles, CheckCircle2, ArrowRight, Layers, ExternalLink } from "lucide-react";
import { LEARN_TOPICS } from "../../data/contentPaysUsLearn";

interface ContentPaysUsLearnProps {
  onNavigate: (route: string) => void;
}

export function ContentPaysUsLearn({ onNavigate }: ContentPaysUsLearnProps) {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-16">
      
      {/* Header */}
      <div className="text-center max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 text-xs font-semibold mb-4">
          <BookOpen className="h-3.5 w-3.5" />
          <span>Creator Education Curriculum</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight mb-6">
          The Creator Business Journey
        </h1>
        <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
          Master the principles of brand development, buyer demand, content creation, offer packaging, and sustainable growth through our structured educational guide.
        </p>
      </div>

      {/* Topics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {LEARN_TOPICS.map((topic) => (
          <div
            key={topic.id}
            className="rounded-3xl border border-slate-800 bg-gradient-to-b from-slate-900/90 to-slate-950 p-8 flex flex-col justify-between shadow-xl hover:border-slate-700 transition-all"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="px-3 py-1 rounded-full bg-slate-800 text-indigo-300 text-xs font-bold">
                  {topic.stage}
                </span>
              </div>

              <h3 className="text-xl font-bold text-white mb-3 tracking-tight">
                {topic.title}
              </h3>

              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mb-6">
                {topic.summary}
              </p>

              <div className="space-y-2.5 mb-6">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Key Principles</div>
                {topic.keyPrinciples.map((principle, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-xs text-slate-300">
                    <CheckCircle2 className="h-4 w-4 text-indigo-400 shrink-0 mt-0.5" />
                    <span>{principle}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-6 border-t border-slate-800/80">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Practical Application</div>
              <p className="text-xs text-indigo-200 bg-indigo-950/40 border border-indigo-500/20 p-3 rounded-xl leading-relaxed">
                {topic.practicalApplication}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Bottom CTA Card */}
      <div className="rounded-3xl border border-indigo-500/30 bg-gradient-to-r from-indigo-950/60 via-purple-950/60 to-slate-900 p-8 sm:p-12 text-center max-w-4xl mx-auto shadow-2xl">
        <h3 className="text-2xl sm:text-3xl font-extrabold text-white mb-4">
          Ready to put education into practice?
        </h3>
        <p className="text-sm text-slate-300 max-w-xl mx-auto mb-8 leading-relaxed">
          Explore our centralized directory of 16 specialized AI applications designed to automate each stage of your creator journey.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            onClick={() => onNavigate("/applications")}
            className="w-full sm:w-auto px-8 py-3.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 cursor-pointer"
          >
            Explore 16 Applications
          </button>
          <button
            onClick={() => onNavigate("/create")}
            className="w-full sm:w-auto px-8 py-3.5 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 cursor-pointer flex items-center justify-center gap-1.5"
          >
            Launch ThreadsWorks <ExternalLink className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

    </div>
  );
}
