import React, { useEffect, useState } from "react";
import { ArrowRight, BookOpen, CheckCircle2, Circle, Download, Loader2, Save } from "lucide-react";
import { ecosystemFetch, exportStructuredAsset } from "../../services/ecosystemClient";

export interface AcademyLesson {
  id: string;
  number: string;
  module: string;
  title: string;
  durationMinutes: number;
  summary: string;
  keyTakeaways: string[];
  practicalAssignment: string;
  worksheetPrompt: string;
  recommendedAppId: string;
  recommendedAppName: string;
}

export const OFFICIAL_FIRST_SALE_LESSONS: AcademyLesson[] = [
  {
    id: "fs_lesson_01",
    number: "01",
    module: "Foundation",
    title: "Clarify One Problem Worth Paying For",
    durationMinutes: 10,
    summary:
      "Your first sale rarely comes from a huge course. It comes from solving one concrete, recurring bottleneck clearly enough that a buyer recognizes immediate value.",
    keyTakeaways: [
      "Narrow your audience to one specific person trying to accomplish one concrete outcome.",
      "Separate verified audience questions you have actually heard from assumptions you still need to test.",
      "Favor speed-to-outcome: a 2-page playbook someone finishes today beats a 12-hour course they never open."
    ],
    practicalAssignment:
      "Write down 3 real questions people in your audience have asked you recently and circle the single one you can solve clearly in under 60 minutes.",
    worksheetPrompt:
      "1. Who specifically am I helping?\n2. What concrete problem or bottleneck did I hear them mention?\n3. What clear result can they achieve in under 1 hour using my help?",
    recommendedAppId: "demandworks",
    recommendedAppName: "DemandWorks"
  },
  {
    id: "fs_lesson_02",
    number: "02",
    module: "Positioning",
    title: "Define Your Voice & Honest Positioning",
    durationMinutes: 8,
    summary:
      "People buy from creators who sound clear, specific, and grounded—not generic templates or hype. Codifying your voice once saves hours across every future tool.",
    keyTakeaways: [
      "State clearly what you help people do and how your practical mechanism works.",
      "Document phrases you naturally use and buzzwords you avoid so your writing stays authentic.",
      "Save your positioning once in Shared Intelligence so OfferWorks, ProductWorks, and ThreadsWorks stay aligned."
    ],
    practicalAssignment:
      "Complete your one-sentence positioning statement and list 5 clichés you refuse to use in your creator content.",
    worksheetPrompt:
      "Positioning Statement:\nI help [audience] achieve [specific outcome] using [practical mechanism].\n\nWords/Clichés I Avoid:\n-",
    recommendedAppId: "creatorworks",
    recommendedAppName: "CreatorWorks"
  },
  {
    id: "fs_lesson_03",
    number: "03",
    module: "Offer Design",
    title: "Shape a Simple, Transparent Starter Offer",
    durationMinutes: 12,
    summary:
      "Before building assets, specify the exact deliverables, scope, format, and transparent pricing of your starter offer so buyers know precisely what they receive.",
    keyTakeaways: [
      "Keep scope focused: 1 core asset (e.g. PDF playbook or checklist) + 1 practical template or example.",
      "State who the offer is for and who should skip it—honesty builds higher buyer trust.",
      "Choose an approachable starter price or pre-order structure without fake countdown timers."
    ],
    practicalAssignment:
      "Draft your 3-bullet Deliverables list and a plain-English refund/expectations note in OfferWorks.",
    worksheetPrompt:
      "Offer Title:\nCore Deliverable:\nBonus/Template:\nPrice (if set):\nWho It Is For / Not For:",
    recommendedAppId: "offerworks",
    recommendedAppName: "OfferWorks"
  },
  {
    id: "fs_lesson_04",
    number: "04",
    module: "Product Build",
    title: "Ship Your First Downloadable Digital Product",
    durationMinutes: 15,
    summary:
      "Turn your offer blueprint into a tangible downloadable asset—such as a 2-page PDF playbook, carousel, or workbook—in hours instead of months.",
    keyTakeaways: [
      "Edit every AI-assisted draft so it reflects your real experience and exact terminology.",
      "Verify that every downloadable file opens cleanly before sharing it with a single buyer.",
      "Pair your finished product with ProductWorks Automatic Promotion so promotional drafts stay grounded in what is actually inside."
    ],
    practicalAssignment:
      "Generate and edit your first digital product in ProductWorks, download the PDF/ZIP to inspect it yourself, and review the 5 prepared promotional drafts.",
    worksheetPrompt:
      "Product Filename Verified:\nEdits Made for Accuracy:\nTop 3 Practical Takeaways Inside the Product:",
    recommendedAppId: "productworks",
    recommendedAppName: "ProductWorks"
  },
  {
    id: "fs_lesson_05",
    number: "05",
    module: "Attraction & Conversation",
    title: "Publish Helpful Content & Start Real Buyer Conversations",
    durationMinutes: 12,
    summary:
      "Your first sale usually starts with helpful public teaching followed by a respectful one-to-one reply or conversation—not complex paid ad funnels.",
    keyTakeaways: [
      "Teach one real takeaway from your product publicly in ThreadsWorks to attract genuinely interested readers.",
      "Use conversation-starter posts that invite replies instead of hard-selling cold audiences.",
      "Log every warm inquiry cleanly in SalesWorks CRM so no interested person falls through the cracks."
    ],
    practicalAssignment:
      "Send 2 promotional drafts from ProductWorks into ThreadsWorks Library, edit them in your voice, and log at least 3 warm conversations in SalesWorks CRM.",
    worksheetPrompt:
      "Draft 1 Angle:\nDraft 2 Angle:\n3 Warm Leads or Replies Logged:",
    recommendedAppId: "threadsworks",
    recommendedAppName: "ThreadsWorks"
  },
  {
    id: "fs_lesson_06",
    number: "06",
    module: "Sale, Delivery & Proof",
    title: "Close Ethically, Deliver Smoothly & Document Verified Proof",
    durationMinutes: 12,
    summary:
      "Crossing zero-to-one is complete when a real customer pays, receives immediate value through smooth onboarding, and shares honest feedback you can document.",
    keyTakeaways: [
      "Set up your DeliveryWorks welcome checklist before your first sale so delivery feels effortless.",
      "Record verified customer sales cleanly in FinanceWorks (excluding test or self-purchases).",
      "Ask your first buyer 3 specific feedback questions after 7 days and store their response in ProofWorks."
    ],
    practicalAssignment:
      "Create your DeliveryWorks onboarding record, prepare your ProofWorks feedback script, and review your First Sale Engine milestone tracker.",
    worksheetPrompt:
      "Delivery Access Checklist:\nDay-7 Follow-Up Date:\nVerified Customer Feedback Notes:",
    recommendedAppId: "deliveryworks",
    recommendedAppName: "DeliveryWorks"
  }
];

interface ContentPaysUsAcademyViewProps {
  isAuthenticated: boolean;
  onLaunchApp?: (appId: string) => void;
  onOpenAuth?: (mode: "signin" | "signup") => void;
}

export function ContentPaysUsAcademyView({
  isAuthenticated,
  onLaunchApp,
  onOpenAuth
}: ContentPaysUsAcademyViewProps) {
  const [selectedLessonId, setSelectedLessonId] = useState<string>(OFFICIAL_FIRST_SALE_LESSONS[0].id);
  const [completedIds, setCompletedIds] = useState<string[]>([]);
  const [notesByLesson, setNotesByLesson] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<boolean>(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const activeLesson =
    OFFICIAL_FIRST_SALE_LESSONS.find((l) => l.id === selectedLessonId) || OFFICIAL_FIRST_SALE_LESSONS[0];

  useEffect(() => {
    if (!isAuthenticated) return;
    ecosystemFetch<{ completedLessonIds: string[]; assignmentNotes: Record<string, string> }>(
      "/api/ecosystem/academy/progress"
    )
      .then((data) => {
        setCompletedIds(Array.isArray(data.completedLessonIds) ? data.completedLessonIds : []);
        setNotesByLesson(data.assignmentNotes || {});
      })
      .catch(() => {});
  }, [isAuthenticated]);

  const persistProgress = async (nextCompleted: string[], nextNotes: Record<string, string>) => {
    if (!isAuthenticated) {
      setSaveMessage("Sign in free to save your course progress and worksheet notes across devices.");
      return;
    }
    setSaving(true);
    setSaveMessage(null);
    try {
      await ecosystemFetch("/api/ecosystem/academy/progress", {
        method: "PUT",
        body: { completedLessonIds: nextCompleted, assignmentNotes: nextNotes }
      });
      setSaveMessage("Progress and assignment notes saved to your account.");
    } catch (err: any) {
      setSaveMessage(err?.message || "Unable to save progress right now.");
    } finally {
      setSaving(false);
    }
  };

  const toggleLessonComplete = async (lessonId: string) => {
    const next = completedIds.includes(lessonId)
      ? completedIds.filter((id) => id !== lessonId)
      : [...completedIds, lessonId];
    setCompletedIds(next);
    await persistProgress(next, notesByLesson);
  };

  const percentComplete = Math.round(
    (completedIds.length / OFFICIAL_FIRST_SALE_LESSONS.length) * 100
  );

  return (
    <div className="space-y-8">
      {/* Official Flagship Course Interactive Player */}
      <section className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#111115] p-6 sm:p-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-zinc-800 pb-5">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[11px] font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30">
                Official ContentPaysUs Course · Free
              </span>
              <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                {OFFICIAL_FIRST_SALE_LESSONS.length} Practical Lessons · Downloadable Worksheets
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-950 dark:text-white">
              How to Get Your First Sale
            </h2>
          </div>

          <div className="min-w-[200px] space-y-1.5">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-zinc-300">
              <span>Course Progress</span>
              <span>
                {completedIds.length}/{OFFICIAL_FIRST_SALE_LESSONS.length} ({percentComplete}%)
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-zinc-800 overflow-hidden">
              <div
                className="h-full bg-emerald-600 dark:bg-emerald-500 transition-all"
                style={{ width: `${percentComplete}%` }}
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Lesson Navigation List */}
          <div className="lg:col-span-4 space-y-2">
            {OFFICIAL_FIRST_SALE_LESSONS.map((lesson) => {
              const isDone = completedIds.includes(lesson.id);
              const isSelected = activeLesson.id === lesson.id;
              return (
                <button
                  key={lesson.id}
                  type="button"
                  onClick={() => {
                    setSelectedLessonId(lesson.id);
                    setSaveMessage(null);
                  }}
                  className={`w-full text-left rounded-xl border p-3.5 transition-colors cursor-pointer flex items-start gap-3 ${
                    isSelected
                      ? "border-indigo-600 dark:border-indigo-400 bg-indigo-50/60 dark:bg-indigo-950/30"
                      : "border-slate-200 dark:border-zinc-800 bg-[#fafaf9] dark:bg-[#09090b] hover:border-slate-300 dark:hover:border-zinc-700"
                  }`}
                >
                  {isDone ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <Circle className="h-4 w-4 text-slate-400 dark:text-zinc-500 shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0">
                    <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-indigo-700 dark:text-indigo-400">
                      Lesson {lesson.number} · {lesson.module} · {lesson.durationMinutes} min
                    </p>
                    <p className="mt-0.5 text-xs font-bold text-slate-950 dark:text-white leading-snug">
                      {lesson.title}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Active Lesson Workspace */}
          <div className="lg:col-span-8 rounded-xl border border-slate-200 dark:border-zinc-800 bg-[#fafaf9] dark:bg-[#09090b] p-6 space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-mono text-xs font-semibold uppercase tracking-wider text-indigo-700 dark:text-indigo-400">
                  Lesson {activeLesson.number} · {activeLesson.module}
                </p>
                <h3 className="mt-1 text-xl font-extrabold text-slate-950 dark:text-white">
                  {activeLesson.title}
                </h3>
              </div>

              <button
                type="button"
                onClick={() => toggleLessonComplete(activeLesson.id)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  completedIds.includes(activeLesson.id)
                    ? "bg-emerald-600 text-white"
                    : "border border-slate-300 dark:border-zinc-700 bg-white dark:bg-[#111115] text-slate-800 dark:text-zinc-200 hover:border-emerald-500"
                }`}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                {completedIds.includes(activeLesson.id) ? "Completed" : "Mark Lesson Complete"}
              </button>
            </div>

            <p className="text-sm leading-relaxed text-slate-700 dark:text-zinc-300">
              {activeLesson.summary}
            </p>

            <div className="space-y-2">
              <h4 className="font-mono text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                Core Takeaways
              </h4>
              <ul className="space-y-2 text-xs leading-relaxed text-slate-800 dark:text-zinc-200">
                {activeLesson.keyTakeaways.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#111115] p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-xs font-bold text-slate-950 dark:text-white">
                  Practical Assignment &amp; Worksheet
                </h4>
                <button
                  type="button"
                  onClick={() =>
                    exportStructuredAsset(
                      "md",
                      `ContentPaysUs Academy - Lesson ${activeLesson.number} - ${activeLesson.title}`,
                      [
                        { label: "Summary", value: activeLesson.summary },
                        { label: "Assignment", value: activeLesson.practicalAssignment },
                        { label: "Worksheet Template", value: activeLesson.worksheetPrompt },
                        { label: "Your Notes", value: notesByLesson[activeLesson.id] || "" }
                      ],
                      { appId: "academy", provenance: "user_provided_fact" }
                    )
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold border border-slate-300 dark:border-zinc-700 text-slate-800 dark:text-zinc-200 hover:border-indigo-500 cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download Worksheet (.md)
                </button>
              </div>
              <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                {activeLesson.practicalAssignment}
              </p>
              <textarea
                rows={4}
                value={notesByLesson[activeLesson.id] ?? activeLesson.worksheetPrompt}
                onChange={(e) =>
                  setNotesByLesson((prev) => ({ ...prev, [activeLesson.id]: e.target.value }))
                }
                className="w-full rounded-lg border border-slate-200 dark:border-zinc-800 bg-[#fafaf9] dark:bg-[#09090b] p-3 text-xs leading-relaxed text-slate-900 dark:text-zinc-100"
              />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => persistProgress(completedIds, notesByLesson)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-slate-950 dark:bg-white text-white dark:text-slate-950 cursor-pointer disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  {isAuthenticated ? "Save Notes to Account" : "Sign In to Save Progress"}
                </button>

                {onLaunchApp ? (
                  <button
                    type="button"
                    onClick={() => onLaunchApp(activeLesson.recommendedAppId)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer"
                  >
                    Apply in {activeLesson.recommendedAppName} <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onOpenAuth?.("signup")}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer"
                  >
                    Apply in {activeLesson.recommendedAppName} <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {saveMessage && (
                <p className="text-[11px] font-medium text-indigo-700 dark:text-indigo-400">{saveMessage}</p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Clear Separation: Future Community-Created Courses */}
      <section className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#111115] p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-slate-500 dark:text-zinc-400" />
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
              Future Community Track · Planned (Separate from Official Curriculum)
            </span>
          </div>
          <h3 className="text-sm font-bold text-slate-950 dark:text-white">
            Community-Created Free Courses
          </h3>
          <p className="text-xs text-slate-600 dark:text-zinc-400 max-w-2xl leading-relaxed">
            Future creator-submitted free lessons will live in a clearly labeled Community Library separate from official ContentPaysUs Academy courses—never displaying unverified enrollment counts or synthetic ratings.
          </p>
        </div>
      </section>
    </div>
  );
}
