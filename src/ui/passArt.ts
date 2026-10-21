// A picture for pre-readers on the pass screen: one player slides the mouse over to the other.
// Original shapes, no words. The words on the screen stay; this only adds a picture.
import { svgFromString } from './svg';

const PASS_ART = `<svg viewBox="0 0 240 90" width="240" height="90">
  <g fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="30" cy="30" r="13" fill="var(--tc-ink-deep)"/>
    <path d="M8 82 C8 58 52 58 52 82 Z" fill="var(--tc-ink-deep)"/>
    <circle cx="210" cy="30" r="13" fill="var(--tc-ink-deep)"/>
    <path d="M188 82 C188 58 232 58 232 82 Z" fill="var(--tc-ink-deep)"/>
    <rect x="104" y="30" width="32" height="46" rx="16" fill="var(--tc-parchment-warm)" stroke="var(--tc-ink-deep)"/>
    <path d="M120 30 V50 M104 50 H136" stroke="var(--tc-ink-deep)" stroke-width="3"/>
    <path d="M64 50 H92 M82 40 L94 50 L82 60"/>
    <path d="M148 50 H176 M166 40 L178 50 L166 60"/>
  </g>
</svg>`;

export function passArt(doc: Document): SVGElement {
  return svgFromString(doc, PASS_ART, 'tc-pass-art');
}
