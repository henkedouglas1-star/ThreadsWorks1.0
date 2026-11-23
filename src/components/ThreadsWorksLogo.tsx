import React, { useId } from "react";

export interface ThreadsWorksLogoProps {
  /**
   * Layout variant:
   * - "full": Symbol + Wordmark ("ThreadsWorks")
   * - "symbol": Symbol icon only
   * - "app-icon": Symbol centered inside a rounded squircle app icon container
   */
  variant?: "full" | "symbol" | "app-icon";
  
  /**
   * Preset sizes:
   * - "xs": 24px symbol height
   * - "sm": 32px symbol height
   * - "md": 40px symbol height
   * - "lg": 56px symbol height
   * - "xl": 80px symbol height
   */
  size?: "xs" | "sm" | "md" | "lg" | "xl";

  /**
   * Optionally displays the official tagline "YOUR AI OPERATING SYSTEM FOR THREADS"
   */
  showTagline?: boolean;

  /**
   * Additional container CSS classes
   */
  className?: string;

  /**
   * Optional click handler
   */
  onClick?: () => void;
}

/**
 * ThreadsWorks Official Master Logo Component
 * Single Source of Truth for the ThreadsWorks AI Creator Operating System Brand Identity.
 *
 * Symbol Architecture:
 * - Central Diamond Core: Represents the AI Intelligence Engine & Creator Strategy.
 * - Dynamic Interlocking Helix Threads: Represents continuous automated workflow (Idea → AI → Content → Publish → Analytics).
 * - Precision Nodes: Highlights connected creator checkpoints and scalable automation.
 */
export default function ThreadsWorksLogo({
  variant = "full",
  size = "md",
  showTagline = false,
  className = "",
  onClick
}: ThreadsWorksLogoProps) {
  const uid = useId().replace(/:/g, "");
  const ids = {
    glow: `twGlow-${uid}`,
    primary: `twThreadPrimary-${uid}`,
    secondary: `twThreadSecondary-${uid}`,
    core: `twCoreSpark-${uid}`,
  };
  
  // Size mapping
  const sizeStyles = {
    xs: { symbol: "h-6 w-6", text: "text-base", subtitle: "text-[8px]" },
    sm: { symbol: "h-8 w-8", text: "text-lg", subtitle: "text-[9px]" },
    md: { symbol: "h-10 w-10", text: "text-xl", subtitle: "text-[10px]" },
    lg: { symbol: "h-14 w-14", text: "text-2xl sm:text-3xl", subtitle: "text-[11px]" },
    xl: { symbol: "h-20 w-20 sm:h-24 sm:w-24", text: "text-3xl sm:text-4xl md:text-5xl", subtitle: "text-[10px] sm:text-xs" }
  }[size];

  // Pure Vector SVG Symbol - Theme-aware via centralized CSS custom properties
  const SymbolSVG = (
    <svg 
      viewBox="0 0 512 512" 
      className={`${sizeStyles.symbol} shrink-0`}
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      shapeRendering="geometricPrecision"
    >
      <defs>
        {/* Soft Outer Ambient Glow */}
        <filter id={ids.glow} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="12" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>

        {/* Primary Thread Stream Gradient (Idea -> AI Flow) */}
        <linearGradient id={ids.primary} x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" style={{ stopColor: "var(--logo-primary-0)" }} />
          <stop offset="30%" style={{ stopColor: "var(--logo-primary-1)" }} />
          <stop offset="65%" style={{ stopColor: "var(--logo-primary-2)" }} />
          <stop offset="100%" style={{ stopColor: "var(--logo-primary-3)" }} />
        </linearGradient>

        {/* Secondary Counter Loop Gradient (Automation -> Publish Loop) */}
        <linearGradient id={ids.secondary} x1="100%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" style={{ stopColor: "var(--logo-secondary-0)" }} />
          <stop offset="50%" style={{ stopColor: "var(--logo-secondary-1)" }} />
          <stop offset="100%" style={{ stopColor: "var(--logo-secondary-2)" }} />
        </linearGradient>

        {/* Central Core AI Diamond Radial Gradient */}
        <radialGradient id={ids.core} cx="35%" cy="30%" r="70%">
          <stop offset="0%" style={{ stopColor: "var(--logo-core-0)" }} />
          <stop offset="40%" style={{ stopColor: "var(--logo-core-1)" }} />
          <stop offset="75%" style={{ stopColor: "var(--logo-core-2)" }} />
          <stop offset="100%" style={{ stopColor: "var(--logo-core-3)" }} />
        </radialGradient>
      </defs>

      {/* SYMBOL EMBLEM GEOMETRY */}
      <g>
        {/* Primary Thread Loop Stream */}
        <path 
          d="M 160 120 
             C 80 200, 90 340, 210 400 
             C 330 460, 430 340, 390 220 
             C 360 120, 240 80, 160 120 Z"
          fill="none"
          stroke={`url(#${ids.primary})`}
          strokeWidth="32"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Counter Interlocking Loop Stream */}
        <path 
          d="M 352 392 
             C 432 312, 422 172, 302 112 
             C 182 52, 82 172, 122 292 
             C 152 392, 272 432, 352 392 Z"
          fill="none"
          stroke={`url(#${ids.secondary})`}
          strokeWidth="24"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.9"
        />

        {/* Central Intelligent AI Diamond Core */}
        <path 
          d="M 256 168 
             C 266 216 296 246 344 256 
             C 296 266 266 296 256 344 
             C 246 296 216 266 168 256 
             C 216 246 246 216 256 168 Z"
          fill={`url(#${ids.core})`}
        />

        {/* Inner Precision Spark Highlight */}
        <path 
          d="M 256 216 
             C 260 238 274 252 296 256 
             C 274 260 260 274 256 296 
             C 252 274 238 260 216 256 
             C 238 252 252 238 256 216 Z"
          style={{ fill: "var(--logo-spark)" }}
        />

        {/* Luminous Connected Workflow Nodes */}
        <circle cx="390" cy="160" r="18" fill={`url(#${ids.core})`} />
        <circle cx="122" cy="352" r="14" style={{ fill: "var(--logo-node-2)" }} />
      </g>
    </svg>
  );

  // App Icon Squircle Container Wrapper (Always dark squircle surface -> force dark CSS token scope)
  if (variant === "app-icon") {
    return (
      <div 
        onClick={onClick}
        className={`relative group flex items-center justify-center ${onClick ? "cursor-pointer" : ""} ${className}`}
      >
        {/* Soft Ambient Glow Halo */}
        <div className="absolute -inset-2.5 rounded-[2.2rem] sm:rounded-[2.6rem] bg-gradient-to-r from-purple-600 via-fuchsia-500 to-indigo-600 opacity-40 blur-xl group-hover:opacity-70 transition duration-500 pointer-events-none" />
        
        {/* Black Rounded Squircle Container */}
        <div
          data-theme="dark"
          className="dark relative flex items-center justify-center rounded-[2rem] sm:rounded-[2.4rem] border border-purple-400/30 bg-gradient-to-b from-[#1C0B3B] via-[#0B0318] to-[#04010A] p-3 sm:p-4 shadow-2xl shadow-purple-950/80 transition-transform duration-300 hover:scale-105"
        >
          {SymbolSVG}
        </div>
      </div>
    );
  }

  // Standalone Symbol Variant
  if (variant === "symbol") {
    return (
      <div onClick={onClick} className={`inline-flex items-center justify-center ${onClick ? "cursor-pointer" : ""} ${className}`}>
        {SymbolSVG}
      </div>
    );
  }

  // Full Master Brand Variant (Symbol + Wordmark + Subtitle/Tagline)
  return (
    <div 
      onClick={onClick} 
      className={`inline-flex flex-col items-center sm:items-start ${onClick ? "cursor-pointer group" : ""} ${className}`}
    >
      <div className="flex items-center gap-3">
        {/* Symbol */}
        <div className="relative flex items-center justify-center">
          {SymbolSVG}
        </div>

        {/* Wordmark: Threads (High-Contrast Ink/White) + Works (Deep/Luminous Violet Gradient) */}
        <div className="flex flex-col text-left">
          <div className={`font-sans font-black tracking-tight leading-none text-slate-900 dark:text-white ${sizeStyles.text}`}>
            Threads<span className="bg-gradient-to-r from-purple-700 via-violet-600 to-indigo-700 dark:from-purple-400 dark:via-fuchsia-300 dark:to-indigo-300 bg-clip-text text-transparent">Works</span>
          </div>
          {!showTagline && (
            <span className={`font-mono font-bold tracking-[0.25em] text-brand-text-strong dark:text-purple-300/85 uppercase mt-0.5 ${sizeStyles.subtitle}`}>
              CREATOR OS
            </span>
          )}
        </div>
      </div>

      {/* Optional Tagline */}
      {showTagline && (
        <p className={`font-mono font-bold tracking-[0.25em] text-brand-text-strong dark:text-purple-300/90 uppercase mt-2.5 text-center sm:text-left ${sizeStyles.subtitle}`}>
          YOUR AI OPERATING SYSTEM FOR THREADS
        </p>
      )}
    </div>
  );
}
