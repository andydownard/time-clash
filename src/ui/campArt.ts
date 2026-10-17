// The Camp hub picture, drawn as inline SVG. Adapted from the design handoff (board 1, Central
// Camp Hub): a sunset field, a castle and two pavilion camps on the left, a lab with domed pods
// on the right, a campfire in the middle, and a friendly skirmish that never hurts anyone.
// No files are fetched. The picture is decorative, so it is aria-hidden. Colors come from the
// palette in tokens.css plus the scene-only list below, which tests/ui/campArt.test.ts keeps in check.
import { svgFromString } from './svg';

/** Scene-only colors that are not in the palette (sky, grass, stone, flame, glass). */
export const CAMP_EXTRA_COLORS: readonly string[] = [
  '#05061a',
  '#0a0a1e',
  '#163a31',
  '#1a0f2a',
  '#1a1e2c',
  '#1d2744',
  '#1d4a3a',
  '#1f4a2c',
  '#2a1530',
  '#2a1608',
  '#2a2030',
  '#2a2535',
  '#2a2f44',
  '#2b0f06',
  '#2b2548',
  '#2b3550',
  '#2b7fc0',
  '#2c6fe0',
  '#2d5a55',
  '#2d6a3a',
  '#2f9fe8',
  '#34303f',
  '#3a5aa8',
  '#3b3560',
  '#3f7f58',
  '#44506d',
  '#44508e',
  '#46557a',
  '#46578a',
  '#4a2f14',
  '#4a3a2a',
  '#4aa8ff',
  '#4d5568',
  '#4f8668',
  '#5a2a54',
  '#5a3517',
  '#5a3a12',
  '#5b3418',
  '#5c4a38',
  '#5d6c8c',
  '#5fb4ff',
  '#6a5240',
  '#6b4120',
  '#6b4220',
  '#6b4b2a',
  '#6c66a8',
  '#6f7d96',
  '#756e9a',
  '#7a4c26',
  '#7a5a1e',
  '#7ab27c',
  '#7b7886',
  '#7d7886',
  '#7f86d0',
  '#7f8ca8',
  '#7fb56a',
  '#8795ab',
  '#8a5a2e',
  '#8a6a45',
  '#8a82c0',
  '#8b95ad',
  '#8fd088',
  '#8fd4ff',
  '#9aa3b8',
  '#9aa5bd',
  '#9af0ff',
  '#9bd486',
  '#9fb2d6',
  '#a39cc0',
  '#a98458',
  '#aab3c8',
  '#aab6cc',
  '#b07a45',
  '#b39c78',
  '#b9c4d8',
  '#bfeaff',
  '#c28a52',
  '#c9a24a',
  '#c9ad94',
  '#cfd9ee',
  '#cfe6ff',
  '#d5dde9',
  '#e3e9f2',
  '#e6d5a6',
  '#e6faff',
  '#e9c15a',
  '#e9eef7',
  '#eefcff',
  '#f0a6c0',
  '#f1f6ff',
  '#f2c566',
  '#f5c9a0',
  '#ff4f1a',
  '#ff5fb0',
  '#ff6a1a',
  '#ff7a1f',
  '#ff7a2e',
  '#ff7a7a',
  '#ff8a2a',
  '#ff9a3a',
  '#ff9bb0',
  '#ffa826',
  '#ffb347',
  '#ffb890',
  '#ffc88c',
  '#ffd23e',
  '#ffd27a',
  '#ffd36b',
  '#ffd9a0',
  '#ffe08a',
  '#ffe27a',
  '#ffe98a',
  '#ffe9a8',
  '#fff4c4',
  '#fff6d8',
];

const CAMP_SCENE = `<svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">
<defs>
<linearGradient id="tcCampSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a5aa8"/><stop offset=".3" stop-color="#7f86d0"/><stop offset=".58" stop-color="#f0a6c0"/><stop offset=".8" stop-color="#ffc88c"/><stop offset="1" stop-color="#ffe9a8"/></linearGradient>
<linearGradient id="tcCampGround" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7ab27c"/><stop offset=".5" stop-color="#4f8668"/><stop offset="1" stop-color="#2d5a55"/></linearGradient>
<radialGradient id="tcCampFireGlow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffb347" stop-opacity=".85"/><stop offset=".45" stop-color="#ff8a2a" stop-opacity=".32"/><stop offset="1" stop-color="#ff6a1a" stop-opacity="0"/></radialGradient>
<radialGradient id="tcCampLantern" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffe08a" stop-opacity=".9"/><stop offset="1" stop-color="#ffe08a" stop-opacity="0"/></radialGradient>
<radialGradient id="tcCampDoorWarm" cx=".5" cy=".85" r=".8"><stop offset="0" stop-color="#ffd27a"/><stop offset="1" stop-color="#5a2a54"/></radialGradient>
<radialGradient id="tcCampDoorCool" cx=".5" cy=".8" r=".8"><stop offset="0" stop-color="#eefcff"/><stop offset="1" stop-color="#2f9fe8"/></radialGradient>
<linearGradient id="tcCampDome" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f1f6ff"/><stop offset=".5" stop-color="#9fb2d6"/><stop offset="1" stop-color="#46578a"/></linearGradient>
<radialGradient id="tcCampNeonGround" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#4fd8ff" stop-opacity=".5"/><stop offset="1" stop-color="#4fd8ff" stop-opacity="0"/></radialGradient>
<linearGradient id="tcCampWood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b07a45"/><stop offset="1" stop-color="#7a4c26"/></linearGradient>
<linearGradient id="tcCampSteel" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#e3e9f2"/><stop offset=".35" stop-color="#9aa8bd"/><stop offset=".6" stop-color="#d5dde9"/><stop offset="1" stop-color="#8795ab"/></linearGradient>
<linearGradient id="tcCampCanvasShade" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#0a0a1e" stop-opacity=".35"/><stop offset=".4" stop-color="#0a0a1e" stop-opacity="0"/><stop offset=".6" stop-color="#0a0a1e" stop-opacity="0"/><stop offset="1" stop-color="#0a0a1e" stop-opacity=".4"/></linearGradient>
<radialGradient id="tcCampVig" cx=".5" cy=".55" r=".75"><stop offset=".55" stop-color="#05061a" stop-opacity="0"/><stop offset="1" stop-color="#05061a" stop-opacity=".35"/></radialGradient>
<filter id="tcCampGrain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves="2" seed="4"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1 0 0 0 0"/></filter>
<filter id="tcCampBlur6" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6"/></filter>
<filter id="tcCampBlur14" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="14"/></filter>
<filter id="tcCampBlur30" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="30"/></filter>
<pattern id="tcCampWeave" width="5" height="5" patternUnits="userSpaceOnUse"><path d="M0,2.5 H5 M2.5,0 V5" stroke="#000" stroke-opacity=".16" stroke-width="1"/><path d="M0,0.5 H5" stroke="#fff" stroke-opacity=".07" stroke-width="1"/></pattern>
<pattern id="tcCampBlades" width="80" height="46" patternUnits="userSpaceOnUse"><path d="M6,40 L2,26 M6,40 L7,22 M6,40 L12,27 M44,20 L40,8 M44,20 L45,4 M44,20 L50,9 M20,18 L17,8 M20,18 L24,9" stroke="#9bd486" stroke-width="1.8" stroke-linecap="round" fill="none"/><path d="M66,44 L62,32 M66,44 L68,28 M66,44 L72,33 M30,44 L27,34 M30,44 L34,35" stroke="#163a31" stroke-width="1.8" stroke-linecap="round" fill="none"/></pattern>
<linearGradient id="tcCampAO" x1="0" y1="0" x2="0" y2="1"><stop offset=".55" stop-color="#05061a" stop-opacity="0"/><stop offset="1" stop-color="#05061a" stop-opacity=".4"/></linearGradient>
<linearGradient id="tcCampFireRim" x1="0" y1="0" x2="1" y2="0"><stop offset=".35" stop-color="#ff9a3a" stop-opacity="0"/><stop offset="1" stop-color="#ff9a3a" stop-opacity=".5"/></linearGradient>
<linearGradient id="tcCampPodWarm" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ff9a3a" stop-opacity=".55"/><stop offset="1" stop-color="#ff9a3a" stop-opacity="0"/></linearGradient>
<radialGradient id="tcCampStoneLit" cx=".5" cy=".3" r=".8"><stop offset="0" stop-color="#c9ad94"/><stop offset=".5" stop-color="#7d7886"/><stop offset="1" stop-color="#34303f"/></radialGradient>
<linearGradient id="tcCampHaze" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff9bb0" stop-opacity="0"/><stop offset=".6" stop-color="#ff9bb0" stop-opacity=".28"/><stop offset="1" stop-color="#ff9bb0" stop-opacity="0"/></linearGradient>
<linearGradient id="tcCampFadeV" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000"/><stop offset=".5" stop-color="#fff"/><stop offset="1" stop-color="#000"/></linearGradient>
<mask id="tcCampCloudMask"><rect x="0" y="230" width="1600" height="230" fill="url(#tcCampFadeV)"/></mask>
<filter id="tcCampBlur2" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="2"/></filter>
<filter id="tcCampCloud" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".004 .015" numOctaves="4" seed="8"/><feColorMatrix values="0 0 0 0 1  0 0 0 0 .78  0 0 0 0 .7  0 0 0 2.6 -1.05"/></filter>
<filter id="tcCampBumpG" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".07" numOctaves="3" seed="11" result="n"/><feDiffuseLighting in="n" lighting-color="#ffffff" surfaceScale="2.2" diffuseConstant="1" result="l"><feDistantLight azimuth="235" elevation="62"/></feDiffuseLighting><feComposite in="l" in2="SourceGraphic" operator="in"/></filter>
<filter id="tcCampBump" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency=".09" numOctaves="3" seed="7" result="n"/><feDiffuseLighting in="n" lighting-color="#ffffff" surfaceScale="3" result="l"><feDistantLight azimuth="225" elevation="52"/></feDiffuseLighting><feComposite in="l" in2="SourceGraphic" operator="in" result="li"/><feBlend in="SourceGraphic" in2="li" mode="multiply"/></filter>
<filter id="tcCampWoodTex" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency=".02 .5" numOctaves="3" seed="3" result="n"/><feColorMatrix in="n" values="0 0 0 0 .18  0 0 0 0 .09  0 0 0 0 .02  0 0 0 1.6 -.7" result="g"/><feComposite in="g" in2="SourceGraphic" operator="in" result="gi"/><feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="gi"/></feMerge></filter>
<filter id="tcCampSteelTex" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency=".003 .8" numOctaves="2" seed="5" result="n"/><feColorMatrix in="n" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 1.4 -.55" result="g"/><feComposite in="g" in2="SourceGraphic" operator="in" result="gi"/><feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="gi"/></feMerge></filter>
<pattern id="tcCampStoneP" width="44" height="26" patternUnits="userSpaceOnUse"><rect width="44" height="26" fill="#a39cc0"/><path d="M0,13 H44 M0,0 H44 M22,0 V13 M0,13 V26 M44,13 V26" stroke="#756e9a" stroke-width="2" fill="none"/></pattern>
<linearGradient id="tcCampSoil" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6a5240"/><stop offset="1" stop-color="#2a2030"/></linearGradient>
<linearGradient id="tcCampMound" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fd088"/><stop offset="1" stop-color="#3f7f58"/></linearGradient>
<radialGradient id="tcCampDawnGlow" cx="1180" cy="430" r="720" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#ffd9a0" stop-opacity=".55"/><stop offset=".5" stop-color="#ffb890" stop-opacity=".18"/><stop offset="1" stop-color="#ffb890" stop-opacity="0"/></radialGradient>
<g id="tcCampCastle">
<ellipse cx="0" cy="12" rx="215" ry="20" fill="#05061a" opacity=".4"/>
<rect x="-150" y="-120" width="300" height="120" fill="url(#tcCampStoneP)" stroke="#3b3560" stroke-width="4"/>
<path d="M-150,-120 V-138 H-128 V-120 M-110,-120 V-138 H-88 V-120 M-70,-120 V-138 H-48 V-120 M48,-120 V-138 H70 V-120 M88,-120 V-138 H110 V-120 M128,-120 V-138 H150 V-120" fill="url(#tcCampStoneP)" stroke="#3b3560" stroke-width="3"/>
<rect x="-55" y="-210" width="110" height="210" fill="url(#tcCampStoneP)" stroke="#3b3560" stroke-width="4"/>
<path d="M-55,-210 V-228 H-34 V-210 M-14,-210 V-228 H7 V-210 M34,-210 V-228 H55 V-210" fill="url(#tcCampStoneP)" stroke="#3b3560" stroke-width="3"/>
<rect x="-195" y="-180" width="64" height="180" rx="5" fill="url(#tcCampStoneP)" stroke="#3b3560" stroke-width="4"/>
<rect x="131" y="-180" width="64" height="180" rx="5" fill="url(#tcCampStoneP)" stroke="#3b3560" stroke-width="4"/>
<g fill="url(#tcCampCanvasShade)"><rect x="-195" y="-180" width="64" height="180" rx="5"/><rect x="131" y="-180" width="64" height="180" rx="5"/><rect x="-55" y="-210" width="110" height="210"/></g>
<g fill="url(#tcCampFireRim)"><rect x="-195" y="-180" width="64" height="180" rx="5"/><rect x="131" y="-180" width="64" height="180" rx="5"/><rect x="-55" y="-210" width="110" height="210"/><rect x="-150" y="-120" width="300" height="120"/></g>
<path d="M-203,-178 L-163,-262 L-123,-178 Q-163,-166 -203,-178 Z" stroke="#25104f" stroke-width="4" stroke-linejoin="round" style="fill:var(--c1)"/>
<path d="M123,-178 L163,-262 L203,-178 Q163,-166 123,-178 Z" stroke="#25104f" stroke-width="4" stroke-linejoin="round" style="fill:var(--c1)"/>
<path d="M-163,-262 L-188,-173 M-163,-262 L-138,-173 M163,-262 L138,-173 M163,-262 L188,-173" stroke="#f7ebcb" stroke-opacity=".35" stroke-width="4" fill="none"/>
<path d="M-163,-262 V-300 M163,-262 V-300 M0,-228 V-262" stroke="#e9c15a" stroke-width="4"/>
<path class="tc-camp-flag" d="M-161,-300 L-120,-290 L-161,-280 Z" fill="#ffb23e" stroke="#25104f" stroke-width="2.5"/>
<path class="tc-camp-flag" d="M165,-300 L206,-290 L165,-280 Z" fill="#f7ebcb" stroke="#25104f" stroke-width="2.5"/>
<path class="tc-camp-flag" d="M2,-262 L40,-253 L2,-244 Z" fill="#ffb23e" stroke="#25104f" stroke-width="2.5"/>
<path d="M-34,0 V-50 Q0,-92 34,-50 V0 Z" fill="url(#tcCampDoorWarm)" stroke="#3b3560" stroke-width="5"/>
<path d="M-20,0 V-58 M-7,0 V-72 M7,0 V-72 M20,0 V-58 M-32,-24 H32 M-30,-44 H30" stroke="#2b2548" stroke-width="3" fill="none"/>
<path d="M-12,-130 V-160 Q0,-178 12,-160 V-130 Z M-175,-120 V-136 Q-163,-150 -151,-136 V-120 Z M151,-120 V-136 Q163,-150 175,-136 V-120 Z" fill="#ffd27a" stroke="#3b3560" stroke-width="3"/>
<path d="M-118,-114 h26 v46 l-13,-10 l-13,10 Z M92,-114 h26 v46 l-13,-10 l-13,10 Z" stroke="#25104f" stroke-width="2.5" style="fill:var(--c1)"/>
<circle cx="-105" cy="-96" r="5" fill="#ffb23e"/><circle cx="105" cy="-96" r="5" fill="#ffb23e"/>
<path d="M-56,-4 V-34 M56,-4 V-34" stroke="#4a3a2a" stroke-width="5" stroke-linecap="round"/>
<circle cx="-56" cy="-44" r="24" fill="url(#tcCampLantern)"/><circle cx="56" cy="-44" r="24" fill="url(#tcCampLantern)"/>
<path d="M-56,-34 C-63,-42 -56,-48 -56,-56 C-49,-48 -49,-40 -56,-34 Z M56,-34 C49,-42 56,-48 56,-56 C63,-48 63,-40 56,-34 Z" fill="#ffb23e"/>
</g>
<g id="tcCampBase">
<ellipse cx="0" cy="10" rx="190" ry="18" fill="#05061a" opacity=".35"/>
<rect x="-180" y="8" width="360" height="52" rx="10" fill="url(#tcCampSoil)" stroke="#1d2744" stroke-width="3"/>
<rect x="-150" y="24" width="300" height="20" rx="10" fill="#0a1a4f" stroke-width="3" style="stroke:var(--neon)"/>
<path d="M-120,24 V44 M-40,24 V44 M40,24 V44 M120,24 V44" stroke="#2f6bff" stroke-width="3"/>
<circle cx="-80" cy="34" r="3" fill="#ffe08a"/><circle cx="0" cy="34" r="3" fill="#ffe08a"/><circle cx="80" cy="34" r="3" fill="#ffe08a"/>
<path d="M-165,8 C-150,-60 -70,-92 0,-92 C70,-92 150,-60 165,8 Z" fill="url(#tcCampMound)" stroke="#1d4a3a" stroke-width="3"/>
<path d="M-165,8 C-150,-60 -70,-92 0,-92 C70,-92 150,-60 165,8 Z" fill="url(#tcCampBlades)" opacity=".5"/>
<g fill="#7b7886" stroke="#2a2535" stroke-width="2"><ellipse cx="-150" cy="2" rx="14" ry="8"/><ellipse cx="146" cy="4" rx="16" ry="9"/><ellipse cx="-120" cy="-6" rx="8" ry="5"/></g>
<rect x="-119" y="-62" width="18" height="26" rx="4" fill="#9aa8bd" stroke="#1d2744" stroke-width="3"/><rect x="101" y="-62" width="18" height="26" rx="4" fill="#9aa8bd" stroke="#1d2744" stroke-width="3"/>
<g opacity=".8" filter="url(#tcCampBlur6)" style="fill:var(--neon)"><circle cx="-110" cy="-64" r="8"/><circle cx="110" cy="-64" r="8"/></g>
<path d="M-40,-86 L40,-86 L32,-78 L-32,-78 Z" fill="url(#tcCampDoorCool)" stroke-width="3" style="stroke:var(--neon)"/>
<path d="M-62,8 L-62,-42 Q0,-84 62,-42 L62,8 Z" fill="#5d6c8c" stroke="#1d2744" stroke-width="4"/>
<path d="M-46,6 L-46,-38 Q0,-70 46,-38 L46,6 Z" fill="url(#tcCampDoorCool)"/>
<path d="M-40,-8 H40 M-34,-20 H34 M-26,-32 H26" stroke="#2b7fc0" stroke-width="3" opacity=".7"/>
<path d="M-62,8 L-62,-42 Q0,-84 62,-42 L62,8" fill="none" stroke-width="9" opacity=".7" filter="url(#tcCampBlur6)" style="stroke:var(--neon)"/>
<path d="M-62,8 L-62,-42 Q0,-84 62,-42 L62,8" fill="none" stroke-width="4" style="stroke:var(--neon)"/>
<path d="M-74,8 L74,8 L90,26 L-90,26 Z" fill="#46557a" stroke="#1d2744" stroke-width="3"/>
<path d="M-16,12 L0,20 L16,12" fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="stroke:var(--neon)"/>
<path d="M72,-84 V-140" stroke="#cfd9ee" stroke-width="4"/>
<circle cx="72" cy="-144" r="16" opacity=".4" filter="url(#tcCampBlur6)" style="fill:var(--neon)"/><circle class="tc-camp-blink" cx="72" cy="-144" r="6" style="fill:var(--neon)"/>
</g>
<g id="tcCampKnight">
<ellipse cx="0" cy="3" rx="18" ry="5" fill="#05061a" opacity=".35"/>
<rect x="-10" y="-26" width="8" height="26" rx="3" fill="#9aa8bd" stroke="#25104f" stroke-width="2"/><rect x="2" y="-26" width="8" height="26" rx="3" fill="#9aa8bd" stroke="#25104f" stroke-width="2"/>
<ellipse cx="-6" cy="0" rx="8" ry="4" fill="#7a4a24" stroke="#25104f" stroke-width="2"/><ellipse cx="6" cy="0" rx="8" ry="4" fill="#7a4a24" stroke="#25104f" stroke-width="2"/>
<g transform="scale(-1 1)"><path d="M26,-4 V-100" stroke="#6b4b2a" stroke-width="3.5" stroke-linecap="round"/><path d="M26,-114 L21,-98 H31 Z" fill="#cfd9ee" stroke="#25104f" stroke-width="2" stroke-linejoin="round"/></g>
<path d="M-15,-28 L15,-28 L17,-56 Q0,-62 -17,-56 Z" stroke="#25104f" stroke-width="2.5" style="fill:var(--c1)"/>
<rect x="-15" y="-34" width="30" height="5" fill="#7a4a24"/>
<path d="M-17,-52 L-24,-38 M17,-52 L26,-42" stroke="#9aa8bd" stroke-width="7" stroke-linecap="round"/>
<g transform="scale(-1 1)"><path d="M-42,-54 h22 v20 q0,12 -11,16 q-11,-4 -11,-16 Z" fill="#f7ebcb" stroke="#25104f" stroke-width="2.5"/><path d="M-40,-44 q9,-4 9,0 q9,-4 9,0 v14 q-9,-4 -9,0 q-9,-4 -9,0 Z" style="fill:var(--c1)"/><path d="M-31,-44 V-30" stroke="#f7ebcb" stroke-width="1.5"/>
</g>
<circle cx="0" cy="-72" r="15" fill="url(#tcCampSteel)" stroke="#25104f" stroke-width="2.5"/><ellipse cx="0" cy="-70" rx="9" ry="8" fill="#f5c9a0" stroke="#25104f" stroke-width="2"/><circle cx="-3.5" cy="-71" r="1.6" fill="#25104f"/><circle cx="3.5" cy="-71" r="1.6" fill="#25104f"/>
<path d="M0,-87 C-8,-104 12,-106 16,-96 C8,-96 4,-92 3,-87 Z" fill="#ffb23e" stroke="#25104f" stroke-width="2"/>
</g>
<g id="tcCampTrooper">
<ellipse cx="0" cy="3" rx="18" ry="5" fill="#05061a" opacity=".35"/>
<rect x="-10" y="-26" width="8" height="26" rx="3" fill="#1a3fb5" stroke="#12102b" stroke-width="2"/><rect x="2" y="-26" width="8" height="26" rx="3" fill="#1a3fb5" stroke="#12102b" stroke-width="2"/>
<rect x="-12" y="-5" width="12" height="6" rx="2" fill="#12102b"/><rect x="0" y="-5" width="12" height="6" rx="2" fill="#12102b"/>
<path d="M-14,-28 L14,-28 L16,-56 Q0,-62 -16,-56 Z" fill="#2f6bff" stroke="#12102b" stroke-width="2.5"/>
<path d="M-9,-43 H9" stroke-width="3" style="stroke:var(--neon)"/><circle cx="0" cy="-50" r="2.4" style="fill:var(--neon)"/><circle cx="0" cy="-36" r="2.4" style="fill:var(--neon)"/>
<path d="M-16,-52 L-24,-36 M16,-52 L26,-44" stroke="#e9eef7" stroke-width="7" stroke-linecap="round"/>
<g transform="translate(34 -28) scale(.9)"><path d="M-12,-14 h24 v20 q0,12 -12,16 q-12,-4 -12,-16 Z" fill="#2f6bff" stroke="#12102b" stroke-width="2.5"/><path d="M-8,-8 H8" stroke="#12102b" stroke-width="2.5" stroke-linecap="round"/><circle cx="0" cy="2" r="5.5" fill="#12102b"/><circle cx="0" cy="2" r="2.6" fill="#8247e8"/><path d="M-8,12 H8" stroke="#12102b" stroke-width="2.5" stroke-linecap="round"/></g><g transform="translate(26 -44)"><rect x="-3" y="-4" width="7" height="14" rx="2" fill="#12102b"/><rect x="-5" y="-12" width="34" height="10" rx="3" fill="#12102b" stroke="#ff5fb0" stroke-width="1.5"/><rect x="6" y="-10" width="16" height="3" rx="1.5" fill="#8247e8"/><rect x="22" y="-10" width="12" height="6" rx="2" fill="#ff5fb0"/><circle cx="36" cy="-7" r="4" fill="#ff5fb0" opacity=".7"/><circle cx="0" cy="2" r="5" fill="#e9eef7" stroke="#12102b" stroke-width="2"/></g>
<circle cx="0" cy="-72" r="15" fill="#e9eef7" stroke="#12102b" stroke-width="2.5"/><ellipse cx="0" cy="-71" rx="10" ry="8" fill="#0a1a4f"/><ellipse cx="0" cy="-71" rx="7" ry="5" style="fill:var(--neon)"/>
<path d="M9,-86 L13,-100" stroke="#cfd9ee" stroke-width="2.5"/><circle cx="13" cy="-102" r="3" style="fill:var(--neon)"/>
</g>
<g id="tcCampArcher">
<rect x="-6" y="-16" width="5" height="16" fill="#9aa8bd" stroke="#25104f" stroke-width="1.5"/><rect x="1" y="-16" width="5" height="16" fill="#9aa8bd" stroke="#25104f" stroke-width="1.5"/>
<path d="M-9,-16 L9,-16 L10,-34 Q0,-38 -10,-34 Z" stroke="#25104f" stroke-width="2" style="fill:var(--c1)"/>
<path d="M8,-30 L22,-34" stroke="#9aa8bd" stroke-width="5" stroke-linecap="round"/>
<path d="M24,-52 Q40,-34 24,-16" fill="none" stroke="#7a4a24" stroke-width="3" stroke-linecap="round"/><path d="M24,-52 L24,-16" stroke="#f7ebcb" stroke-width="1"/>
<circle cx="0" cy="-44" r="9" fill="url(#tcCampSteel)" stroke="#25104f" stroke-width="2"/><ellipse cx="1" cy="-43" rx="5" ry="4.5" fill="#f5c9a0"/>
</g>
<clipPath id="tcCampPavBody"><path d="M-110,-95 L-110,-5 Q0,25 110,-5 L110,-95 Z"/></clipPath>
<clipPath id="tcCampPodClip"><path d="M-150,0 A150,190 0 0 1 150,0 A150,20 0 0 1 -150,0 Z"/></clipPath>
<path id="tcCampPine" d="M-26,0 L0,-46 L26,0 Z M-20,-30 L0,-72 L20,-30 Z M-14,-56 L0,-96 L14,-56 Z" fill="#44508e"/>
<g id="tcCampTuft"><path d="M0,0 L-5,-14 M0,0 L0,-19 M0,0 L6,-13" stroke="#7fb56a" stroke-width="2.5" stroke-linecap="round" fill="none"/></g>
<g id="tcCampPodLines" fill="none" stroke-linejoin="round">
<path d="M-150,0 L-116,-70 L-100,0 L-70,-70 L-50,0 L-23,-70 L0,0 L23,-70 L50,0 L70,-70 L100,0 L116,-70 L150,0"/>
<path d="M-139,-70 Q0,-84 139,-70"/>
<path d="M-139,-70 L-100,-130 L-93,-70 L-55,-130 L-46,-70 L-18,-130 L0,-70 L18,-130 L46,-70 L55,-130 L93,-70 L100,-130 L139,-70"/>
<path d="M-109,-130 Q0,-143 109,-130"/>
<path d="M-100,-130 L-60,-175 L-55,-130 L-18,-175 L0,-130 L18,-175 L55,-130 L60,-175 L100,-130"/>
<path d="M-60,-175 Q0,-186 60,-175"/>
</g>

<g id="tcCampPavilion">
<ellipse cx="0" cy="8" rx="150" ry="20" fill="#0a0a1e" opacity=".4"/>
<path d="M-135,-90 L-180,6 M135,-90 L180,6" stroke="#e6d5a6" stroke-width="2.5" fill="none"/>
<path d="M-184,12 L-177,-4 M184,12 L177,-4" stroke="#6b4b2a" stroke-width="6" stroke-linecap="round" fill="none"/>
<path d="M-110,-95 L-110,-5 Q0,25 110,-5 L110,-95 Z" style="fill:var(--c1)"/>
<g clip-path="url(#tcCampPavBody)" fill="none" opacity=".95"><path d="M-88,-100 V30 M-44,-100 V30 M0,-100 V30 M44,-100 V30 M88,-100 V30" stroke-width="22" style="stroke:var(--c2)"/></g>
<path d="M-110,-95 L-110,-5 Q0,25 110,-5 L110,-95 Z" fill="url(#tcCampCanvasShade)" stroke="#1a0f2a" stroke-width="3"/>
<g clip-path="url(#tcCampPavBody)"><rect x="-120" y="-100" width="240" height="130" fill="url(#tcCampWeave)"/><rect x="-120" y="-100" width="240" height="130" fill="url(#tcCampAO)"/><rect x="-120" y="-100" width="240" height="130" fill="url(#tcCampFireRim)"/><path d="M-66,-95 Q-72,-50 -64,-6 M22,-95 Q28,-50 20,-4 M66,-95 Q60,-50 68,-8" stroke="#05061a" stroke-opacity=".18" stroke-width="3" fill="none"/></g>
<path d="M-34,3 L-34,-38 Q0,-62 34,-38 L34,3 Q0,10 -34,3 Z" fill="url(#tcCampDoorWarm)" stroke="#2a1530" stroke-width="4"/>
<path d="M-34,-38 Q-54,-22 -50,6 Q-42,8 -34,3 Z" stroke="#2a1530" stroke-width="3" style="fill:var(--c1)"/>
<path d="M34,-38 Q54,-22 50,6 Q42,8 34,3 Z" stroke="#2a1530" stroke-width="3" style="fill:var(--c1)"/>
<path d="M-135,-90 L0,-300 L135,-90 Q0,-82 -135,-90 Z" stroke="#1a0f2a" stroke-width="3" stroke-linejoin="round" style="fill:var(--c1)"/>
<g opacity=".92" style="fill:var(--c2)"><polygon points="0,-300 -90,-87.8 -45,-86.4"/><polygon points="0,-300 0,-86 45,-86.4"/><polygon points="0,-300 90,-87.8 135,-90"/></g>
<path d="M0,-300 L-90,-87.8 M0,-300 L-45,-86.4 M0,-300 L0,-86 M0,-300 L45,-86.4 M0,-300 L90,-87.8" stroke="#1a0f2a" stroke-opacity=".3" stroke-width="2" fill="none"/>
<path d="M-135,-90 L0,-300 L135,-90 Q0,-82 -135,-90 Z" fill="url(#tcCampCanvasShade)"/>
<path d="M-135,-90 L0,-300 L135,-90 Q0,-82 -135,-90 Z" fill="url(#tcCampWeave)"/>
<path d="M-135,-90 L0,-300 L135,-90 Q0,-82 -135,-90 Z" fill="url(#tcCampFireRim)"/>
<path d="M-110,-88 a22,22 0 0 0 44,0 a22,22 0 0 0 44,0 a22,22 0 0 0 44,0 a22,22 0 0 0 44,0 a22,22 0 0 0 44,0 Z" fill="#f2c566" stroke="#7a5a1e" stroke-width="2.5"/>
<path d="M0,-300 V-338" stroke="#e9c15a" stroke-width="4"/>
<circle cx="0" cy="-300" r="6" fill="#f2c566" stroke="#7a5a1e" stroke-width="2"/>
<path class="tc-camp-flag" d="M2,-338 L56,-324 L2,-310 Z" stroke="#1a0f2a" stroke-width="2.5" style="fill:var(--c2)"/>
<path d="M-158,10 V-142 M-158,-140 H-116 M158,10 V-142 M158,-140 H116" stroke="#6b4b2a" stroke-width="6" stroke-linecap="round" fill="none"/>
<path d="M-152,-134 h34 v62 l-17,-14 l-17,14 Z" stroke="#1a0f2a" stroke-width="2.5" style="fill:var(--c2)"/>
<circle cx="-135" cy="-112" r="7" style="fill:var(--c1)"/>
<path d="M118,-134 h34 v62 l-17,-14 l-17,14 Z" stroke="#1a0f2a" stroke-width="2.5" style="fill:var(--c2)"/>
<circle cx="135" cy="-112" r="7" style="fill:var(--c1)"/>
<path d="M-62,-68 V-52 M62,-68 V-52" stroke="#1a0f2a" stroke-width="2"/>
<circle cx="-62" cy="-42" r="30" fill="url(#tcCampLantern)"/>
<rect x="-70" y="-52" width="16" height="20" rx="5" fill="#ffd36b" stroke="#5a3a12" stroke-width="2.5"/>
<circle cx="62" cy="-42" r="30" fill="url(#tcCampLantern)"/>
<rect x="54" y="-52" width="16" height="20" rx="5" fill="#ffd36b" stroke="#5a3a12" stroke-width="2.5"/>
</g>

<g id="tcCampPod">
<ellipse cx="0" cy="10" rx="200" ry="28" fill="url(#tcCampNeonGround)"/>
<ellipse cx="0" cy="12" rx="170" ry="20" fill="#0a0a1e" opacity=".35"/>
<path d="M-160,0 v10 a160,20 0 0 0 320,0 v-10 Z" fill="#46557a" stroke="#1d2744" stroke-width="3"/>
<ellipse cx="0" cy="0" rx="160" ry="20" fill="#5d6c8c" stroke="#1d2744" stroke-width="3"/>
<path d="M-150,0 A150,190 0 0 1 150,0 A150,20 0 0 1 -150,0 Z" fill="url(#tcCampDome)" stroke="#1d2744" stroke-width="3"/>
<g clip-path="url(#tcCampPodClip)">
<use href="#tcCampPodLines" stroke-width="8" opacity=".75" filter="url(#tcCampBlur6)" style="stroke:var(--neon)"/>
<use href="#tcCampPodLines" stroke="#e6faff" stroke-width="2.2"/>
<circle cx="-82" cy="-100" r="13" fill="url(#tcCampDoorCool)" stroke-width="3" style="stroke:var(--neon)"/>
<circle cx="82" cy="-100" r="13" fill="url(#tcCampDoorCool)" stroke-width="3" style="stroke:var(--neon)"/>
<path d="M-110,-40 Q-100,-140 -20,-176" stroke="#fff" stroke-opacity=".5" stroke-width="10" stroke-linecap="round" fill="none"/>
<g fill="#05061a" opacity=".13"><polygon points="-100,0 -70,-70 -50,0"/><polygon points="0,0 23,-70 50,0"/><polygon points="100,0 116,-70 150,0"/><polygon points="-139,-70 -100,-130 -93,-70"/><polygon points="-46,-70 -18,-130 0,-70"/><polygon points="46,-70 55,-130 93,-70"/></g>
<rect x="-150" y="-192" width="110" height="196" fill="url(#tcCampPodWarm)"/>
<path d="M-150,-30 Q0,-60 150,-30 L150,0 L-150,0 Z" fill="#8fd4ff" opacity=".18"/>
</g>
<path d="M-32,2 L-32,-52 Q0,-88 32,-52 L32,2 Q0,14 -32,2 Z" fill="url(#tcCampDoorCool)" stroke-width="3" style="stroke:var(--neon)"/>
<path d="M-160,4 a160,20 0 0 0 320,0" fill="none" stroke-width="9" opacity=".7" filter="url(#tcCampBlur6)" style="stroke:var(--neon)"/>
<path d="M-160,4 a160,20 0 0 0 320,0" fill="none" stroke-width="4" style="stroke:var(--neon)"/>
<path d="M0,-188 V-232" stroke="#cfd9ee" stroke-width="4"/>
<circle cx="0" cy="-236" r="18" opacity=".4" filter="url(#tcCampBlur6)" style="fill:var(--neon)"/>
<circle class="tc-camp-blink" cx="0" cy="-236" r="6" style="fill:var(--neon)"/>
</g>

<g id="tcCampBenchWood">
<ellipse cx="0" cy="6" rx="170" ry="18" fill="#0a0a1e" opacity=".4"/>
<path d="M-130,-52 L-124,0 L-100,0 L-98,-52 Z M98,-52 L100,0 L124,0 L130,-52 Z" fill="#5a3517" stroke="#2a1608" stroke-width="3" filter="url(#tcCampWoodTex)"/>
<rect x="-124" y="-30" width="248" height="12" rx="3" fill="#6b4220" stroke="#2a1608" stroke-width="3"/>
<rect x="-140" y="-62" width="280" height="14" rx="3" fill="#8a5a2e" stroke="#2a1608" stroke-width="3"/>
<path d="M-138,-96 L138,-96 L158,-78 L-158,-78 Z" fill="#c28a52" stroke="#2a1608" stroke-width="3" stroke-linejoin="round" filter="url(#tcCampWoodTex)"/>
<path d="M-46,-96 L-52,-78 M30,-96 L34,-78 M96,-96 L104,-78" stroke="#7a4c26" stroke-opacity=".6" stroke-width="2"/>
<rect x="-158" y="-80" width="316" height="18" rx="5" fill="url(#tcCampWood)" stroke="#2a1608" stroke-width="3" filter="url(#tcCampWoodTex)"/>
<g transform="translate(-60,-90) rotate(-6)">
<rect x="-46" y="-18" width="92" height="30" fill="#5fb4ff" opacity=".6" filter="url(#tcCampBlur6)"/>
<rect x="-44" y="-16" width="88" height="28" fill="#2c6fe0" stroke="#cfe6ff" stroke-width="2"/>
<path d="M-44,-6 H44 M-44,4 H44 M-22,-16 V12 M0,-16 V12 M22,-16 V12" stroke="#cfe6ff" stroke-opacity=".35" stroke-width="1"/>
<path d="M-32,2 L30,-6 M20,-14 V4 M-32,2 L-36,6" stroke="#fff" stroke-width="2.2" stroke-linecap="round" fill="none"/>
</g>
<path d="M32,-100 L84,-100 L78,-92 L66,-90 L70,-80 L84,-78 L84,-74 L34,-74 L34,-78 L48,-80 L52,-90 L40,-92 Z" fill="#4d5568" stroke="#1a1e2c" stroke-width="2.5" stroke-linejoin="round"/>
<path d="M34,-98 H82" stroke="#9aa5bd" stroke-width="2"/>
<g transform="translate(122,-90) rotate(-30)"><rect x="-3" y="-40" width="6" height="44" rx="2" fill="#7a4c26" stroke="#2a1608" stroke-width="1.5"/><rect x="-12" y="-50" width="24" height="14" rx="3" fill="#8b95ad" stroke="#1a1e2c" stroke-width="2"/></g>
<g transform="translate(-124,-104)"><circle r="14" fill="#c9a24a" stroke="#5a3a12" stroke-width="2.5"/><circle r="17" fill="none" stroke="#c9a24a" stroke-width="7" stroke-dasharray="6 7.4"/><circle r="5" fill="#4a2f14"/></g>
<circle cx="-18" cy="-112" r="3" fill="#8fd4ff" opacity=".8"/><circle cx="-4" cy="-122" r="2" fill="#8fd4ff" opacity=".6"/>
</g>

<g id="tcCampBenchSteel">
<ellipse cx="0" cy="6" rx="170" ry="18" fill="#0a0a1e" opacity=".4"/>
<path d="M-130,-52 L-124,0 L-100,0 L-98,-52 Z M98,-52 L100,0 L124,0 L130,-52 Z" fill="url(#tcCampSteel)" stroke="#2b3550" stroke-width="3" filter="url(#tcCampSteelTex)"/>
<circle cx="-112" cy="-40" r="3" fill="#2b3550"/><circle cx="112" cy="-40" r="3" fill="#2b3550"/>
<rect x="-140" y="-62" width="280" height="30" rx="4" fill="#6f7d96" stroke="#2b3550" stroke-width="3"/>
<path d="M-110,-54 H-40 M-110,-47 H-40 M-110,-40 H-40 M40,-54 H110 M40,-47 H110 M40,-40 H110" stroke="#2b3550" stroke-width="3" stroke-linecap="round"/>
<path d="M-30,-46 H30" stroke-width="9" opacity=".7" filter="url(#tcCampBlur6)" style="stroke:#4fd8ff"/>
<path d="M-30,-46 H30" stroke="#4fd8ff" stroke-width="4" stroke-linecap="round"/>
<path d="M-138,-96 L138,-96 L158,-78 L-158,-78 Z" fill="url(#tcCampSteel)" stroke="#2b3550" stroke-width="3" stroke-linejoin="round" filter="url(#tcCampSteelTex)"/>
<path d="M-120,-92 H120 M-130,-87 H130 M-140,-82 H140" stroke="#fff" stroke-opacity=".35" stroke-width="1.2"/>
<rect x="-158" y="-80" width="316" height="18" rx="5" fill="#8795ab" stroke="#2b3550" stroke-width="3"/>
<path d="M-14,-100 L-44,-124 L44,-124 L14,-100 Z" fill="#4fd8ff" opacity=".28"/>
<rect x="-16" y="-104" width="32" height="10" rx="3" fill="#44506d" stroke="#1d2744" stroke-width="2"/>
<g transform="translate(0,-168)">
<rect x="-62" y="-30" width="124" height="70" rx="6" fill="#4fd8ff" opacity=".25" stroke="#9af0ff" stroke-width="2.5"/>
<path d="M-62,-18 H62 M-62,-6 H62 M-62,6 H62 M-62,18 H62 M-62,30 H62" stroke="#9af0ff" stroke-opacity=".3" stroke-width="1"/>
<path d="M-42,22 V6 M-24,22 V-4 M-6,22 V2 M12,22 V-10 M30,22 V-2" stroke="#e6faff" stroke-width="6" stroke-linecap="round"/>
<path d="M-48,-14 Q-20,-34 0,-14" fill="none" stroke="#e6faff" stroke-width="2.5"/>
<circle cx="40" cy="-8" r="9" fill="none" stroke="#e6faff" stroke-width="2.5"/>
</g>
<g transform="translate(-112,-104)"><circle r="12" fill="#b9c4d8" stroke="#2b3550" stroke-width="2.5"/><circle r="15" fill="none" stroke="#b9c4d8" stroke-width="6" stroke-dasharray="5 6.4"/><circle r="4" fill="#2b3550"/></g>
<g transform="translate(-86,-96)"><circle r="9" fill="#8795ab" stroke="#2b3550" stroke-width="2.5"/><circle r="12" fill="none" stroke="#8795ab" stroke-width="5" stroke-dasharray="4 5"/><circle r="3" fill="#2b3550"/></g>
<g transform="translate(106,-90) rotate(24)"><rect x="-3" y="-34" width="6" height="40" rx="2" fill="#aab6cc" stroke="#2b3550" stroke-width="2"/><path d="M-9,-34 a9,9 0 1 1 18,0 l-5,0 a4,4 0 1 0 -8,0 Z" fill="#aab6cc" stroke="#2b3550" stroke-width="2"/></g>
</g>

<g id="tcCampBenchWar">
<ellipse cx="0" cy="6" rx="230" ry="18" fill="#0a0a1e" opacity=".4"/>
<path d="M-176,-52 L-170,0 L-144,0 L-142,-52 Z" fill="#5a3517" stroke="#2a1608" stroke-width="3"/>
<path d="M142,-52 L144,0 L170,0 L176,-52 Z" fill="url(#tcCampSteel)" stroke="#2b3550" stroke-width="3"/>
<rect x="-190" y="-62" width="190" height="16" rx="3" fill="#8a5a2e" stroke="#2a1608" stroke-width="3"/>
<rect x="0" y="-62" width="190" height="16" rx="3" fill="#6f7d96" stroke="#2b3550" stroke-width="3"/>
<path d="M-188,-96 L0,-96 L0,-78 L-208,-78 Z" fill="#c28a52" stroke="#2a1608" stroke-width="3" stroke-linejoin="round"/>
<path d="M0,-96 L188,-96 L208,-78 L0,-78 Z" fill="url(#tcCampSteel)" stroke="#2b3550" stroke-width="3" stroke-linejoin="round"/>
<rect x="-208" y="-80" width="208" height="18" rx="5" fill="url(#tcCampWood)" stroke="#2a1608" stroke-width="3"/>
<rect x="0" y="-80" width="208" height="18" rx="5" fill="#8795ab" stroke="#2b3550" stroke-width="3"/>
<polygon points="-72,-98 72,-98 88,-80 -88,-80" fill="#5fb4ff" opacity=".55" filter="url(#tcCampBlur6)"/>
<polygon points="-72,-98 72,-98 88,-80 -88,-80" fill="#2c6fe0" stroke="#cfe6ff" stroke-width="2"/>
<path d="M-60,-90 C-20,-100 20,-82 60,-92" stroke="#fff" stroke-width="2.2" stroke-dasharray="5 5" fill="none"/>
<path d="M18,-94 l8,8 m0,-8 l-8,8" stroke="#ff7a7a" stroke-width="3" stroke-linecap="round"/>
<g transform="translate(-128,-92)">
<rect x="-26" y="-34" width="52" height="34" fill="#9aa3b8" stroke="#2a2f44" stroke-width="2.5"/>
<rect x="-34" y="-50" width="16" height="50" fill="#aab3c8" stroke="#2a2f44" stroke-width="2.5"/>
<rect x="18" y="-50" width="16" height="50" fill="#aab3c8" stroke="#2a2f44" stroke-width="2.5"/>
<path d="M-37,-50 L-26,-68 L-15,-50 Z M15,-50 L26,-68 L37,-50 Z" fill="#5a28b8" stroke="#2a2f44" stroke-width="2.5" stroke-linejoin="round"/>
<path d="M-8,0 V-14 Q0,-22 8,-14 V0 Z" fill="#2a1530"/>
<path d="M26,-68 V-84 l14,5 l-14,5" fill="#f7ebcb" stroke="#2a2f44" stroke-width="1.5"/>
</g>
<g transform="translate(128,-92)">
<rect x="-34" y="-20" width="68" height="20" rx="3" fill="#9aa8bd" stroke="#2b3550" stroke-width="2.5"/>
<rect x="-14" y="-76" width="28" height="56" fill="#cfd9ee" stroke="#2b3550" stroke-width="2.5"/>
<path d="M-14,-62 H14 M-14,-46 H14 M-14,-30 H14" stroke-width="3" style="stroke:#4fd8ff"/>
<ellipse cx="0" cy="-78" rx="20" ry="6" fill="#aab6cc" stroke="#2b3550" stroke-width="2.5"/>
<path d="M0,-84 V-100" stroke="#cfd9ee" stroke-width="3"/><circle cx="0" cy="-102" r="4" fill="#4fd8ff"/>
</g>
</g>
</defs>

<rect x="0" y="0" width="1600" height="520" fill="url(#tcCampSky)"/>
<g fill="#fff6d8" opacity=".3"><circle cx="120" cy="60" r="1.8"/><circle cx="260" cy="130" r="1.2"/><circle cx="380" cy="40" r="2"/><circle cx="520" cy="100" r="1.4"/><circle cx="640" cy="30" r="1.6"/><circle cx="760" cy="90" r="1.2"/><circle cx="880" cy="50" r="2"/><circle cx="1000" cy="120" r="1.4"/><circle cx="1120" cy="40" r="1.6"/><circle cx="1420" cy="80" r="2"/><circle cx="1520" cy="150" r="1.4"/><circle cx="1560" cy="40" r="1.2"/><circle cx="200" cy="220" r="1.4"/><circle cx="980" cy="220" r="1.2"/><circle cx="1360" cy="230" r="1.4"/><circle cx="60" cy="170" r="1.6"/><circle cx="460" cy="200" r="1.2"/><circle cx="700" cy="180" r="1.4"/></g>
<circle cx="1180" cy="430" r="230" fill="#ffd9a0" opacity=".6" filter="url(#tcCampBlur30)"/>
<circle cx="1180" cy="430" r="58" fill="#fff4c4"/>
<rect x="0" y="230" width="1600" height="230" filter="url(#tcCampCloud)" opacity=".6" mask="url(#tcCampCloudMask)"/>
<ellipse cx="400" cy="410" rx="320" ry="26" fill="#ff9bb0" opacity=".4" filter="url(#tcCampBlur14)"/>
<ellipse cx="1150" cy="400" rx="380" ry="22" fill="#ff9bb0" opacity=".35" filter="url(#tcCampBlur14)"/>
<path d="M0,430 C200,375 380,420 560,396 C760,372 900,430 1100,402 C1300,375 1460,420 1600,396 L1600,540 L0,540 Z" fill="#8a82c0" filter="url(#tcCampBlur2)"/>
<path d="M0,462 C260,420 480,458 720,440 C960,422 1180,466 1380,440 C1480,428 1560,440 1600,436 L1600,540 L0,540 Z" fill="#6c66a8"/>
<rect x="0" y="390" width="1600" height="100" fill="url(#tcCampHaze)"/>
<g filter="url(#tcCampBlur2)"><use href="#tcCampPine" transform="translate(60 468) scale(1.6)"/><use href="#tcCampPine" transform="translate(150 462) scale(1.2)"/><use href="#tcCampPine" transform="translate(300 456) scale(1.1)"/><use href="#tcCampPine" transform="translate(620 452) scale(.8)"/><use href="#tcCampPine" transform="translate(700 456) scale(.7)"/><use href="#tcCampPine" transform="translate(900 452) scale(1)"/><use href="#tcCampPine" transform="translate(985 458) scale(1.4)"/><use href="#tcCampPine" transform="translate(1060 450) scale(.9)"/><use href="#tcCampPine" transform="translate(1280 452) scale(1)"/><use href="#tcCampPine" transform="translate(1500 464) scale(1.2)"/><use href="#tcCampPine" transform="translate(1565 470) scale(1.8)"/></g>
<path d="M0,448 C300,438 600,462 900,448 C1200,434 1400,456 1600,446 L1600,900 L0,900 Z" fill="url(#tcCampGround)"/>
<rect x="0" y="448" width="1600" height="452" fill="url(#tcCampBlades)" opacity=".45"/>
<ellipse cx="800" cy="640" rx="620" ry="230" fill="#8a6a45" opacity=".5" filter="url(#tcCampBlur14)"/>
<ellipse cx="800" cy="620" rx="440" ry="170" fill="#a98458" opacity=".45" filter="url(#tcCampBlur14)"/>
<rect x="0" y="448" width="1600" height="452" fill="#ffffff" filter="url(#tcCampBumpG)" opacity=".5" style="mix-blend-mode: multiply"/>
<g fill="#5c4a38" opacity=".8"><ellipse cx="660" cy="700" rx="7" ry="4"/><ellipse cx="930" cy="720" rx="6" ry="3.5"/><ellipse cx="740" cy="740" rx="9" ry="5"/><ellipse cx="880" cy="690" rx="5" ry="3"/><ellipse cx="610" cy="650" rx="6" ry="3.5"/><ellipse cx="1010" cy="660" rx="8" ry="4"/></g>
<g fill="#b39c78" opacity=".7"><ellipse cx="700" cy="715" rx="5" ry="3"/><ellipse cx="960" cy="690" rx="6" ry="3.5"/><ellipse cx="820" cy="735" rx="4" ry="2.5"/><ellipse cx="560" cy="680" rx="5" ry="3"/><ellipse cx="1070" cy="740" rx="6" ry="3.5"/></g>
<g><use href="#tcCampTuft" x="60" y="780"/><use href="#tcCampTuft" x="200" y="850"/><use href="#tcCampTuft" x="300" y="760"/><use href="#tcCampTuft" x="1400" y="810"/><use href="#tcCampTuft" x="1520" y="860"/><use href="#tcCampTuft" x="1300" y="850"/><use href="#tcCampTuft" x="700" y="870"/><use href="#tcCampTuft" x="920" y="872"/><use href="#tcCampTuft" x="120" y="700"/><use href="#tcCampTuft" x="1500" y="750"/></g>

<g fill="#05061a" filter="url(#tcCampBlur14)" opacity=".45"><ellipse cx="40" cy="614" rx="210" ry="20"/><ellipse cx="250" cy="532" rx="150" ry="14"/><ellipse cx="1370" cy="532" rx="150" ry="14"/><ellipse cx="1600" cy="624" rx="170" ry="18"/><ellipse cx="370" cy="812" rx="210" ry="18"/><ellipse cx="1240" cy="812" rx="210" ry="18"/></g>
<g transform="translate(430 535) scale(.62)" style="--c1:#1a3fb5"><use href="#tcCampCastle"/></g>
<g transform="translate(170 612) scale(.9)" style="--c1:#5a28b8"><use href="#tcCampCastle"/></g>
<g transform="translate(1190 498) scale(.75)" style="--neon:#4aa8ff"><use href="#tcCampBase"/></g>
<g transform="translate(1415 610) scale(.95)" style="--neon:#4fd8ff"><use href="#tcCampBase"/></g>
<g transform="translate(372 556) scale(.75)" style="--c1:#1a3fb5"><use href="#tcCampKnight"/></g>
<g transform="translate(338 552) scale(.75)" style="--c1:#1a3fb5"><use href="#tcCampKnight"/></g>
<g transform="translate(105 650)" style="--c1:#5a28b8"><use href="#tcCampKnight"/></g>
<g transform="translate(240 654)" style="--c1:#5a28b8"><use href="#tcCampKnight"/></g>
<g transform="translate(1145 522) scale(.75)" style="--neon:#4aa8ff"><use href="#tcCampTrooper"/></g>
<g transform="translate(1235 526) scale(.75)" style="--neon:#4aa8ff"><use href="#tcCampTrooper"/></g>
<g transform="translate(1362 652)" style="--neon:#4fd8ff"><use href="#tcCampTrooper"/></g>
<g transform="translate(1472 656)" style="--neon:#4fd8ff"><use href="#tcCampTrooper"/></g>
<g transform="translate(160 424) scale(1.1)" style="--c1:#5a28b8"><use href="#tcCampArcher"/></g>
<g transform="translate(205 424) scale(1.1)" style="--c1:#5a28b8"><use href="#tcCampArcher"/></g>
<g transform="translate(125 507) scale(1.1)" style="--c1:#5a28b8"><use href="#tcCampArcher"/></g>
<g transform="translate(240 507) scale(1.1)" style="--c1:#5a28b8"><use href="#tcCampArcher"/></g>
<g transform="translate(418 406) scale(.8)" style="--c1:#1a3fb5"><use href="#tcCampArcher"/></g>
<g transform="translate(446 406) scale(.8)" style="--c1:#1a3fb5"><use href="#tcCampArcher"/></g>
<g fill="none" stroke="#f7ebcb" stroke-width="3" stroke-linecap="round"><path class="tc-camp-arrow" d="M190,396 l16,-5 m-6,-3 l6,3 l-4,5"/><path class="tc-camp-arrow tc-camp-d2" d="M240,396 l16,-5 m-6,-3 l6,3 l-4,5"/><path class="tc-camp-arrow" d="M160,480 l16,-5"/><path class="tc-camp-arrow tc-camp-d2" d="M276,480 l16,-5"/><path class="tc-camp-arrow" d="M460,388 l14,-4"/></g>
<g transform="translate(300 640)"><rect x="-4" y="-10" width="46" height="16" rx="6" fill="#2a2535" stroke="#12102b" stroke-width="2" transform="rotate(-12)"/><circle cx="-2" cy="2" r="9" fill="#7a4a24" stroke="#12102b" stroke-width="2"/><circle cx="-2" cy="2" r="9" fill="none" stroke="#12102b" stroke-width="2"/><circle class="tc-camp-puff" cx="44" cy="-10" r="12" fill="#f7ebcb"/><circle class="tc-camp-ball" cx="46" cy="-10" r="5" fill="#25104f"/></g>
<g style="--neon:#4fd8ff"><path class="tc-camp-bolt" d="M1352,612 h-34" stroke="#ff5fb0" stroke-width="4" stroke-linecap="round"/><path class="tc-camp-bolt tc-camp-d2" d="M1462,616 h-34" stroke="#ff5fb0" stroke-width="4" stroke-linecap="round"/><path class="tc-camp-bolt" d="M1135,482 h-30" stroke="#ff5fb0" stroke-width="4" stroke-linecap="round"/><path class="tc-camp-bolt tc-camp-d2" d="M1225,486 h-30" stroke="#ff5fb0" stroke-width="4" stroke-linecap="round"/></g>
<g transform="translate(1415 520)"><g class="tc-camp-miss"><g transform="scale(-1 1)"><path d="M-38,-8 L-48,-17 L-44,0 L-48,17 L-38,8 Z" fill="#1f4a2c" stroke="#12102b" stroke-width="2" stroke-linejoin="round"/><rect x="-42" y="-8" width="28" height="16" rx="3" fill="#2d6a3a" stroke="#12102b" stroke-width="2"/><rect x="-30" y="-8" width="7" height="16" fill="#2f6bff"/><path d="M-14,-8 Q-6,-8 0,0 Q-6,8 -14,8 Z" fill="#2f6bff" stroke="#12102b" stroke-width="2" stroke-linejoin="round"/><path d="M-42,-4 l-16,4 l16,4 Z" fill="#ff7a2e"/><path d="M-42,-2 l-9,2 l9,2 Z" fill="#ffd23e"/></g></g></g>

<use href="#tcCampBenchWood" x="200" y="770"/>
<use href="#tcCampBenchSteel" x="1400" y="770"/>

<!-- old side: small campfire near the castles -->
<g transform="translate(560 548) scale(.62)">
<ellipse cx="0" cy="-30" rx="160" ry="110" fill="#ff7a1a" opacity=".16" filter="url(#tcCampBlur30)" class="tc-camp-glow"/>
<ellipse cx="0" cy="4" rx="70" ry="14" fill="#05061a" opacity=".4"/>
<ellipse cx="-52" cy="-4" rx="14" ry="9" fill="url(#tcCampStoneLit)" stroke="#2a2535" stroke-width="3" filter="url(#tcCampBump)"/><ellipse cx="-34" cy="-14" rx="14" ry="9" fill="url(#tcCampStoneLit)" stroke="#2a2535" stroke-width="3" filter="url(#tcCampBump)"/><ellipse cx="0" cy="-18" rx="14" ry="9" fill="url(#tcCampStoneLit)" stroke="#2a2535" stroke-width="3" filter="url(#tcCampBump)"/><ellipse cx="34" cy="-14" rx="14" ry="9" fill="url(#tcCampStoneLit)" stroke="#2a2535" stroke-width="3" filter="url(#tcCampBump)"/><ellipse cx="52" cy="-4" rx="14" ry="9" fill="url(#tcCampStoneLit)" stroke="#2a2535" stroke-width="3" filter="url(#tcCampBump)"/>
<ellipse cx="0" cy="0" rx="48" ry="14" fill="#2b0f06"/>
<ellipse cx="0" cy="2" rx="34" ry="9" fill="#ff7a1f" opacity=".7" filter="url(#tcCampBlur6)"/>
<rect x="-38" y="-6" width="76" height="12" rx="6" transform="rotate(-14)" fill="#5b3418" stroke="#2a1608" stroke-width="3"/>
<rect x="-38" y="-6" width="76" height="12" rx="6" transform="rotate(14)" fill="#6b4120" stroke="#2a1608" stroke-width="3"/>
<g transform="translate(0 0) scale(.8)">
<path class="tc-camp-flame" d="M-14,0 C-20,-22 -4,-30 -2,-52 C6,-36 8,-44 10,-62 C20,-40 26,-28 20,-12 C26,-8 24,-2 16,0 Z" fill="#ff4f1a" opacity=".85" filter="url(#tcCampBlur6)"/>
<path class="tc-camp-flame" d="M-14,0 C-20,-22 -4,-30 -2,-52 C6,-36 8,-44 10,-62 C20,-40 26,-28 20,-12 C26,-8 24,-2 16,0 Z" fill="#ff6a1a"/>
<path class="tc-camp-flame tc-camp-flame2" d="M-14,0 C-20,-22 -4,-30 -2,-52 C6,-36 8,-44 10,-62 C20,-40 26,-28 20,-12 C26,-8 24,-2 16,0 Z" fill="#ffa826" transform="scale(.75)"/>
<path class="tc-camp-flame tc-camp-flame3" d="M-14,0 C-20,-22 -4,-30 -2,-52 C6,-36 8,-44 10,-62 C20,-40 26,-28 20,-12 C26,-8 24,-2 16,0 Z" fill="#ffe27a" transform="scale(.45)"/>
</g>
<ellipse cx="-44" cy="10" rx="14" ry="9" fill="url(#tcCampStoneLit)" stroke="#2a2535" stroke-width="3" filter="url(#tcCampBump)"/><ellipse cx="-16" cy="16" rx="14" ry="9" fill="url(#tcCampStoneLit)" stroke="#2a2535" stroke-width="3" filter="url(#tcCampBump)"/><ellipse cx="16" cy="16" rx="14" ry="9" fill="url(#tcCampStoneLit)" stroke="#2a2535" stroke-width="3" filter="url(#tcCampBump)"/><ellipse cx="44" cy="10" rx="14" ry="9" fill="url(#tcCampStoneLit)" stroke="#2a2535" stroke-width="3" filter="url(#tcCampBump)"/>
<g fill="#ffd36b"><circle class="tc-camp-spark" cx="-6" cy="-60" r="3" style="--dx:-14px"/><circle class="tc-camp-spark" cx="8" cy="-66" r="2.5" style="--dx:16px;animation-delay:-.9s"/></g>
</g>
<!-- new side: upright jet engine near the bases -->
<g transform="translate(1010 524) scale(.55)" style="--neon:#4fd8ff">
<ellipse cx="0" cy="-60" rx="170" ry="120" fill="#4fd8ff" opacity=".16" filter="url(#tcCampBlur30)" class="tc-camp-glow"/>
<ellipse cx="0" cy="4" rx="60" ry="12" fill="#05061a" opacity=".4"/>
<path d="M-40,4 L-30,-14 H30 L40,4 Z" fill="#5d6c8c" stroke="#12102b" stroke-width="3"/>
<path d="M-30,-14 V-82 Q0,-92 30,-82 V-14 Z" fill="#7f8ca8" filter="url(#tcCampSteelTex)" stroke="#12102b" stroke-width="3"/>
<path d="M-30,-40 H30 M-30,-62 H30" stroke="#12102b" stroke-width="3"/>
<rect x="-22" y="-30" width="44" height="6" rx="3" style="fill:var(--neon)"/>
<path d="M-30,-82 L-38,-100 H38 L30,-82 Z" fill="#9aa8bd" stroke="#12102b" stroke-width="3"/>
<ellipse cx="0" cy="-100" rx="38" ry="7" fill="#0a1a4f" stroke="#12102b" stroke-width="3"/>
<g transform="translate(0 -102)">
<path class="tc-camp-flame" d="M-14,0 C-20,-22 -4,-30 -2,-52 C6,-36 8,-44 10,-62 C20,-40 26,-28 20,-12 C26,-8 24,-2 16,0 Z" fill="#2f6bff" opacity=".9" filter="url(#tcCampBlur6)" transform="scale(1.2 1.6)"/>
<path class="tc-camp-flame" d="M-14,0 C-20,-22 -4,-30 -2,-52 C6,-36 8,-44 10,-62 C20,-40 26,-28 20,-12 C26,-8 24,-2 16,0 Z" fill="#2f6bff" transform="scale(1.1 1.5)"/>
<path class="tc-camp-flame tc-camp-flame2" d="M-14,0 C-20,-22 -4,-30 -2,-52 C6,-36 8,-44 10,-62 C20,-40 26,-28 20,-12 C26,-8 24,-2 16,0 Z" fill="#4fd8ff" transform="scale(.85 1.2)"/>
<path class="tc-camp-flame tc-camp-flame3" d="M-14,0 C-20,-22 -4,-30 -2,-52 C6,-36 8,-44 10,-62 C20,-40 26,-28 20,-12 C26,-8 24,-2 16,0 Z" fill="#bfeaff" transform="scale(.55 .85)"/>
<path class="tc-camp-flame tc-camp-flame3" d="M-14,0 C-20,-22 -4,-30 -2,-52 C6,-36 8,-44 10,-62 C20,-40 26,-28 20,-12 C26,-8 24,-2 16,0 Z" fill="#ffffff" transform="scale(.28 .5)"/>
</g></g>

<use href="#tcCampBenchWar" x="800" y="890"/>

<g fill="#ffe98a"><circle class="tc-camp-fly" cx="260" cy="700" r="3"/><circle class="tc-camp-fly" cx="460" cy="820" r="2.5" style="animation-delay: -2s"/><circle class="tc-camp-fly" cx="1000" cy="860" r="3" style="animation-delay: -3s"/><circle class="tc-camp-fly" cx="1340" cy="740" r="2.5" style="animation-delay: -1s"/><circle class="tc-camp-fly" cx="1560" cy="690" r="3" style="animation-delay: -4s"/><circle class="tc-camp-fly" cx="90" cy="820" r="2.5" style="animation-delay: -5s"/></g>
<g fill="#ffd36b" opacity=".3" filter="url(#tcCampBlur6)"><circle class="tc-camp-fly" cx="130" cy="860" r="22"/><circle class="tc-camp-fly" cx="1480" cy="840" r="28" style="animation-delay: -3s"/><circle class="tc-camp-fly" cx="640" cy="120" r="16" style="animation-delay: -2s"/></g>
<rect x="0" y="0" width="1600" height="900" fill="url(#tcCampDawnGlow)" style="mix-blend-mode: screen"/>
<rect x="0" y="0" width="1600" height="900" filter="url(#tcCampGrain)" opacity=".1"/>
<rect x="0" y="0" width="1600" height="900" fill="url(#tcCampVig)"/>
</svg>`;

export function campScene(doc: Document): SVGElement {
  return svgFromString(doc, CAMP_SCENE, 'tc-camp-art');
}
