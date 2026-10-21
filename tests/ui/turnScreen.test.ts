// @vitest-environment jsdom
// The "Turn your iPad" screen: shown only on a touch tablet held upright, hidden when turned.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TURN_SCREEN } from '../../src/data/copy';
import { awayMs, mountTurnScreen, shouldAskToTurn, type TurnWindow } from '../../src/ui/turnScreen';

// Heavy under CPU load (a full run, or a build running beside it): a longer limit for this file only.
vi.setConfig({ testTimeout: 120_000 });

describe('shouldAskToTurn', () => {
  it('asks on a touch tablet held upright', () => {
    expect(shouldAskToTurn({ width: 744, height: 1133, coarse: true })).toBe(true);
    expect(shouldAskToTurn({ width: 1032, height: 1376, coarse: true })).toBe(true);
    expect(shouldAskToTurn({ width: 600, height: 601, coarse: true })).toBe(true);
  });
  it('does not ask when the screen is wider than tall (landscape or square)', () => {
    expect(shouldAskToTurn({ width: 1133, height: 744, coarse: true })).toBe(false);
    expect(shouldAskToTurn({ width: 800, height: 800, coarse: true })).toBe(false);
  });
  it('does not ask on a phone-sized screen (short side under 600)', () => {
    expect(shouldAskToTurn({ width: 390, height: 844, coarse: true })).toBe(false);
    expect(shouldAskToTurn({ width: 599, height: 1000, coarse: true })).toBe(false);
  });
  it('does not ask on a mouse and keyboard computer, even in a tall narrow window', () => {
    expect(shouldAskToTurn({ width: 768, height: 1024, coarse: false })).toBe(false);
  });
});

function fakeWin(width: number, height: number, coarse = true) {
  const listeners = new Map<string, Set<() => void>>();
  const win = {
    innerWidth: width,
    innerHeight: height,
    matchMedia: (q: string) => ({ matches: q.includes('pointer: coarse') ? coarse : false }),
    addEventListener: (t: string, fn: () => void) => {
      if (!listeners.has(t)) listeners.set(t, new Set());
      listeners.get(t)!.add(fn);
    },
    removeEventListener: (t: string, fn: () => void) => void listeners.get(t)?.delete(fn),
  } as unknown as TurnWindow & { innerWidth: number; innerHeight: number };
  const turnTo = (w: number, h: number, event = 'resize') => {
    win.innerWidth = w;
    win.innerHeight = h;
    listeners.get(event)?.forEach((fn) => fn());
  };
  return { win, turnTo, count: (t: string) => listeners.get(t)?.size ?? 0 };
}

const screen = () => document.querySelector<HTMLElement>('[data-testid="turn-screen"]');

afterEach(() => {
  document.body.innerHTML = '';
  delete document.body.dataset.cover;
  delete document.body.dataset.paused;
});

describe('mountTurnScreen', () => {
  it('shows a status screen with the message when the tablet starts upright', () => {
    const t = fakeWin(744, 1133);
    mountTurnScreen(document, t.win);
    const el = screen()!;
    expect(el).not.toBeNull();
    expect(el.hidden).toBe(false);
    expect(el.getAttribute('role')).toBe('dialog');
    expect(el.getAttribute('aria-modal')).toBe('true');
    expect(el.textContent).toContain(TURN_SCREEN.title);
    expect(el.querySelector('svg')).not.toBeNull();
    expect(el.querySelector('svg')!.getAttribute('aria-hidden')).toBe('true');
  });

  it('is hidden at landscape and appears and disappears on resize and orientationchange', () => {
    const t = fakeWin(1133, 744);
    mountTurnScreen(document, t.win);
    expect(screen()!.hidden).toBe(true);
    t.turnTo(744, 1133);
    expect(screen()!.hidden).toBe(false);
    t.turnTo(1133, 744, 'orientationchange');
    expect(screen()!.hidden).toBe(true);
  });

  it('never shows on a mouse computer in a tall window', () => {
    const t = fakeWin(768, 1024, false);
    mountTurnScreen(document, t.win);
    expect(screen()!.hidden).toBe(true);
  });

  it('keeps the page behind it out of reach while it is up, and gives it back after', () => {
    const t = fakeWin(1133, 744);
    const game = document.createElement('div');
    game.id = 'game';
    const already = document.createElement('div');
    already.setAttribute('inert', '');
    document.body.append(game, already);
    mountTurnScreen(document, t.win);
    t.turnTo(744, 1133);
    expect(game.hasAttribute('inert')).toBe(true);
    expect(screen()!.hasAttribute('inert')).toBe(false);
    expect(document.activeElement).toBe(screen());
    t.turnTo(1133, 744);
    expect(game.hasAttribute('inert')).toBe(false);
    expect(already.hasAttribute('inert')).toBe(true);
  });

  it('pauses a running battle once, and does nothing if it is already paused', () => {
    const t = fakeWin(1133, 744);
    let pauses = 0;
    const pause = document.createElement('button');
    pause.setAttribute('data-testid', 'pause');
    pause.addEventListener('click', () => pauses++);
    document.body.append(pause);
    mountTurnScreen(document, t.win);
    t.turnTo(744, 1133);
    expect(pauses).toBe(1);
    t.turnTo(744, 1100); // still upright: no second pause
    expect(pauses).toBe(1);
    t.turnTo(1133, 744);
    document.body.dataset.paused = 'true';
    t.turnTo(744, 1133);
    expect(pauses).toBe(1);
  });

  it('adds up the time spent away so a reload timer can skip it', () => {
    const t = fakeWin(1133, 744);
    let clock = 1000;
    mountTurnScreen(document, t.win, { now: () => clock });
    const before = awayMs();
    t.turnTo(744, 1133);
    clock = 4500;
    t.turnTo(1133, 744);
    expect(awayMs() - before).toBe(3500);
  });

  it('removes its listeners and its screen on destroy', () => {
    const t = fakeWin(744, 1133);
    const mounted = mountTurnScreen(document, t.win);
    mounted.destroy();
    expect(screen()).toBeNull();
    expect(t.count('resize')).toBe(0);
    expect(t.count('orientationchange')).toBe(0);
  });
});
