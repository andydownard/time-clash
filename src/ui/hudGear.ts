// Phase 2 gear in the battle bar: one button for the ammo kind and one for the evasion ability.
// It floats just above Fire (or below it when there is no room above, as in portrait), so the
// selector, the sliders and Fire still share one row.
import { GEAR_COPY, PLAN_COPY } from '../data/copy';
import { AMMO, type AmmoId } from '../game/ammo';
import type { UiCtx } from './ctx';
import { h } from './dom';
import { TEST_IDS, type HudGear } from './types';

export const AMMO_ICON: Record<AmmoId, string> = {
  standard: '●',
  confetti: '\u{1F389}',
  plasma: '\u{1F52E}',
  bowling: '\u{1F3B3}',
};
const ABILITY_ICON = { dodge: '\u{1F6F9}', barricade: '\u{1F9F1}' } as const;
const ORDER: readonly AmmoId[] = AMMO.map((a) => a.id);
/** Gap between the gear and Fire, in px. */
const GAP = 8;

/** The kind after `current` that still has shots, wrapping back to Standard. */
export function nextAmmo(current: AmmoId, left: Partial<Record<AmmoId, number>>): AmmoId {
  const usable = ORDER.filter((id) => id === 'standard' || (left[id] ?? 0) > 0);
  const at = usable.indexOf(current);
  return usable[(at + 1) % usable.length] ?? 'standard';
}

const ammoName = (id: AmmoId): string =>
  id === 'standard' ? GEAR_COPY.standard : PLAN_COPY.ammo[id].name;

type Rectish = { left: number; top: number; right: number; bottom: number };
const overlaps = (a: Rectish, b: Rectish): boolean =>
  a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

export function createGear(ctx: UiCtx, on: { ammo: (id: AmmoId) => void; evasion: () => void }) {
  const { doc } = ctx;
  let gear: HudGear | null = null;
  let enabled = false;

  const ammoIcon = h(doc, 'span', { class: 'tc-gear-icon', 'aria-hidden': 'true' });
  const ammoCount = h(doc, 'span', { class: 'tc-gear-word', 'aria-hidden': 'true' });
  const ammo = h(
    doc,
    'button',
    {
      type: 'button',
      class: 'tc-btn tc-btn-neutral tc-gear-btn',
      'data-testid': TEST_IDS.gearAmmo,
    },
    ammoIcon,
    ammoCount,
  );
  const evaIcon = h(doc, 'span', { class: 'tc-gear-icon', 'aria-hidden': 'true' });
  const evaWord = h(doc, 'span', { class: 'tc-gear-word', 'aria-hidden': 'true' });
  const evasion = h(
    doc,
    'button',
    {
      type: 'button',
      class: 'tc-btn tc-btn-neutral tc-gear-btn',
      'data-testid': TEST_IDS.gearEvasion,
      'aria-pressed': 'false',
    },
    evaIcon,
    evaWord,
  );
  const root = h(doc, 'div', { class: 'tc-gear', role: 'group', hidden: true }, ammo, evasion);

  ammo.addEventListener('click', () => {
    if (!enabled || !gear) return;
    const next = nextAmmo(gear.ammo, gear.ammoLeft);
    if (next !== gear.ammo) on.ammo(next);
  });
  evasion.addEventListener('click', () => {
    if (!enabled || !gear) return;
    const p = gear.evasion.phase;
    if (p === 'ready' || p === 'armed') on.evasion();
  });

  return {
    root,
    update(next: HudGear | undefined, canFire: boolean): void {
      gear = next ?? null;
      enabled = canFire;
      root.hidden = !gear;
      if (!gear) return;
      // Ammo: hidden until the team owns a special kind.
      const owned = Object.keys(gear.ammoLeft).length > 0;
      ammo.hidden = !owned;
      const left = gear.ammo === 'standard' ? null : (gear.ammoLeft[gear.ammo] ?? 0);
      ammoIcon.textContent = AMMO_ICON[gear.ammo];
      ammoCount.textContent = left === null ? '∞' : String(left);
      ammo.setAttribute(
        'aria-label',
        GEAR_COPY.ammoButton(
          ammoName(gear.ammo),
          left === null ? GEAR_COPY.unlimited : GEAR_COPY.shotsLeft(left),
        ),
      );
      ammo.disabled = !canFire;
      ammo.dataset.ammo = gear.ammo;
      // Evasion: its name and state in words; the icon and a short word on the button.
      const e = gear.evasion;
      const words = GEAR_COPY.abilities[e.id];
      evaIcon.textContent = ABILITY_ICON[e.id];
      const label =
        e.phase === 'ready'
          ? GEAR_COPY.ready(words.name)
          : e.phase === 'armed'
            ? GEAR_COPY.armed(words.name)
            : e.phase === 'active'
              ? GEAR_COPY.active(words.name)
              : e.phase === 'recharging'
                ? GEAR_COPY.recharging(words.name, e.turnsLeft)
                : GEAR_COPY.used(words.name);
      evaWord.textContent =
        e.phase === 'armed'
          ? `✓ ${words.short}`
          : e.phase === 'recharging'
            ? `${words.short} ${e.turnsLeft}`
            : words.short;
      evasion.setAttribute('aria-label', label);
      evasion.title = label;
      evasion.setAttribute('aria-pressed', String(e.phase === 'armed'));
      evasion.dataset.phase = e.phase;
      evasion.disabled = !canFire || (e.phase !== 'ready' && e.phase !== 'armed');
    },
    /**
     * Sits centered over `fire`. If that spot would cover another part of the bar, it goes under
     * Fire instead. Positions are relative to the bar (`fire.offsetParent`).
     */
    place(fire: HTMLElement, others: readonly HTMLElement[]): void {
      if (root.hidden) return;
      const w = root.offsetWidth;
      const hgt = root.offsetHeight;
      const left = fire.offsetLeft + fire.offsetWidth / 2 - w / 2;
      const above = fire.offsetTop - hgt - GAP;
      const box = (top: number): Rectish => ({ left, top, right: left + w, bottom: top + hgt });
      const blocked = others.some((o) => {
        if (o.offsetWidth === 0 || o.hidden) return false;
        const r = {
          left: o.offsetLeft,
          top: o.offsetTop,
          right: o.offsetLeft + o.offsetWidth,
          bottom: o.offsetTop + o.offsetHeight,
        };
        return overlaps(box(above), r);
      });
      const top = blocked ? fire.offsetTop + fire.offsetHeight + GAP : above;
      root.style.left = `${Math.round(left)}px`;
      root.style.top = `${Math.round(top)}px`;
    },
  };
}
