// Battle HUD: base health, scrap, wind, aim sliders, Fire, and the corner buttons.
// Keyboard: Up/Down = angle, Left/Right = power (Shift = bigger steps), Space = fire.
import { BUTTONS, HUD, TEAM_NAMES, windLabel } from '../data/copy';
import { AIM, WIND } from '../game/config';
import { TEAMS, type Team } from '../game/types';
import { LOCAL_IDS } from './constants';
import type { UiCtx } from './ctx';
import { h } from './dom';
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
  mute: HTMLButtonElement;
  panel: Record<Team, HTMLElement>;
  name: Record<Team, HTMLElement>;
  hpText: Record<Team, HTMLElement>;
  hpMeter: Record<Team, HTMLElement>;
  hpFill: Record<Team, HTMLElement>;
  scrap: Record<Team, HTMLElement>;
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
        if (canFire) handlers.onFire();
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
      if (canFire) h_.onFire();
    });

    const mute = h(doc, 'button', {
      type: 'button',
      class: 'tc-btn tc-btn-neutral',
      'data-testid': LOCAL_IDS.hudMute,
      text: muteLabel(),
    });
    mute.addEventListener('click', () => h_.onMuteToggle());

    const wind = h(doc, 'div', { class: 'tc-wind', 'data-testid': TEST_IDS.wind });
    const windText = h(doc, 'span', { class: 'tc-wind-text' });
    const windFill = h(doc, 'span', { class: 'tc-wind-fill', 'data-dir': 'none' });
    wind.append(
      windText,
      h(doc, 'span', { class: 'tc-wind-bar', 'aria-hidden': 'true' }, windFill),
    );
    const shots = h(doc, 'div', {
      class: 'tc-shots',
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
          h(doc, 'span', { class: 'tc-hp-label', text: `${HUD.baseHealth}: ` }),
          hpText[t],
          hpMeter[t],
        ),
        h(
          doc,
          'div',
          { class: 'tc-scrap-row' },
          h(doc, 'span', { text: `${HUD.scrap}: ` }),
          scrap[t],
        ),
      ),
    );

    const root = h(
      doc,
      'div',
      { class: 'tc-hud', 'data-motion': ctx.motion(), tabindex: -1 },
      h(
        doc,
        'div',
        { class: 'tc-hud-top' },
        ...TEAMS.slice(0, 1).map((t) => panel[t]),
        h(doc, 'div', { class: 'tc-hud-center' }, wind, shots),
        ...TEAMS.slice(1).map((t) => panel[t]),
        h(doc, 'div', { class: 'tc-hud-corner' }, mute),
      ),
      h(
        doc,
        'div',
        { class: 'tc-hud-bottom' },
        h(doc, 'div', { class: 'tc-aim' }, a.row, p.row),
        fire,
        h(doc, 'p', { class: 'tc-hint', text: HUD.keyboardHint }),
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
      mute,
      panel,
      name,
      hpText,
      hpMeter,
      hpFill,
      scrap,
    };
  }

  return {
    show(next: HudHandlers): void {
      this.hide();
      handlers = next;
      parts = build(next);
      ctx.layer.hud.append(parts.root);
      parts.root.style.pointerEvents = 'auto';
      doc.addEventListener('keydown', onKey);
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
      parts.shots.textContent = `${HUD.shotsLeft}: ${HUD.shotsValue(state.shotsLeft)}`;
      for (const t of TEAMS) {
        const hp = clamp(Math.round(state.baseHp[t]), 0, 100);
        parts.name[t].textContent = state.names[t];
        parts.hpText[t].textContent = HUD.hpValue(hp);
        parts.hpMeter[t].setAttribute('aria-valuenow', String(hp));
        parts.hpFill[t].style.width = `${hp}%`;
        parts.scrap[t].textContent = String(state.scrap[t]);
        parts.panel[t].setAttribute('data-active', String(state.activeTeam === t));
        const turn = parts.panel[t].querySelector('[data-role="turn-text"]');
        if (turn) turn.textContent = state.activeTeam === t ? HUD.yourTurn : '';
      }
    },
    hide(): void {
      doc.removeEventListener('keydown', onKey);
      unsubscribe?.();
      unsubscribe = null;
      parts?.root.remove();
      parts = null;
      handlers = null;
      canFire = false;
    },
  };
}
