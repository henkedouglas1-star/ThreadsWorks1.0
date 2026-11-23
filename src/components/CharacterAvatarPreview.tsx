import React, { useState } from "react";
import { CharacterAvatarConfig } from "../types";
import CharacterFiberCanvas from "./avatar/CharacterFiberCanvas";
import {
  HeadFaceLayer,
  HairLayer,
  EyesBrowsLayer,
  ExpressionMouthLayer,
  BodyClothingLayer,
  HatLayer,
  AccessoriesLayer,
} from "./avatar/AvatarLayers";
import {
  Sparkles,
  Coffee,
  Radio,
  Laptop,
  Rocket,
  Lightbulb,
  Box,
  Layers,
} from "lucide-react";

interface CharacterAvatarPreviewProps {
  config: CharacterAvatarConfig;
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
  className?: string;
  showPropsBadge?: boolean;
  force2D?: boolean;
  autoRotate3D?: boolean;
}

export default function CharacterAvatarPreview({
  config,
  size = "lg",
  className = "",
  showPropsBadge = true,
  force2D = false,
  autoRotate3D = false,
}: CharacterAvatarPreviewProps) {
  const [viewMode, setViewMode] = useState<"3d" | "2d">(force2D ? "2d" : "3d");

  // Safe default normalization
  const safeConfig: CharacterAvatarConfig = {
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

  // If compact icon sizes (xs, sm, md), render the fast lightweight SVG layer representation
  if (size === "xs" || size === "sm" || size === "md" || (force2D && viewMode === "2d")) {
    const sizeClasses = {
      xs: "w-9 h-9 text-[10px]",
      sm: "w-14 h-14 text-xs",
      md: "w-24 h-24 text-sm",
      lg: "w-44 h-44 text-base",
      xl: "w-56 h-56 text-lg",
      "2xl": "w-72 h-72 text-xl",
    }[size];

    const getBackdropClass = () => {
      switch (safeConfig.backdrop) {
        case "gradient-sunset":
          return "from-amber-400/25 via-orange-500/20 to-rose-500/25";
        case "gradient-cyber":
          return "from-cyan-400/25 via-sky-500/20 to-indigo-500/25";
        case "gradient-emerald":
          return "from-emerald-400/25 via-teal-500/20 to-green-600/25";
        case "solid-cream":
          return "from-amber-100/70 via-amber-50/60 to-amber-100/70 dark:from-neutral-800 dark:to-neutral-900";
        case "studio-dark":
          return "from-slate-900 via-slate-800 to-indigo-950";
        case "gradient-purple":
        default:
          return "from-purple-500/25 via-indigo-500/20 to-pink-500/25";
      }
    };

    return (
      <div
        id="avatar-preview-wrapper"
        className={`relative flex items-center justify-center overflow-hidden bg-gradient-to-br ${getBackdropClass()} rounded-3xl border border-purple-500/20 ${sizeClasses} ${className} transition-all duration-300 select-none shadow-md`}
      >
        <div className="absolute inset-0 bg-radial from-white/30 dark:from-white/5 to-transparent pointer-events-none" />
        <svg
          viewBox="0 0 200 200"
          className="w-full h-full p-2 transition-transform duration-300 pointer-events-none"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <BodyClothingLayer config={safeConfig} />
          <HeadFaceLayer config={safeConfig} />
          <EyesBrowsLayer config={safeConfig} />
          <ExpressionMouthLayer config={safeConfig} />
          <HairLayer config={safeConfig} />
          <HatLayer config={safeConfig} />
          <AccessoriesLayer config={safeConfig} />
        </svg>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // FULL-BODY 3D SHOWROOM PREVIEW (For lg, xl, 2xl)
  // ---------------------------------------------------------------------------
  const stageHeights = {
    lg: "380px",
    xl: "440px",
    "2xl": "490px",
  }[size as "lg" | "xl" | "2xl"] || "440px";

  const getBackdropClass = () => {
    switch (safeConfig.backdrop) {
      case "gradient-sunset":
        return "from-amber-950/20 via-orange-950/10 to-rose-950/20";
      case "gradient-cyber":
        return "from-cyan-950/20 via-sky-950/10 to-indigo-950/20";
      case "gradient-emerald":
        return "from-emerald-950/20 via-teal-950/10 to-green-950/20";
      case "solid-cream":
        return "from-amber-100/40 via-amber-50/20 to-amber-100/40 dark:from-neutral-900/50 dark:to-neutral-950/50";
      case "studio-dark":
        return "from-slate-950 via-slate-900 to-indigo-950";
      case "gradient-purple":
      default:
        return "from-purple-950/25 via-indigo-950/15 to-pink-950/25";
    }
  };

  return (
    <div
      id="avatar-preview-wrapper-3d"
      className={`relative w-full overflow-hidden rounded-3xl border border-border-primary bg-gradient-to-b ${getBackdropClass()} shadow-inner ${className}`}
    >
      {/* Background Soft Studio Glow Vignette */}
      <div className="absolute inset-0 bg-radial from-purple-500/10 via-transparent to-transparent pointer-events-none" />

      {/* Full-Body 3D Fiber Canvas with OrbitControls */}
      <CharacterFiberCanvas
        config={safeConfig}
        height={stageHeights}
        autoRotate={autoRotate3D}
        interactive={true}
        showControls={true}
      />
    </div>
  );
}
