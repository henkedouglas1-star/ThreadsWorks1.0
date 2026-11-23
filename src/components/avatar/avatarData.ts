import { CharacterAvatarConfig } from "../../types";

export interface OptionItem {
  id: string;
  label: string;
  description?: string;
  icon?: string;
  previewColor?: string;
  badge?: string;
}

export const BASE_CHARACTERS: OptionItem[] = [
  { id: "human-creator", label: "Human Creator", icon: "👤", description: "Friendly, versatile modern creator" },
  { id: "robo-buddy", label: "Robo Buddy", icon: "🤖", description: "Futuristic tech companion with glowing visor" },
  { id: "cosmic-cat", label: "Cosmic Cat", icon: "🐱", description: "Playful, charismatic feline creator" },
  { id: "zen-panda", label: "Zen Panda", icon: "🐼", description: "Calm, thoughtful mindful builder" },
  { id: "capybara-craft", label: "Capybara", icon: "🦫", description: "Chill, unflappable high-leverage operator" },
  { id: "fox-strategist", label: "Fox Strategist", icon: "🦊", description: "Sharp, clever growth architect" },
  { id: "cyber-bunny", label: "Cyber Bunny", icon: "🐰", description: "High-energy, fast-shipping innovator" },
  { id: "owl-scholar", label: "Owl Scholar", icon: "🦉", description: "Wise, analytical deep-dive authority" },
  { id: "minimal-pixel", label: "Pixel Pioneer", icon: "👾", description: "Retro 8-bit digital native" },
];

export const AVATAR_STYLES: OptionItem[] = [
  { id: "cute-cartoon", label: "Cute Cartoon", description: "Smooth vector, vibrant pastel warmth & friendly vibe", badge: "Popular" },
  { id: "3d-character", label: "3D Character", description: "Pillowy claymorphism with depth & soft ambient lighting", badge: "3D" },
  { id: "illustrated", label: "Illustrated", description: "Clean linework & hand-drawn editorial feel" },
  { id: "mascot", label: "Mascot Sticker", description: "Bold pop-art strokes & die-cut badge outline" },
];

export const SKIN_TONES = [
  { color: "#FDDFB8", label: "Porcelain Warm" },
  { color: "#F5D0A9", label: "Light Peach" },
  { color: "#E8B88A", label: "Warm Sand" },
  { color: "#D4A373", label: "Golden Honey" },
  { color: "#B07D4C", label: "Caramel Bronze" },
  { color: "#8C5832", label: "Rich Amber" },
  { color: "#613D24", label: "Espresso" },
  { color: "#402315", label: "Deep Cocoa" },
  { color: "#D1E8FF", label: "Cyber Glaze" },
  { color: "#FDE2E4", label: "Pastel Rose" },
];

export const FACE_SHAPES: OptionItem[] = [
  { id: "oval", label: "Soft Oval", icon: "🥚" },
  { id: "round", label: "Cute Round", icon: "⚪" },
  { id: "square", label: "Defined Chiseled", icon: "◻️" },
  { id: "heart", label: "Heart / Tapered", icon: "🤍" },
];

export const EYE_STYLES: OptionItem[] = [
  { id: "classic", label: "Classic Shine", icon: "👀", description: "Friendly round eyes with soft glint" },
  { id: "sparkle", label: "Anime Star", icon: "✨", description: "Dual-glint animated sparkle" },
  { id: "confident", label: "Cool Confident", icon: "😏", description: "Sharp focused gaze with cool poise" },
  { id: "calm", label: "Calm Oval", icon: "😌", description: "Gentle, relaxed, peaceful eyes" },
  { id: "cateye", label: "Cat-Eye Wing", icon: "👁️", description: "Subtle stylish winged lashes" },
  { id: "curious", label: "Curious Wide", icon: "🧐", description: "Bright, open, observant eyes" },
];

export const EYEBROW_STYLES: OptionItem[] = [
  { id: "natural", label: "Natural Soft", icon: "〰️" },
  { id: "arched", label: "Sharp Arched", icon: "⤴️" },
  { id: "bold", label: "Bold & Thick", icon: "➖" },
  { id: "straight", label: "Focused Straight", icon: "―" },
];

export const HAIR_STYLES: OptionItem[] = [
  { id: "swoop", label: "Classic Swoop", icon: "💇" },
  { id: "curly", label: "Curly Afro", icon: "🦱" },
  { id: "long", label: "Long Waves", icon: "🌊" },
  { id: "spiky", label: "Modern Spiky", icon: "⚡" },
  { id: "bob", label: "Chic Bob", icon: "✂️" },
  { id: "ponytail", label: "High Ponytail", icon: "👱" },
  { id: "bun", label: "Messy Topknot", icon: "🍩" },
  { id: "braids", label: "Sleek Braids", icon: "🧶" },
  { id: "buzz", label: "Clean Buzzcut", icon: "✨" },
  { id: "beanie", label: "Beanie Slouch", icon: "🧶" },
];

export const HAIR_COLORS = [
  { color: "#231B15", label: "Midnight Black" },
  { color: "#4A3525", label: "Dark Espresso" },
  { color: "#7B4A2C", label: "Chestnut Brown" },
  { color: "#A85324", label: "Warm Auburn" },
  { color: "#DE9B52", label: "Golden Honey" },
  { color: "#FCD34D", label: "Platinum Blonde" },
  { color: "#F43F5E", label: "Rose Magenta" },
  { color: "#8B5CF6", label: "Electric Violet" },
  { color: "#06B6D4", label: "Cyber Teal" },
  { color: "#10B981", label: "Mint Emerald" },
  { color: "#E2E8F0", label: "Silver Mist" },
];

export const CLOTHING_CATEGORIES: OptionItem[] = [
  { id: "tops", label: "Tops & Tees", icon: "👕" },
  { id: "hoodies", label: "Hoodies", icon: "🧥" },
  { id: "jackets", label: "Jackets & Blazers", icon: "👔" },
  { id: "dresses", label: "Dresses & Knitwear", icon: "👗" },
];

export const CLOTHING_STYLES: (OptionItem & { category: string })[] = [
  // Tops
  { id: "crewneck", label: "Casual Crewneck", category: "tops", icon: "👕", description: "Clean everyday cotton tee" },
  { id: "polo", label: "Creator Polo", category: "tops", icon: "👔", description: "Smart casual collared shirt" },
  { id: "tank", label: "Minimalist Tank", category: "tops", icon: "🎽", description: "Athletic airy summer cut" },
  
  // Hoodies
  { id: "hoodie", label: "Oversized Hoodie", category: "hoodies", icon: "🧥", description: "Cozy creator hoodie with drawstrings" },
  { id: "zip-hoodie", label: "Zip Tech Hoodie", category: "hoodies", icon: "⚡", description: "Streamlined dual-tone zip hoodie" },
  
  // Jackets
  { id: "blazer", label: "Executive Blazer", category: "jackets", icon: "💼", description: "Sharp tailored blazer over relaxed tee" },
  { id: "denim", label: "Denim Jacket", category: "jackets", icon: "👖", description: "Classic washed denim with collar" },
  { id: "bomber", label: "Flight Bomber", category: "jackets", icon: "✈️", description: "Urban flight jacket with ribbed trim" },
  { id: "biker", label: "Leather Biker", category: "jackets", icon: "🏍️", description: "Bold asymmetrical moto leather" },
  
  // Dresses / Knit
  { id: "sweater", label: "Cozy Knit Sweater", category: "dresses", icon: "🧶", description: "Chunky textured cable knit" },
  { id: "dress", label: "Chic Minimal Dress", category: "dresses", icon: "👗", description: "Elegant modern silhouette" },
  { id: "cardigan", label: "Slouchy Cardigan", category: "dresses", icon: "🥼", description: "Relaxed button-up creator knit" },
];

export const CLOTHING_COLORS = [
  { color: "#8B5CF6", label: "Threads Purple" },
  { color: "#3B82F6", label: "Royal Blue" },
  { color: "#06B6D4", label: "Cyber Cyan" },
  { color: "#10B981", label: "Emerald Green" },
  { color: "#F59E0B", label: "Warm Amber" },
  { color: "#EC4899", label: "Hot Pink" },
  { color: "#EF4444", label: "Crimson Red" },
  { color: "#1E293B", label: "Midnight Slate" },
  { color: "#F8FAFC", label: "Clean White" },
  { color: "#78350F", label: "Earth Terracotta" },
];

export const HATS: OptionItem[] = [
  { id: "none", label: "No Hat", icon: "🚫" },
  { id: "beanie", label: "Cozy Beanie", icon: "🧶", description: "Slouchy knit beanie with cuff" },
  { id: "snapback", label: "Snapback Cap", icon: "🧢", description: "Streetwear flat-brim cap" },
  { id: "beret", label: "Creator Beret", icon: "🎨", description: "Chic Parisian artist beret" },
  { id: "bucket", label: "Bucket Hat", icon: "🪣", description: "Trendy 90s aesthetic bucket hat" },
  { id: "headband", label: "Sport Headband", icon: "🎀", description: "Athletic sweatband / halo" },
];

export const BOTTOMS: OptionItem[] = [
  { id: "jeans", label: "Classic Denim", icon: "👖", description: "Everyday relaxed denim" },
  { id: "chinos", label: "Tailored Chinos", icon: "🩳", description: "Smart casual clean trousers" },
  { id: "skirt", label: "Pleated Skirt", icon: "👗", description: "Stylish flowing pleats" },
  { id: "shorts", label: "Creator Shorts", icon: "🩳", description: "Comfortable warm-weather cut" },
  { id: "joggers", label: "Tech Joggers", icon: "🏃", description: "Cuffed athletic joggers" },
];

export const BOTTOMS_COLORS = [
  { color: "#2563EB", label: "Indigo Denim" },
  { color: "#1E293B", label: "Midnight Slate" },
  { color: "#D97706", label: "Warm Khaki" },
  { color: "#475569", label: "Charcoal Gray" },
  { color: "#F8FAFC", label: "Clean White" },
  { color: "#8B5CF6", label: "Violet Purple" },
  { color: "#10B981", label: "Forest Olive" },
];

export const SHOES: OptionItem[] = [
  { id: "sneakers", label: "Chunky Sneakers", icon: "👟", description: "Modern platform creator kicks" },
  { id: "high-tops", label: "High-Top Retro", icon: "👟", description: "Streetwear ankle high-tops" },
  { id: "boots", label: "Leather Boots", icon: "🥾", description: "Rugged urban boots" },
  { id: "loafers", label: "Sleek Loafers", icon: "👞", description: "Sharp tailored dress loafers" },
  { id: "slides", label: "Cloud Slides", icon: "🩴", description: "Ultra-chill comfort slip-ons" },
];

export const SHOES_COLORS = [
  { color: "#FFFFFF", label: "Crisp White" },
  { color: "#1E293B", label: "Onyx Black" },
  { color: "#8B5CF6", label: "Threads Purple" },
  { color: "#EF4444", label: "Crimson Red" },
  { color: "#F59E0B", label: "Amber Gold" },
  { color: "#06B6D4", label: "Cyber Teal" },
];

export const ACCESSORY_GROUPS = [
  {
    name: "Eyewear",
    items: [
      { id: "glasses", label: "Round Wireframes", icon: "👓", description: "Minimalist circular metal frames" },
      { id: "wayfarer", label: "Classic Wayfarer", icon: "🕶️", description: "Bold dark acetate frames" },
      { id: "sunglasses", label: "Retro Shades", icon: "😎", description: "Tinted cool-creator sunglasses" },
      { id: "geek-chic", label: "Square Thick Frames", icon: "🤓", description: "High-contrast intellectual frames" },
    ],
  },
  {
    name: "Audio & Tech",
    items: [
      { id: "headphones", label: "Studio Headphones", icon: "🎧", description: "Over-ear podcast / audio pro cans" },
      { id: "neon-headphones", label: "Cyber Glow Cans", icon: "🎧", description: "Glowing neon wireless headphones" },
      { id: "earbuds", label: "Wireless Pods", icon: "⚪", description: "Sleek wireless in-ear pods" },
    ],
  },
  {
    name: "Jewelry & Wrist",
    items: [
      { id: "gold-chain", label: "Gold Curb Chain", icon: "⛓️", description: "Polished statement gold necklace" },
      { id: "pearls", label: "Pearl Strand", icon: "📿", description: "Elegant classic pearls" },
      { id: "earrings", label: "Silver Hoops", icon: "💍", description: "Subtle silver hoop earrings" },
      { id: "watch", label: "Smart Watch", icon: "⌚", description: "Sleek digital fitness & time tracker" },
    ],
  },
  {
    name: "Bags & Carry",
    items: [
      { id: "backpack", label: "Creator Backpack", icon: "🎒", description: "Minimalist waterproof commuter pack" },
      { id: "crossbody", label: "Crossbody Pouch", icon: "👜", description: "Urban utility chest strap bag" },
      { id: "tote", label: "Canvas Tote", icon: "🛍️", description: "Eco creator canvas bag" },
    ],
  },
  {
    name: "Creator Props",
    items: [
      { id: "coffee", label: "Artisan Coffee", icon: "☕", description: "Steaming ceramic espresso mug" },
      { id: "sparkles", label: "Aura Sparkles", icon: "✨", description: "Glinting magical aura particles" },
      { id: "mic", label: "Broadcast Mic", icon: "🎙️", description: "Studio condenser podcast mic" },
      { id: "laptop", label: "Laptop Badge", icon: "💻", description: "Sleek open workstation icon" },
      { id: "crown", label: "Creator Crown", icon: "👑", description: "Royal gold crown of authority" },
      { id: "rocket", label: "Growth Rocket", icon: "🚀", description: "Momentum rocket icon" },
    ],
  },
];

export const EXPRESSIONS: OptionItem[] = [
  { id: "happy", label: "Happy", icon: "😊", description: "Warm, welcoming, friendly smile with blushing cheeks" },
  { id: "confident", label: "Confident", icon: "😎", description: "Cool poise, subtle smirk, high authority" },
  { id: "thinking", label: "Thinking", icon: "🤔", description: "Contemplative, hand-on-chin deep strategist" },
  { id: "surprised", label: "Surprised", icon: "😮", description: "Wide-eyed revelation and unexpected insight" },
  { id: "excited", label: "Excited", icon: "🤩", description: "Sparkling eyes, broad smile, infectious momentum" },
  { id: "laughing", label: "Laughing", icon: "😆", description: "Joyful closed-eye laughter, pure delight" },
  { id: "celebrating", label: "Celebrating", icon: "🥳", description: "Confetti burst, party hat vibe, victorious win" },
  { id: "curious", label: "Curious", icon: "🧐", description: "Inquisitive one-eyebrow raise, probing mind" },
  { id: "zen", label: "Zen Calm", icon: "🧘", description: "Centered, mindful, serene balance" },
  { id: "winking", label: "Winking", icon: "😉", description: "Playful, charming insider wink" },
];

export const BACKDROPS: OptionItem[] = [
  { id: "gradient-purple", label: "Twilight Violet", previewColor: "#8B5CF6", description: "Threads signature purple & cosmic indigo" },
  { id: "gradient-sunset", label: "Golden Sunset", previewColor: "#F59E0B", description: "Warm peach, amber and coral radiance" },
  { id: "gradient-cyber", label: "Cyber Pulse", previewColor: "#06B6D4", description: "Electric cyan, teal & midnight navy" },
  { id: "gradient-emerald", label: "Zen Emerald", previewColor: "#10B981", description: "Forest jade, mint and sage harmony" },
  { id: "solid-cream", label: "Warm Studio", previewColor: "#FEF3C7", description: "Refined minimalist studio background" },
  { id: "studio-dark", label: "Onyx Void", previewColor: "#0F172A", description: "Sleek high-contrast dark room" },
];

export const DEFAULT_AVATAR_CONFIG: CharacterAvatarConfig = {
  name: "Luna",
  baseCharacter: "human-creator",
  appearance: {
    skinTone: "#FDDFB8",
    faceShape: "oval",
    hairStyle: "swoop",
    hairColor: "#231B15",
    eyeStyle: "classic",
    eyebrows: "natural",
  },
  clothing: {
    category: "hoodies",
    style: "hoodie",
    color: "#8B5CF6",
    accentColor: "#C084FC",
    bottoms: "jeans",
    bottomsColor: "#2563EB",
    shoes: "sneakers",
    shoesColor: "#FFFFFF",
    hat: "none",
    hatColor: "#1E293B",
  },
  accessories: ["glasses", "sparkles"],
  expression: "happy",
  avatarStyle: "3d-character",
  backdrop: "gradient-purple",
};

/**
 * Returns a randomized, harmonious avatar combination while preserving custom name if passed
 */
export function generateRandomAvatar(existingName?: string): CharacterAvatarConfig {
  const randomFrom = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

  const base = randomFrom(BASE_CHARACTERS).id;
  const style = "3d-character";
  const skin = randomFrom(SKIN_TONES).color;
  const face = randomFrom(FACE_SHAPES).id;
  const hairStyle = randomFrom(HAIR_STYLES).id;
  const hairColor = randomFrom(HAIR_COLORS).color;
  const eyeStyle = randomFrom(EYE_STYLES).id;
  const eyebrows = randomFrom(EYEBROW_STYLES).id;
  const clothingStyle = randomFrom(CLOTHING_STYLES).id;
  const clothingColor = randomFrom(CLOTHING_COLORS).color;
  const bottoms = randomFrom(BOTTOMS).id;
  const bottomsColor = randomFrom(BOTTOMS_COLORS).color;
  const shoes = randomFrom(SHOES).id;
  const shoesColor = randomFrom(SHOES_COLORS).color;
  const hat = randomFrom(HATS).id;
  const expression = randomFrom(EXPRESSIONS).id;
  const backdrop = randomFrom(BACKDROPS).id;

  // Pick 1-2 random accessories
  const allAccessoryIds = ACCESSORY_GROUPS.flatMap((g) => g.items.map((i) => i.id));
  const numAcc = Math.floor(Math.random() * 3);
  const pickedAccessories: string[] = [];
  for (let i = 0; i < numAcc; i++) {
    const acc = randomFrom(allAccessoryIds);
    if (!pickedAccessories.includes(acc)) {
      pickedAccessories.push(acc);
    }
  }

  return {
    name: existingName && existingName.trim() ? existingName.trim() : "Luna",
    baseCharacter: base,
    appearance: {
      skinTone: skin,
      faceShape: face,
      hairStyle,
      hairColor,
      eyeStyle,
      eyebrows,
    },
    clothing: {
      category: "hoodies",
      style: clothingStyle,
      color: clothingColor,
      accentColor: "#FFFFFF",
      bottoms,
      bottomsColor,
      shoes,
      shoesColor,
      hat,
      hatColor: "#1E293B",
    },
    accessories: pickedAccessories,
    expression,
    avatarStyle: style,
    backdrop,
  };
}
