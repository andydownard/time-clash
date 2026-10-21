// Everything the child sees about the Computer player that is not the battle itself:
// its picture, the Play with / How hard? choices on Setup, its card, and the thinking banner.
import '../styles/computer.css';
import { COMPUTER } from '../data/computerCopy';
import { BOT_LEVELS, type BotLevel } from '../game/config';
import { DEFAULT_PRACTICE, type PracticeChoice } from '../game/practice';
import type { Team } from '../game/types';
import type { UiCtx } from './ctx';
import { h } from './dom';
import { svgFromString } from './svg';

export const COMPUTER_IDS = {
  playWithPerson: 'play-with-person',
  playWithComputer: 'play-with-computer',
  level: (level: BotLevel) => `computer-level-${level}`,
  card: 'computer-card',
  thinking: 'computer-thinking',
} as const;

// Friendly robot head (Team Future): rounded box, two round eyes, a smile, a glowing antenna.
const ROBOT = `<svg viewBox="0 0 100 100" role="img" focusable="false">
  <line class="tc-cp-line" x1="50" y1="22" x2="50" y2="10"/>
  <circle class="tc-cp-bulb" cx="50" cy="8" r="6"/>
  <rect class="tc-cp-trim" x="6" y="44" width="10" height="22" rx="4"/>
  <rect class="tc-cp-trim" x="84" y="44" width="10" height="22" rx="4"/>
  <rect class="tc-cp-body" x="14" y="22" width="72" height="66" rx="20"/>
  <circle class="tc-cp-eye" cx="36" cy="50" r="9"/>
  <circle class="tc-cp-eye" cx="64" cy="50" r="9"/>
  <circle class="tc-cp-glint" cx="39" cy="46" r="3"/>
  <circle class="tc-cp-glint" cx="67" cy="46" r="3"/>
  <path class="tc-cp-mouth" d="M34 70 Q50 82 66 70"/>
</svg>`;

// Friendly helmet (Team Past): round dome, a plume, a wide face opening with two smiling eyes.
const HELMET = `<svg viewBox="0 0 100 100" role="img" focusable="false">
  <path class="tc-cp-plume" d="M50 8 Q70 2 74 22 Q60 18 50 24 Q40 18 26 22 Q30 2 50 8 Z"/>
  <path class="tc-cp-metal" d="M16 60 Q16 24 50 24 Q84 24 84 60 L84 84 L16 84 Z"/>
  <rect class="tc-cp-body" x="26" y="46" width="48" height="30" rx="12"/>
  <circle class="tc-cp-eye" cx="40" cy="58" r="6"/>
  <circle class="tc-cp-eye" cx="60" cy="58" r="6"/>
  <circle class="tc-cp-glint" cx="42" cy="56" r="2"/>
  <circle class="tc-cp-glint" cx="62" cy="56" r="2"/>
  <path class="tc-cp-mouth" d="M42 68 Q50 74 58 68"/>
  <line class="tc-cp-line" x1="50" y1="24" x2="50" y2="44"/>
</svg>`;

/** The Computer player's picture. A robot head for Team Future, a helmet for Team Past. */
export function computerFace(doc: Document, team: Team, small = false): SVGElement {
  const svg = svgFromString(
    doc,
    team === 'FUTURE' ? ROBOT : HELMET,
    small ? 'tc-cp-face tc-cp-face--small' : 'tc-cp-face',
  );
  svg.setAttribute('data-role', 'computer-face');
  return svg;
}

type Pick<T extends string> = { value: T; label: string; testId: string };

/** A row of big radio buttons with arrow-key movement, like the grade chips. */
function radioRow<T extends string>(
  doc: Document,
  label: string,
  picks: ReadonlyArray<Pick<T>>,
  current: () => T,
  set: (v: T) => void,
  extraClass = '',
): { el: HTMLElement; paint: () => void } {
  const chips = picks.map((p) =>
    h(doc, 'button', {
      type: 'button',
      class: `tc-chip tc-chip-wide ${extraClass}`.trim(),
      role: 'radio',
      'data-testid': p.testId,
      text: p.label,
    }),
  );
  const paint = (): void =>
    chips.forEach((c, i) => {
      const on = picks[i]?.value === current();
      c.setAttribute('aria-checked', String(on));
      c.tabIndex = on ? 0 : -1;
    });
  chips.forEach((chip, i) => {
    chip.addEventListener('click', () => {
      set((picks[i] as Pick<T>).value);
      paint();
    });
    chip.addEventListener('keydown', (e) => {
      const move =
        e.key === 'ArrowRight' || e.key === 'ArrowDown'
          ? 1
          : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
            ? -1
            : 0;
      if (!move) return;
      e.preventDefault();
      const to = Math.min(picks.length - 1, Math.max(0, i + move));
      set((picks[to] as Pick<T>).value);
      paint();
      chips[to]?.focus();
    });
  });
  paint();
  return {
    el: h(doc, 'div', { class: 'tc-chips', role: 'radiogroup', 'aria-label': label }, ...chips),
    paint,
  };
}

export type PracticeSetup = {
  /** The "Play with" row. Goes above the team cards. */
  playWithRow: HTMLElement;
  /** The Computer player's card. Shown in place of the Team Future card. */
  card: HTMLElement;
  /** True while Computer player is picked. */
  isComputer(): boolean;
  choice(): PracticeChoice;
  /** Back to Another player and Medium (after Clear my data). */
  reset(): void;
};

/** The team that the Computer player plays. Setup always puts the child on Team Past. */
export const COMPUTER_TEAM: Team = 'FUTURE';

/**
 * Builds the Play with row and the Computer player card. `onChange` runs after every pick so
 * Setup can show or hide the human card for that side.
 */
export function createPracticeSetup(
  ctx: UiCtx,
  initial: PracticeChoice | null,
  onChange: () => void,
): PracticeSetup {
  const { doc } = ctx;
  const state: PracticeChoice = { ...(initial ?? DEFAULT_PRACTICE) };

  const who = radioRow<'person' | 'computer'>(
    doc,
    COMPUTER.playWith,
    [
      { value: 'person', label: COMPUTER.anotherPlayer, testId: COMPUTER_IDS.playWithPerson },
      { value: 'computer', label: COMPUTER.computerPlayer, testId: COMPUTER_IDS.playWithComputer },
    ],
    () => state.opponent,
    (v) => {
      state.opponent = v;
      onChange();
    },
  );
  const playWithRow = h(
    doc,
    'div',
    { class: 'tc-play-with' },
    h(doc, 'p', { class: 'tc-label', text: COMPUTER.playWith }),
    who.el,
  );

  const level = radioRow<BotLevel>(
    doc,
    COMPUTER.howHard,
    BOT_LEVELS.map((l) => ({ value: l, label: COMPUTER.levels[l], testId: COMPUTER_IDS.level(l) })),
    () => state.level,
    (v) => {
      state.level = v;
      onChange();
    },
  );
  const card = h(
    doc,
    'div',
    {
      class: 'tc-team-card tc-computer-card',
      'data-team': COMPUTER_TEAM,
      'data-testid': COMPUTER_IDS.card,
      role: 'group',
      'aria-label': COMPUTER.name,
      hidden: true,
    },
    computerFace(doc, COMPUTER_TEAM),
    h(doc, 'h2', { class: 'tc-computer-name', text: COMPUTER.name }),
    h(doc, 'p', { class: 'tc-label', text: COMPUTER.howHard }),
    level.el,
    h(doc, 'p', { class: 'tc-computer-note', text: COMPUTER.cardNote }),
  );

  return {
    playWithRow,
    card,
    isComputer: () => state.opponent === 'computer',
    choice: () => ({ ...state }),
    reset() {
      Object.assign(state, DEFAULT_PRACTICE);
      who.paint();
      level.paint();
      onChange();
    },
  };
}

export type ThinkingHandle = { show(text: string | null, team: Team): void; dispose(): void };

/** "Computer player is thinking" with its small picture. Text only, never a question or an answer. */
export function createThinking(ctx: UiCtx): ThinkingHandle {
  const { doc } = ctx;
  let el: HTMLElement | null = null;
  return {
    show(text, team) {
      if (text === null) {
        el?.remove();
        el = null;
        return;
      }
      const dots = h(
        doc,
        'span',
        { class: 'tc-thinking-dots', 'aria-hidden': 'true' },
        h(doc, 'i'),
        h(doc, 'i'),
        h(doc, 'i'),
      );
      const label = h(doc, 'span', { text });
      if (!el) {
        el = h(doc, 'div', {
          class: 'tc-thinking',
          'data-testid': COMPUTER_IDS.thinking,
          role: 'status',
          'aria-live': 'polite',
        });
        ctx.layer.banner.append(el);
      }
      el.setAttribute('data-motion', ctx.motion());
      el.replaceChildren(computerFace(doc, team, true), label, dots);
    },
    dispose() {
      el?.remove();
      el = null;
    },
  };
}
