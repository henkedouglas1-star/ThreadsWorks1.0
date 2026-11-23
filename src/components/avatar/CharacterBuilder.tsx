import React, { useState } from "react";
import { CharacterAvatarConfig } from "../../types";
import CharacterAvatarPreview from "../CharacterAvatarPreview";
import {
  BASE_CHARACTERS,
  AVATAR_STYLES,
  SKIN_TONES,
  FACE_SHAPES,
  EYE_STYLES,
  EYEBROW_STYLES,
  HAIR_STYLES,
  HAIR_COLORS,
  CLOTHING_CATEGORIES,
  CLOTHING_STYLES,
  CLOTHING_COLORS,
  HATS,
  BOTTOMS,
  BOTTOMS_COLORS,
  SHOES,
  SHOES_COLORS,
  ACCESSORY_GROUPS,
  EXPRESSIONS,
  BACKDROPS,
  DEFAULT_AVATAR_CONFIG,
  generateRandomAvatar,
} from "./avatarData";
import {
  Sparkles,
  Wand2,
  RotateCcw,
  Save,
  Check,
  Smile,
  User,
  Palette,
  Scissors,
  Shirt,
  Glasses,
  Layers,
  HelpCircle,
  Copy,
  AlertTriangle,
  Tag,
  Box,
} from "lucide-react";

interface CharacterBuilderProps {
  config: CharacterAvatarConfig;
  onChange: (newConfig: CharacterAvatarConfig) => void;
  onSave?: () => void;
  isSaving?: boolean;
  saveSuccess?: boolean;
}

type CategoryTab =
  | "base"
  | "appearance"
  | "hair"
  | "clothing"
  | "accessories"
  | "expressions"
  | "style";

export default function CharacterBuilder({
  config,
  onChange,
  onSave,
  isSaving = false,
  saveSuccess = false,
}: CharacterBuilderProps) {
  const [activeTab, setActiveTab] = useState<CategoryTab>("base");
  const [activeClothingCategory, setActiveClothingCategory] = useState<string>("hoodies");
  const [showResetModal, setShowResetModal] = useState<boolean>(false);
  const [copyFeedback, setCopyFeedback] = useState<boolean>(false);

  // Safe normalizer
  const character: CharacterAvatarConfig = {
    name: config?.name || "Luna",
    baseCharacter: config?.baseCharacter || "human-creator",
    appearance: {
      skinTone: config?.appearance?.skinTone || "#FDDFB8",
      faceShape: config?.appearance?.faceShape || "oval",
      hairStyle: config?.appearance?.hairStyle || "swoop",
      hairColor: config?.appearance?.hairColor || "#231B15",
      eyeStyle: config?.appearance?.eyeStyle || "classic",
      eyebrows: config?.appearance?.eyebrows || "natural",
    },
    clothing: {
      category: config?.clothing?.category || "hoodies",
      style: config?.clothing?.style || "hoodie",
      color: config?.clothing?.color || "#8B5CF6",
      accentColor: config?.clothing?.accentColor || "#FFFFFF",
      bottoms: config?.clothing?.bottoms || "jeans",
      bottomsColor: config?.clothing?.bottomsColor || "#2563EB",
      shoes: config?.clothing?.shoes || "sneakers",
      shoesColor: config?.clothing?.shoesColor || "#FFFFFF",
      hat: config?.clothing?.hat || "none",
      hatColor: config?.clothing?.hatColor || "#1E293B",
    },
    accessories: Array.isArray(config?.accessories) ? config.accessories : [],
    expression: config?.expression || "happy",
    avatarStyle: config?.avatarStyle || "3d-character",
    backdrop: config?.backdrop || "gradient-purple",
  };

  // Updaters
  const updateConfig = (partial: Partial<CharacterAvatarConfig>) => {
    onChange({
      ...character,
      ...partial,
    });
  };

  const updateAppearance = (partial: Partial<CharacterAvatarConfig["appearance"]>) => {
    onChange({
      ...character,
      appearance: {
        ...character.appearance,
        ...partial,
      },
    });
  };

  const updateClothing = (partial: Partial<CharacterAvatarConfig["clothing"]>) => {
    onChange({
      ...character,
      clothing: {
        ...character.clothing,
        ...partial,
      },
    });
  };

  const toggleAccessory = (accId: string) => {
    const current = character.accessories || [];
    const exists = current.includes(accId);
    const next = exists ? current.filter((id) => id !== accId) : [...current, accId];
    updateConfig({ accessories: next });
  };

  const handleRandomize = () => {
    const randomConfig = generateRandomAvatar(character.name);
    onChange(randomConfig);
  };

  const handleConfirmReset = () => {
    onChange({
      ...DEFAULT_AVATAR_CONFIG,
      name: character.name || DEFAULT_AVATAR_CONFIG.name,
    });
    setShowResetModal(false);
  };

  // Nav tabs
  const TABS: { id: CategoryTab; label: string; icon: React.ReactNode }[] = [
    { id: "base", label: "Base", icon: <User className="w-4 h-4" /> },
    { id: "appearance", label: "Appearance", icon: <Palette className="w-4 h-4" /> },
    { id: "hair", label: "Hair", icon: <Scissors className="w-4 h-4" /> },
    { id: "clothing", label: "Clothing & Shoes", icon: <Shirt className="w-4 h-4" /> },
    { id: "accessories", label: "Accessories", icon: <Glasses className="w-4 h-4" /> },
    { id: "expressions", label: "Expressions", icon: <Smile className="w-4 h-4" /> },
    { id: "style", label: "Stage & Aura", icon: <Layers className="w-4 h-4" /> },
  ];

  return (
    <div id="character-builder-root" className="space-y-6">
      {/* Header controls bar with Name Input */}
      <div className="flex flex-col gap-4 pb-5 border-b border-border-primary">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-text-primary tracking-tight flex items-center gap-2">
              <span>Full-Body 3D Character Studio</span>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 font-bold">
                Interactive 3D
              </span>
            </h3>
            <p className="text-xs text-text-muted mt-0.5">
              Customize your full-body 3D companion with 360° rotation, wardrobe styling, and expressive poses.
            </p>
          </div>

          {/* Global Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              id="avatar-surprise-me-btn"
              type="button"
              onClick={handleRandomize}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 dark:text-purple-300 text-xs font-semibold border border-purple-500/20 transition cursor-pointer"
              title="Randomize avatar combination"
            >
              <Wand2 className="w-3.5 h-3.5" />
              <span>Surprise Me</span>
            </button>

            <button
              id="avatar-reset-btn"
              type="button"
              onClick={() => setShowResetModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-bg-app hover:bg-red-500/10 text-text-muted hover:text-red-500 text-xs font-semibold border border-border-primary transition cursor-pointer"
              title="Reset avatar to default"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>

            {onSave && (
              <button
                id="avatar-save-btn"
                type="button"
                onClick={onSave}
                disabled={isSaving}
                className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold shadow-md transition cursor-pointer ${
                  saveSuccess
                    ? "bg-emerald-600 text-white shadow-emerald-500/20"
                    : "bg-purple-600 hover:bg-purple-500 text-white shadow-purple-500/20"
                }`}
              >
                {isSaving ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : saveSuccess ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Saved!</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Character</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Character Name Input Field */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-bg-app border border-border-primary shadow-xs">
          <div className="space-y-0.5">
            <label htmlFor="character-name-input" className="text-xs font-bold text-text-primary flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-purple-500" />
              <span>Name Your Character</span>
            </label>
            <p className="text-[11px] text-text-muted">
              Give your 3D character a name. This character represents your voice and identity inside ThreadsWorks.
            </p>
          </div>
          <div className="w-full sm:w-64">
            <input
              id="character-name-input"
              type="text"
              value={character.name || ""}
              onChange={(e) => updateConfig({ name: e.target.value })}
              placeholder="e.g. Luna, Jax, Nova..."
              maxLength={30}
              className="w-full px-3.5 py-1.5 rounded-xl bg-bg-card border border-border-primary focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 text-xs font-semibold text-text-primary placeholder:text-text-muted outline-none transition"
            />
          </div>
        </div>
      </div>

      {/* Main Studio Grid: Interactive 3D Showroom on Desktop / Mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* ======================================================================= */}
        {/* LEFT COLUMN: HERO 3D SHOWROOM PREVIEW & QUICK MOOD SWITCHER */}
        {/* ======================================================================= */}
        <div className="lg:col-span-5 lg:sticky lg:top-4 space-y-4">
          <div className="bg-bg-card border border-border-primary rounded-3xl p-5 flex flex-col items-center text-center space-y-4 shadow-sm">
            {/* Meet Character Badge Banner */}
            <div className="w-full flex items-center justify-between px-2 pt-1">
              <div className="inline-flex items-center gap-1.5 text-xs font-extrabold text-text-primary tracking-tight">
                <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                <span>Meet {character.name && character.name.trim() ? character.name.trim() : "Luna"}</span>
              </div>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 font-bold capitalize">
                {character.baseCharacter.replace(/-/g, " ")}
              </span>
            </div>

            {/* Live 3D WebGL Showroom Canvas */}
            <div className="w-full relative group">
              <CharacterAvatarPreview config={character} size="2xl" />
            </div>

            {/* Identity Style Pill Badges */}
            <div className="w-full flex items-center justify-center gap-1.5 flex-wrap text-xs text-text-muted">
              <span className="px-2.5 py-1 rounded-xl bg-bg-app border border-border-primary text-text-secondary font-medium capitalize text-[11px]">
                {character.expression} mood
              </span>
              <span className="px-2.5 py-1 rounded-xl bg-bg-app border border-border-primary text-text-secondary font-medium capitalize text-[11px]">
                {character.clothing.style.replace(/-/g, " ")}
              </span>
              <span className="px-2.5 py-1 rounded-xl bg-bg-app border border-border-primary text-text-secondary font-medium capitalize text-[11px]">
                {character.clothing.bottoms || "jeans"}
              </span>
              {character.clothing.hat && character.clothing.hat !== "none" && (
                <span className="px-2.5 py-1 rounded-xl bg-bg-app border border-border-primary text-text-secondary font-medium capitalize text-[11px]">
                  {character.clothing.hat}
                </span>
              )}
            </div>

            {/* Quick Expressions Strip */}
            <div className="w-full pt-3 border-t border-border-primary space-y-2">
              <div className="flex items-center justify-between text-[11px] font-mono font-bold text-text-muted uppercase">
                <span>Instant Mood Switch</span>
                <span className="text-[10px] text-purple-500 lowercase font-sans">8 expressions</span>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {EXPRESSIONS.slice(0, 8).map((exp) => (
                  <button
                    key={exp.id}
                    type="button"
                    onClick={() => updateConfig({ expression: exp.id })}
                    title={exp.description}
                    className={`flex flex-col items-center justify-center p-1.5 rounded-xl border text-[11px] font-medium transition cursor-pointer ${
                      character.expression === exp.id
                        ? "bg-purple-600 text-white font-bold border-purple-600 shadow-sm"
                        : "bg-bg-app border-border-primary text-text-secondary hover:bg-bg-card-hover"
                    }`}
                  >
                    <span className="text-base leading-none mb-0.5">{exp.icon}</span>
                    <span className="text-[10px] truncate max-w-full">{exp.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ======================================================================= */}
        {/* RIGHT COLUMN: CATEGORY TABS & RICH CUSTOMIZATION CONTROLS */}
        {/* ======================================================================= */}
        <div className="lg:col-span-7 space-y-6">
          {/* Category Navigation Pills */}
          <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-bg-card border border-border-primary overflow-x-auto no-scrollbar">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer select-none ${
                    isActive
                      ? "bg-purple-600 text-white shadow-sm"
                      : "text-text-muted hover:text-text-primary hover:bg-bg-app"
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Active Category Panel */}
          <div className="bg-bg-card border border-border-primary rounded-3xl p-6 md:p-7 space-y-6 shadow-sm min-h-[420px]">
            {/* TAB 1: BASE CHARACTER */}
            {activeTab === "base" && (
              <div className="space-y-5 animate-in fade-in duration-200">
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-text-primary">Choose Your Base Archetype</h4>
                  <p className="text-xs text-text-muted">
                    Pick a starting character foundation to represent your creative persona.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {BASE_CHARACTERS.map((base) => {
                    const isSelected = character.baseCharacter === base.id;
                    return (
                      <button
                        key={base.id}
                        type="button"
                        onClick={() => updateConfig({ baseCharacter: base.id })}
                        className={`flex flex-col items-start p-3.5 rounded-2xl border text-left transition cursor-pointer select-none relative group ${
                          isSelected
                            ? "bg-purple-500/10 border-purple-500 text-purple-600 dark:text-purple-300 ring-2 ring-purple-500/20"
                            : "bg-bg-app border-border-primary text-text-secondary hover:bg-bg-card-hover"
                        }`}
                      >
                        <div className="flex items-center justify-between w-full mb-2">
                          <span className="text-2xl">{base.icon}</span>
                          {isSelected && <Check className="w-4 h-4 text-purple-600 dark:text-purple-400 font-bold" />}
                        </div>
                        <div className="text-xs font-bold text-text-primary group-hover:text-purple-600 transition">
                          {base.label}
                        </div>
                        <p className="text-[11px] text-text-muted mt-1 leading-snug">
                          {base.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB 2: APPEARANCE (Skin, Face Shape, Eyes, Eyebrows) */}
            {activeTab === "appearance" && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-text-primary">Skin, Facial Structure & Gaze</h4>
                  <p className="text-xs text-text-muted">
                    Personalize your skin tone, face shape, eye design, and eyebrow curvature.
                  </p>
                </div>

                {/* 1. Skin Tone Palette */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-text-primary">Skin Tone</label>
                    <span className="text-[11px] font-mono text-purple-500 font-bold">
                      {SKIN_TONES.find((s) => s.color === character.appearance.skinTone)?.label || "Custom"}
                    </span>
                  </div>
                  <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                    {SKIN_TONES.map((tone) => {
                      const isSelected = character.appearance.skinTone === tone.color;
                      return (
                        <button
                          key={tone.color}
                          type="button"
                          onClick={() => updateAppearance({ skinTone: tone.color })}
                          style={{ backgroundColor: tone.color }}
                          title={tone.label}
                          className={`w-full aspect-square rounded-2xl border-2 transition-transform transform hover:scale-105 cursor-pointer flex items-center justify-center ${
                            isSelected
                              ? "border-purple-600 ring-2 ring-purple-500/50 shadow-md"
                              : "border-black/10 dark:border-white/10"
                          }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5 text-black/70 mix-blend-difference" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Face Shape */}
                <div className="space-y-2.5">
                  <label className="text-xs font-bold text-text-primary">Face Shape</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {FACE_SHAPES.map((shape) => {
                      const isSelected = (character.appearance.faceShape || "oval") === shape.id;
                      return (
                        <button
                          key={shape.id}
                          type="button"
                          onClick={() => updateAppearance({ faceShape: shape.id })}
                          className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-medium transition cursor-pointer select-none ${
                            isSelected
                              ? "bg-purple-500/10 border-purple-500 text-purple-600 dark:text-purple-300 font-bold"
                              : "bg-bg-app border-border-primary text-text-secondary hover:bg-bg-card-hover"
                          }`}
                        >
                          <span className="text-base">{shape.icon}</span>
                          <span>{shape.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 3. Eyes Design */}
                <div className="space-y-2.5">
                  <label className="text-xs font-bold text-text-primary">Eye Style</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {EYE_STYLES.map((eye) => {
                      const isSelected = character.appearance.eyeStyle === eye.id;
                      return (
                        <button
                          key={eye.id}
                          type="button"
                          onClick={() => updateAppearance({ eyeStyle: eye.id })}
                          className={`flex flex-col items-start p-2.5 rounded-xl border text-left transition cursor-pointer select-none ${
                            isSelected
                              ? "bg-purple-500/10 border-purple-500 text-purple-600 dark:text-purple-300 font-bold"
                              : "bg-bg-app border-border-primary text-text-secondary hover:bg-bg-card-hover"
                          }`}
                        >
                          <div className="flex items-center gap-1.5 text-xs font-bold text-text-primary">
                            <span>{eye.icon}</span>
                            <span>{eye.label}</span>
                          </div>
                          <span className="text-[10px] text-text-muted mt-0.5">{eye.description}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 4. Eyebrows */}
                <div className="space-y-2.5">
                  <label className="text-xs font-bold text-text-primary">Eyebrow Arc</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {EYEBROW_STYLES.map((brow) => {
                      const isSelected = (character.appearance.eyebrows || "natural") === brow.id;
                      return (
                        <button
                          key={brow.id}
                          type="button"
                          onClick={() => updateAppearance({ eyebrows: brow.id })}
                          className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-medium transition cursor-pointer select-none ${
                            isSelected
                              ? "bg-purple-500/10 border-purple-500 text-purple-600 dark:text-purple-300 font-bold"
                              : "bg-bg-app border-border-primary text-text-secondary hover:bg-bg-card-hover"
                          }`}
                        >
                          <span className="text-sm font-mono text-purple-500">{brow.icon}</span>
                          <span>{brow.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: HAIR (Style & Palette) */}
            {activeTab === "hair" && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-text-primary">Hairstyle & Color</h4>
                  <p className="text-xs text-text-muted">
                    Choose from modern creator cuts, curls, waves, or clean buzz options.
                  </p>
                </div>

                {/* Hair Color Palette */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-text-primary">Hair Color</label>
                    <span className="text-[11px] font-mono text-purple-500 font-bold">
                      {HAIR_COLORS.find((c) => c.color === character.appearance.hairColor)?.label || "Custom"}
                    </span>
                  </div>
                  <div className="grid grid-cols-6 sm:grid-cols-11 gap-2">
                    {HAIR_COLORS.map((c) => {
                      const isSelected = character.appearance.hairColor === c.color;
                      return (
                        <button
                          key={c.color}
                          type="button"
                          onClick={() => updateAppearance({ hairColor: c.color })}
                          style={{ backgroundColor: c.color }}
                          title={c.label}
                          className={`w-full aspect-square rounded-2xl border-2 transition-transform transform hover:scale-110 cursor-pointer flex items-center justify-center ${
                            isSelected
                              ? "border-purple-600 ring-2 ring-purple-500/50 shadow-md"
                              : "border-black/10 dark:border-white/10"
                          }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5 text-white mix-blend-difference" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Hair Styles Grid */}
                <div className="space-y-2.5">
                  <label className="text-xs font-bold text-text-primary">Hairstyle Cut</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
                    {HAIR_STYLES.map((hair) => {
                      const isSelected = character.appearance.hairStyle === hair.id;
                      return (
                        <button
                          key={hair.id}
                          type="button"
                          onClick={() => updateAppearance({ hairStyle: hair.id })}
                          className={`flex flex-col items-center p-3 rounded-2xl border text-center transition cursor-pointer select-none ${
                            isSelected
                              ? "bg-purple-500/15 border-purple-500 text-purple-600 dark:text-purple-300 font-bold ring-1 ring-purple-500/30"
                              : "bg-bg-app border-border-primary text-text-secondary hover:bg-bg-card-hover"
                          }`}
                        >
                          <span className="text-xl mb-1">{hair.icon}</span>
                          <span className="text-xs font-semibold">{hair.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: CLOTHING & SHOES (Tops, Hoodies, Jackets, Bottoms, Shoes, Hats) */}
            {activeTab === "clothing" && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-text-primary">Full-Body Wardrobe & Footwear</h4>
                  <p className="text-xs text-text-muted">
                    Mix top outfits, jeans or chinos, high-top sneakers, and streetwear hats.
                  </p>
                </div>

                {/* Top Outfit Primary Color */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-text-primary">Top Outfit Color</label>
                    <span className="text-[11px] font-mono text-purple-500 font-bold">
                      {CLOTHING_COLORS.find((c) => c.color === character.clothing.color)?.label || "Custom"}
                    </span>
                  </div>
                  <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                    {CLOTHING_COLORS.map((col) => {
                      const isSelected = character.clothing.color === col.color;
                      return (
                        <button
                          key={col.color}
                          type="button"
                          onClick={() => updateClothing({ color: col.color })}
                          style={{ backgroundColor: col.color }}
                          title={col.label}
                          className={`w-full aspect-square rounded-2xl border-2 transition-transform transform hover:scale-105 cursor-pointer flex items-center justify-center ${
                            isSelected
                              ? "border-purple-600 ring-2 ring-purple-500/50 shadow-md"
                              : "border-black/10 dark:border-white/10"
                          }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5 text-white mix-blend-difference" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Sub-Category Filter (Tops, Hoodies, Jackets, Dresses) */}
                <div className="space-y-3">
                  <div className="flex items-center gap-1.5 border-b border-border-primary pb-2 overflow-x-auto no-scrollbar">
                    {CLOTHING_CATEGORIES.map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setActiveClothingCategory(cat.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer select-none ${
                          activeClothingCategory === cat.id
                            ? "bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30"
                            : "text-text-muted hover:text-text-primary"
                        }`}
                      >
                        <span>{cat.icon}</span>
                        <span>{cat.label}</span>
                      </button>
                    ))}
                  </div>

                  {/* Filtered Clothing Styles */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                    {CLOTHING_STYLES.filter((item) => item.category === activeClothingCategory).map((cloth) => {
                      const isSelected = character.clothing.style === cloth.id;
                      return (
                        <button
                          key={cloth.id}
                          type="button"
                          onClick={() => updateClothing({ style: cloth.id, category: cloth.category })}
                          className={`flex flex-col items-start p-3 rounded-2xl border text-left transition cursor-pointer select-none ${
                            isSelected
                              ? "bg-purple-500/10 border-purple-500 text-purple-600 dark:text-purple-300 font-bold ring-1 ring-purple-500/30"
                              : "bg-bg-app border-border-primary text-text-secondary hover:bg-bg-card-hover"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{cloth.icon}</span>
                            <span className="text-xs font-bold text-text-primary">{cloth.label}</span>
                          </div>
                          <span className="text-[10px] text-text-muted mt-1">{cloth.description}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Bottoms / Pants & Bottoms Color */}
                <div className="space-y-3 pt-3 border-t border-border-primary">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-text-primary">Bottoms & Pants</label>
                    <span className="text-[11px] font-mono text-purple-500 font-bold capitalize">
                      {character.clothing.bottoms || "jeans"}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {BOTTOMS.map((bot) => {
                      const isSelected = (character.clothing.bottoms || "jeans") === bot.id;
                      return (
                        <button
                          key={bot.id}
                          type="button"
                          onClick={() => updateClothing({ bottoms: bot.id })}
                          className={`flex flex-col items-center p-2.5 rounded-xl border text-center transition cursor-pointer select-none ${
                            isSelected
                              ? "bg-purple-500/10 border-purple-500 text-purple-600 dark:text-purple-300 font-bold"
                              : "bg-bg-app border-border-primary text-text-secondary hover:bg-bg-card-hover"
                          }`}
                        >
                          <span className="text-lg mb-0.5">{bot.icon}</span>
                          <span className="text-[11px] font-medium">{bot.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Bottoms Color Palette */}
                  <div className="grid grid-cols-6 sm:grid-cols-8 gap-2 pt-1">
                    {BOTTOMS_COLORS.map((bc) => {
                      const isSelected = (character.clothing.bottomsColor || "#2563EB") === bc.color;
                      return (
                        <button
                          key={bc.color}
                          type="button"
                          onClick={() => updateClothing({ bottomsColor: bc.color })}
                          style={{ backgroundColor: bc.color }}
                          title={bc.label}
                          className={`w-full aspect-square rounded-xl border-2 transition-transform transform hover:scale-105 cursor-pointer flex items-center justify-center ${
                            isSelected
                              ? "border-purple-600 ring-2 ring-purple-500/50 shadow-md"
                              : "border-black/10 dark:border-white/10"
                          }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5 text-white mix-blend-difference" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Shoes & Footwear */}
                <div className="space-y-3 pt-3 border-t border-border-primary">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-text-primary">Footwear & Shoes</label>
                    <span className="text-[11px] font-mono text-purple-500 font-bold capitalize">
                      {character.clothing.shoes || "sneakers"}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {SHOES.map((sh) => {
                      const isSelected = (character.clothing.shoes || "sneakers") === sh.id;
                      return (
                        <button
                          key={sh.id}
                          type="button"
                          onClick={() => updateClothing({ shoes: sh.id })}
                          className={`flex flex-col items-center p-2.5 rounded-xl border text-center transition cursor-pointer select-none ${
                            isSelected
                              ? "bg-purple-500/10 border-purple-500 text-purple-600 dark:text-purple-300 font-bold"
                              : "bg-bg-app border-border-primary text-text-secondary hover:bg-bg-card-hover"
                          }`}
                        >
                          <span className="text-lg mb-0.5">{sh.icon}</span>
                          <span className="text-[11px] font-medium">{sh.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Shoes Color Palette */}
                  <div className="grid grid-cols-6 gap-2 pt-1">
                    {SHOES_COLORS.map((sc) => {
                      const isSelected = (character.clothing.shoesColor || "#FFFFFF") === sc.color;
                      return (
                        <button
                          key={sc.color}
                          type="button"
                          onClick={() => updateClothing({ shoesColor: sc.color })}
                          style={{ backgroundColor: sc.color }}
                          title={sc.label}
                          className={`w-full aspect-square rounded-xl border-2 transition-transform transform hover:scale-105 cursor-pointer flex items-center justify-center ${
                            isSelected
                              ? "border-purple-600 ring-2 ring-purple-500/50 shadow-md"
                              : "border-black/10 dark:border-white/10"
                          }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5 text-white mix-blend-difference" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Hats & Headwear */}
                <div className="space-y-2.5 pt-3 border-t border-border-primary">
                  <label className="text-xs font-bold text-text-primary">Hats & Headwear</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                    {HATS.map((hat) => {
                      const isSelected = (character.clothing.hat || "none") === hat.id;
                      return (
                        <button
                          key={hat.id}
                          type="button"
                          onClick={() => updateClothing({ hat: hat.id })}
                          className={`flex flex-col items-center p-2.5 rounded-xl border text-center transition cursor-pointer select-none ${
                            isSelected
                              ? "bg-purple-500/10 border-purple-500 text-purple-600 dark:text-purple-300 font-bold"
                              : "bg-bg-app border-border-primary text-text-secondary hover:bg-bg-card-hover"
                          }`}
                        >
                          <span className="text-lg mb-0.5">{hat.icon}</span>
                          <span className="text-[11px] truncate max-w-full font-medium">{hat.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: ACCESSORIES (Glasses, Audio, Jewelry, Bags, Props) */}
            {activeTab === "accessories" && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-text-primary">Creator Accessories & Signature Props</h4>
                  <p className="text-xs text-text-muted">
                    Equip glasses, studio headphones, coffee mugs, podcast mics, or authority crowns.
                  </p>
                </div>

                {ACCESSORY_GROUPS.map((group) => (
                  <div key={group.name} className="space-y-2.5">
                    <div className="text-xs font-bold text-text-primary uppercase tracking-wider text-[11px] font-mono text-purple-600 dark:text-purple-400">
                      {group.name}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                      {group.items.map((item) => {
                        const isSelected = (character.accessories || []).includes(item.id);
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => toggleAccessory(item.id)}
                            className={`flex items-start justify-between p-3 rounded-2xl border text-left transition cursor-pointer select-none ${
                              isSelected
                                ? "bg-purple-500/10 border-purple-500 text-purple-600 dark:text-purple-300 font-bold ring-1 ring-purple-500/30"
                                : "bg-bg-app border-border-primary text-text-secondary hover:bg-bg-card-hover"
                            }`}
                          >
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1.5 text-xs font-bold text-text-primary">
                                <span className="text-base">{item.icon}</span>
                                <span>{item.label}</span>
                              </div>
                              <p className="text-[10px] text-text-muted">{item.description}</p>
                            </div>
                            <div
                              className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 border transition ${
                                isSelected
                                  ? "bg-purple-600 border-purple-600 text-white"
                                  : "border-border-primary bg-bg-app"
                              }`}
                            >
                              {isSelected && <Check className="w-3.5 h-3.5" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* TAB 6: EXPRESSIONS (Happy, Confident, Thinking, Surprised, Excited, Laughing, Celebrating, Curious) */}
            {activeTab === "expressions" && (
              <div className="space-y-5 animate-in fade-in duration-200">
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-text-primary">Emotional Frequency & Expression</h4>
                  <p className="text-xs text-text-muted">
                    Set your character's default presence—from thoughtful deep thinker to celebratory win mode.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {EXPRESSIONS.map((exp) => {
                    const isSelected = character.expression === exp.id;
                    return (
                      <button
                        key={exp.id}
                        type="button"
                        onClick={() => updateConfig({ expression: exp.id })}
                        className={`flex items-start gap-3 p-3.5 rounded-2xl border text-left transition cursor-pointer select-none ${
                          isSelected
                            ? "bg-purple-500/10 border-purple-500 text-purple-600 dark:text-purple-300 font-bold ring-2 ring-purple-500/20"
                            : "bg-bg-app border-border-primary text-text-secondary hover:bg-bg-card-hover"
                        }`}
                      >
                        <span className="text-2xl shrink-0 p-1 rounded-xl bg-bg-app border border-border-primary">
                          {exp.icon}
                        </span>
                        <div className="space-y-0.5 flex-1">
                          <div className="text-xs font-bold text-text-primary">{exp.label}</div>
                          <p className="text-[11px] text-text-muted leading-snug">{exp.description}</p>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-purple-600 dark:text-purple-400 mt-1 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB 7: AVATAR STYLE & BACKDROP */}
            {activeTab === "style" && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-text-primary">3D Showroom Atmosphere & Backdrops</h4>
                  <p className="text-xs text-text-muted">
                    Choose lighting vibes and pedestal atmospheres for your 3D character showroom.
                  </p>
                </div>

                {/* Avatar Styles Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {AVATAR_STYLES.map((st) => {
                    const isSelected = character.avatarStyle === st.id;
                    return (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => updateConfig({ avatarStyle: st.id })}
                        className={`flex flex-col items-start p-3.5 rounded-2xl border text-left transition cursor-pointer select-none ${
                          isSelected
                            ? "bg-purple-500/10 border-purple-500 text-purple-600 dark:text-purple-300 font-bold ring-2 ring-purple-500/20"
                            : "bg-bg-app border-border-primary text-text-secondary hover:bg-bg-card-hover"
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="text-xs font-bold text-text-primary">{st.label}</span>
                          {st.badge && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold">
                              {st.badge}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-text-muted mt-1 leading-snug">{st.description}</p>
                      </button>
                    );
                  })}
                </div>

                {/* Backdrops / Auras */}
                <div className="space-y-2.5 pt-2 border-t border-border-primary">
                  <label className="text-xs font-bold text-text-primary">Showroom Atmosphere & Stage Lighting</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {BACKDROPS.map((bd) => {
                      const isSelected = (character.backdrop || "gradient-purple") === bd.id;
                      return (
                        <button
                          key={bd.id}
                          type="button"
                          onClick={() => updateConfig({ backdrop: bd.id })}
                          className={`flex items-center gap-2 p-2.5 rounded-xl border text-left transition cursor-pointer select-none ${
                            isSelected
                              ? "bg-purple-500/10 border-purple-500 text-purple-600 dark:text-purple-300 font-bold"
                              : "bg-bg-app border-border-primary text-text-secondary hover:bg-bg-card-hover"
                          }`}
                        >
                          <div
                            style={{ backgroundColor: bd.previewColor }}
                            className="w-4 h-4 rounded-full border border-black/20 shrink-0"
                          />
                          <div className="truncate">
                            <div className="text-xs font-bold text-text-primary truncate">{bd.label}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Modal for Reset */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-bg-card border border-border-primary rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="w-10 h-10 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h4 className="text-base font-bold text-text-primary">Reset 3D Character Avatar?</h4>
              <p className="text-xs text-text-muted leading-relaxed">
                This will reset your character's visual appearance back to default settings while keeping your character's name intact.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                className="px-4 py-2 rounded-xl bg-bg-app hover:bg-bg-card-hover text-text-secondary text-xs font-semibold border border-border-primary transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReset}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition shadow-md shadow-red-500/20 cursor-pointer"
              >
                Yes, Reset Appearance
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

