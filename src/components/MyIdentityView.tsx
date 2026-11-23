import React, { useState, useEffect, useRef, useCallback } from "react";
import { UserProfile, CreatorIdentity, CharacterAvatarConfig } from "../types";
import { usePersistentDraft } from "../utils/usePersistentDraft";
import {
  Sparkles,
  Check,
  Copy,
  RotateCcw,
  BookOpen,
  ArrowRight,
  Loader2,
  Cloud,
  AlertCircle,
  CheckCircle2,
  Mic,
  Lightbulb,
  User,
  Palette,
  Eye,
  Shirt,
  Wand2,
} from "lucide-react";
import { DEFAULT_AVATAR_CONFIG } from "./avatar/avatarData";
import CharacterBuilder from "./avatar/CharacterBuilder";
import CharacterAvatarPreview from "./CharacterAvatarPreview";
import { auth, db, withTimeout, handleFirestoreError, OperationType, sanitizeForFirestore } from "../firebase";
import { doc, setDoc } from "firebase/firestore";
import { apiFetch } from "../lib/api";

interface MyIdentityViewProps {
  profile?: UserProfile | null;
  onNavigateToTab?: (tab: string) => void;
  onRefreshProfile?: () => void;
}

const DEFAULT_IDENTITY: CreatorIdentity = {
  rawVoice: "",
  personality: "",
  howYouThink: "",
  whatYouBelieve: "",
  yourExperiences: "",
  yourExpertise: "",
  yourHumor: "",
  yourPerspective: "",
  writingStyle: "",
  tone: "",
  wordsYouUse: "",
  wordsYouAvoid: "",
  whoYouHelp: "",
  whatYouHelpThemDo: "",
  whatYoureKnownFor: "",
  whatYouTalkAbout: "",
  whatYouWantPeopleToRemember: "",
  character: DEFAULT_AVATAR_CONFIG,
};

const EXAMPLE_VOICE_TEXT = `I'm an independent software founder and digital strategist building bootstrapped creator tools.

I help solo founders, creators, and online entrepreneurs turn their raw insights into high-converting Meta Threads content and predictable inbound distribution.

How I think & what I believe:
- Systems beat sporadic motivation every single time.
- Direct proof and real metrics always outperform vanity hype.
- Most social advice burns people out by demanding 10 posts a day; I focus on 1 sharp insight with a repeatable framework.

My personality & tone:
- Grounded, direct, calm, analytical, and peer-to-peer.
- Zero corporate jargon or fake guru hype.
- Sarcastic and observational when dissecting bad industry advice.

How I write:
- Short, punchy 1-line to 2-line thoughts with generous spacing.
- Real case studies and lessons from 8+ years building online.
- Words I naturally use: leverage, compounding consistency, distribution engine, clear inputs, predictable output.
- Words I avoid: synergy, supercharge, game-changer, crushing it, 10x guru, passive wealth.`;

const STARTER_PROMPTS = [
  {
    label: "Founder / Builder",
    text: "I am a solo software founder building bootstrapped products. I help indie founders build profitable SaaS products without burning out. I believe in extreme product simplicity and customer proof over hype. My personality is pragmatic, transparent, and direct. I write in short, punchy 1-2 line thoughts with zero buzzwords. I avoid words like 'synergy', 'game-changer', and 'crushing it'."
  },
  {
    label: "Coach / Strategist",
    text: "I am a positioning consultant and conversion strategist for high-ticket service providers. I help boutique consultants and agency owners attract qualified inbound clients through authority content. My background is 8 years in B2B sales and copywriting. I think in repeatable offer frameworks. My tone is calm, authoritative, and peer-to-peer. I never use high-pressure hype or fake scarcity."
  },
  {
    label: "Solo Creator / Writer",
    text: "I help modern creators build predictable audience distribution on Meta Threads. I talk about copywriting frameworks, organic growth systems, and solo economics. I believe consistency and genuine proof beat vanity metrics every single time. My humor is dry, observational, and self-aware. I write in short, conversational paragraphs with clear takeaways."
  }
];

function buildNormalizedIdentity(
  raw?: Partial<CreatorIdentity> | null,
  profile?: UserProfile | null
): CreatorIdentity {
  const char: Partial<CharacterAvatarConfig> = raw?.character || {};
  const charApp: Partial<CharacterAvatarConfig["appearance"]> = char.appearance || {};
  const charCloth: Partial<CharacterAvatarConfig["clothing"]> = char.clothing || {};

  return {
    rawVoice: raw?.rawVoice || profile?.rawVoice || "",
    personality: raw?.personality || "",
    howYouThink: raw?.howYouThink || "",
    whatYouBelieve: raw?.whatYouBelieve || "",
    yourExperiences: raw?.yourExperiences || "",
    yourExpertise: raw?.yourExpertise || profile?.offer || "",
    yourHumor: raw?.yourHumor || "",
    yourPerspective: raw?.yourPerspective || "",
    writingStyle: raw?.writingStyle || profile?.writingStyle || "",
    tone: raw?.tone || "",
    wordsYouUse: raw?.wordsYouUse || profile?.keywords || "",
    wordsYouAvoid: raw?.wordsYouAvoid || "",
    whoYouHelp: raw?.whoYouHelp || profile?.audience || "",
    whatYouHelpThemDo: raw?.whatYouHelpThemDo || profile?.desiredResult || "",
    whatYoureKnownFor: raw?.whatYoureKnownFor || "",
    whatYouTalkAbout: raw?.whatYouTalkAbout || "",
    whatYouWantPeopleToRemember: raw?.whatYouWantPeopleToRemember || "",
    character: {
      name: char.name || DEFAULT_AVATAR_CONFIG.name,
      baseCharacter: char.baseCharacter || DEFAULT_AVATAR_CONFIG.baseCharacter,
      appearance: {
        skinTone: charApp.skinTone || DEFAULT_AVATAR_CONFIG.appearance.skinTone,
        faceShape: charApp.faceShape || DEFAULT_AVATAR_CONFIG.appearance.faceShape,
        hairStyle: charApp.hairStyle || DEFAULT_AVATAR_CONFIG.appearance.hairStyle,
        hairColor: charApp.hairColor || DEFAULT_AVATAR_CONFIG.appearance.hairColor,
        eyeStyle: charApp.eyeStyle || DEFAULT_AVATAR_CONFIG.appearance.eyeStyle,
        eyebrows: charApp.eyebrows || DEFAULT_AVATAR_CONFIG.appearance.eyebrows,
      },
      clothing: {
        category: charCloth.category || DEFAULT_AVATAR_CONFIG.clothing.category,
        style: charCloth.style || DEFAULT_AVATAR_CONFIG.clothing.style,
        color: charCloth.color || DEFAULT_AVATAR_CONFIG.clothing.color,
        accentColor: charCloth.accentColor || DEFAULT_AVATAR_CONFIG.clothing.accentColor,
        bottoms: charCloth.bottoms || DEFAULT_AVATAR_CONFIG.clothing.bottoms,
        bottomsColor: charCloth.bottomsColor || DEFAULT_AVATAR_CONFIG.clothing.bottomsColor,
        shoes: charCloth.shoes || DEFAULT_AVATAR_CONFIG.clothing.shoes,
        shoesColor: charCloth.shoesColor || DEFAULT_AVATAR_CONFIG.clothing.shoesColor,
        hat: charCloth.hat || DEFAULT_AVATAR_CONFIG.clothing.hat,
        hatColor: charCloth.hatColor || DEFAULT_AVATAR_CONFIG.clothing.hatColor,
      },
      accessories: Array.isArray(char.accessories) ? char.accessories : DEFAULT_AVATAR_CONFIG.accessories,
      expression: char.expression || DEFAULT_AVATAR_CONFIG.expression,
      avatarStyle: char.avatarStyle || DEFAULT_AVATAR_CONFIG.avatarStyle,
      backdrop: char.backdrop || DEFAULT_AVATAR_CONFIG.backdrop,
    },
  };
}

function synthesizeInitialVoiceText(id: CreatorIdentity | null): string {
  if (!id) return "";
  if (id.rawVoice && id.rawVoice.trim()) return id.rawVoice.trim();

  const parts: string[] = [];
  if (id.whoYouHelp || id.whatYouHelpThemDo) {
    parts.push(`Audience & Mission: I help ${id.whoYouHelp || "creators and founders"} ${id.whatYouHelpThemDo || "scale their impact"}.`);
  }
  if (id.personality || id.tone) {
    parts.push(`Personality & Tone: ${[id.personality, id.tone].filter(Boolean).join(". ")}`);
  }
  if (id.howYouThink || id.whatYouBelieve) {
    parts.push(`Thinking & Beliefs: ${[id.howYouThink, id.whatYouBelieve].filter(Boolean).join(". ")}`);
  }
  if (id.yourExperiences || id.yourExpertise) {
    parts.push(`Background & Expertise: ${[id.yourExperiences, id.yourExpertise].filter(Boolean).join(". ")}`);
  }
  if (id.writingStyle) {
    parts.push(`Writing Style: ${id.writingStyle}`);
  }
  if (id.wordsYouUse) {
    parts.push(`Phrases & Words I Use: ${id.wordsYouUse}`);
  }
  if (id.wordsYouAvoid) {
    parts.push(`Words I Avoid: ${id.wordsYouAvoid}`);
  }
  if (id.whatYouTalkAbout) {
    parts.push(`Topics: ${id.whatYouTalkAbout}`);
  }

  return parts.join("\n\n");
}

export default function MyIdentityView({ profile, onNavigateToTab, onRefreshProfile }: MyIdentityViewProps) {
  const currentUid = profile?.uid || auth.currentUser?.uid || "";
  const [activeUid, setActiveUid] = useState<string>(currentUid);
  const [activeSection, setActiveSection] = useState<"voice" | "character">("voice");

  const [identity, setIdentity] = useState<CreatorIdentity>(() => {
    if (profile?.creatorIdentity) {
      return buildNormalizedIdentity(profile.creatorIdentity, profile);
    }
    if (currentUid) {
      const saved = localStorage.getItem(`threadsworks_identity_${currentUid}`);
      if (saved) {
        try {
          return buildNormalizedIdentity(JSON.parse(saved), profile);
        } catch (e) {
          console.warn("Failed parsing cached identity:", e);
        }
      }
    }
    return buildNormalizedIdentity(null, profile);
  });

  // Single unified voice text state
  const [voiceText, setVoiceText] = usePersistentDraft<string>("my-identity", "voice-text", identity.rawVoice || synthesizeInitialVoiceText(identity));

  const [isEnhancingVoice, setIsEnhancingVoice] = useState<boolean>(false);
  const [previousVoiceText, setPreviousVoiceText] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isSavingChar, setIsSavingChar] = useState<boolean>(false);
  const [saveCharSuccess, setSaveCharSuccess] = useState<boolean>(false);
  const [saveToast, setSaveToast] = useState<boolean>(false);
  const [saveToastMessage, setSaveToastMessage] = useState<string>("Your Voice saved successfully!");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [copiedSummary, setCopiedSummary] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sync when profile arrives or changes
  useEffect(() => {
    if (!currentUid) {
      setIdentity(DEFAULT_IDENTITY);
      setActiveUid("");
      return;
    }

    if (currentUid !== activeUid) {
      setActiveUid(currentUid);
      let loaded: CreatorIdentity | null = null;

      if (profile?.creatorIdentity) {
        loaded = buildNormalizedIdentity(profile.creatorIdentity, profile);
      } else {
        const cached = localStorage.getItem(`threadsworks_identity_${currentUid}`);
        if (cached) {
          try {
            loaded = buildNormalizedIdentity(JSON.parse(cached), profile);
          } catch (_) {}
        }
      }

      if (!loaded) {
        loaded = buildNormalizedIdentity(null, profile);
      }

      setIdentity(loaded);
      const initialText = loaded.rawVoice || profile?.rawVoice || synthesizeInitialVoiceText(loaded);
      setVoiceText(initialText);
      try {
        localStorage.setItem(`threadsworks_identity_${currentUid}`, JSON.stringify(loaded));
      } catch (_) {}
    } else if (profile?.creatorIdentity) {
      const synced = buildNormalizedIdentity(profile.creatorIdentity, profile);
      setIdentity(synced);
      if (!voiceText.trim() && (synced.rawVoice || profile.rawVoice)) {
        setVoiceText(synced.rawVoice || profile.rawVoice || "");
      }
    }
  }, [currentUid, activeUid, profile]);

  // Persist both raw text and AI-extracted identity to Firestore and LocalStorage
  const persistVoiceData = useCallback(
    async (rawText: string, structuredIdentity: CreatorIdentity, targetUid: string) => {
      if (!targetUid) return;

      try {
        setSaveStatus("saving");

        const completeIdentity: CreatorIdentity = {
          ...structuredIdentity,
          rawVoice: rawText,
        };

        // 1. Cache locally
        localStorage.setItem(`threadsworks_identity_${targetUid}`, JSON.stringify(completeIdentity));

        // 2. Firestore user doc
        const userRef = doc(db, "users", targetUid);
        const payload = {
          rawVoice: rawText,
          creatorIdentity: completeIdentity,
          audience: completeIdentity.whoYouHelp || "",
          desiredResult: completeIdentity.whatYouHelpThemDo || "",
          writingStyle: completeIdentity.writingStyle || "",
          offer: completeIdentity.yourExpertise || "",
          keywords: completeIdentity.wordsYouUse || "",
          updatedAt: new Date().toISOString(),
        };

        await Promise.all([
          withTimeout(setDoc(userRef, sanitizeForFirestore(payload), { merge: true }), 5000, true),
          withTimeout(setDoc(doc(db, "settings", targetUid), sanitizeForFirestore({ rawVoice: rawText, creatorIdentity: completeIdentity, audience: completeIdentity.whoYouHelp || "", desiredResult: completeIdentity.whatYouHelpThemDo || "", writingStyle: completeIdentity.writingStyle || "", offer: completeIdentity.yourExpertise || "", keywords: completeIdentity.wordsYouUse || "", updatedAt: new Date().toISOString() }), { merge: true }), 3000, true).catch(() => {})
        ]);

        // 4. Update cached profile
        const profileCacheKey = `profile_${targetUid}`;
        const existingCacheStr = localStorage.getItem(profileCacheKey);
        let existingProfile: any = {};
        if (existingCacheStr) {
          try {
            existingProfile = JSON.parse(existingCacheStr);
          } catch (_) {}
        }
        const updatedProfile = {
          ...existingProfile,
          ...payload,
          uid: targetUid,
          email: auth.currentUser?.email || existingProfile.email || "",
        };
        localStorage.setItem(profileCacheKey, JSON.stringify(updatedProfile));

        setIdentity(completeIdentity);
        setSaveStatus("saved");

        if (onRefreshProfile) {
          onRefreshProfile();
        }
      } catch (err: any) {
        console.error("Failed saving voice profile:", err);
        handleFirestoreError(err, OperationType.WRITE, `users/${targetUid}`);
        setSaveStatus("error");
      }
    },
    [onRefreshProfile]
  );

  // Main Unified AI Save & Extract Handler
  const handleSaveVoice = async () => {
    if (!voiceText.trim()) {
      setErrorMsg("Please enter something about yourself and how you communicate.");
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);
    setSaveStatus("saving");

    const targetUid = currentUid || auth.currentUser?.uid || "";

    try {
      // Send raw unified text to AI extraction backend
      let extractedData: Partial<CreatorIdentity> = {};
      try {
        const data = await apiFetch<any>("/api/extract-identity", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rawInput: voiceText.trim(),
            existingIdentity: identity.personality || identity.whoYouHelp ? identity : null,
          }),
        });

        if (data.identity && typeof data.identity === "object") {
          extractedData = data.identity;
        }
      } catch (aiErr) {
        console.warn("AI voice extraction fallback:", aiErr);
      }

      const mergedIdentity: CreatorIdentity = {
        rawVoice: voiceText.trim(),
        personality: extractedData.personality || identity.personality || "",
        howYouThink: extractedData.howYouThink || identity.howYouThink || "",
        whatYouBelieve: extractedData.whatYouBelieve || identity.whatYouBelieve || "",
        yourExperiences: extractedData.yourExperiences || identity.yourExperiences || "",
        yourExpertise: extractedData.yourExpertise || identity.yourExpertise || "",
        yourHumor: extractedData.yourHumor || identity.yourHumor || "",
        yourPerspective: extractedData.yourPerspective || identity.yourPerspective || "",
        writingStyle: extractedData.writingStyle || identity.writingStyle || "",
        tone: extractedData.tone || identity.tone || "",
        wordsYouUse: extractedData.wordsYouUse || identity.wordsYouUse || "",
        wordsYouAvoid: extractedData.wordsYouAvoid || identity.wordsYouAvoid || "",
        whoYouHelp: extractedData.whoYouHelp || identity.whoYouHelp || "",
        whatYouHelpThemDo: extractedData.whatYouHelpThemDo || identity.whatYouHelpThemDo || "",
        whatYoureKnownFor: extractedData.whatYoureKnownFor || identity.whatYoureKnownFor || "",
        whatYouTalkAbout: extractedData.whatYouTalkAbout || identity.whatYouTalkAbout || "",
        whatYouWantPeopleToRemember: extractedData.whatYouWantPeopleToRemember || identity.whatYouWantPeopleToRemember || "",
        character: identity.character || DEFAULT_AVATAR_CONFIG,
      };

      if (targetUid) {
        await persistVoiceData(voiceText.trim(), mergedIdentity, targetUid);
      }

      setSaveToastMessage("Your Voice is saved and ready for content generation!");
      setSaveToast(true);
      setTimeout(() => setSaveToast(false), 3000);
    } catch (err: any) {
      console.error("Save error:", err);
      setErrorMsg("Failed to save. Your text is preserved below, please try again.");
      setSaveStatus("error");
    } finally {
      setIsSaving(false);
    }
  };

  // AI Depth Enhancement for Your Voice
  const handleEnhanceVoice = async () => {
    if (!voiceText.trim() || isEnhancingVoice || isSaving) return;
    setIsEnhancingVoice(true);
    setPreviousVoiceText(voiceText);
    setErrorMsg(null);

    try {
      const data = await apiFetch<any>("/api/enhance-context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: "your_voice",
          text: voiceText.trim(),
          context: {
            creatorIdentity: identity,
            rawBusinessText: profile?.rawBusinessText,
            customInstruction: profile?.customInstruction
          }
        })
      });

      if (data && data.enhancedText) {
        setVoiceText(data.enhancedText);
        setSaveToastMessage("Enhanced Your Voice with deep context. Review and edit, or click Save.");
        setSaveToast(true);
        setTimeout(() => setSaveToast(false), 4000);
      }
    } catch (err: any) {
      console.error("Enhance voice error:", err);
      setErrorMsg("Enhancement temporarily unavailable. Please try again in a moment.");
    } finally {
      setIsEnhancingVoice(false);
    }
  };

  const handleUndoEnhanceVoice = () => {
    if (previousVoiceText !== null) {
      setVoiceText(previousVoiceText);
      setPreviousVoiceText(null);
    }
  };

  // Character Builder Handlers
  const handleCharacterConfigChange = (newChar: CharacterAvatarConfig) => {
    const updated = {
      ...identity,
      character: newChar,
    };
    setIdentity(updated);
  };

  const handleSaveCharacter = async () => {
    const targetUid = currentUid || auth.currentUser?.uid || "";
    if (!targetUid) return;

    setIsSavingChar(true);
    try {
      await persistVoiceData(voiceText, identity, targetUid);
      setSaveCharSuccess(true);
      setSaveToastMessage("3D Character avatar updated successfully!");
      setSaveToast(true);
      setTimeout(() => {
        setSaveCharSuccess(false);
        setSaveToast(false);
      }, 3000);
    } catch (err) {
      console.error("Failed saving character:", err);
    } finally {
      setIsSavingChar(false);
    }
  };

  const handleLoadExample = () => {
    setVoiceText(EXAMPLE_VOICE_TEXT);
    setErrorMsg(null);
  };

  const handleReset = () => {
    if (window.confirm("Are you sure you want to clear your Voice input?")) {
      setVoiceText("");
      const emptyIdentity = { ...DEFAULT_IDENTITY, rawVoice: "" };
      setIdentity(emptyIdentity);
      const targetUid = currentUid || auth.currentUser?.uid || "";
      if (targetUid) {
        persistVoiceData("", emptyIdentity, targetUid);
      }
    }
  };

  const handleCopy = () => {
    if (!voiceText) return;
    navigator.clipboard.writeText(voiceText);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2000);
  };

  const hasContent = Boolean(voiceText && voiceText.trim().length > 20);

  return (
    <div id="your-voice-view-root" className="space-y-8 animate-fade-in pb-16 max-w-5xl mx-auto">
      {/* Toast Notification */}
      {saveToast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-xl shadow-xl animate-fade-in font-medium text-xs">
          <CheckCircle2 className="w-4 h-4" />
          <span>{saveToastMessage}</span>
        </div>
      )}

      {/* Main Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-bg-card via-bg-card to-purple-50/70 dark:to-purple-950/20 border border-border-primary p-6 md:p-8 shadow-sm">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-surface text-brand-text text-xs font-semibold border border-brand-border">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Your Voice</span>
              </div>

              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-medium bg-bg-app border border-brand-border text-text-secondary">
                <span>WHO YOU ARE + HOW YOU SOUND + HOW YOU THINK</span>
              </div>

              {/* Status Badge */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-bg-app border border-border-primary">
                {saveStatus === "saving" && (
                  <span className="flex items-center gap-1.5 text-status-warning-text font-semibold animate-pulse">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Analyzing & Saving...</span>
                  </span>
                )}
                {saveStatus === "saved" && (
                  <span className="flex items-center gap-1.5 text-status-success-text font-semibold">
                    <Check className="w-3.5 h-3.5" />
                    <span>Calibrated & Active ✓</span>
                  </span>
                )}
                {saveStatus === "error" && (
                  <span className="flex items-center gap-1.5 text-status-warning-text">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>Saved locally</span>
                  </span>
                )}
                {saveStatus === "idle" && (
                  <span className="flex items-center gap-1.5 text-text-secondary">
                    <Cloud className="w-3.5 h-3.5 text-brand-text" />
                    <span>{hasContent ? "Voice Calibrated" : "Ready for Input"}</span>
                  </span>
                )}
              </div>
            </div>

            <h1 className="text-2xl md:text-3xl font-extrabold text-text-primary tracking-tight font-sans">
              Your Voice
            </h1>

            <p className="text-text-secondary text-sm md:text-base leading-relaxed">
              Your Voice represents who you are and how you naturally communicate. It establishes your personality, perspective, beliefs, tone, vocabulary, phrasing, and writing characteristics so your content authentically sounds like you.
            </p>
          </div>

          {/* Header Action Tools */}
          <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
            {activeSection === "voice" && (
              <>
                <button
                  id="voice-load-example-btn"
                  type="button"
                  onClick={handleLoadExample}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-bg-card hover:bg-bg-card-hover text-text-secondary hover:text-text-primary border border-border-primary rounded-xl transition cursor-pointer"
                  title="Load a rich creator sample"
                >
                  <BookOpen className="w-3.5 h-3.5 text-purple-500" />
                  <span>Sample Voice</span>
                </button>

                {voiceText && (
                  <button
                    id="voice-copy-btn"
                    type="button"
                    onClick={handleCopy}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-bg-card hover:bg-bg-card-hover text-text-secondary hover:text-text-primary border border-border-primary rounded-xl transition cursor-pointer"
                    title="Copy voice text to clipboard"
                  >
                    {copiedSummary ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedSummary ? "Copied" : "Copy"}</span>
                  </button>
                )}

                <button
                  id="voice-reset-btn"
                  type="button"
                  onClick={handleReset}
                  className="p-2 text-text-muted hover:text-red-500 hover:bg-red-500/10 border border-border-primary rounded-xl transition cursor-pointer"
                  title="Clear input"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Navigation Switcher: Voice vs Character Studio */}
        <div className="flex items-center gap-2 mt-6 pt-5 border-t border-border-primary">
          <button
            type="button"
            id="tab-btn-voice"
            onClick={() => setActiveSection("voice")}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeSection === "voice"
                ? "bg-purple-600 text-white shadow-md shadow-purple-500/20"
                : "bg-bg-app hover:bg-bg-card-hover text-text-secondary hover:text-text-primary border border-border-primary"
            }`}
          >
            <Mic className="w-3.5 h-3.5" />
            <span>Your Voice (Single Input)</span>
          </button>

          <button
            type="button"
            id="tab-btn-character"
            onClick={() => setActiveSection("character")}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeSection === "character"
                ? "bg-purple-600 text-white shadow-md shadow-purple-500/20"
                : "bg-bg-app hover:bg-bg-card-hover text-text-secondary hover:text-text-primary border border-border-primary"
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>3D Character Studio</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
              activeSection === "character"
                ? "bg-white/20 text-white"
                : "bg-brand-surface text-brand-text border border-brand-border"
            }`}>
              {identity.character?.name || "Luna"}
            </span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* VIEW 1: SINGLE UNIFIED SECTION & INPUT CARD: "Tell Us About Your Voice"  */}
      {/* ========================================================================= */}
      {activeSection === "voice" && (
        <div className="space-y-6">
          <section
            id="section-your-voice-unified"
            className="rounded-2xl bg-bg-card border border-purple-500/30 p-6 md:p-8 shadow-sm space-y-6"
          >
            <div className="space-y-2 border-b border-border-primary pb-4">
              <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400">
                <Mic className="w-4 h-4" />
                <span className="text-xs font-bold font-mono uppercase tracking-wider">
                  Single Unified Input
                </span>
              </div>

              <h2 className="text-xl font-bold text-text-primary tracking-tight font-sans">
                Tell Us About Your Voice
              </h2>

              <div className="space-y-2 text-xs md:text-sm text-text-secondary leading-relaxed max-w-3xl">
                <p>
                  Share information about who you are, how you naturally communicate, your beliefs, tone, vocabulary, and writing characteristics.
                </p>
                <p className="text-purple-600 dark:text-purple-400 font-medium">
                  Primary question: &ldquo;How should this sound so it feels like this person wrote it?&rdquo;
                </p>
                <p className="text-text-muted text-[11px]">
                  Note: Business offers, products, and pricing belong in <strong>My Business</strong>. Content formats and posting rules belong in <strong>Create Content</strong>.
                </p>
              </div>
            </div>

            {/* Single Unified Textarea */}
            <div className="space-y-2">
              <div className="relative">
                <textarea
                  id="tell-us-about-your-voice-input"
                  rows={12}
                  value={voiceText}
                  onChange={(e) => {
                    setVoiceText(e.target.value);
                    if (errorMsg) setErrorMsg(null);
                  }}
                  disabled={isSaving}
                  placeholder={`Tell us about yourself so ThreadsWorks can create content that sounds authentically like you.

• Personality & perspective (grounded, direct, analytical, energetic, etc.)
• What you believe & how you think (core convictions, mental models, counter-intuitive opinions)
• Writing style & tone (sentence cadence, rhythm, conversational pacing)
• Words & phrases you naturally use (signature vocabulary, idioms)
• Words & phrases you avoid (banned jargon, clichés, overused hype)
• Storytelling tendencies & how you explain ideas

YOUR VOICE = WHO YOU ARE + HOW YOU SOUND + HOW YOU THINK`}
                  className="w-full rounded-xl border border-border-primary bg-bg-app px-4 py-4 text-xs md:text-sm text-text-primary placeholder:text-text-muted/60 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:outline-none transition leading-relaxed resize-y min-h-[260px] font-sans"
                />
                <div className="absolute bottom-3 right-3 text-[10px] text-text-muted font-mono bg-bg-app/90 px-2 py-0.5 rounded border border-border-primary/50 backdrop-blur">
                  {voiceText.length} characters
                </div>
              </div>

              {errorMsg && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-status-warning-bg border border-status-warning-border text-status-warning-text text-xs font-medium animate-fade-in">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}
            </div>

            {/* Action Controls */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 border-t border-border-primary">
              <div className="flex items-center gap-2">
                <p className="text-xs text-text-muted text-center sm:text-left">
                  ThreadsWorks uses AI to understand your identity, tone, and writing style from this context.
                </p>
                {previousVoiceText !== null && (
                  <button
                    type="button"
                    onClick={handleUndoEnhanceVoice}
                    className="text-xs text-text-secondary hover:text-text-primary underline cursor-pointer shrink-0 ml-2"
                  >
                    Undo Enhancement
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
                <button
                  id="enhance-your-voice-btn"
                  type="button"
                  onClick={handleEnhanceVoice}
                  disabled={isEnhancingVoice || isSaving || !voiceText.trim()}
                  className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs transition cursor-pointer border ${
                    isEnhancingVoice || isSaving || !voiceText.trim()
                      ? "border-border-primary text-text-muted bg-bg-app/50 cursor-not-allowed"
                      : "border-brand-border bg-brand-surface hover:bg-brand-surface-hover text-brand-text shadow-sm hover:scale-[1.01]"
                  }`}
                  title="Develop and enrich your voice context with AI depth"
                >
                  {isEnhancingVoice ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-500" />
                      <span>Enhancing Voice...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                      <span>Enhance Your Voice</span>
                    </>
                  )}
                </button>

                <button
                  id="save-your-voice-btn"
                  type="button"
                  onClick={handleSaveVoice}
                  disabled={isSaving || isEnhancingVoice || !voiceText.trim()}
                  className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs transition cursor-pointer shadow-md ${
                    isSaving || isEnhancingVoice || !voiceText.trim()
                      ? "bg-purple-600/50 text-white/70 cursor-not-allowed"
                      : "bg-purple-600 hover:bg-purple-500 text-white shadow-purple-500/20 hover:scale-[1.01]"
                  }`}
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving Voice...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Save Your Voice</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </section>

          {/* Quick Character Companion Bar */}
          <div className="p-4 md:p-5 rounded-2xl bg-bg-card border border-border-primary flex items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-bg-app border border-purple-500/20 flex items-center justify-center overflow-hidden shrink-0">
                <CharacterAvatarPreview config={identity.character} size="sm" showPropsBadge={false} />
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-text-primary">
                    3D Companion: {identity.character?.name || "Luna"}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 font-mono">
                    {identity.character?.clothing?.style || "hoodie"}
                  </span>
                </div>
                <p className="text-[11px] text-text-muted">
                  Interactive full-body 3D companion representing your voice & creator persona.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setActiveSection("character")}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-bg-app hover:bg-purple-500/10 text-text-secondary hover:text-purple-600 dark:hover:text-purple-400 border border-border-primary text-xs font-semibold transition cursor-pointer shrink-0"
            >
              <Palette className="w-3.5 h-3.5" />
              <span>Customize Character</span>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: 3D CHARACTER STUDIO SECTION                                      */}
      {/* ========================================================================= */}
      {activeSection === "character" && (
        <section
          id="section-character-studio"
          className="rounded-2xl bg-bg-card border border-border-primary p-6 md:p-8 shadow-sm space-y-6"
        >
          <CharacterBuilder
            config={identity.character}
            onChange={handleCharacterConfigChange}
            onSave={handleSaveCharacter}
            isSaving={isSavingChar}
            saveSuccess={saveCharSuccess}
          />
        </section>
      )}

      {/* Bottom Content Engine Transition Footer */}
      <div className="p-6 rounded-2xl bg-bg-card border border-border-primary flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
        <div className="space-y-1 text-center sm:text-left">
          <div className="flex items-center justify-center sm:justify-start gap-2 text-xs font-bold text-text-primary">
            <Sparkles className="w-4 h-4 text-purple-500" />
            <span>Your Voice Powers Content Generation</span>
          </div>
          <p className="text-xs text-text-muted max-w-xl">
            Your Voice is automatically combined with your Business, CTA, and learned intelligence in Create Content to produce high-authority, authentic Threads posts.
          </p>
        </div>

        <button
          id="navigate-to-engine-btn"
          type="button"
          onClick={() => onNavigateToTab && onNavigateToTab("engine")}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-lg shadow-purple-500/10 transition cursor-pointer shrink-0"
        >
          <span>Create Content With Your Voice</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
