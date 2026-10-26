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
  const evaWord = h(doc, 'span', { class: 'tc-gear-word tc-gear-long', 'aria-hidden': 'true' });
  /** The short form for a narrow screen: the turns left, a dash, or nothing. */
  const evaMark = h(doc, 'span', { class: 'tc-gear-word tc-gear-short', 'aria-hidden': 'true' });
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
    evaMark,
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
      // Armed keeps the ready words: the Ember ring and aria-pressed say it, and the button
      // keeps its size (Regression 24).
      evaWord.textContent =
        e.phase === 'recharging' ? `${words.short} ${e.turnsLeft}` : words.short;
      evaMark.textContent =
        e.phase === 'recharging' ? String(e.turnsLeft) : e.phase === 'used' ? '\u2013' : '';
      evasion.setAttribute('aria-label', label);
      evasion.title = label;
      evasion.setAttribute('aria-pressed', String(e.phase === 'armed'));
      evasion.dataset.phase = e.phase;
      evasion.disabled = !canFire || (e.phase !== 'ready' && e.phase !== 'armed');
    },
    /**
     * Sits by Fire without covering another part of the bar or leaving the window. It tries, in
     * order: centered over Fire, right-aligned over Fire, centered under Fire. Positions are set
     * relative to the bar (`fire.offsetParent`).
     */
    place(fire: HTMLElement, others: readonly HTMLElement[], fresh = true): void {
      if (root.hidden) return;
      if (fresh) delete root.dataset.compact;
      const w = root.offsetWidth;
      const hgt = root.offsetHeight;
      const parentWidth = (fire.offsetParent as HTMLElement | null)?.offsetWidth ?? 0;
      const rectOf = (o: HTMLElement): Rectish => ({
        left: o.offsetLeft,
        top: o.offsetTop,
        right: o.offsetLeft + o.offsetWidth,
        bottom: o.offsetTop + o.offsetHeight,
      });
      const f = rectOf(fire);
      const centered = f.left + (f.right - f.left) / 2 - w / 2;
      const candidates: Array<{ left: number; top: number }> = [
        { left: centered, top: f.top - hgt - GAP },
        { left: f.right - w, top: f.top - hgt - GAP },
        { left: centered, top: f.bottom + GAP },
      ];
      // The bar's top in window terms, so "under Fire" can be checked against the window height.
      const barTop = (fire.offsetParent as HTMLElement | null)?.getBoundingClientRect().top ?? 0;
      const winH = doc.defaultView?.innerHeight ?? 0;
      const fits = ({ left, top }: { left: number; top: number }): boolean => {
        const box: Rectish = { left, top, right: left + w, bottom: top + hgt };
        if (left < 0 || (parentWidth > 0 && box.right > parentWidth)) return false;
        if (winH > 0 && barTop + box.bottom > winH) return false;
        return !others.some((o) => o.offsetWidth > 0 && !o.hidden && overlaps(box, rectOf(o)));
      };
      let pick = candidates.find(fits);
      if (!pick && root.dataset.compact !== 'true') {
        // No room: drop the words (the icon and a mark stay, the full name is the label) and retry.
        root.dataset.compact = 'true';
        this.place(fire, others, false);
        return;
      }
      if (!pick) {
        // Still no room: keep it over Fire, but inside the bar.
        const first = candidates[0]!;
        const max = parentWidth > 0 ? parentWidth - w : first.left;
        pick = { left: Math.max(0, Math.min(first.left, max)), top: first.top };
      }
      root.style.left = `${Math.round(pick.left)}px`;
      root.style.top = `${Math.round(pick.top)}px`;
    },
  };
}
