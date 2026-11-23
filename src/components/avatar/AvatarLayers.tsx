import React from "react";
import { CharacterAvatarConfig } from "../../types";

interface LayerProps {
  config: CharacterAvatarConfig;
}

/**
 * 1. Base Head & Facial Structure Layer
 */
export function HeadFaceLayer({ config }: LayerProps) {
  const { baseCharacter, appearance } = config;
  const skinColor = appearance.skinTone || "#FDDFB8";
  const faceShape = appearance.faceShape || "oval";

  // Base human head variations
  if (baseCharacter === "human-creator") {
    return (
      <g id="layer-human-head">
        {/* Neck */}
        <rect x="91" y="126" width="18" height="24" rx="6" fill={skinColor} />
        {/* Neck shadow under jaw */}
        <path d="M 91 126 Q 100 134 109 126 L 109 132 Q 100 138 91 132 Z" fill="#00000018" />

        {/* Ears */}
        <ellipse cx="60" cy="96" rx="6.5" ry="10.5" fill={skinColor} />
        <ellipse cx="60" cy="96" rx="3.5" ry="6" fill="#00000015" />
        <ellipse cx="140" cy="96" rx="6.5" ry="10.5" fill={skinColor} />
        <ellipse cx="140" cy="96" rx="3.5" ry="6" fill="#00000015" />

        {/* Dynamic Head Shape */}
        {faceShape === "round" ? (
          <ellipse cx="100" cy="96" rx="42" ry="42" fill={skinColor} />
        ) : faceShape === "square" ? (
          <rect x="60" y="56" width="80" height="78" rx="28" fill={skinColor} />
        ) : faceShape === "heart" ? (
          <path
            d="M 60 85 C 60 55 75 48 100 48 C 125 48 140 55 140 85 C 140 115 120 138 100 138 C 80 138 60 115 60 85 Z"
            fill={skinColor}
          />
        ) : (
          // Default: Soft Oval
          <ellipse cx="100" cy="95" rx="38.5" ry="42.5" fill={skinColor} />
        )}
      </g>
    );
  }

  // 2. Robo Buddy
  if (baseCharacter === "robo-buddy") {
    return (
      <g id="layer-robo-head">
        {/* Antenna */}
        <line x1="100" y1="50" x2="100" y2="28" stroke="#94A3B8" strokeWidth="4" strokeLinecap="round" />
        <circle cx="100" cy="24" r="7" fill="#06B6D4" className="animate-pulse" />
        {/* Head Chassis */}
        <rect x="58" y="48" width="84" height="76" rx="20" fill="#CBD5E1" stroke="#475569" strokeWidth="3" />
        {/* Glow Visor */}
        <rect x="68" y="60" width="64" height="44" rx="12" fill="#0F172A" stroke="#06B6D4" strokeWidth="1.5" />
        {/* Audio Ear Nodes */}
        <rect x="50" y="70" width="9" height="22" rx="3.5" fill="#64748B" />
        <circle cx="54.5" cy="81" r="2" fill="#06B6D4" />
        <rect x="141" y="70" width="9" height="22" rx="3.5" fill="#64748B" />
        <circle cx="145.5" cy="81" r="2" fill="#06B6D4" />
      </g>
    );
  }

  // 3. Cosmic Cat
  if (baseCharacter === "cosmic-cat") {
    return (
      <g id="layer-cat-head">
        {/* Ears */}
        <polygon points="60,72 74,30 98,62" fill="#F472B6" stroke="#DB2777" strokeWidth="2.5" />
        <polygon points="68,64 76,40 90,60" fill="#FCE7F3" />
        <polygon points="140,72 126,30 102,62" fill="#F472B6" stroke="#DB2777" strokeWidth="2.5" />
        <polygon points="132,64 124,40 110,60" fill="#FCE7F3" />
        {/* Head */}
        <circle cx="100" cy="95" r="44" fill="#FBCFE8" stroke="#DB2777" strokeWidth="2" />
        {/* Cute Whisker Tufts */}
        <line x1="55" y1="96" x2="42" y2="92" stroke="#DB2777" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="55" y1="102" x2="42" y2="104" stroke="#DB2777" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="145" y1="96" x2="158" y2="92" stroke="#DB2777" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="145" y1="102" x2="158" y2="104" stroke="#DB2777" strokeWidth="1.5" strokeLinecap="round" />
        {/* Cat Nose */}
        <polygon points="97,105 103,105 100,108" fill="#DB2777" />
      </g>
    );
  }

  // 4. Zen Panda
  if (baseCharacter === "zen-panda") {
    return (
      <g id="layer-panda-head">
        {/* Panda Ears */}
        <circle cx="66" cy="56" r="16" fill="#1E293B" />
        <circle cx="66" cy="56" r="8" fill="#334155" />
        <circle cx="134" cy="56" r="16" fill="#1E293B" />
        <circle cx="134" cy="56" r="8" fill="#334155" />
        {/* Panda Head */}
        <circle cx="100" cy="96" r="44" fill="#FFFFFF" stroke="#1E293B" strokeWidth="2.5" />
        {/* Eye patches */}
        <ellipse cx="80" cy="94" rx="14" ry="12" fill="#1E293B" transform="rotate(-15 80 94)" />
        <ellipse cx="120" cy="94" rx="14" ry="12" fill="#1E293B" transform="rotate(15 120 94)" />
        {/* Panda Nose */}
        <ellipse cx="100" cy="107" rx="5" ry="3.5" fill="#1E293B" />
      </g>
    );
  }

  // 5. Capybara Craft
  if (baseCharacter === "capybara-craft") {
    return (
      <g id="layer-capybara-head">
        {/* Ears */}
        <circle cx="64" cy="64" r="10" fill="#78350F" />
        <circle cx="136" cy="64" r="10" fill="#78350F" />
        {/* Head Shape */}
        <rect x="62" y="60" width="76" height="76" rx="26" fill="#D97706" stroke="#78350F" strokeWidth="2.5" />
        {/* Cute Broad Snout */}
        <rect x="72" y="96" width="56" height="34" rx="14" fill="#B45309" />
        {/* Nostrils */}
        <circle cx="94" cy="108" r="2" fill="#78350F" />
        <circle cx="106" cy="108" r="2" fill="#78350F" />
      </g>
    );
  }

  // 6. Fox Strategist
  if (baseCharacter === "fox-strategist") {
    return (
      <g id="layer-fox-head">
        {/* Big Fox Ears */}
        <polygon points="56,76 68,26 94,62" fill="#EA580C" stroke="#9A3412" strokeWidth="2.5" />
        <polygon points="66,66 72,36 88,58" fill="#1E293B" />
        <polygon points="144,76 132,26 106,62" fill="#EA580C" stroke="#9A3412" strokeWidth="2.5" />
        <polygon points="134,66 128,36 112,58" fill="#1E293B" />
        {/* Fox Head */}
        <circle cx="100" cy="94" r="43" fill="#FB923C" stroke="#9A3412" strokeWidth="2" />
        {/* White Cheek Tufts */}
        <path d="M 60 96 Q 75 118 100 120 Q 125 118 140 96 Q 130 135 100 135 Q 70 135 60 96 Z" fill="#FFFFFF" />
        {/* Small Nose */}
        <circle cx="100" cy="110" r="3.5" fill="#1E293B" />
      </g>
    );
  }

  // 7. Cyber Bunny
  if (baseCharacter === "cyber-bunny") {
    return (
      <g id="layer-bunny-head">
        {/* Long Bunny Ears */}
        <rect x="70" y="16" width="16" height="60" rx="8" fill="#E0E7FF" stroke="#6366F1" strokeWidth="2" />
        <rect x="74" y="24" width="8" height="44" rx="4" fill="#A5B4FC" />
        <rect x="114" y="16" width="16" height="60" rx="8" fill="#E0E7FF" stroke="#6366F1" strokeWidth="2" />
        <rect x="118" y="24" width="8" height="44" rx="4" fill="#A5B4FC" />
        {/* Head */}
        <circle cx="100" cy="96" r="42" fill="#EEF2FF" stroke="#6366F1" strokeWidth="2" />
        {/* Cute Bunny Nose */}
        <polygon points="97,105 103,105 100,108" fill="#EC4899" />
      </g>
    );
  }

  // 8. Owl Scholar
  if (baseCharacter === "owl-scholar") {
    return (
      <g id="layer-owl-head">
        {/* Feather Horns */}
        <polygon points="62,60 52,34 76,48" fill="#78350F" />
        <polygon points="138,60 148,34 124,48" fill="#78350F" />
        {/* Head */}
        <circle cx="100" cy="95" r="44" fill="#A16207" stroke="#713F12" strokeWidth="2" />
        {/* Face Disc */}
        <circle cx="82" cy="92" r="18" fill="#FEF3C7" />
        <circle cx="118" cy="92" r="18" fill="#FEF3C7" />
        {/* Owl Beak */}
        <polygon points="96,98 104,98 100,110" fill="#D97706" />
      </g>
    );
  }

  // 9. Minimal Pixel
  return (
    <g id="layer-pixel-head">
      <rect x="62" y="52" width="76" height="76" rx="6" fill={skinColor} stroke="#000000" strokeWidth="3.5" />
    </g>
  );
}

/**
 * 2. Hair Styling Layer
 */
export function HairLayer({ config }: LayerProps) {
  const { baseCharacter, appearance } = config;
  if (baseCharacter !== "human-creator" && baseCharacter !== "minimal-pixel") {
    // Non-human characters have customized animal ears / headgear
    return null;
  }

  const hairColor = appearance.hairColor || "#231B15";
  const hairStyle = appearance.hairStyle || "swoop";

  if (baseCharacter === "minimal-pixel") {
    return (
      <g id="layer-pixel-hair" fill={hairColor}>
        <rect x="58" y="44" width="84" height="20" />
        <rect x="54" y="56" width="10" height="28" />
        <rect x="136" y="56" width="10" height="28" />
      </g>
    );
  }

  switch (hairStyle) {
    case "curly":
      return (
        <g id="layer-hair-curly" fill={hairColor}>
          <circle cx="68" cy="62" r="16" />
          <circle cx="84" cy="50" r="17" />
          <circle cx="100" cy="46" r="18" />
          <circle cx="116" cy="50" r="17" />
          <circle cx="132" cy="62" r="16" />
          <circle cx="58" cy="78" r="14" />
          <circle cx="142" cy="78" r="14" />
          <circle cx="56" cy="94" r="12" />
          <circle cx="144" cy="94" r="12" />
        </g>
      );

    case "long":
      return (
        <g id="layer-hair-long" fill={hairColor}>
          {/* Top Cap */}
          <path d="M 60 88 C 56 56 70 44 100 44 C 130 44 144 56 140 88 C 130 64 116 58 100 58 C 84 58 70 64 60 88 Z" />
          {/* Left Curtain */}
          <path d="M 62 80 C 56 95 54 125 58 152 Q 68 158 74 135 L 72 88 Z" />
          {/* Right Curtain */}
          <path d="M 138 80 C 144 95 146 125 142 152 Q 132 158 126 135 L 128 88 Z" />
        </g>
      );

    case "spiky":
      return (
        <g id="layer-hair-spiky" fill={hairColor}>
          <path d="M 62 82 L 66 48 L 76 56 L 86 38 L 98 52 L 112 36 L 122 54 L 134 46 L 138 82 C 128 66 114 58 100 58 C 86 58 72 66 62 82 Z" />
        </g>
      );

    case "bob":
      return (
        <g id="layer-hair-bob" fill={hairColor}>
          <path d="M 58 92 C 54 54 70 44 100 44 C 130 44 146 54 142 92 L 144 118 Q 135 125 130 110 L 132 82 C 125 62 75 62 68 82 L 70 110 Q 65 125 56 118 Z" />
        </g>
      );

    case "ponytail":
      return (
        <g id="layer-hair-ponytail" fill={hairColor}>
          {/* Top smooth hair */}
          <path d="M 60 82 C 58 54 72 46 100 46 C 128 46 142 54 140 82 C 130 64 116 58 100 58 C 84 58 70 64 60 82 Z" />
          {/* High Ponytail */}
          <path d="M 100 48 Q 136 28 144 56 Q 148 88 136 102 Q 130 80 120 60 Z" />
          <circle cx="106" cy="46" r="4" fill="#F43F5E" />
        </g>
      );

    case "bun":
      return (
        <g id="layer-hair-bun" fill={hairColor}>
          {/* Bun */}
          <circle cx="100" cy="34" r="18" />
          <ellipse cx="100" cy="46" rx="8" ry="4" fill="#8B5CF6" />
          {/* Base hair */}
          <path d="M 60 84 C 58 56 74 48 100 48 C 126 48 142 56 140 84 C 130 66 116 60 100 60 C 84 60 70 66 60 84 Z" />
        </g>
      );

    case "braids":
      return (
        <g id="layer-hair-braids" fill={hairColor}>
          {/* Top scalp braids */}
          <path d="M 62 82 C 60 52 74 46 100 46 C 126 46 140 52 138 82 Z" />
          {/* Left Braid */}
          <rect x="56" y="80" width="8" height="60" rx="4" />
          <line x1="56" y1="92" x2="64" y2="92" stroke="#FFFFFF40" strokeWidth="2" />
          <line x1="56" y1="104" x2="64" y2="104" stroke="#FFFFFF40" strokeWidth="2" />
          <line x1="56" y1="116" x2="64" y2="116" stroke="#FFFFFF40" strokeWidth="2" />
          <circle cx="60" cy="140" r="4" fill="#F59E0B" />
          {/* Right Braid */}
          <rect x="136" y="80" width="8" height="60" rx="4" />
          <line x1="136" y1="92" x2="144" y2="92" stroke="#FFFFFF40" strokeWidth="2" />
          <line x1="136" y1="104" x2="144" y2="104" stroke="#FFFFFF40" strokeWidth="2" />
          <line x1="136" y1="116" x2="144" y2="116" stroke="#FFFFFF40" strokeWidth="2" />
          <circle cx="140" cy="140" r="4" fill="#F59E0B" />
        </g>
      );

    case "buzz":
      return (
        <g id="layer-hair-buzz" fill={hairColor} opacity="0.85">
          <path d="M 61 80 C 60 52 74 46 100 46 C 126 46 140 52 139 80 C 130 64 116 58 100 58 C 84 58 70 64 61 80 Z" />
        </g>
      );

    case "beanie":
      return (
        <g id="layer-hair-beanie">
          <path d="M 58 84 C 58 46 76 34 100 34 C 124 34 142 46 142 84 Z" fill="#EF4444" />
          <rect x="56" y="76" width="88" height="14" rx="5" fill="#B91C1C" />
          <circle cx="100" cy="32" r="7" fill="#FEE2E2" />
        </g>
      );

    case "swoop":
    default:
      return (
        <g id="layer-hair-swoop" fill={hairColor}>
          <path d="M 60 82 C 58 54 74 46 100 46 C 126 46 142 54 140 82 C 130 66 114 60 100 60 C 82 60 68 68 60 82 Z" />
          {/* Side swoop lock */}
          <path d="M 62 80 Q 75 70 95 72 Q 80 84 64 88 Z" />
        </g>
      );
  }
}

/**
 * 3. Eyes, Eyebrows & Gaze Layer
 */
export function EyesBrowsLayer({ config }: LayerProps) {
  const { baseCharacter, appearance, expression } = config;
  const eyeStyle = appearance.eyeStyle || "classic";
  const eyebrows = appearance.eyebrows || "natural";
  const hairColor = appearance.hairColor || "#231B15";

  // Special handling for Robo Buddy
  if (baseCharacter === "robo-buddy") {
    return (
      <g id="layer-robo-eyes">
        {expression === "excited" || expression === "celebrating" ? (
          <g fill="#FACC15">
            <polygon points="84,76 87,82 93,82 88,86 90,92 84,88 78,92 80,86 75,82 81,82" />
            <polygon points="116,76 119,82 125,82 120,86 122,92 116,88 110,92 112,86 107,82 113,82" />
          </g>
        ) : expression === "thinking" || expression === "curious" ? (
          <g stroke="#38BDF8" strokeWidth="3.5" strokeLinecap="round">
            <line x1="76" y1="78" x2="90" y2="84" />
            <circle cx="116" cy="82" r="5" fill="#38BDF8" />
          </g>
        ) : expression === "laughing" || expression === "zen" ? (
          <g stroke="#38BDF8" strokeWidth="3.5" strokeLinecap="round" fill="none">
            <path d="M 76 84 Q 84 76 92 84" />
            <path d="M 108 84 Q 116 76 124 84" />
          </g>
        ) : (
          <g fill="#38BDF8">
            <circle cx="84" cy="82" r="5.5" />
            <circle cx="86" cy="80" r="2" fill="#FFFFFF" />
            <circle cx="116" cy="82" r="5.5" />
            <circle cx="118" cy="80" r="2" fill="#FFFFFF" />
          </g>
        )}
      </g>
    );
  }

  // Panda eye adjustment
  const isPanda = baseCharacter === "zen-panda";
  const eyePupilColor = isPanda ? "#FFFFFF" : "#1E293B";

  // Eyebrows renderer
  const renderEyebrows = () => {
    if (eyebrows === "bold") {
      return (
        <g stroke={hairColor} strokeWidth="3.5" strokeLinecap="round">
          <line x1="76" y1="83" x2="92" y2="85" />
          <line x1="124" y1="83" x2="108" y2="85" />
        </g>
      );
    }
    if (eyebrows === "arched") {
      return (
        <g stroke={hairColor} strokeWidth="2.5" strokeLinecap="round" fill="none">
          <path d="M 76 86 Q 84 81 92 85" />
          <path d="M 124 86 Q 116 81 108 85" />
        </g>
      );
    }
    if (eyebrows === "straight") {
      return (
        <g stroke={hairColor} strokeWidth="2.5" strokeLinecap="round">
          <line x1="77" y1="84" x2="91" y2="84" />
          <line x1="123" y1="84" x2="109" y2="84" />
        </g>
      );
    }
    // Default natural
    return (
      <g stroke={hairColor} strokeWidth="2" strokeLinecap="round" fill="none">
        <path d="M 78 86 Q 84 83 91 86" />
        <path d="M 122 86 Q 116 83 109 86" />
      </g>
    );
  };

  // Eyes renderer based on expression / eyeStyle
  const renderEyes = () => {
    if (expression === "laughing" || expression === "zen") {
      return (
        <g stroke={eyePupilColor} strokeWidth="2.5" strokeLinecap="round" fill="none">
          <path d="M 78 94 Q 84 88 90 94" />
          <path d="M 110 94 Q 116 88 122 94" />
        </g>
      );
    }

    if (expression === "winking") {
      return (
        <g>
          <circle cx="84" cy="94" r="4.5" fill={eyePupilColor} />
          <circle cx="86" cy="92" r="1.5" fill="#FFFFFF" />
          <path d="M 110 94 Q 116 99 122 94" stroke={eyePupilColor} strokeWidth="2.5" strokeLinecap="round" fill="none" />
        </g>
      );
    }

    if (eyeStyle === "sparkle" || expression === "excited" || expression === "celebrating") {
      return (
        <g>
          <circle cx="84" cy="94" r="5.5" fill={eyePupilColor} />
          <circle cx="86" cy="91.5" r="2.2" fill="#FFFFFF" />
          <circle cx="82" cy="96" r="1.2" fill="#FFFFFF" />
          <circle cx="116" cy="94" r="5.5" fill={eyePupilColor} />
          <circle cx="118" cy="91.5" r="2.2" fill="#FFFFFF" />
          <circle cx="114" cy="96" r="1.2" fill="#FFFFFF" />
        </g>
      );
    }

    if (eyeStyle === "cateye") {
      return (
        <g>
          <ellipse cx="84" cy="94" rx="4.5" ry="5" fill={eyePupilColor} />
          <path d="M 87 91 L 93 88" stroke={eyePupilColor} strokeWidth="2" strokeLinecap="round" />
          <circle cx="85.5" cy="92.5" r="1.5" fill="#FFFFFF" />
          <ellipse cx="116" cy="94" rx="4.5" ry="5" fill={eyePupilColor} />
          <path d="M 119 91 L 125 88" stroke={eyePupilColor} strokeWidth="2" strokeLinecap="round" />
          <circle cx="117.5" cy="92.5" r="1.5" fill="#FFFFFF" />
        </g>
      );
    }

    if (eyeStyle === "confident") {
      return (
        <g>
          <ellipse cx="84" cy="93.5" rx="4" ry="4.5" fill={eyePupilColor} />
          <circle cx="85.5" cy="92" r="1.5" fill="#FFFFFF" />
          <ellipse cx="116" cy="93.5" rx="4" ry="4.5" fill={eyePupilColor} />
          <circle cx="117.5" cy="92" r="1.5" fill="#FFFFFF" />
        </g>
      );
    }

    // Default classic round
    return (
      <g>
        <circle cx="84" cy="94" r="4.5" fill={eyePupilColor} />
        <circle cx="86" cy="92" r="1.5" fill="#FFFFFF" />
        <circle cx="116" cy="94" r="4.5" fill={eyePupilColor} />
        <circle cx="118" cy="92" r="1.5" fill="#FFFFFF" />
      </g>
    );
  };

  return (
    <g id="layer-eyes-brows">
      {renderEyebrows()}
      {renderEyes()}
    </g>
  );
}

/**
 * 4. Expressions & Mouth Layer
 */
export function ExpressionMouthLayer({ config }: LayerProps) {
  const { baseCharacter, expression } = config;

  if (baseCharacter === "robo-buddy") {
    // Visor digital mouth
    switch (expression) {
      case "excited":
      case "celebrating":
        return <path d="M 88 92 Q 100 102 112 92 Z" fill="#38BDF8" />;
      case "thinking":
        return <line x1="92" y1="94" x2="108" y2="94" stroke="#38BDF8" strokeWidth="2.5" strokeLinecap="round" />;
      case "surprised":
        return <circle cx="100" cy="94" r="4" stroke="#38BDF8" strokeWidth="2" fill="none" />;
      case "confident":
        return <path d="M 90 94 Q 104 98 112 90" stroke="#38BDF8" strokeWidth="2.5" strokeLinecap="round" fill="none" />;
      default:
        return <path d="M 90 92 Q 100 98 110 92" stroke="#38BDF8" strokeWidth="2.5" strokeLinecap="round" fill="none" />;
    }
  }

  // Rosy cheeks for humans and cute animals
  const showBlush = expression === "happy" || expression === "excited" || expression === "celebrating" || expression === "laughing";

  return (
    <g id="layer-mouth-expression">
      {/* Soft Rosy Cheeks */}
      {showBlush && (
        <g opacity="0.45">
          <ellipse cx="74" cy="102" rx="5.5" ry="3.5" fill="#F43F5E" />
          <ellipse cx="126" cy="102" rx="5.5" ry="3.5" fill="#F43F5E" />
        </g>
      )}

      {/* Mouth variants */}
      {expression === "excited" || expression === "celebrating" ? (
        <g>
          <path d="M 89 112 Q 100 128 111 112 Z" fill="#EF4444" stroke="#1E293B" strokeWidth="1.5" />
          <path d="M 92 113 Q 100 118 108 113" stroke="#FFFFFF" strokeWidth="2" fill="none" />
        </g>
      ) : expression === "laughing" ? (
        <path d="M 90 112 Q 100 126 110 112 Z" fill="#F43F5E" stroke="#1E293B" strokeWidth="1.5" />
      ) : expression === "surprised" ? (
        <ellipse cx="100" cy="115" rx="4.5" ry="6" fill="#1E293B" />
      ) : expression === "thinking" ? (
        <g>
          <path d="M 94 116 Q 102 113 108 116" stroke="#1E293B" strokeWidth="2" strokeLinecap="round" fill="none" />
        </g>
      ) : expression === "curious" ? (
        <path d="M 92 115 Q 98 118 108 112" stroke="#1E293B" strokeWidth="2" strokeLinecap="round" fill="none" />
      ) : expression === "confident" ? (
        <path d="M 91 114 Q 104 118 112 110" stroke="#1E293B" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      ) : expression === "zen" ? (
        <line x1="95" y1="115" x2="105" y2="115" stroke="#1E293B" strokeWidth="2" strokeLinecap="round" />
      ) : (
        // Default happy smile
        <path d="M 91 113 Q 100 122 109 113" stroke="#1E293B" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      )}
    </g>
  );
}

/**
 * 5. Clothing & Torso Layer
 */
export function BodyClothingLayer({ config }: LayerProps) {
  const { clothing } = config;
  const style = clothing.style || "hoodie";
  const primaryColor = clothing.color || "#8B5CF6";
  const accentColor = clothing.accentColor || "#FFFFFF";

  return (
    <g id="layer-torso-clothing">
      <defs>
        <linearGradient id="clothGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={primaryColor} />
          <stop offset="100%" stopColor={primaryColor} stopOpacity="0.85" />
        </linearGradient>
      </defs>

      {style === "hoodie" || style === "zip-hoodie" ? (
        <g id="cloth-hoodie">
          <path d="M 44 190 Q 44 140 100 140 Q 156 140 156 190 Z" fill="url(#clothGrad)" />
          {/* Kangaroo pocket */}
          <path d="M 72 170 L 128 170 L 122 190 L 78 190 Z" fill="#00000015" />
          {/* Hoodie collar & pouch */}
          <ellipse cx="100" cy="148" rx="28" ry="14" fill="#00000025" />
          {style === "zip-hoodie" ? (
            <line x1="100" y1="148" x2="100" y2="190" stroke={accentColor} strokeWidth="2.5" />
          ) : (
            <>
              <line x1="92" y1="148" x2="92" y2="175" stroke={accentColor} strokeWidth="2" strokeLinecap="round" />
              <line x1="108" y1="148" x2="108" y2="175" stroke={accentColor} strokeWidth="2" strokeLinecap="round" />
            </>
          )}
        </g>
      ) : style === "blazer" ? (
        <g id="cloth-blazer">
          {/* Outer dark jacket */}
          <path d="M 48 190 Q 48 142 100 142 Q 152 142 152 190 Z" fill="#1E293B" />
          {/* Inner colored shirt */}
          <path d="M 76 190 L 100 150 L 124 190 Z" fill={primaryColor} />
          {/* Blazer lapels */}
          <path d="M 60 146 L 86 190 L 58 190 Z" fill="#0F172A" />
          <path d="M 140 146 L 114 190 L 142 190 Z" fill="#0F172A" />
        </g>
      ) : style === "denim" ? (
        <g id="cloth-denim">
          <path d="M 46 190 Q 46 142 100 142 Q 154 142 154 190 Z" fill="#3B82F6" />
          {/* Collar & Buttons */}
          <path d="M 76 142 L 100 164 L 124 142" stroke="#1D4ED8" strokeWidth="3" fill="none" />
          <line x1="100" y1="164" x2="100" y2="190" stroke="#1D4ED8" strokeWidth="2" strokeDasharray="3 3" />
          {/* Flap pockets */}
          <rect x="62" y="166" width="16" height="12" rx="2" fill="#2563EB" stroke="#1D4ED8" strokeWidth="1" />
          <rect x="122" y="166" width="16" height="12" rx="2" fill="#2563EB" stroke="#1D4ED8" strokeWidth="1" />
        </g>
      ) : style === "sweater" ? (
        <g id="cloth-sweater">
          <path d="M 46 190 Q 46 142 100 142 Q 154 142 154 190 Z" fill="url(#clothGrad)" />
          {/* Ribbed knit texture */}
          <path d="M 78 142 Q 100 152 122 142" stroke="#FFFFFF50" strokeWidth="4" fill="none" />
          <line x1="68" y1="162" x2="132" y2="162" stroke="#FFFFFF25" strokeWidth="2.5" />
          <line x1="64" y1="176" x2="136" y2="176" stroke="#FFFFFF25" strokeWidth="2.5" />
        </g>
      ) : style === "bomber" || style === "biker" ? (
        <g id="cloth-jacket">
          <path d="M 46 190 Q 46 142 100 142 Q 154 142 154 190 Z" fill="#0F172A" />
          {/* Inner accent tee */}
          <path d="M 80 190 L 100 156 L 120 190 Z" fill={primaryColor} />
          {/* Zip line */}
          <line x1="100" y1="156" x2="95" y2="190" stroke="#94A3B8" strokeWidth="2.5" />
        </g>
      ) : style === "dress" ? (
        <g id="cloth-dress">
          <path d="M 52 190 Q 52 142 100 142 Q 148 142 148 190 Z" fill="url(#clothGrad)" />
          <path d="M 78 142 Q 100 160 122 142" stroke="#00000030" strokeWidth="2.5" fill="none" />
        </g>
      ) : style === "polo" ? (
        <g id="cloth-polo">
          <path d="M 48 190 Q 48 144 100 144 Q 152 144 152 190 Z" fill="url(#clothGrad)" />
          {/* Collar flaps */}
          <polygon points="76,144 100,162 88,144" fill="#00000030" />
          <polygon points="124,144 100,162 112,144" fill="#00000030" />
        </g>
      ) : (
        // Casual Crewneck / Tee
        <g id="cloth-crewneck">
          <path d="M 48 190 Q 48 144 100 144 Q 152 144 152 190 Z" fill="url(#clothGrad)" />
          <path d="M 80 144 Q 100 158 120 144" stroke="#00000025" strokeWidth="3" fill="none" />
        </g>
      )}
    </g>
  );
}

/**
 * 6. Hat & Headgear Layer
 */
export function HatLayer({ config }: LayerProps) {
  const { clothing } = config;
  const hat = clothing.hat || "none";
  const hatColor = clothing.hatColor || clothing.color || "#1E293B";

  if (hat === "none") return null;

  switch (hat) {
    case "snapback":
      return (
        <g id="hat-snapback">
          {/* Cap Dome */}
          <path d="M 58 74 C 58 42 78 36 100 36 C 122 36 142 42 142 74 Z" fill={hatColor} />
          {/* Flat Brim */}
          <rect x="52" y="68" width="96" height="12" rx="4" fill="#0F172A" />
          {/* Top button */}
          <circle cx="100" cy="35" r="3.5" fill="#0F172A" />
        </g>
      );

    case "beret":
      return (
        <g id="hat-beret">
          <ellipse cx="100" cy="46" rx="48" ry="16" fill={hatColor} transform="rotate(-6 100 46)" />
          <circle cx="100" cy="30" r="3" fill="#00000040" />
        </g>
      );

    case "bucket":
      return (
        <g id="hat-bucket">
          <path d="M 68 62 L 74 38 L 126 38 L 132 62 Z" fill={hatColor} />
          <ellipse cx="100" cy="62" rx="46" ry="12" fill={hatColor} stroke="#00000020" strokeWidth="2" />
        </g>
      );

    case "headband":
      return (
        <g id="hat-headband">
          <rect x="58" y="64" width="84" height="12" rx="4" fill={hatColor} />
          <circle cx="100" cy="70" r="3" fill="#FFFFFF" />
        </g>
      );

    case "beanie":
      return (
        <g id="hat-beanie">
          <path d="M 60 76 C 60 42 78 32 100 32 C 122 32 140 42 140 76 Z" fill={hatColor} />
          <rect x="58" y="70" width="84" height="12" rx="4" fill="#00000030" />
          <circle cx="100" cy="30" r="6" fill="#F8FAFC" />
        </g>
      );

    default:
      return null;
  }
}

/**
 * 7. Accessories Layer (Glasses, Headphones, Chains, etc.)
 */
export function AccessoriesLayer({ config }: LayerProps) {
  const { accessories = [] } = config;

  return (
    <g id="layer-accessories">
      {/* Glasses: Round Wireframes */}
      {(accessories.includes("glasses") || accessories.includes("glasses-wire")) && (
        <g id="acc-glasses-wire" stroke="#1E293B" strokeWidth="2.5" fill="#FFFFFF25">
          <circle cx="84" cy="94" r="11" />
          <circle cx="116" cy="94" r="11" />
          <line x1="95" y1="94" x2="105" y2="94" stroke="#1E293B" strokeWidth="2" />
          <line x1="62" y1="92" x2="73" y2="92" stroke="#1E293B" strokeWidth="2" />
          <line x1="127" y1="92" x2="138" y2="92" stroke="#1E293B" strokeWidth="2" />
        </g>
      )}

      {/* Glasses: Classic Wayfarer / Geek Chic */}
      {(accessories.includes("wayfarer") || accessories.includes("geek-chic")) && (
        <g id="acc-glasses-wayfarer" stroke="#0F172A" strokeWidth="3" fill="#FFFFFF30">
          <rect x="72" y="85" width="24" height="18" rx="4" />
          <rect x="104" y="85" width="24" height="18" rx="4" />
          <line x1="96" y1="92" x2="104" y2="92" stroke="#0F172A" strokeWidth="3" />
        </g>
      )}

      {/* Glasses: Sunglasses */}
      {accessories.includes("sunglasses") && (
        <g id="acc-sunglasses">
          <path d="M 72 86 L 96 86 L 94 102 Q 84 106 74 102 Z" fill="#0F172A" />
          <path d="M 104 86 L 128 86 L 126 102 Q 116 106 106 102 Z" fill="#0F172A" />
          <line x1="96" y1="90" x2="104" y2="90" stroke="#0F172A" strokeWidth="3" />
        </g>
      )}

      {/* Headphones: Over-Ear Studio Pro */}
      {(accessories.includes("headphones") || accessories.includes("neon-headphones")) && (
        <g id="acc-headphones">
          {/* Headband */}
          <path d="M 56 94 C 56 48 80 40 100 40 C 120 40 144 48 144 94" stroke="#8B5CF6" strokeWidth="5.5" strokeLinecap="round" fill="none" />
          {/* Left Can */}
          <rect x="50" y="82" width="12" height="26" rx="6" fill="#6D28D9" />
          {accessories.includes("neon-headphones") && <circle cx="56" cy="95" r="3" fill="#06B6D4" />}
          {/* Right Can */}
          <rect x="138" y="82" width="12" height="26" rx="6" fill="#6D28D9" />
          {accessories.includes("neon-headphones") && <circle cx="144" cy="95" r="3" fill="#06B6D4" />}
        </g>
      )}

      {/* Jewelry: Gold Chain */}
      {accessories.includes("gold-chain") && (
        <path d="M 80 144 Q 100 166 120 144" stroke="#F59E0B" strokeWidth="3.5" strokeLinecap="round" fill="none" />
      )}

      {/* Jewelry: Pearls */}
      {accessories.includes("pearls") && (
        <g fill="#F8FAFC" stroke="#E2E8F0" strokeWidth="0.5">
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <circle key={i} cx={82 + i * 6} cy={144 + Math.sin((i / 6) * Math.PI) * 12} r="2.8" />
          ))}
        </g>
      )}

      {/* Earrings: Silver Hoops */}
      {accessories.includes("earrings") && (
        <g fill="none" stroke="#CBD5E1" strokeWidth="2">
          <circle cx="58" cy="106" r="4.5" />
          <circle cx="142" cy="106" r="4.5" />
        </g>
      )}

      {/* Creator Crown */}
      {accessories.includes("crown") && (
        <g id="acc-crown" fill="#F59E0B" stroke="#B45309" strokeWidth="2">
          <polygon points="74,52 84,32 100,44 116,32 126,52" />
          <circle cx="84" cy="32" r="2.5" fill="#EF4444" />
          <circle cx="100" cy="44" r="2.5" fill="#3B82F6" />
          <circle cx="116" cy="32" r="2.5" fill="#10B981" />
        </g>
      )}
    </g>
  );
}
