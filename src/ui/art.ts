// Original pictures for the screens, drawn as inline SVG. Adapted from the design handoff
// (Loading, Setup). No files are fetched. Every color is a palette color from
// docs/DESIGN_SYSTEM.md, plus a short list of scene-only colors (sky, grass, skin, flame)
// that tests/ui/art.test.ts keeps in check. All pictures are decorative: aria-hidden.
import { svgFromString } from './svg';

/** Scene-only colors that are not in the palette (sky, grass, skin tone, flames, wood). */
export const ART_EXTRA_COLORS: readonly string[] = [
  '#4aa8f0',
  '#a9e0ff',
  '#fff2c9',
  '#7fcf7a',
  '#5fb860',
  '#6f95ff',
  '#cfe0ff',
  '#e9eef7',
  '#5d6c8c',
  '#7d8aa6',
  '#cfd9ee',
  '#f5c9a0',
  '#e5a57a',
  '#ff8aa0',
  '#8fe4ff',
  '#ff7a1a',
  '#e8262a',
  '#ffd23e',
  '#ff5a1a',
  '#ff5fb0',
  '#c98f52',
  '#8a5a2b',
  '#6b4b2a',
  '#fff6c2',
  '#fff3b0',
  '#05061a',
  '#ffffff',
];

/** The loading scene: a knight on a wobbling hoverboard and a confused repair bot. */
const LOADING_SCENE = `<svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">
<defs>
<linearGradient id="tcLdBg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4aa8f0"/><stop offset=".55" stop-color="#a9e0ff"/><stop offset="1" stop-color="#fff2c9"/></linearGradient>
<linearGradient id="tcLdBoard" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6f95ff"/><stop offset="1" stop-color="#1a3fb5"/></linearGradient>
<linearGradient id="tcLdSteel" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e9eef7"/><stop offset=".5" stop-color="#9aa8bd"/><stop offset="1" stop-color="#5d6c8c"/></linearGradient>
<filter id="tcLdBlur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="8"/></filter>
<path id="tcLdStar" d="M0,-12 L3,-3 L12,0 L3,3 L0,12 L-3,3 L-12,0 L-3,-3 Z" fill="#ffffff" stroke="#ffb23e" stroke-width="1.5"/>
<path id="tcLdWind" d="M0,0 L34,0" stroke="#ffffff" stroke-width="4" stroke-linecap="round" opacity=".9"/>
</defs>
<rect width="1600" height="900" fill="url(#tcLdBg)"/>
<circle cx="1230" cy="140" r="110" fill="#fff3b0" opacity=".5" filter="url(#tcLdBlur)"/>
<circle cx="1230" cy="140" r="62" fill="#fff6c2"/>
<g fill="#ffffff" opacity=".95"><ellipse cx="420" cy="160" rx="90" ry="28"/><ellipse cx="380" cy="145" rx="50" ry="28"/><ellipse cx="450" cy="140" rx="55" ry="32"/><ellipse cx="900" cy="110" rx="110" ry="26"/><ellipse cx="860" cy="95" rx="55" ry="28"/><ellipse cx="930" cy="88" rx="60" ry="30"/><ellipse cx="260" cy="408" rx="90" ry="22"/><ellipse cx="230" cy="394" rx="44" ry="24"/><ellipse cx="290" cy="390" rx="48" ry="26"/></g>
<path d="M0,640 C250,560 520,600 800,570 C1100,540 1350,600 1600,560 L1600,900 L0,900 Z" fill="#7fcf7a"/>
<path d="M0,720 C300,660 600,720 900,690 C1200,660 1450,720 1600,690 L1600,900 L0,900 Z" fill="#5fb860"/>
<g><use href="#tcLdStar" x="260" y="120" class="tc-ld-twinkle"/><use href="#tcLdStar" x="1180" y="90" class="tc-ld-twinkle" style="animation-delay:-1.4s"/><use href="#tcLdStar" x="540" y="250" class="tc-ld-twinkle" style="animation-delay:-.8s"/></g>
<g transform="translate(0 50)">
<ellipse cx="800" cy="600" rx="270" ry="30" fill="#05061a" opacity=".25"/>
<g transform="translate(800 410)">
<g class="tc-ld-board">
<ellipse cx="-116" cy="84" rx="46" ry="62" fill="#ff7a1a" opacity=".5" filter="url(#tcLdBlur)"/><ellipse cx="116" cy="84" rx="46" ry="62" fill="#ff7a1a" opacity=".5" filter="url(#tcLdBlur)"/>
<g transform="translate(-116 0)"><g class="tc-ld-flame"><path d="M-20,40 Q-26,90 0,142 Q26,90 20,40 Z" fill="#e8262a"/><path d="M-14,40 Q-18,82 0,120 Q18,82 14,40 Z" fill="#ff7a1a"/><path d="M-8,40 Q-10,70 0,96 Q10,70 8,40 Z" fill="#ffd23e"/></g></g>
<g transform="translate(116 0)"><g class="tc-ld-flame" style="animation-delay:-.07s"><path d="M-20,40 Q-26,90 0,142 Q26,90 20,40 Z" fill="#e8262a"/><path d="M-14,40 Q-18,82 0,120 Q18,82 14,40 Z" fill="#ff7a1a"/><path d="M-8,40 Q-10,70 0,96 Q10,70 8,40 Z" fill="#ffd23e"/></g></g>
<rect x="-170" y="0" width="340" height="30" rx="15" fill="url(#tcLdBoard)" stroke="#0a1a4f" stroke-width="4"/>
<rect x="-150" y="5" width="300" height="7" rx="3.5" fill="#cfe0ff" opacity=".6"/>
<rect x="-150" y="22" width="300" height="4" rx="2" fill="#4fd8ff"/>
<rect x="-140" y="30" width="48" height="14" rx="5" fill="#12102b"/><rect x="92" y="30" width="48" height="14" rx="5" fill="#12102b"/>
<g class="tc-ld-knight">
<g class="tc-ld-leg-a"><path d="M-24,-92 L-62,-48 L-92,-6" fill="none" stroke="#25104f" stroke-width="30" stroke-linecap="round" stroke-linejoin="round"/><path d="M-24,-92 L-62,-48 L-92,-6" fill="none" stroke="#9aa8bd" stroke-width="22" stroke-linecap="round" stroke-linejoin="round"/><ellipse cx="-100" cy="-4" rx="24" ry="11" fill="#7a4a24" stroke="#25104f" stroke-width="3"/></g>
<g class="tc-ld-leg-b"><path d="M24,-92 L50,-44 L44,-6" fill="none" stroke="#25104f" stroke-width="30" stroke-linecap="round" stroke-linejoin="round"/><path d="M24,-92 L50,-44 L44,-6" fill="none" stroke="#9aa8bd" stroke-width="22" stroke-linecap="round" stroke-linejoin="round"/><ellipse cx="54" cy="-4" rx="24" ry="11" fill="#7a4a24" stroke="#25104f" stroke-width="3"/></g>
<g class="tc-ld-arm-l"><path d="M-44,-160 L-92,-182 L-86,-232" fill="none" stroke="#25104f" stroke-width="26" stroke-linecap="round" stroke-linejoin="round"/><path d="M-44,-160 L-92,-182 L-86,-232" fill="none" stroke="#9aa8bd" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/><g transform="translate(-86 -232) rotate(-8)"><rect x="-6" y="-104" width="12" height="90" rx="4" fill="#c98f52" stroke="#25104f" stroke-width="3"/><rect x="-22" y="-18" width="44" height="10" rx="4" fill="#6b4b2a" stroke="#25104f" stroke-width="3"/><rect x="-6" y="-8" width="12" height="22" rx="4" fill="#6b4b2a" stroke="#25104f" stroke-width="3"/></g><circle cx="-86" cy="-230" r="14" fill="#cfd9ee" stroke="#25104f" stroke-width="3"/></g>
<g class="tc-ld-arm-r"><path d="M44,-160 L92,-182 L86,-232" fill="none" stroke="#25104f" stroke-width="26" stroke-linecap="round" stroke-linejoin="round"/><path d="M44,-160 L92,-182 L86,-232" fill="none" stroke="#9aa8bd" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/><g transform="translate(86 -232) rotate(-30) scale(1.5 1.5)"><rect x="-3" y="-4" width="7" height="14" rx="2" fill="#12102b"/><rect x="-5" y="-12" width="34" height="10" rx="3" fill="#12102b" stroke="#ff5fb0" stroke-width="1.5"/><rect x="6" y="-10" width="16" height="3" rx="1.5" fill="#8247e8"/><rect x="22" y="-10" width="12" height="6" rx="2" fill="#ff5fb0"/></g><circle cx="86" cy="-230" r="14" fill="#cfd9ee" stroke="#25104f" stroke-width="3"/></g>
<path d="M-44,-170 L44,-170 L54,-84 Q0,-68 -54,-84 Z" fill="#5a28b8" stroke="#25104f" stroke-width="4" stroke-linejoin="round"/>
<rect x="-52" y="-100" width="104" height="12" fill="#7a4a24" stroke="#25104f" stroke-width="3"/>
<circle cx="0" cy="-124" r="14" fill="#ffb23e" stroke="#25104f" stroke-width="3"/>
<path d="M-46,-170 Q0,-194 46,-170 L40,-142 Q0,-130 -40,-142 Z" fill="url(#tcLdSteel)" stroke="#25104f" stroke-width="4" stroke-linejoin="round"/>
<g class="tc-ld-head">
<g class="tc-ld-plume"><path d="M0,-272 C-26,-336 44,-346 72,-318 C46,-318 26,-300 16,-272 Z" fill="#bc9cff" stroke="#25104f" stroke-width="4" stroke-linejoin="round"/></g>
<circle cx="0" cy="-220" r="58" fill="url(#tcLdSteel)" stroke="#25104f" stroke-width="4"/>
<ellipse cx="0" cy="-214" rx="40" ry="38" fill="#f5c9a0" stroke="#25104f" stroke-width="3"/>
<path d="M-56,-236 Q0,-300 56,-236 Q0,-262 -56,-236 Z" fill="#7d8aa6" stroke="#25104f" stroke-width="3" stroke-linejoin="round"/>
<ellipse cx="-17" cy="-222" rx="5.5" ry="7.5" fill="#25104f"/><ellipse cx="17" cy="-222" rx="5.5" ry="7.5" fill="#25104f"/>
<circle cx="-15.2" cy="-225" r="2.2" fill="#ffffff"/><circle cx="18.8" cy="-225" r="2.2" fill="#ffffff"/>
<path d="M-27,-238 Q-17,-244 -7,-239 M7,-239 Q17,-244 27,-238" stroke="#25104f" stroke-width="4" stroke-linecap="round" fill="none"/>
<circle cx="0" cy="-208" r="7" fill="#e5a57a"/>
<path d="M-13,-192 Q0,-181 13,-192" fill="none" stroke="#25104f" stroke-width="4" stroke-linecap="round"/>
<circle cx="-30" cy="-200" r="7" fill="#ff8aa0" opacity=".6"/><circle cx="30" cy="-200" r="7" fill="#ff8aa0" opacity=".6"/>
<path class="tc-ld-sweat" d="M-70,-250 q-6,12 0,16 q6,-4 0,-16 Z" fill="#8fe4ff" stroke="#25104f" stroke-width="2"/>
</g>
</g>
</g>
</g>
<g transform="translate(1030 290)">
<g class="tc-ld-bot">
<g class="tc-ld-flame"><path d="M-14,46 L14,46 L0,90 Z" fill="#ff5a1a"/><path d="M-8,46 L8,46 L0,72 Z" fill="#ffd23e"/></g>
<g class="tc-ld-head">
<path d="M0,-40 V-62" stroke="#cfd9ee" stroke-width="5"/>
<circle cx="0" cy="-66" r="9" fill="#ffb23e" stroke="#25104f" stroke-width="3"/>
<circle cx="0" cy="0" r="44" fill="url(#tcLdSteel)" stroke="#25104f" stroke-width="4"/>
<ellipse cx="0" cy="-2" rx="32" ry="26" fill="#12102b" stroke="#25104f" stroke-width="3"/>
<circle cx="0" cy="-2" r="15" fill="#4fd8ff"/><circle cx="0" cy="-2" r="7" fill="#12102b"/><circle cx="-4" cy="-6" r="3" fill="#ffffff"/>
<path d="M-24,-24 L-6,-20" stroke="#4fd8ff" stroke-width="4" stroke-linecap="round"/>
<rect x="-58" y="-6" width="14" height="22" rx="7" fill="#9aa8bd" stroke="#25104f" stroke-width="3"/><rect x="44" y="-6" width="14" height="22" rx="7" fill="#9aa8bd" stroke="#25104f" stroke-width="3"/>
</g>
<text x="52" y="-72" font-family="Orbitron, sans-serif" font-weight="900" font-size="46" fill="#ffb23e" stroke="#12102b" stroke-width="2" paint-order="stroke">?</text>
</g>
</g>
<g><use href="#tcLdWind" x="470" y="300"/><use href="#tcLdWind" x="440" y="340"/><use href="#tcLdWind" x="1120" y="480"/></g>
</g>
</svg>`;

export function loadingScene(doc: Document): SVGElement {
  return svgFromString(doc, LOADING_SCENE, 'tc-loading-art');
}

/** The wavy timeline that fills as loading moves along. pathLength is 100, so a dash is a percent. */
const TIMELINE_PATH = 'M40,120 C190,20 290,220 460,120 S730,20 860,120 S1130,220 1260,120';
const TIMELINE = `<svg viewBox="0 0 1300 240" preserveAspectRatio="xMidYMid meet">
<defs>
<linearGradient id="tcLdBar" gradientUnits="userSpaceOnUse" x1="40" y1="0" x2="1260" y2="0"><stop offset="0" stop-color="#4fd8ff"/><stop offset=".45" stop-color="#2f6bff"/><stop offset="1" stop-color="#bc9cff"/></linearGradient>
</defs>
<g fill="none" stroke-linecap="round">
<path d="${TIMELINE_PATH}" pathLength="100" stroke="#05061a" stroke-opacity=".6" stroke-width="44" transform="translate(0 8)"/>
<path d="${TIMELINE_PATH}" pathLength="100" stroke="#f7ebcb" stroke-width="40"/>
<path d="${TIMELINE_PATH}" pathLength="100" stroke="#0a1a4f" stroke-width="30"/>
<path class="tc-bar-fill" d="${TIMELINE_PATH}" pathLength="100" stroke="url(#tcLdBar)" stroke-width="22" stroke-dasharray="0 100"/>
</g>
<circle cx="40" cy="120" r="22" fill="#4fd8ff" stroke="#f7ebcb" stroke-width="5"/>
<circle cx="1260" cy="120" r="22" fill="#25104f" stroke="#f7ebcb" stroke-width="5"/>
<path d="M1260,108 V132 M1260,108 L1276,114 L1260,120" stroke="#f7ebcb" stroke-width="3" fill="none"/>
</svg>`;

export function loadingTimeline(doc: Document): SVGElement {
  return svgFromString(doc, TIMELINE, 'tc-timeline');
}

/** Castle on the left, pod on the right. Sits faintly behind the title and setup screens. */
const SKYLINE = `<svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice">
<g fill="#12102b" opacity=".45"><rect x="60" y="760" width="300" height="140"/><rect x="40" y="700" width="70" height="200"/><rect x="310" y="700" width="70" height="200"/><path d="M30,700 L75,630 L120,700 Z M300,700 L345,630 L390,700 Z"/><rect x="170" y="680" width="100" height="220"/></g>
<g fill="#12102b" opacity=".6"><path d="M1020,900 C1060,800 1160,760 1260,760 C1360,760 1460,800 1500,900 Z"/><path d="M1380,900 C1410,830 1480,800 1560,800 L1600,800 L1600,900 Z"/></g>
</svg>`;

export function skyline(doc: Document): SVGElement {
  return svgFromString(doc, SKYLINE, 'tc-skyline');
}

/** Chrono, the little time-keeper bot. */
const CHRONO = `<svg viewBox="-70 -90 140 150">
<path d="M0,-40 V-62" stroke="#cfd9ee" stroke-width="5"/>
<circle cx="0" cy="-66" r="9" fill="#ffb23e" stroke="#25104f" stroke-width="3"/>
<circle cx="0" cy="0" r="44" fill="#9aa8bd" stroke="#25104f" stroke-width="4"/>
<ellipse cx="0" cy="-2" rx="32" ry="26" fill="#12102b" stroke="#25104f" stroke-width="3"/>
<circle cx="0" cy="-2" r="15" fill="#4fd8ff"/><circle cx="0" cy="-2" r="7" fill="#12102b"/><circle cx="-4" cy="-6" r="3" fill="#ffffff"/>
<rect x="-58" y="-6" width="14" height="22" rx="7" fill="#9aa8bd" stroke="#25104f" stroke-width="3"/><rect x="44" y="-6" width="14" height="22" rx="7" fill="#9aa8bd" stroke="#25104f" stroke-width="3"/>
</svg>`;

export function chronoFace(doc: Document): SVGElement {
  return svgFromString(doc, CHRONO, 'tc-chrono-face');
}

/** One small picture per How to Play card, keyed by IntroCard.art. */
const INTRO_ART: Record<string, string> = {
  welcome: `<svg viewBox="0 0 240 140">
<circle cx="120" cy="70" r="56" fill="#f7ebcb" stroke="#12102b" stroke-width="6"/>
<path d="M120,30 V70 L146,86" fill="none" stroke="#12102b" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
<circle cx="120" cy="70" r="7" fill="#5a28b8"/>
<path d="M28,118 V84 H44 V94 H56 V84 H72 V118 Z" fill="#5a28b8" stroke="#12102b" stroke-width="4" stroke-linejoin="round"/>
<path d="M170,118 C176,96 196,88 206,88 C216,88 232,96 236,118 Z" fill="#1a3fb5" stroke="#12102b" stroke-width="4"/>
<path d="M22,26 l5,10 l10,5 l-10,5 l-5,10 l-5,-10 l-10,-5 l10,-5 Z" fill="#ffb23e"/>
</svg>`,
  aim: `<svg viewBox="0 0 240 140">
<path d="M30,112 Q110,-8 200,96" fill="none" stroke="#12102b" stroke-width="6" stroke-dasharray="4 14" stroke-linecap="round"/>
<circle cx="30" cy="112" r="14" fill="#5a28b8" stroke="#12102b" stroke-width="4"/>
<circle cx="204" cy="100" r="26" fill="#f7ebcb" stroke="#12102b" stroke-width="5"/>
<circle cx="204" cy="100" r="15" fill="#2f6bff" stroke="#12102b" stroke-width="4"/>
<circle cx="204" cy="100" r="5" fill="#ffb23e"/>
</svg>`,
  'two-shots': `<svg viewBox="0 0 240 140">
<path d="M20,100 Q60,30 112,64" fill="none" stroke="#12102b" stroke-width="5" stroke-dasharray="3 12" stroke-linecap="round"/>
<path d="M20,116 Q80,40 196,82" fill="none" stroke="#12102b" stroke-width="5" stroke-dasharray="3 12" stroke-linecap="round"/>
<circle cx="120" cy="66" r="20" fill="#ffb23e" stroke="#12102b" stroke-width="5"/>
<circle cx="206" cy="84" r="20" fill="#4fd8ff" stroke="#12102b" stroke-width="5"/>
<text x="120" y="75" text-anchor="middle" font-family="Orbitron, sans-serif" font-weight="900" font-size="24" fill="#12102b">1</text>
<text x="206" y="93" text-anchor="middle" font-family="Orbitron, sans-serif" font-weight="900" font-size="24" fill="#12102b">2</text>
</svg>`,
  reload: `<svg viewBox="0 0 240 140">
<rect x="40" y="20" width="160" height="100" rx="16" fill="#f7ebcb" stroke="#12102b" stroke-width="6"/>
<text x="120" y="96" text-anchor="middle" font-family="Orbitron, sans-serif" font-weight="900" font-size="72" fill="#5a28b8">?</text>
<path d="M60,120 L52,136 L84,122 Z" fill="#f7ebcb" stroke="#12102b" stroke-width="5" stroke-linejoin="round"/>
<path d="M206,24 l4,9 l9,4 l-9,4 l-4,9 l-4,-9 l-9,-4 l9,-4 Z" fill="#ffb23e"/>
</svg>`,
  wipeouts: `<svg viewBox="0 0 240 140">
<rect x="30" y="86" width="52" height="40" rx="6" fill="#8247e8" stroke="#12102b" stroke-width="5" transform="rotate(-8 56 106)"/>
<rect x="92" y="90" width="52" height="36" rx="6" fill="#2f6bff" stroke="#12102b" stroke-width="5" transform="rotate(6 118 108)"/>
<rect x="150" y="82" width="52" height="44" rx="6" fill="#ffb23e" stroke="#12102b" stroke-width="5" transform="rotate(-4 176 104)"/>
<rect x="68" y="40" width="48" height="40" rx="6" fill="#4fd8ff" stroke="#12102b" stroke-width="5" transform="rotate(14 92 60)"/>
<rect x="122" y="30" width="44" height="38" rx="6" fill="#bc9cff" stroke="#12102b" stroke-width="5" transform="rotate(-12 144 49)"/>
</svg>`,
};

export function introArt(doc: Document, id: string): SVGElement {
  return svgFromString(doc, INTRO_ART[id] ?? INTRO_ART.welcome!, 'tc-art-svg');
}
