// "Turn your iPad sideways": a full-screen note shown only when a touch tablet is held upright.
// The game is built for landscape, so portrait gets this instead of a squeezed board.
//
// Why this test: the short side is at least 600px (a tablet, not a phone) AND the main pointer is
// a finger (pointer: coarse). That keeps laptops and desktop windows out, even a tall narrow one
// with a mouse. A phone in portrait is not covered because phones are not supported.
// No timers: it listens for resize and orientationchange only.
import { TURN_SCREEN } from '../data/copy';
import { h } from './dom';
import { svgFromString } from './svg';

export const TURN_MIN_SHORT_SIDE = 600;
/** Above the pass screen and reload cover (100), so nothing can be answered behind it. */
export const TURN_Z = 200;

export type TurnFacts = { width: number; height: number; coarse: boolean };

export function shouldAskToTurn({ width, height, coarse }: TurnFacts): boolean {
  return coarse && height > width && Math.min(width, height) >= TURN_MIN_SHORT_SIDE;
}

export type TurnWindow = Pick<
  Window,
  'innerWidth' | 'innerHeight' | 'matchMedia' | 'addEventListener' | 'removeEventListener'
>;

export type TurnOptions = { now?: () => number };

export type TurnScreen = { destroy(): void };

/** Milliseconds spent on the turn screen so far. The reload timer skips this time. */
let away = 0;
export function awayMs(): number {
  return away;
}

const TABLET = `<svg viewBox="0 0 240 200" width="240" height="200" role="presentation">
  <g class="tc-turn-tablet">
    <rect x="90" y="30" width="60" height="100" rx="10" fill="#12102b" stroke="#ffb23e" stroke-width="6"/>
    <rect x="98" y="44" width="44" height="72" rx="3" fill="#2f6bff"/>
    <circle cx="120" cy="123" r="3.5" fill="#ffb23e"/>
  </g>
  <path d="M168 60 A56 56 0 0 1 196 118" fill="none" stroke="#4fd8ff" stroke-width="6" stroke-linecap="round"/>
  <path d="M196 118 l-4 -16 m4 16 l-15 -6" fill="none" stroke="#4fd8ff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

const pauseRunningGame = (doc: Document): void => {
  const body = doc.body;
  if (body.dataset.paused || body.dataset.cover) return;
  doc.querySelector<HTMLElement>('[data-testid="pause"]')?.click();
};

export function mountTurnScreen(
  doc: Document,
  win: TurnWindow,
  options: TurnOptions = {},
): TurnScreen {
  const now = options.now ?? (() => performance.now());
  const picture = svgFromString(doc, TABLET, 'tc-turn-picture');
  picture.setAttribute('aria-label', TURN_SCREEN.picture);
  const root = h(
    doc,
    'section',
    {
      class: 'tc-turn',
      'data-testid': 'turn-screen',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': 'tc-turn-title',
      'aria-describedby': 'tc-turn-body',
      tabindex: '-1',
      hidden: true,
    },
    h(
      doc,
      'div',
      { class: 'tc-turn-card' },
      picture,
      h(doc, 'h2', { id: 'tc-turn-title', text: TURN_SCREEN.title }),
      h(doc, 'p', { id: 'tc-turn-body', text: TURN_SCREEN.body }),
    ),
  );
  root.style.zIndex = String(TURN_Z);
  doc.body.append(root);

  let shown = false;
  let shownAt = 0;
  let returnFocus: HTMLElement | null = null;
  const lockedByUs: Element[] = [];

  const show = (): void => {
    shown = true;
    shownAt = now();
    returnFocus = doc.activeElement instanceof HTMLElement ? doc.activeElement : null;
    // A running battle pauses first, so no turn or timer is lost while the iPad is upright.
    pauseRunningGame(doc);
    for (const el of doc.body.children) {
      if (el === root || el.tagName === 'SCRIPT' || el.hasAttribute('inert')) continue;
      el.setAttribute('inert', '');
      lockedByUs.push(el);
    }
    root.hidden = false;
    root.focus();
  };

  const hide = (): void => {
    shown = false;
    away += Math.max(0, now() - shownAt);
    root.hidden = true;
    for (const el of lockedByUs.splice(0)) el.removeAttribute('inert');
    // Back to the pause panel if the game paused itself, else to where the player was.
    const resume = doc.querySelector<HTMLElement>('[data-testid="pause-resume"]');
    if (resume) resume.focus();
    else if (returnFocus?.isConnected) returnFocus.focus();
    returnFocus = null;
  };

  const check = (): void => {
    let coarse: boolean;
    try {
      coarse = win.matchMedia('(pointer: coarse)').matches;
    } catch {
      coarse = false;
    }
    const want = shouldAskToTurn({ width: win.innerWidth, height: win.innerHeight, coarse });
    if (want && !shown) show();
    else if (!want && shown) hide();
  };

  win.addEventListener('resize', check);
  win.addEventListener('orientationchange', check);
  check();

  return {
    destroy() {
      win.removeEventListener('resize', check);
      win.removeEventListener('orientationchange', check);
      if (shown) hide();
      root.remove();
    },
  };
}
