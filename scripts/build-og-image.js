import fs from 'fs';
import path from 'path';
import { Resvg } from '@resvg/resvg-js';

const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
  <defs>
    <!-- Background Gradients -->
    <radialGradient id="bg-glow-right" cx="80%" cy="50%" r="60%">
      <stop offset="0%" stop-color="#7e22ce" stop-opacity="0.35" />
      <stop offset="50%" stop-color="#3b0764" stop-opacity="0.15" />
      <stop offset="100%" stop-color="#030206" stop-opacity="0" />
    </radialGradient>
    <radialGradient id="bg-glow-left" cx="20%" cy="30%" r="50%">
      <stop offset="0%" stop-color="#581c87" stop-opacity="0.25" />
      <stop offset="100%" stop-color="#030206" stop-opacity="0" />
    </radialGradient>

    <!-- Component Gradients -->
    <linearGradient id="purple-btn-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#a855f7" />
      <stop offset="100%" stop-color="#7c3aed" />
    </linearGradient>
    <linearGradient id="purple-text-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#c084fc" />
      <stop offset="100%" stop-color="#e879f9" />
    </linearGradient>
    <linearGradient id="card-border-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#6b21a8" />
      <stop offset="50%" stop-color="#3b0764" />
      <stop offset="100%" stop-color="#1e1b4b" />
    </linearGradient>

    <!-- Glow Filter -->
    <filter id="purple-glow-filter" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="12" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
    <filter id="green-glow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="8" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>

  <!-- Base Dark Canvas -->
  <rect width="1200" height="630" fill="#040308" />
  <rect width="1200" height="630" fill="url(#bg-glow-right)" />
  <rect width="1200" height="630" fill="url(#bg-glow-left)" />

  <!-- ================= LEFT COLUMN ================= -->
  
  <!-- Logo Header -->
  <g transform="translate(50, 48)">
    <rect width="40" height="40" rx="10" fill="url(#purple-btn-gradient)" />
    <!-- TW Icon in Logo -->
    <path d="M 11 26 L 16 14 L 21 26 L 25 14 L 29 26" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none" />
    <text x="52" y="28" font-family="system-ui, -apple-system, sans-serif" font-size="22" font-weight="900" letter-spacing="1" fill="#FFFFFF">THREADSWORKS</text>
  </g>

  <!-- Headline -->
  <g transform="translate(50, 140)">
    <text x="0" y="60" font-family="system-ui, -apple-system, sans-serif" font-size="62" font-weight="900" fill="#FFFFFF" letter-spacing="-1.5">STOP GUESSING</text>
    <text x="0" y="135" font-family="system-ui, -apple-system, sans-serif" font-size="62" font-weight="900" fill="#FFFFFF" letter-spacing="-1.5">WHAT TO POST.</text>
    
    <!-- Curved Purple Accent Line under POST. -->
    <path d="M 285 148 Q 370 156 455 146" stroke="#a855f7" stroke-width="5" stroke-linecap="round" fill="none" />
  </g>

  <!-- Subtitle -->
  <g transform="translate(50, 325)">
    <text font-family="system-ui, -apple-system, sans-serif" font-size="21" font-weight="700">
      <tspan fill="#c084fc">AI-powered</tspan>
      <tspan fill="#d4d4d8"> content creation for </tspan>
      <tspan fill="#c084fc">Threads.</tspan>
    </text>
  </g>

  <!-- Bottom Left Process Steps (4 icons) -->
  <g transform="translate(50, 400)">
    <!-- 1. CREATE -->
    <g transform="translate(0, 0)">
      <rect width="56" height="56" rx="14" fill="#0f0921" stroke="#581c87" stroke-width="1.5" />
      <path d="M 20 36 L 33 23 L 30 20 L 17 33 Z M 31 19 L 34 16 L 37 19 L 34 22 Z" fill="none" stroke="#c084fc" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      <text x="28" y="75" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="800" fill="#e4e4e7" text-anchor="middle" letter-spacing="0.5">CREATE</text>
    </g>

    <!-- Arrow 1 -->
    <path d="M 66 28 L 78 28 M 74 24 L 78 28 L 74 32" stroke="#6b21a8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none" />

    <!-- 2. SCHEDULE -->
    <g transform="translate(88, 0)">
      <rect width="56" height="56" rx="14" fill="#0f0921" stroke="#581c87" stroke-width="1.5" />
      <rect x="17" y="18" width="22" height="20" rx="3" fill="none" stroke="#c084fc" stroke-width="2" />
      <line x1="17" y1="24" x2="39" y2="24" stroke="#c084fc" stroke-width="1.5" />
      <circle cx="22" cy="29" r="1" fill="#c084fc" />
      <circle cx="28" cy="29" r="1" fill="#c084fc" />
      <circle cx="34" cy="29" r="1" fill="#c084fc" />
      <circle cx="22" cy="33" r="1" fill="#c084fc" />
      <circle cx="28" cy="33" r="1" fill="#c084fc" />
      <text x="28" y="75" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="800" fill="#e4e4e7" text-anchor="middle" letter-spacing="0.5">SCHEDULE</text>
    </g>

    <!-- Arrow 2 -->
    <path d="M 154 28 L 166 28 M 162 24 L 166 28 L 162 32" stroke="#6b21a8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none" />

    <!-- 3. PUBLISH -->
    <g transform="translate(176, 0)">
      <rect width="56" height="56" rx="14" fill="#0f0921" stroke="#581c87" stroke-width="1.5" />
      <path d="M 18 36 L 38 18 L 28 38 L 25 29 Z" fill="none" stroke="#c084fc" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      <text x="28" y="75" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="800" fill="#e4e4e7" text-anchor="middle" letter-spacing="0.5">PUBLISH</text>
    </g>

    <!-- Arrow 3 -->
    <path d="M 242 28 L 254 28 M 250 24 L 254 28 L 250 32" stroke="#6b21a8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none" />

    <!-- 4. AUTOMATE -->
    <g transform="translate(264, 0)">
      <rect width="56" height="56" rx="14" fill="#0f0921" stroke="#581c87" stroke-width="1.5" />
      <rect x="18" y="21" width="20" height="16" rx="4" fill="none" stroke="#c084fc" stroke-width="2" />
      <circle cx="23" cy="27" r="1.5" fill="#c084fc" />
      <circle cx="33" cy="27" r="1.5" fill="#c084fc" />
      <path d="M 24 33 Q 28 36 32 33" stroke="#c084fc" stroke-width="1.5" stroke-linecap="round" fill="none" />
      <line x1="28" y1="16" x2="28" y2="21" stroke="#c084fc" stroke-width="2" />
      <circle cx="28" cy="15" r="1.5" fill="#c084fc" />
      <text x="28" y="75" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="800" fill="#e4e4e7" text-anchor="middle" letter-spacing="0.5">AUTOMATE</text>
    </g>
  </g>

  <!-- Globe & Domain Footer -->
  <g transform="translate(50, 560)">
    <circle cx="10" cy="10" r="9" fill="none" stroke="#a855f7" stroke-width="1.5" />
    <ellipse cx="10" cy="10" rx="4" ry="9" fill="none" stroke="#a855f7" stroke-width="1.5" />
    <line x1="1" y1="10" x2="19" y2="10" stroke="#a855f7" stroke-width="1.5" />
    <text x="28" y="16" font-family="system-ui, -apple-system, sans-serif" font-size="17" font-weight="600" fill="#a1a1aa">threadsworks.com</text>
  </g>


  <!-- ================= RIGHT COLUMN (3D App Mockup Card) ================= -->
  
  <g transform="translate(480, 25)">
    <!-- Outer Card Glow & Border -->
    <rect width="670" height="580" rx="22" fill="#0a0714" stroke="url(#card-border-gradient)" stroke-width="2" filter="url(#purple-glow-filter)" opacity="0.6" />
    <rect width="670" height="580" rx="22" fill="#080511" stroke="#3b0764" stroke-width="1.5" />

    <!-- Card Header -->
    <g transform="translate(25, 22)">
      <!-- Left Logo -->
      <rect width="28" height="28" rx="7" fill="url(#purple-btn-gradient)" />
      <path d="M 8 18 L 11 10 L 14 18 L 17 10 L 20 18" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" fill="none" />
      <text x="36" y="20" font-family="system-ui, -apple-system, sans-serif" font-size="15" font-weight="900" letter-spacing="1" fill="#FFFFFF">THREADSWORKS</text>

      <!-- Right AI ENGINE Badge -->
      <g transform="translate(520, 2)">
        <rect width="100" height="24" rx="12" fill="#092016" stroke="#059669" stroke-width="1" />
        <circle cx="16" cy="12" r="3.5" fill="#10b981" />
        <text x="26" y="16" font-family="system-ui, -apple-system, sans-serif" font-size="10" font-weight="800" fill="#6ee7b7" letter-spacing="0.5">AI ENGINE</text>
      </g>
    </g>

    <!-- Top Banner Card inside UI -->
    <g transform="translate(25, 68)">
      <rect width="620" height="92" rx="16" fill="#120a27" stroke="#3b0764" stroke-width="1.5" />
      
      <!-- Purple Sparkle Icon Box -->
      <g transform="translate(18, 16)">
        <rect width="60" height="60" rx="16" fill="url(#purple-btn-gradient)" />
        <!-- Sparkle Star -->
        <path d="M 30 18 Q 30 30 18 30 Q 30 30 30 42 Q 30 30 42 30 Q 30 30 30 18 Z" fill="#FFFFFF" />
        <circle cx="40" cy="20" r="2" fill="#FFFFFF" />
      </g>

      <!-- Text "WHAT SHOULD I POST?" -->
      <text x="92" y="42" font-family="system-ui, -apple-system, sans-serif" font-size="19" font-weight="900" fill="#a1a1aa" letter-spacing="0.5">WHAT SHOULD</text>
      <text x="92" y="65" font-family="system-ui, -apple-system, sans-serif" font-size="19" font-weight="900" fill="#a1a1aa" letter-spacing="0.5">I POST?</text>

      <!-- Arrow -> -->
      <text x="250" y="58" font-family="system-ui, -apple-system, sans-serif" font-size="28" font-weight="900" fill="#c084fc">➔</text>

      <!-- Right Text "BETTER CONTENT DECISIONS." -->
      <text x="290" y="44" font-family="system-ui, -apple-system, sans-serif" font-size="26" font-weight="900" fill="url(#purple-text-gradient)" letter-spacing="-0.5">BETTER CONTENT</text>
      <text x="290" y="72" font-family="system-ui, -apple-system, sans-serif" font-size="26" font-weight="900" fill="#FFFFFF" letter-spacing="-0.5">DECISIONS.</text>
    </g>

    <!-- Pipeline Process Flow Container -->
    <g transform="translate(25, 180)">
      <rect width="620" height="125" rx="16" fill="#0d081f" stroke="#2e1065" stroke-width="1.5" />

      <!-- Connecting Illumination Line -->
      <line x1="60" y1="52" x2="560" y2="52" stroke="#6b21a8" stroke-width="2.5" />

      <!-- Step 1: IDEA -->
      <g transform="translate(60, 52)">
        <circle r="22" fill="#13092b" stroke="#581c87" stroke-width="1.5" />
        <!-- Atom orbits -->
        <ellipse rx="10" ry="4" fill="none" stroke="#a855f7" stroke-width="1.5" transform="rotate(30)" />
        <ellipse rx="10" ry="4" fill="none" stroke="#a855f7" stroke-width="1.5" transform="rotate(-30)" />
        <circle r="2.5" fill="#a855f7" />
        <text x="0" y="40" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="800" fill="#a1a1aa" text-anchor="middle">IDEA</text>
      </g>

      <!-- Arrow 1 -->
      <path d="M 115 52 L 135 52 M 130 48 L 135 52 L 130 56" stroke="#7e22ce" stroke-width="1.5" stroke-linecap="round" fill="none" />

      <!-- Step 2: CREATE -->
      <g transform="translate(185, 52)">
        <circle r="22" fill="#13092b" stroke="#581c87" stroke-width="1.5" />
        <path d="M -6 6 L 5 -5 L 2 -8 L -9 3 Z" fill="none" stroke="#c084fc" stroke-width="1.5" />
        <text x="0" y="40" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="800" fill="#a1a1aa" text-anchor="middle">CREATE</text>
      </g>

      <!-- Arrow 2 -->
      <path d="M 240 52 L 260 52 M 255 48 L 260 52 L 255 56" stroke="#7e22ce" stroke-width="1.5" stroke-linecap="round" fill="none" />

      <!-- Step 3: SCHEDULE -->
      <g transform="translate(310, 52)">
        <circle r="22" fill="#13092b" stroke="#581c87" stroke-width="1.5" />
        <rect x="-8" y="-7" width="16" height="14" rx="2" fill="none" stroke="#c084fc" stroke-width="1.5" />
        <line x1="-8" y1="-2" x2="8" y2="-2" stroke="#c084fc" stroke-width="1" />
        <text x="0" y="40" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="800" fill="#a1a1aa" text-anchor="middle">SCHEDULE</text>
      </g>

      <!-- Arrow 3 -->
      <path d="M 365 52 L 385 52 M 380 48 L 385 52 L 380 56" stroke="#7e22ce" stroke-width="1.5" stroke-linecap="round" fill="none" />

      <!-- Step 4: PUBLISH -->
      <g transform="translate(435, 52)">
        <circle r="22" fill="#13092b" stroke="#581c87" stroke-width="1.5" />
        <path d="M -7 7 L 8 -8 L -1 8 L -3 1 Z" fill="none" stroke="#c084fc" stroke-width="1.5" />
        <text x="0" y="40" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="800" fill="#a1a1aa" text-anchor="middle">PUBLISH</text>
      </g>

      <!-- Arrow 4 -->
      <path d="M 490 52 L 510 52 M 505 48 L 510 52 L 505 56" stroke="#7e22ce" stroke-width="1.5" stroke-linecap="round" fill="none" />

      <!-- Step 5: AUTOMATE (Active with glow + checkmark) -->
      <g transform="translate(560, 52)">
        <circle r="26" fill="url(#purple-btn-gradient)" filter="url(#purple-glow-filter)" opacity="0.8" />
        <circle r="26" fill="#1e1035" stroke="#a855f7" stroke-width="2" />
        
        <!-- Bot Head Icon -->
        <rect x="-10" y="-8" width="20" height="15" rx="3" fill="none" stroke="#FFFFFF" stroke-width="1.8" />
        <circle cx="-4" cy="-3" r="1.5" fill="#FFFFFF" />
        <circle cx="4" cy="-3" r="1.5" fill="#FFFFFF" />
        <path d="M -4 3 Q 0 6 4 3" stroke="#FFFFFF" stroke-width="1.5" fill="none" />
        <line x1="0" y1="-12" x2="0" y2="-8" stroke="#FFFFFF" stroke-width="1.8" />
        <circle cx="0" cy="-13" r="1.5" fill="#FFFFFF" />

        <!-- Green Checkmark Badge on Automate -->
        <g transform="translate(14, -14)" filter="url(#green-glow)">
          <circle r="10" fill="#10b981" />
          <path d="M -4 0 L -1 3 L 4 -3" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none" />
        </g>

        <text x="0" y="42" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="900" fill="#FFFFFF" text-anchor="middle">AUTOMATE</text>
        <text x="0" y="54" font-family="system-ui, -apple-system, sans-serif" font-size="9" font-weight="800" fill="#34d399" text-anchor="middle">ACTIVE</text>
      </g>
    </g>

    <!-- 4 Feature Cards Grid at Bottom -->
    <g transform="translate(25, 322)">
      <!-- Card 1 -->
      <g transform="translate(0, 0)">
        <rect width="142" height="232" rx="14" fill="#0d081f" stroke="#251242" stroke-width="1.5" />
        
        <!-- Icon -->
        <g transform="translate(18, 22)">
          <path d="M 12 2 Q 12 12 2 12 Q 12 12 12 22 Q 12 12 22 12 Q 12 12 12 2 Z" fill="none" stroke="#a855f7" stroke-width="1.8" />
          <circle cx="18" cy="4" r="1.5" fill="#a855f7" />
        </g>

        <text x="18" y="115" font-family="system-ui, -apple-system, sans-serif" font-size="12" font-weight="600" fill="#9ca3af" width="106">
          <tspan x="18" dy="0">AI finds the best</tspan>
          <tspan x="18" dy="18">content</tspan>
          <tspan x="18" dy="18">opportunities</tspan>
        </text>
      </g>

      <!-- Card 2 -->
      <g transform="translate(159, 0)">
        <rect width="142" height="232" rx="14" fill="#0d081f" stroke="#251242" stroke-width="1.5" />
        
        <g transform="translate(18, 22)">
          <path d="M 4 20 L 18 6 L 15 3 L 1 17 Z" fill="none" stroke="#a855f7" stroke-width="1.8" />
        </g>

        <text x="18" y="115" font-family="system-ui, -apple-system, sans-serif" font-size="12" font-weight="600" fill="#9ca3af">
          <tspan x="18" dy="0">Create high-quality</tspan>
          <tspan x="18" dy="18">Threads posts</tspan>
        </text>
      </g>

      <!-- Card 3 -->
      <g transform="translate(318, 0)">
        <rect width="142" height="232" rx="14" fill="#0d081f" stroke="#251242" stroke-width="1.5" />
        
        <g transform="translate(18, 22)">
          <rect x="0" y="2" width="20" height="18" rx="3" fill="none" stroke="#a855f7" stroke-width="1.8" />
          <line x1="0" y1="7" x2="20" y2="7" stroke="#a855f7" stroke-width="1.5" />
          <circle cx="5" cy="12" r="1" fill="#a855f7" />
          <circle cx="10" cy="12" r="1" fill="#a855f7" />
          <circle cx="15" cy="12" r="1" fill="#a855f7" />
        </g>

        <text x="18" y="115" font-family="system-ui, -apple-system, sans-serif" font-size="12" font-weight="600" fill="#9ca3af">
          <tspan x="18" dy="0">Schedule for the</tspan>
          <tspan x="18" dy="18">perfect time</tspan>
        </text>
      </g>

      <!-- Card 4 -->
      <g transform="translate(477, 0)">
        <rect width="142" height="232" rx="14" fill="#0d081f" stroke="#251242" stroke-width="1.5" />
        
        <g transform="translate(18, 22)">
          <path d="M 2 20 L 22 2 L 12 22 L 9 12 Z" fill="none" stroke="#a855f7" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
        </g>

        <text x="18" y="115" font-family="system-ui, -apple-system, sans-serif" font-size="12" font-weight="600" fill="#9ca3af">
          <tspan x="18" dy="0">Publish</tspan>
          <tspan x="18" dy="18">automatically</tspan>
          <tspan x="18" dy="18">and stay consistent</tspan>
        </text>
      </g>
    </g>

  </g>
</svg>`;

async function renderOgImage() {
  try {
    const resvg = new Resvg(svgContent, {
      fitTo: {
        mode: 'width',
        value: 1200,
      },
    });

    const pngData = resvg.render();
    const pngBuffer = pngData.asPng();

    const publicDir = path.join(process.cwd(), 'public');
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }

    const outputPath = path.join(publicDir, 'og-image.png');
    fs.writeFileSync(outputPath, pngBuffer);
    console.log(`Successfully generated OG image at: ${outputPath} (${pngBuffer.length} bytes)`);
  } catch (err) {
    console.warn("Notice: OG image generator skipped or failed (using fallback public/og-image.png):", err.message || err);
  }
}

renderOgImage().catch((err) => {
  console.warn("Notice: OG image script warning:", err.message || err);
});
