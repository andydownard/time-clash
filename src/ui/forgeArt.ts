// The Forge pictures, drawn as inline SVG. Adapted from the design handoff (boards 7 and 7b):
// a blacksmith at a hot forge for Team Past, a robot arm in a lab for Team Future, and a small
// picture for each weapon. No files are fetched. Every picture is decorative, so it is aria-hidden
// (each weapon row is named in words). Colors come from the palette in tokens.css plus the
// scene-only list below, which tests/ui/forgeArt.test.ts keeps in check.
import type { Team } from '../game/types';
import type { WeaponId } from '../game/weapons';
import { svgFromString } from './svg';

/** Scene-only colors that are not in the palette (metal, fire, glass, skin). */
export const FORGE_EXTRA_COLORS: readonly string[] = [
  '#05061a',
  '#1d2744',
  '#241d44',
  '#2a1a22',
  '#2a2535',
  '#2a3a66',
  '#3a3550',
  '#3b3560',
  '#4a2a3a',
  '#5a3a2a',
  '#5b3418',
  '#5d6c8c',
  '#7a3a22',
  '#7f8ca8',
  '#8a4f2a',
  '#8a97b3',
  '#a8672b',
  '#bfeaff',
  '#cfd9ee',
  '#dfe7f5',
  '#f5c9a0',
  '#ff4f1a',
  '#ff5a1a',
  '#ff5fb0',
  '#ffd23e',
  '#ffd27a',
  '#ffd36b',
  '#fff6d0',
];

const PAST_SCENE = `<svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">
<defs>
<linearGradient id="tcForgePFWall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#25104f"/><stop offset=".7" stop-color="#4a2a3a"/><stop offset="1" stop-color="#7a3a22"/></linearGradient>
<radialGradient id="tcForgePFFire" cx=".5" cy=".6" r=".6"><stop offset="0" stop-color="#ffd27a"/><stop offset=".4" stop-color="#ff7a1a" stop-opacity=".8"/><stop offset="1" stop-color="#ff4f1a" stop-opacity="0"/></radialGradient>
<linearGradient id="tcForgePFBlade" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ff5a1a"/><stop offset=".6" stop-color="#ffb23e"/><stop offset="1" stop-color="#fff6d0"/></linearGradient>
<pattern id="tcForgePFBrick" width="80" height="40" patternUnits="userSpaceOnUse"><rect width="80" height="40" fill="#3b3560"/><path d="M0,0 H80 M0,20 H80 M40,0 V20 M0,20 V40 M80,20 V40" stroke="#241d44" stroke-width="3" fill="none"/></pattern>
</defs>
<rect width="1600" height="900" fill="url(#tcForgePFBrick)"/>
<rect width="1600" height="900" fill="url(#tcForgePFWall)" opacity=".7"/>
<rect y="806" width="1600" height="94" fill="#2a1a22" opacity=".8"/>
<circle cx="170" cy="660" r="300" fill="url(#tcForgePFFire)" class="tc-forge-glow"/>
<path d="M50,806 V610 Q50,470 170,470 Q290,470 290,610 V806 Z" fill="#12102b" stroke="#5d6c8c" stroke-width="10"/>
<path d="M90,806 V630 Q90,520 170,520 Q250,520 250,630 V806 Z" fill="#ff7a1a" class="tc-forge-glow"/>
<path d="M120,806 V650 Q120,570 170,570 Q220,570 220,650 V806 Z" fill="#ffd27a" class="tc-forge-glow"/>
<g fill="#ffb23e"><circle class="tc-forge-spark" cx="150" cy="600" r="4" style="--dx:-30px"/><circle class="tc-forge-spark" cx="190" cy="620" r="3" style="--dx:40px;animation-delay:.8s"/></g>
<!-- anvil -->
<g transform="translate(540 800)">
<ellipse cx="0" cy="8" rx="110" ry="14" fill="#05061a" opacity=".45"/>
<path d="M-62,0 H62 L46,-30 H-46 Z" fill="#3a3550" stroke="#12102b" stroke-width="4"/>
<rect x="-34" y="-72" width="68" height="44" fill="#5d6c8c" stroke="#12102b" stroke-width="4"/>
<path d="M-82,-110 L-130,-104 Q-112,-86 -82,-84 Z" fill="#7f8ca8" stroke="#12102b" stroke-width="5" stroke-linejoin="round"/>
<rect x="-82" y="-110" width="160" height="26" rx="4" fill="#7f8ca8" stroke="#12102b" stroke-width="5"/>
<rect x="-78" y="-108" width="152" height="5" fill="#cfd9ee" opacity=".55"/>
</g>
<!-- flat sword on the anvil -->
<g>
<rect x="436" y="679" width="30" height="10" rx="4" fill="#7a4a24" stroke="#12102b" stroke-width="2"/>
<circle cx="432" cy="684" r="7" fill="#ffb23e" stroke="#12102b" stroke-width="2"/>
<rect x="464" y="668" width="12" height="32" rx="3" fill="#5a28b8" stroke="#12102b" stroke-width="2.5"/>
<path d="M476,675 H592 L640,684 L592,693 H476 Z" fill="url(#tcForgePFBlade)" stroke="#12102b" stroke-width="2.5" stroke-linejoin="round"/>
<path d="M480,684 H620" stroke="#12102b" stroke-width="1.5" opacity=".5"/>
<path class="tc-forge-hot" d="M476,675 H592 L640,684 L592,693 H476 Z" fill="#fff6d0" opacity=".5"/>
</g>
<!-- blacksmith -->
<g>
<ellipse cx="362" cy="806" rx="70" ry="12" fill="#05061a" opacity=".45"/>
<rect x="334" y="730" width="22" height="70" fill="#5a3a2a" stroke="#12102b" stroke-width="3"/><rect x="368" y="730" width="22" height="70" fill="#5a3a2a" stroke="#12102b" stroke-width="3"/>
<rect x="328" y="788" width="32" height="16" rx="5" fill="#25104f" stroke="#12102b" stroke-width="3"/><rect x="366" y="788" width="32" height="16" rx="5" fill="#25104f" stroke="#12102b" stroke-width="3"/>
<rect x="326" y="640" width="72" height="100" rx="16" fill="#8a4f2a" stroke="#12102b" stroke-width="4"/>
<path d="M334,662 h56 v84 h-56 Z" fill="#5b3418" stroke="#12102b" stroke-width="3"/>
<path d="M346,662 L362,640 L378,662" fill="none" stroke="#12102b" stroke-width="3"/>
<path d="M346,668 L412,688 L444,688" fill="none" stroke="#12102b" stroke-width="24" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M346,668 L412,688 L444,688" fill="none" stroke="#8a4f2a" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/>
<circle cx="448" cy="686" r="10" fill="#f5c9a0" stroke="#12102b" stroke-width="3"/>
<circle cx="362" cy="614" r="28" fill="#f5c9a0" stroke="#12102b" stroke-width="4"/>
<path d="M334,608 Q362,566 390,608 Z" fill="#5a28b8" stroke="#12102b" stroke-width="3" stroke-linejoin="round"/>
<path d="M336,624 Q362,664 388,624 Q362,640 336,624 Z" fill="#7a4a24" stroke="#12102b" stroke-width="3" stroke-linejoin="round"/>
<ellipse cx="352" cy="613" rx="3.5" ry="5" fill="#12102b"/><ellipse cx="374" cy="613" rx="3.5" ry="5" fill="#12102b"/>
<path d="M348,603 Q353,599 358,602 M366,602 Q371,599 376,603" fill="none" stroke="#12102b" stroke-width="3" stroke-linecap="round"/>
<g transform="translate(388 664)"><g class="tc-forge-hammer">
<path d="M0,0 L60,0" stroke="#12102b" stroke-width="24" stroke-linecap="round"/><path d="M0,0 L60,0" stroke="#8a4f2a" stroke-width="16" stroke-linecap="round"/>
<rect x="56" y="-5" width="100" height="10" rx="5" fill="#a8672b" stroke="#12102b" stroke-width="2.5"/>
<circle cx="62" cy="0" r="10" fill="#f5c9a0" stroke="#12102b" stroke-width="3"/>
<rect x="150" y="-24" width="32" height="48" rx="5" fill="#5d6c8c" stroke="#12102b" stroke-width="4"/>
<rect x="154" y="-20" width="8" height="40" fill="#cfd9ee" opacity=".5"/>
</g></g>
</g>
<g fill="#ffd36b"><circle class="tc-forge-sp" cx="566" cy="676" r="4" style="--dx:-50px;--dy:-60px"/><circle class="tc-forge-sp" cx="566" cy="676" r="4" style="--dx:-30px;--dy:-85px"/><circle class="tc-forge-sp" cx="566" cy="676" r="4" style="--dx:0px;--dy:-95px"/><circle class="tc-forge-sp" cx="566" cy="676" r="4" style="--dx:30px;--dy:-85px"/><circle class="tc-forge-sp" cx="566" cy="676" r="4" style="--dx:55px;--dy:-55px"/><circle class="tc-forge-sp" cx="566" cy="676" r="4" style="--dx:70px;--dy:-20px"/><circle class="tc-forge-sp" cx="566" cy="676" r="4" style="--dx:-70px;--dy:-25px"/></g>
</svg>`;

const FUTURE_SCENE = `<svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">
<defs>
<linearGradient id="tcForgeFGBg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#12102b"/><stop offset="1" stop-color="#0a1a4f"/></linearGradient>
<pattern id="tcForgeFGGrid" width="60" height="60" patternUnits="userSpaceOnUse"><path d="M60,0 H0 V60" fill="none" stroke="#2f6bff" stroke-opacity=".25" stroke-width="2"/></pattern>
<linearGradient id="tcForgeFGBlade" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7f8ca8"/><stop offset=".5" stop-color="#dfe7f5"/><stop offset="1" stop-color="#ffffff"/></linearGradient>
<radialGradient id="tcForgeFGGlow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#4fd8ff" stop-opacity=".6"/><stop offset="1" stop-color="#4fd8ff" stop-opacity="0"/></radialGradient>
</defs>
<rect width="1600" height="900" fill="url(#tcForgeFGBg)"/>
<rect width="1600" height="900" fill="url(#tcForgeFGGrid)"/>
<rect y="806" width="1600" height="94" fill="#05061a" opacity=".6"/>
<ellipse cx="540" cy="740" rx="300" ry="160" fill="url(#tcForgeFGGlow)" class="tc-forge-glow"/>
<!-- forge bed -->
<g transform="translate(540 800)">
<ellipse cx="0" cy="8" rx="170" ry="14" fill="#05061a" opacity=".5"/>
<rect x="-150" y="-44" width="300" height="44" rx="10" fill="#1d2744" stroke="#4fd8ff" stroke-width="4"/>
<rect x="-130" y="-34" width="260" height="8" rx="4" fill="#4fd8ff" class="tc-forge-glow"/>
<path d="M-90,0 V-44 M-30,0 V-44 M30,0 V-44 M90,0 V-44" stroke="#2f6bff" stroke-width="3"/>
</g>
<!-- anvil on the forge table -->
<g transform="translate(540 756)">
<path d="M-58,0 H58 L44,-18 H-44 Z" fill="#1d2744" stroke="#4fd8ff" stroke-width="4" stroke-linejoin="round"/>
<rect x="-30" y="-46" width="60" height="30" fill="#2a3a66" stroke="#4fd8ff" stroke-width="4"/>
<path d="M90,-68 L134,-62 Q112,-46 90,-44 Z" fill="#5d6c8c" stroke="#4fd8ff" stroke-width="4" stroke-linejoin="round"/>
<rect x="-90" y="-68" width="180" height="24" rx="4" fill="#9aa8bd" stroke="#4fd8ff" stroke-width="4"/>
<rect x="-84" y="-66" width="168" height="5" fill="#e1eaff" opacity=".6"/>
</g>
<g transform="translate(0 -60)">
<!-- energy blade lying flat -->
<g>
<rect x="408" y="736" width="52" height="12" rx="4" fill="#12102b" stroke="#ff5fb0" stroke-width="2.5"/><rect x="420" y="738" width="22" height="3" fill="#8247e8"/>
<rect x="458" y="730" width="8" height="24" rx="2" fill="#12102b" stroke="#ff5fb0" stroke-width="2"/>
<path d="M466,735 H592 L640,742 L592,749 H466 Z" fill="url(#tcForgeFGBlade)" stroke="#4fd8ff" stroke-width="3" stroke-linejoin="round"/>
<path d="M470,742 H628" stroke="#8a97b3" stroke-width="2"/>
<rect class="tc-forge-hotf" x="520" y="736" width="60" height="12" fill="#4fd8ff" opacity=".55"/>
</g>
</g>
<!-- robot arm -->
<g>
<ellipse cx="300" cy="806" rx="90" ry="12" fill="#05061a" opacity=".5"/>
<rect x="250" y="760" width="100" height="46" rx="10" fill="#5d6c8c" stroke="#0a1a4f" stroke-width="4"/>
<circle cx="300" cy="752" r="26" fill="#9aa8bd" stroke="#0a1a4f" stroke-width="4"/>
<path d="M300,752 L350,640" stroke="#0a1a4f" stroke-width="30" stroke-linecap="round"/><path d="M300,752 L350,640" stroke="#9aa8bd" stroke-width="20" stroke-linecap="round"/>
<circle cx="350" cy="640" r="22" fill="#5d6c8c" stroke="#0a1a4f" stroke-width="4"/><circle cx="350" cy="640" r="8" fill="#4fd8ff"/>
<path d="M350,640 L500,600" stroke="#0a1a4f" stroke-width="28" stroke-linecap="round"/><path d="M350,640 L500,600" stroke="#9aa8bd" stroke-width="18" stroke-linecap="round"/>
<g transform="translate(540 -60)"><g class="tc-forge-press">
<rect x="-14" y="590" width="28" height="110" fill="#5d6c8c" stroke="#0a1a4f" stroke-width="4"/>
<rect x="-34" y="696" width="68" height="46" rx="6" fill="#9aa8bd" stroke="#0a1a4f" stroke-width="4"/>
<rect x="-26" y="730" width="52" height="8" rx="3" fill="#4fd8ff"/>
</g></g>
<circle cx="500" cy="600" r="18" fill="#5d6c8c" stroke="#0a1a4f" stroke-width="4"/><circle cx="500" cy="600" r="6" fill="#ff5fb0"/>
</g>
<g transform="translate(0 -60)"><g fill="#bfeaff"><circle class="tc-forge-spf" cx="540" cy="740" r="4" style="--dx:-50px;--dy:-60px"/><circle class="tc-forge-spf" cx="540" cy="740" r="4" style="--dx:-30px;--dy:-85px"/><circle class="tc-forge-spf" cx="540" cy="740" r="4" style="--dx:0px;--dy:-95px"/><circle class="tc-forge-spf" cx="540" cy="740" r="4" style="--dx:30px;--dy:-85px"/><circle class="tc-forge-spf" cx="540" cy="740" r="4" style="--dx:55px;--dy:-55px"/><circle class="tc-forge-spf" cx="540" cy="740" r="4" style="--dx:70px;--dy:-20px"/><circle class="tc-forge-spf" cx="540" cy="740" r="4" style="--dx:-70px;--dy:-25px"/></g></g>
<!-- operator with controller -->
<g transform="translate(820 806)"><ellipse cx="0" cy="2" rx="52" ry="9" fill="#05061a" opacity=".5"/>
<rect x="-26" y="-92" width="20" height="90" rx="9" fill="#1a3fb5" stroke="#0a1a4f" stroke-width="4"/><rect x="6" y="-92" width="20" height="90" rx="9" fill="#1a3fb5" stroke="#0a1a4f" stroke-width="4"/>
<rect x="-32" y="-12" width="30" height="14" rx="6" fill="#12102b" stroke="#4fd8ff" stroke-width="2"/><rect x="2" y="-12" width="30" height="14" rx="6" fill="#12102b" stroke="#4fd8ff" stroke-width="2"/>
<path d="M-34,-98 H34 L40,-170 Q0,-188 -40,-170 Z" fill="#2f6bff" stroke="#0a1a4f" stroke-width="4" stroke-linejoin="round"/><path d="M-30,-126 H30" stroke="#4fd8ff" stroke-width="4"/><rect x="-6" y="-166" width="12" height="38" rx="5" fill="#8247e8"/>
<circle cx="0" cy="-206" r="30" fill="#f5c9a0" stroke="#0a1a4f" stroke-width="4"/><path d="M-32,-212 Q0,-246 32,-212 L32,-204 H-32 Z" fill="#12102b" stroke="#0a1a4f" stroke-width="3"/>
<rect x="-34" y="-216" width="38" height="14" rx="7" fill="#4fd8ff" stroke="#0a1a4f" stroke-width="3"/><circle cx="-20" cy="-209" r="3" fill="#12102b"/><path d="M-22,-186 Q-12,-180 -4,-186" fill="none" stroke="#0a1a4f" stroke-width="3" stroke-linecap="round"/>
<path d="M-30,-160 L-60,-128 L-30,-112" fill="none" stroke="#0a1a4f" stroke-width="20" stroke-linecap="round" stroke-linejoin="round"/><path d="M-30,-160 L-60,-128 L-30,-112" fill="none" stroke="#2f6bff" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M30,-160 L60,-128 L28,-112" fill="none" stroke="#0a1a4f" stroke-width="20" stroke-linecap="round" stroke-linejoin="round"/><path d="M30,-160 L60,-128 L28,-112" fill="none" stroke="#2f6bff" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
<g transform="translate(0 -112)"><rect x="-44" y="-16" width="88" height="34" rx="14" fill="#12102b" stroke="#4fd8ff" stroke-width="3.5"/><circle cx="-26" cy="1" r="8" fill="#5d6c8c" stroke="#0a1a4f" stroke-width="2"/><circle cx="26" cy="1" r="8" fill="#5d6c8c" stroke="#0a1a4f" stroke-width="2"/><path d="M-8,-4 h6 M-5,-7 v6" stroke="#cfd9ee" stroke-width="2.5" stroke-linecap="round"/><circle class="tc-forge-btn" cx="10" cy="-4" r="4" fill="#ff5fb0"/><circle class="tc-forge-btn" cx="18" cy="2" r="4" fill="#4fd8ff" style="animation-delay:.4s"/><circle class="tc-forge-btn" cx="10" cy="8" r="4" fill="#ffd23e" style="animation-delay:.8s"/><circle cx="2" cy="-12" r="3" fill="#4fd8ff"/></g>
<g fill="none" stroke="#4fd8ff" stroke-width="3" stroke-linecap="round"><path class="tc-forge-sig" d="M-62,-134 Q-72,-148 -62,-162"/><path class="tc-forge-sig" d="M-76,-128 Q-92,-148 -76,-168" style="animation-delay:.25s"/><path class="tc-forge-sig" d="M-90,-122 Q-112,-148 -90,-174" style="animation-delay:.5s"/></g></g>

</svg>`;

/** In the order of the Forge's lists: starter, long range, far range. */
const ICONS: Record<WeaponId, string> = {
  royalSword: `<svg viewBox="0 0 80 40"><path d="M24,15 H58 L78,20 L58,25 H24 Z" fill="#fff6d0" stroke="#12102b" stroke-width="3" stroke-linejoin="round"/><path d="M28,20 H62" stroke="#12102b" stroke-width="1.5" opacity=".5"/><rect x="18" y="9" width="7" height="22" rx="2" fill="#5a28b8" stroke="#12102b" stroke-width="3"/><rect x="5" y="17" width="14" height="6" rx="2" fill="#7a4a24" stroke="#12102b" stroke-width="2.5"/></svg>`,
  elderLongbow: `<svg viewBox="0 0 80 40"><path d="M8,32 Q40,-12 72,32" fill="none" stroke="#7a4a24" stroke-width="6" stroke-linecap="round"/><path d="M8,32 L72,32" stroke="#5d6c8c" stroke-width="2"/><path d="M40,34 V6" stroke="#12102b" stroke-width="3"/></svg>`,
  ironCannon: `<svg viewBox="0 0 80 40"><rect x="6" y="14" width="46" height="14" rx="6" fill="#2a2535" stroke="#12102b" stroke-width="3"/><circle cx="20" cy="32" r="8" fill="#7a4a24" stroke="#12102b" stroke-width="3"/><circle cx="66" cy="16" r="6" fill="#25104f"/></svg>`,
  plasmaBlade: `<svg viewBox="0 0 80 40"><rect x="4" y="16" width="56" height="8" rx="3" fill="none" stroke="#4fd8ff" stroke-width="3"/><rect x="4" y="16" width="56" height="8" rx="3" fill="#4fd8ff"/><path d="M60,16 L76,20 L60,24 Z" fill="#fff"/><rect x="0" y="10" width="8" height="20" fill="#12102b" stroke="#ff5fb0" stroke-width="2"/></svg>`,
  laserRifle: `<svg viewBox="0 0 80 40"><rect x="6" y="14" width="46" height="12" rx="4" fill="#12102b" stroke="#ff5fb0" stroke-width="2.5"/><rect x="16" y="17" width="22" height="3" fill="#8247e8"/><rect x="50" y="16" width="14" height="8" fill="#ff5fb0"/><path d="M16,26 V36" stroke="#ff5fb0" stroke-width="5"/></svg>`,
  railCannon: `<svg viewBox="0 0 80 40"><rect x="4" y="12" width="60" height="16" rx="6" fill="#5d6c8c" stroke="#4fd8ff" stroke-width="3"/><circle cx="68" cy="20" r="6" fill="#4fd8ff"/><rect x="14" y="28" width="20" height="8" fill="#9aa8bd" stroke="#12102b" stroke-width="2"/></svg>`,
};

export function forgeScene(doc: Document, team: Team): SVGElement {
  return svgFromString(doc, team === 'PAST' ? PAST_SCENE : FUTURE_SCENE, 'tc-forge-art');
}

export function weaponIcon(doc: Document, id: WeaponId): SVGElement {
  return svgFromString(doc, ICONS[id], 'tc-weapon-icon');
}
