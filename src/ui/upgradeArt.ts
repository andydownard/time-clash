// The Build Base (old shop) pictures, drawn as inline SVG. Adapted from the design handoff (boards 8 and 8b):
// a broken castle tower being rebuilt for Team Past, a silo bunker cut open like a hologram for
// Team Future, and a small picture for each upgrade. No files are fetched. Every picture is
// decorative, so it is aria-hidden (each upgrade row is named in words). Colors come from the
// palette in tokens.css plus the scene-only list below, which tests/ui/upgradeArt.test.ts checks.
import type { Team } from '../game/types';
import type { UpgradeId } from '../game/upgrades';
import { svgFromString } from './svg';

/** Scene-only colors that are not in the palette (stone, soil, steel, glow). */
export const UPGRADE_EXTRA_COLORS: readonly string[] = [
  '#05061a',
  '#2b2548',
  '#2b6a4c',
  '#2f2a8c',
  '#3b3560',
  '#4fa070',
  '#5f5880',
  '#8a4fc0',
  '#8c84a8',
  '#cfc6e8',
  '#f0a0b8',
  '#ff5fb0',
  '#ffc88c',
  '#ffd27a',
];

const PAST_SCENE = `<svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">
<defs>
<linearGradient id="tcUpPUSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2f2a8c"/><stop offset=".55" stop-color="#8a4fc0"/><stop offset=".85" stop-color="#f0a0b8"/><stop offset="1" stop-color="#ffc88c"/></linearGradient>
<pattern id="tcUpPUStone" width="40" height="24" patternUnits="userSpaceOnUse"><rect width="40" height="24" fill="#8c84a8"/><path d="M0,0 H40 M0,12 H40 M20,0 V12 M0,12 V24 M40,12 V24" stroke="#5f5880" stroke-width="2" fill="none"/></pattern>
<linearGradient id="tcUpPUGrass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4fa070"/><stop offset="1" stop-color="#2b6a4c"/></linearGradient>
</defs>
<rect width="1600" height="900" fill="url(#tcUpPUSky)"/>
<path d="M0,700 C200,660 420,720 700,690 L700,900 L0,900 Z" fill="url(#tcUpPUGrass)"/>
<rect x="700" y="0" width="900" height="900" fill="#12102b" opacity=".55"/>
<g transform="translate(370 800) scale(1.6)">
<ellipse cx="0" cy="10" rx="215" ry="18" fill="#05061a" opacity=".4"/>
<rect x="-150" y="-120" width="300" height="120" fill="url(#tcUpPUStone)" stroke="#3b3560" stroke-width="4"/>
<path d="M-150,-120 V-138 H-128 V-120 M-110,-120 V-138 H-88 V-120 M-70,-120 V-138 H-48 V-120 M88,-120 V-138 H110 V-120" fill="url(#tcUpPUStone)" stroke="#3b3560" stroke-width="3"/>
<rect x="-55" y="-210" width="110" height="210" fill="url(#tcUpPUStone)" stroke="#3b3560" stroke-width="4"/>
<path d="M-55,-210 V-228 H-34 V-210 M-14,-210 V-228 H7 V-210" fill="url(#tcUpPUStone)" stroke="#3b3560" stroke-width="3"/>
<rect x="-195" y="-180" width="64" height="180" rx="5" fill="url(#tcUpPUStone)" stroke="#3b3560" stroke-width="4"/>
<path d="M-203,-178 L-163,-262 L-123,-178 Q-163,-166 -203,-178 Z" fill="#5a28b8" stroke="#25104f" stroke-width="4" stroke-linejoin="round"/>
<path d="M131,0 V-96 L146,-110 L158,-92 L172,-112 L195,-96 V0 Z" fill="url(#tcUpPUStone)" stroke="#3b3560" stroke-width="4" stroke-linejoin="round"/>
<g class="tc-upgrade-hole"><rect x="135" y="-124" width="56" height="30" fill="none" stroke="#ffb23e" stroke-width="3" stroke-dasharray="7 6"/></g>
<path d="M-34,0 V-50 Q0,-92 34,-50 V0 Z" fill="#2b2548" stroke="#3b3560" stroke-width="5"/>
<path d="M-12,-130 V-160 Q0,-178 12,-160 V-130 Z" fill="#ffd27a" stroke="#3b3560" stroke-width="3"/>
<path d="M60,-190 L82,-170 L70,-150 L86,-130" fill="none" stroke="#3b3560" stroke-width="3"/>
<g transform="translate(163 -108)"><g class="tc-upgrade-drop"><line class="tc-upgrade-rope" x1="0" y1="-400" x2="0" y2="-14" stroke="#7a4a24" stroke-width="3"/><rect x="-24" y="-14" width="48" height="28" rx="3" fill="url(#tcUpPUStone)" stroke="#3b3560" stroke-width="4"/></g></g>
</g>
<g fill="#cfc6e8"><circle class="tc-upgrade-dust" cx="533" cy="690" r="26"/><circle class="tc-upgrade-dust" cx="590" cy="700" r="20" style="animation-delay:.1s"/></g>
</svg>`;

const FUTURE_SCENE = `<svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">
<defs>
<linearGradient id="tcUpFUBg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#12102b"/><stop offset="1" stop-color="#0a1a4f"/></linearGradient>
<pattern id="tcUpFUGrid" width="60" height="60" patternUnits="userSpaceOnUse"><path d="M60,0 H0 V60" fill="none" stroke="#2f6bff" stroke-opacity=".25" stroke-width="2"/></pattern>
<pattern id="tcUpFUEarth" width="14" height="14" patternUnits="userSpaceOnUse"><path d="M0,14 L14,0" stroke="#4fd8ff" stroke-opacity=".28" stroke-width="1.5"/></pattern>
<pattern id="tcUpFULines" width="6" height="6" patternUnits="userSpaceOnUse"><path d="M0,3 H6" stroke="#4fd8ff" stroke-opacity=".18" stroke-width="1.5"/></pattern>
<linearGradient id="tcUpFURoom" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2f6bff" stop-opacity=".35"/><stop offset="1" stop-color="#12102b" stop-opacity=".2"/></linearGradient>
</defs>
<rect width="1600" height="900" fill="url(#tcUpFUBg)"/>
<rect width="1600" height="900" fill="url(#tcUpFUGrid)"/>
<g class="tc-upgrade-holo">
<rect x="30" y="150" width="680" height="710" fill="url(#tcUpFUEarth)" stroke="#4fd8ff" stroke-width="2" stroke-dasharray="6 6" opacity=".9"/>
<path d="M10,150 H730" stroke="#4fd8ff" stroke-width="3"/>
<path d="M330,150 Q370,96 410,150 M370,96 V64 M356,72 H384" fill="none" stroke="#4fd8ff" stroke-width="3"/>
<path d="M340,150 L370,126 L400,150" fill="none" stroke="#4fd8ff" stroke-width="2" opacity=".7"/>
<text x="20" y="140" font-family="Orbitron, sans-serif" font-weight="700" font-size="12" letter-spacing="2" fill="#4fd8ff">GROUND LEVEL</text>
<g stroke="#4fd8ff" stroke-width="2.5" fill="url(#tcUpFURoom)" stroke-dasharray="14 6"><rect x="60" y="200" width="620" height="140" rx="6"/><rect x="60" y="370" width="620" height="140" rx="6"/><rect x="60" y="540" width="620" height="140" rx="6"/><rect x="60" y="710" width="620" height="140" rx="6"/></g>
<rect x="60" y="200" width="620" height="650" fill="url(#tcUpFULines)"/>
<rect x="330" y="150" width="80" height="700" fill="#0a1a4f" fill-opacity=".55" stroke="#4fd8ff" stroke-width="4"/>
<path d="M350,150 V850 M390,150 V850" stroke="#4fd8ff" stroke-width="1.5" stroke-dasharray="3 7" opacity=".8"/>
<g class="tc-upgrade-glow" fill="#4fd8ff"><rect x="360" y="176" width="20" height="26" rx="3"/></g>
<path d="M370,396 L358,412 V490 H382 V412 Z M358,490 L346,508 M382,490 L394,508" fill="#e1eaff" fill-opacity=".25" stroke="#4fd8ff" stroke-width="2.5" stroke-linejoin="round"/>
<g fill="none" stroke="#4fd8ff" stroke-width="1.5" opacity=".8"><path d="M44,200 H30 M44,370 H30 M44,540 H30 M44,710 H30 M44,850 H30 M37,150 V850"/><path d="M696,200 H710 M696,370 H710 M696,540 H710 M696,710 H710 M696,850 H710"/></g>
<g font-family="Orbitron, sans-serif" font-weight="700" font-size="11" fill="#4fd8ff" stroke="none"><text x="700" y="194" text-anchor="end">-10 M</text><text x="700" y="364" text-anchor="end">-20 M</text><text x="700" y="534" text-anchor="end">-30 M</text><text x="700" y="704" text-anchor="end">-40 M</text></g>
<g fill="none" stroke="#4fd8ff" stroke-width="2.5" opacity=".9"><rect x="200" y="250" width="60" height="40" rx="3"/><rect x="480" y="420" width="120" height="40" rx="3"/><circle cx="260" cy="610" r="26"/><path d="M500,590 h80 v40 h-80 Z"/></g>
<g class="tc-upgrade-glow" fill="#4fd8ff"><circle cx="120" cy="270" r="9"/><circle cx="120" cy="440" r="9"/><circle cx="120" cy="610" r="9"/><circle cx="120" cy="780" r="9" opacity=".3"/></g>
<text x="370" y="30" text-anchor="middle" font-family="Orbitron, sans-serif" font-weight="700" font-size="13" letter-spacing="2" fill="#4fd8ff" stroke="none">SILO BUNKER · SECTION A-A</text>
<rect class="tc-upgrade-scan" x="40" y="150" width="660" height="6" fill="#4fd8ff" opacity=".6"/>
</g>
</svg>`;

/** In the order of the upgrade lists. */
const ICONS: Record<UpgradeId, string> = {
  tower: `<svg viewBox="0 0 80 40"><rect x="26" y="10" width="28" height="28" fill="#9aa8bd" stroke="#12102b" stroke-width="3"/><path d="M22,10 L40,0 L58,10 Z" fill="#5a28b8" stroke="#12102b" stroke-width="3"/></svg>`,
  wall: `<svg viewBox="0 0 80 40"><rect x="6" y="14" width="68" height="24" fill="#9aa8bd" stroke="#12102b" stroke-width="3"/><path d="M6,14 V8 H18 V14 M30,14 V8 H42 V14 M54,14 V8 H66 V14" fill="#9aa8bd" stroke="#12102b" stroke-width="3"/></svg>`,
  gate: `<svg viewBox="0 0 80 40"><path d="M20,38 V18 Q40,-4 60,18 V38 Z" fill="#7a4a24" stroke="#12102b" stroke-width="3"/><path d="M40,6 V38 M28,22 H52" stroke="#12102b" stroke-width="2.5"/></svg>`,
  forceField: `<svg viewBox="0 0 80 40"><path d="M40,2 L68,12 V26 Q68,38 40,46 Q12,38 12,26 V12 Z" fill="#0a1a4f" stroke="#4fd8ff" stroke-width="3"/><path d="M26,24 H54" stroke="#4fd8ff" stroke-width="3"/></svg>`,
  missiles: `<svg viewBox="0 0 80 40"><path d="M40,2 V34 M28,14 L40,2 L52,14" fill="none" stroke="#4fd8ff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><rect x="24" y="34" width="32" height="8" rx="3" fill="#4fd8ff"/></svg>`,
  squad: `<svg viewBox="0 0 80 40"><rect x="8" y="16" width="44" height="10" rx="4" fill="#12102b" stroke="#ff5fb0" stroke-width="2.5"/><rect x="16" y="19" width="18" height="3" fill="#8247e8"/><rect x="50" y="18" width="14" height="6" fill="#ff5fb0"/></svg>`,
};

export function upgradeScene(doc: Document, team: Team): SVGElement {
  return svgFromString(doc, team === 'PAST' ? PAST_SCENE : FUTURE_SCENE, 'tc-forge-art');
}

export function upgradeIcon(doc: Document, id: UpgradeId): SVGElement {
  return svgFromString(doc, ICONS[id], 'tc-weapon-icon');
}
