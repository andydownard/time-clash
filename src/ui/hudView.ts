// Battle HUD: base health, scrap, wind, aim sliders, Fire, and the corner buttons.
// Keyboard: Up/Down = angle, Left/Right = power (Shift = bigger steps), Space = fire.
import { COMPUTER, computerTurnBanner } from '../data/computerCopy';
import { BUTTONS, HUD, TEAM_NAMES, turnBanner, windLabel } from '../data/copy';
import { AIM, TIMING, TURN, WIND } from '../game/config';
import { TEAMS, type Team } from '../game/types';
import type { UnitId } from '../game/units';
import { LOCAL_IDS } from './constants';
import type { UiCtx } from './ctx';
import { h } from './dom';
import { createGear } from './hudGear';
import { hudIcon } from './hudIcons';
import { TEST_IDS, type HudHandlers, type HudState } from './types';

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));

type Parts = {
  root: HTMLElement;
  angle: HTMLInputElement;
  power: HTMLInputElement;
  angleOut: HTMLElement;
  powerOut: HTMLElement;
  fire: HTMLButtonElement;
  wind: HTMLElement;
  shots: HTMLElement;
  pips: HTMLElement;
  aimPanel: HTMLElement;
  strip: HTMLElement;
  units: HTMLElement;
  unitName: HTMLElement;
  turnText: HTMLElement;
  hint: HTMLElement;
  mute: HTMLButtonElement;
  panel: Record<Team, HTMLElement>;
  name: Record<Team, HTMLElement>;
  hpText: Record<Team, HTMLElement>;
  hpMeter: Record<Team, HTMLElement>;
  hpFill: Record<Team, HTMLElement>;
  scrap: Record<Team, HTMLElement>;
  gear: ReturnType<typeof createGear>;
};

export function createHud(ctx: UiCtx) {
  const { doc } = ctx;
  let parts: Parts | null = null;
  let handlers: HudHandlers | null = null;
  let aim: { angleDeg: number; power: number } = {
    angleDeg: AIM.defaultAngleDeg,
    power: AIM.defaultPower,
  };
  let canFire = false;
  /** The active team's fighter ids, as last drawn. Keys outside this list do nothing. */
  let unitIds: UnitId[] = [];
  /** The coach line stays until the first shot of the session, so a new player learns the controls. */
  let hasFired = false;
  let unsubscribe: (() => void) | null = null;

  const record = <T>(make: (t: Team) => T): Record<Team, T> =>
    ({ PAST: make('PAST'), FUTURE: make('FUTURE') }) as Record<Team, T>;

  const paintAim = (): void => {
    if (!parts) return;
    parts.angle.value = String(aim.angleDeg);
    parts.power.value = String(aim.power);
    parts.angleOut.textContent = HUD.angleValue(aim.angleDeg);
    parts.powerOut.textContent = HUD.powerValue(aim.power);
  };

  const sendAim = (): void => handlers?.onAim({ ...aim });

  const onKey = (e: KeyboardEvent): void => {
    if (!parts || !handlers) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (ctx.coverKind() !== null) return;
    if (doc.body.dataset.paused) return;
    const target = e.target as Element | null;
    // A fighter's letter or number picks it (only the active team's five). Not while typing.
    const typing =
      target &&
      'closest' in target &&
      target.closest('textarea, select, [contenteditable], input:not([type="range"])');
    if (e.key.length === 1 && !typing) {
      const id = unitIds.find((u) => u.toLowerCase() === e.key.toLowerCase());
      if (id) {
        if (canFire) handlers.onSelect(id);
        return;
      }
    }
    const onControl =
      target &&
      'closest' in target &&
      target.closest('button, input, select, textarea, a, [role="radio"]');
    // A range slider uses the arrows itself but not Space, so Space still fires from it.
    const onSlider = onControl && (target as Element).matches('input[type="range"]');
    if (onControl && !(onSlider && e.key === ' ')) return;
    const step = e.shiftKey ? AIM.stepCoarse : AIM.stepFine;
    switch (e.key) {
      case ' ':
        e.preventDefault();
        if (canFire) fireNow(handlers);
        return;
      case 'ArrowUp':
      case 'ArrowDown':
        if (!canFire) return;
        e.preventDefault();
        aim.angleDeg = clamp(
          aim.angleDeg + (e.key === 'ArrowUp' ? step : -step),
          AIM.angleMinDeg,
          AIM.angleMaxDeg,
        );
        break;
      case 'ArrowRight':
      case 'ArrowLeft':
        if (!canFire) return;
        e.preventDefault();
        aim.power = clamp(
          aim.power + (e.key === 'ArrowRight' ? step : -step),
          AIM.powerMin,
          AIM.powerMax,
        );
        break;
      default:
        return;
    }
    paintAim();
    sendAim();
  };

  // One pip per shot (spent ones show a cross) and a last pip: a question comes after shot 2.
  // A ball picture leads the pips, so a pre-reader knows they count shots.
  const paintPips = (el: HTMLElement, shotsLeft: number, bonus = false): void => {
    el.replaceChildren(
      hudIcon(doc, 'shots'),
      ...Array.from({ length: TURN.shotsPerTurn }, (_, i) =>
        h(doc, 'span', {
          class: 'tc-pip',
          'data-used': String(i >= shotsLeft),
        }),
      ),
      h(doc, 'span', { class: 'tc-pip tc-pip-reload', text: HUD.reloadPip }),
      ...(bonus ? [h(doc, 'span', { class: 'tc-pip tc-pip-bonus', text: '\u2605' })] : []),
    );
  };

  // Rebuild the tokens only when the roster changes. Otherwise just move the selection.
  const paintUnits = (state: HudState): void => {
    if (!parts) return;
    const ids = state.units.map((u) => u.id);
    if (ids.join('') !== unitIds.join('')) {
      unitIds = ids;
      const tokens = state.units.map((u) => {
        const b = h(doc, 'button', {
          type: 'button',
          role: 'radio',
          class: 'tc-unit',
          'data-unit': u.id,
          'data-testid': TEST_IDS.unit(u.id),
          'aria-label': HUD.unitLabel(u.name, u.id),
          text: u.id,
        });
        b.addEventListener('click', () => {
          if (canFire) handlers?.onSelect(u.id);
        });
        return b;
      });
      parts.units.replaceChildren(
        h(doc, 'span', { class: 'tc-units-label', text: HUD.pickOne }),
        ...tokens,
        parts.unitName,
      );
    }
    parts.units.setAttribute('data-team', state.activeTeam ?? 'none');
    for (const b of parts.units.querySelectorAll<HTMLElement>('.tc-unit')) {
      b.setAttribute('aria-checked', String(b.dataset.unit === state.selected));
      b.setAttribute('aria-disabled', String(!canFire));
    }
    parts.unitName.textContent = state.units.find((u) => u.id === state.selected)?.name ?? '';
  };

  const fireNow = (h_: HudHandlers): void => {
    hasFired = true;
    if (parts) {
      parts.hint.hidden = true;
      // The wind-up look. It stays on through the flight and clears when Fire is ready again.
      parts.fire.dataset.charging = 'true';
    }
    h_.onFire();
  };

  const muteLabel = (): string => (ctx.settings().muted ? BUTTONS.soundOff : BUTTONS.soundOn);

  function build(h_: HudHandlers): Parts {
    const slider = (id: string, label: string, min: number, max: number, onInput: () => void) => {
      const input = h(doc, 'input', {
        type: 'range',
        class: 'tc-range',
        id: `tc-${id}`,
        min,
        max,
        step: 1,
        'data-testid': id,
      });
      input.addEventListener('input', onInput);
      const out = h(doc, 'output', { class: 'tc-readout', for: `tc-${id}` });
      const row = h(
        doc,
        'div',
        { class: 'tc-slider-row' },
        h(doc, 'label', { for: `tc-${id}`, text: label }),
        input,
        out,
      );
      return { input, out, row };
    };
    const a = slider(TEST_IDS.angleControl, HUD.angle, AIM.angleMinDeg, AIM.angleMaxDeg, () => {
      aim.angleDeg = Number(a.input.value);
      a.out.textContent = HUD.angleValue(aim.angleDeg);
      sendAim();
    });
    const p = slider(TEST_IDS.powerControl, HUD.power, AIM.powerMin, AIM.powerMax, () => {
      aim.power = Number(p.input.value);
      p.out.textContent = HUD.powerValue(aim.power);
      sendAim();
    });

    const fire = h(doc, 'button', {
      type: 'button',
      class: 'tc-btn tc-btn-fire',
      'data-testid': TEST_IDS.fireButton,
      text: HUD.fire,
    });
    fire.addEventListener('click', () => {
      if (canFire) fireNow(h_);
    });

    const mute = h(doc, 'button', {
      type: 'button',
      class: 'tc-btn tc-btn-neutral',
      'data-testid': LOCAL_IDS.hudMute,
      text: muteLabel(),
    });
    mute.addEventListener('click', () => h_.onMuteToggle());

    // The canvas wind sign is the one sighted readout. This copy stays for screen readers.
    const wind = h(doc, 'div', { class: 'tc-wind tc-sr-only', 'data-testid': TEST_IDS.wind });
    const windText = h(doc, 'span', { class: 'tc-wind-text' });
    const windFill = h(doc, 'span', { class: 'tc-wind-fill', 'data-dir': 'none' });
    wind.append(
      windText,
      h(doc, 'span', { class: 'tc-wind-bar', 'aria-hidden': 'true' }, windFill),
    );
    const pips = h(doc, 'div', { class: 'tc-pips', 'aria-hidden': 'true' });
    const shots = h(doc, 'div', {
      class: 'tc-shots tc-sr-only',
      'data-testid': TEST_IDS.shotsLeft,
      'aria-live': 'polite',
    });

    const name = record((t) => h(doc, 'span', { class: 'tc-team-name', 'data-role': `name-${t}` }));
    const hpText = record(() => h(doc, 'span', { class: 'tc-hp-text' }));
    const hpFill = record(() => h(doc, 'span', { class: 'tc-hp-fill' }));
    const hpMeter = record((t) =>
      h(
        doc,
        'div',
        {
          class: 'tc-hp-meter',
          role: 'meter',
          'aria-label': `${TEAM_NAMES[t]} ${HUD.baseHealth}`,
          'aria-valuemin': 0,
          'aria-valuemax': 100,
          'aria-valuenow': 100,
        },
        hpFill[t],
      ),
    );
    const scrap = record((t) =>
      h(doc, 'span', { class: 'tc-scrap', 'data-testid': LOCAL_IDS.hudScrap(t) }),
    );
    const panel = record((t) =>
      h(
        doc,
        'div',
        { class: 'tc-team-panel', 'data-team': t, 'data-active': 'false' },
        h(doc, 'span', { class: 'tc-active-mark', 'aria-hidden': 'true', text: '▶' }),
        h(doc, 'span', { class: 'tc-sr-only', 'data-role': 'turn-text' }),
        name[t],
        h(
          doc,
          'div',
          { 'data-testid': TEST_IDS.baseHp(t), class: 'tc-hp' },
          h(doc, 'span', { class: 'tc-hp-label tc-sr-only', text: HUD.baseHealth }),
          h(doc, 'div', { class: 'tc-hp-row' }, hudIcon(doc, 'health'), hpMeter[t], hpText[t]),
        ),
        h(
          doc,
          'div',
          { class: 'tc-scrap-row' },
          hudIcon(doc, 'scrap'),
          h(doc, 'span', { text: `${HUD.scrap}: ` }),
          scrap[t],
        ),
      ),
    );

    // The turn strip sits on top of the control bar: flashing chevrons, whose turn it is in words,
    // and the shot pips (two shots, then a question). Everything for a turn is in one place.
    const turnText = h(doc, 'span', {
      class: 'tc-turn-text',
      'data-testid': TEST_IDS.turnBanner,
      role: 'status',
    });
    const strip = h(
      doc,
      'div',
      { class: 'tc-turn-strip' },
      h(doc, 'span', { class: 'tc-turn-chev', 'aria-hidden': 'true', text: '\u00AB\u00AB\u00AB' }),
      turnText,
      pips,
    );
    const aimPanel = h(doc, 'div', { class: 'tc-aim' }, a.row, p.row);
    // Fighter selector: one round token per fighter, drawn in update().
    const unitName = h(doc, 'span', { class: 'tc-unit-name', 'aria-live': 'polite' });
    const units = h(
      doc,
      'div',
      { class: 'tc-units', role: 'radiogroup', 'aria-label': HUD.pickOne },
      h(doc, 'span', { class: 'tc-units-label', text: HUD.pickOne }),
      unitName,
    );
    // Wind is drawn once, on the canvas sign. This copy and the shot count are for screen readers.
    const hint = h(
      doc,
      'p',
      { class: 'tc-hint', hidden: hasFired },
      h(doc, 'span', { text: HUD.coach }),
      h(doc, 'span', { class: 'tc-sr-only', text: ` ${HUD.keyboardHint}` }),
    );

    // Phase 2 gear (ammo and the evasion ability) floats by Fire, outside the one-row layout.
    const gear = createGear(ctx, {
      ammo: (id) => h_.onAmmo?.(id),
      evasion: () => h_.onEvasion?.(),
    });
    const root = h(
      doc,
      'div',
      { class: 'tc-hud', 'data-motion': ctx.motion(), tabindex: -1 },
      h(
        doc,
        'div',
        { class: 'tc-hud-top' },
        ...TEAMS.slice(0, 1).map((t) => panel[t]),
        ...TEAMS.slice(1).map((t) => panel[t]),
        h(doc, 'div', { class: 'tc-hud-corner' }, mute),
      ),
      h(
        doc,
        'div',
        { class: 'tc-hud-bottom' },
        strip,
        units,
        aimPanel,
        fire,
        hint,
        wind,
        shots,
        gear.root,
      ),
    );
    return {
      root,
      angle: a.input,
      power: p.input,
      angleOut: a.out,
      powerOut: p.out,
      fire,
      wind,
      shots,
      pips,
      aimPanel,
      strip,
      units,
      unitName,
      turnText,
      hint,
      mute,
      panel,
      name,
      hpText,
      hpMeter,
      hpFill,
      scrap,
      gear,
    };
  }

  const placeGear = (): void => {
    if (parts) parts.gear.place(parts.fire, [parts.strip, parts.units, parts.aimPanel]);
  };

  return {
    show(next: HudHandlers): void {
      this.hide();
      handlers = next;
      parts = build(next);
      ctx.layer.hud.append(parts.root);
      parts.root.style.pointerEvents = 'auto';
      doc.addEventListener('keydown', onKey);
      doc.defaultView?.addEventListener('resize', placeGear);
      unsubscribe = ctx.onSettings(() => {
        if (parts) parts.mute.textContent = muteLabel();
      });
      paintAim();
    },
    update(state: HudState): void {
      if (!parts) return;
      aim = { angleDeg: state.angleDeg, power: state.power };
      canFire = state.canFire;
      paintAim();
      parts.angle.disabled = !canFire;
      parts.power.disabled = !canFire;
      parts.fire.disabled = !canFire;
      if (canFire) delete parts.fire.dataset.charging;
      if (state.activeTeam) parts.fire.dataset.team = state.activeTeam;
      else delete parts.fire.dataset.team;
      paintUnits(state);
      parts.gear.update(state.gear, canFire);
      placeGear();
      // A disabled control drops focus to the page. Keep it inside the HUD instead.
      const active = doc.activeElement;
      if (
        !canFire &&
        active &&
        parts.root.contains(active) &&
        (active as HTMLInputElement).disabled
      )
        parts.root.focus();
      const windText = parts.wind.querySelector('.tc-wind-text');
      if (windText) windText.textContent = windLabel(state.wind);
      const fill = parts.wind.querySelector<HTMLElement>('.tc-wind-fill');
      if (fill) {
        const pct = Math.min(100, Math.round((Math.abs(Number(state.wind) || 0) / WIND.max) * 100));
        fill.style.width = `${pct}%`;
        fill.setAttribute('data-dir', state.wind > 0 ? 'right' : state.wind < 0 ? 'left' : 'none');
      }
      parts.shots.textContent = state.bonus
        ? HUD.powerShot
        : `${HUD.shotsLeft}: ${HUD.shotsValue(state.shotsLeft)}`;
      const who = state.activeTeam;
      parts.aimPanel.setAttribute('data-team', who ?? 'none');
      parts.strip.setAttribute('data-team', who ?? 'none');
      // Shot 1 until the first shot is fired, then shot 2.
      const shot = Math.min(TURN.shotsPerTurn, TURN.shotsPerTurn - state.shotsLeft + 1);
      const turnShot = state.bonus ? 'POWER' : shot;
      parts.turnText.textContent = who
        ? state.computerTeam === who
          ? computerTurnBanner(turnShot)
          : turnBanner(state.names[who], turnShot)
        : '';
      paintPips(parts.pips, state.shotsLeft, state.bonus);
      for (const t of TEAMS) {
        const max = Math.max(1, Math.round(state.maxBaseHp?.[t] ?? 100));
        const hp = clamp(Math.round(state.baseHp[t]), 0, max);
        parts.name[t].textContent = state.names[t];
        parts.hpText[t].textContent = HUD.hpValue(hp, max);
        parts.hpMeter[t].setAttribute('aria-valuenow', String(hp));
        parts.hpMeter[t].setAttribute('aria-valuemax', String(max));
        parts.hpFill[t].style.width = `${(hp / max) * 100}%`;
        parts.scrap[t].textContent = String(state.scrap[t]);
        parts.panel[t].setAttribute('data-active', String(state.activeTeam === t));
        const turn = parts.panel[t].querySelector('[data-role="turn-text"]');
        if (turn) {
          turn.textContent =
            state.activeTeam === t
              ? state.computerTeam === t
                ? COMPUTER.playingNow
                : HUD.yourTurn
              : '';
        }
      }
    },
    /** A new turn starts: the horn sounds and the strip flashes for a moment. */
    flash(): Promise<void> {
      ctx.sfx('horn');
      const strip = parts?.strip;
      if (!strip) return Promise.resolve();
      strip.setAttribute('data-flash', 'true');
      return new Promise<void>((resolve) => {
        ctx.env.setTimeout(() => {
          strip.removeAttribute('data-flash');
          resolve();
        }, TIMING.bannerHoldMs);
      });
    },
    hide(): void {
      doc.removeEventListener('keydown', onKey);
      doc.defaultView?.removeEventListener('resize', placeGear);
      unsubscribe?.();
      unsubscribe = null;
      parts?.root.remove();
      parts = null;
      handlers = null;
      canFire = false;
      unitIds = [];
    },
  };
}
