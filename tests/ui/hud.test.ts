// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BUTTONS, HUD, tumblePool, windLabel, turnBanner } from '../../src/data/copy';
import { AIM, TIMING } from '../../src/game/config';
import type { HudHandlers, HudState } from '../../src/ui/types';
import { TEST_IDS, Z } from '../../src/ui/types';
import { click, flush, key, q, qa, setup } from './helpers';

// Heavy under CPU load (a full run, or a build running beside it): a longer limit for this file only.
vi.setConfig({ testTimeout: 30_000 });

let s: ReturnType<typeof setup>;
beforeEach(() => {
  s = setup();
});

const state = (over: Partial<HudState> = {}): HudState => ({
  activeTeam: 'PAST',
  names: { PAST: 'Alex', FUTURE: 'Sam' },
  baseHp: { PAST: 100, FUTURE: 75 },
  scrap: { PAST: 3, FUTURE: 0 },
  wind: -12,
  angleDeg: 45,
  power: 60,
  shotsLeft: 2,
  bonus: false,
  canFire: true,
  selected: 'C',
  units: [],
  ...over,
});

const handlers = (): HudHandlers & {
  calls: string[];
  aims: Array<{ angleDeg: number; power: number }>;
} => {
  const calls: string[] = [];
  const aims: Array<{ angleDeg: number; power: number }> = [];
  return {
    calls,
    aims,
    onAim: (a) => aims.push(a),
    onFire: () => calls.push('fire'),
    onMuteToggle: () => calls.push('mute'),
    onSelect: () => {},
  };
};

describe('turn strip (the turn banner)', () => {
  const show = (over: Partial<HudState> = {}) => {
    s.overlay.showHud(handlers());
    s.overlay.updateHud(state(over));
  };

  it('says whose turn it is and which shot, in words, on the control bar', () => {
    show({ shotsLeft: 2 });
    expect(q(TEST_IDS.turnBanner)!.textContent).toBe('ALEX, YOUR TURN! (SHOT 1 OF 2)');
    expect(q(TEST_IDS.turnBanner)!.textContent).toBe(turnBanner('Alex', 1));
    expect(q(TEST_IDS.turnBanner)!.closest('.tc-hud-bottom')).not.toBeNull();
  });

  it('says shot 2 after the first shot is fired, and for the other team', () => {
    show({ activeTeam: 'FUTURE', shotsLeft: 1 });
    expect(q(TEST_IDS.turnBanner)!.textContent).toBe('SAM, YOUR TURN! (SHOT 2 OF 2)');
    expect(q(TEST_IDS.turnBanner)!.closest('.tc-turn-strip')!.getAttribute('data-team')).toBe(
      'FUTURE',
    );
  });

  it('keeps saying shot 2 of 2 while the last shot flies (never "shot 3")', () => {
    show({ shotsLeft: 0 });
    expect(q(TEST_IDS.turnBanner)!.textContent).toBe(turnBanner('Alex', 2));
  });

  it('is empty when no team is up (nothing to announce)', () => {
    show({ activeTeam: null });
    expect(q(TEST_IDS.turnBanner)!.textContent).toBe('');
  });

  it('puts the name in as text only', () => {
    show({ names: { PAST: '<i>x</i>', FUTURE: 'Sam' } });
    expect(q(TEST_IDS.turnBanner)!.querySelector('i')).toBeNull();
    expect(q(TEST_IDS.turnBanner)!.textContent).toContain('<I>X</I>'.toUpperCase());
  });

  it('is announced politely, and the chevrons are decoration only', () => {
    show();
    expect(q(TEST_IDS.turnBanner)!.getAttribute('role')).toBe('status');
    expect(document.querySelector('.tc-turn-chev')!.getAttribute('aria-hidden')).toBe('true');
  });

  it('holds the shot pips (two shots, then reload) inside the strip', () => {
    show();
    expect(document.querySelectorAll('.tc-turn-strip .tc-pips .tc-pip')).toHaveLength(3);
  });

  it('flashes for bannerHoldMs when a turn starts, then stops, and sounds the horn', async () => {
    show();
    const strip = document.querySelector('.tc-turn-strip')!;
    let done = false;
    const p = s.overlay.showTurnBanner({ name: 'Alex', team: 'PAST', shot: 1 });
    void p.then(() => (done = true));
    expect(strip.hasAttribute('data-flash')).toBe(true);
    expect(s.sfx).toContain('horn');
    s.clock.advance(TIMING.bannerHoldMs - 1);
    await flush();
    expect(done).toBe(false);
    s.clock.advance(1);
    await p;
    expect(strip.hasAttribute('data-flash')).toBe(false);
  });

  it('does not fail when the HUD is not up (resolves, no flash)', async () => {
    await expect(
      s.overlay.showTurnBanner({ name: 'Alex', team: 'PAST', shot: 1 }),
    ).resolves.toBeUndefined();
  });

  it('is hidden above a cover, with the rest of the board', () => {
    show();
    void s.overlay.showPassScreen({ nextName: 'Sam', nextTeam: 'FUTURE' });
    const hud = q(TEST_IDS.turnBanner)!.closest<HTMLElement>('[data-layer="hud"]')!;
    expect(hud.style.visibility).toBe('hidden');
  });
});

describe('HUD', () => {
  it('draws the controls: angle, power, fire, wind, hp, scrap, shots left', () => {
    s.overlay.showHud(handlers());
    s.overlay.updateHud(state());
    expect(q<HTMLInputElement>(TEST_IDS.angleControl)!.type).toBe('range');
    expect(q<HTMLInputElement>(TEST_IDS.powerControl)!.type).toBe('range');
    expect(q<HTMLInputElement>(TEST_IDS.angleControl)!.min).toBe(String(AIM.angleMinDeg));
    expect(q<HTMLInputElement>(TEST_IDS.angleControl)!.max).toBe(String(AIM.angleMaxDeg));
    expect(q<HTMLInputElement>(TEST_IDS.powerControl)!.max).toBe(String(AIM.powerMax));
    expect(q<HTMLInputElement>(TEST_IDS.angleControl)!.value).toBe('45');
    expect(q<HTMLInputElement>(TEST_IDS.powerControl)!.value).toBe('60');
    expect(q(TEST_IDS.fireButton)!.textContent).toBe(HUD.fire);
    expect(q(TEST_IDS.wind)!.textContent).toBe(windLabel(-12));
    expect(q(TEST_IDS.baseHp('PAST'))!.textContent).toContain(HUD.hpValue(100));
    expect(q(TEST_IDS.baseHp('FUTURE'))!.textContent).toContain(HUD.hpValue(75));
    expect(q(TEST_IDS.shotsLeft)!.textContent).toContain(HUD.shotsValue(2));
    expect(q('hud-scrap-PAST')!.textContent).toContain('3');
  });

  it('shows value readouts and labels as text', () => {
    s.overlay.showHud(handlers());
    s.overlay.updateHud(state());
    const text = document.body.textContent!;
    expect(text).toContain(HUD.angleValue(45));
    expect(text).toContain(HUD.powerValue(60));
    expect(text).toContain(HUD.keyboardHint);
  });

  it('wind uses words and arrows, not color alone (calm, left, right)', () => {
    s.overlay.showHud(handlers());
    s.overlay.updateHud(state({ wind: 0 }));
    expect(q(TEST_IDS.wind)!.textContent).toBe('Wind: calm');
    s.overlay.updateHud(state({ wind: 30 }));
    expect(q(TEST_IDS.wind)!.textContent).toBe('Wind: windy →→ (30)');
  });

  it('shows a wind bar that fills with the strength and says which way it blows', () => {
    s.overlay.showHud(handlers());
    s.overlay.updateHud(state({ wind: 40 }));
    const bar = q(TEST_IDS.wind)!.querySelector<HTMLElement>('.tc-wind-fill')!;
    expect(bar.getAttribute('data-dir')).toBe('right');
    expect(bar.style.width).toBe('50%');
    s.overlay.updateHud(state({ wind: -80 }));
    expect(bar.getAttribute('data-dir')).toBe('left');
    expect(bar.style.width).toBe('100%');
    s.overlay.updateHud(state({ wind: 0 }));
    expect(bar.style.width).toBe('0%');
  });

  it('shows a third gold star pip and Power Shot text only while the bonus is up', () => {
    s.overlay.showHud({
      onAim: () => {},
      onFire: () => {},
      onSelect: () => {},
      onMuteToggle: () => {},
    });
    s.overlay.updateHud(state({ shotsLeft: 0, bonus: true }));
    expect(q(TEST_IDS.shotsLeft)!.textContent).toContain(HUD.powerShot);
    expect(document.querySelectorAll('.tc-pip-bonus')).toHaveLength(1);
    s.overlay.updateHud(state({ shotsLeft: 1, bonus: false }));
    expect(document.querySelectorAll('.tc-pip-bonus')).toHaveLength(0);
  });

  it('health bars are meters with numbers', () => {
    s.overlay.showHud(handlers());
    s.overlay.updateHud(state());
    const meter = q(TEST_IDS.baseHp('FUTURE'))!.querySelector(
      '[role="meter"], progress, [role="progressbar"]',
    )!;
    expect(
      meter.getAttribute('aria-valuenow') ?? (meter as HTMLProgressElement).value.toString(),
    ).toBe('75');
  });

  it('updates in place (no duplicate controls)', () => {
    s.overlay.showHud(handlers());
    s.overlay.updateHud(state());
    s.overlay.updateHud(state({ angleDeg: 80, shotsLeft: 1 }));
    expect(qa(`[data-testid="${TEST_IDS.fireButton}"]`)).toHaveLength(1);
    expect(q<HTMLInputElement>(TEST_IDS.angleControl)!.value).toBe('80');
    expect(q(TEST_IDS.shotsLeft)!.textContent).toContain(HUD.shotsValue(1));
  });

  it('showHud twice does not double up', () => {
    s.overlay.showHud(handlers());
    s.overlay.showHud(handlers());
    expect(qa(`[data-testid="${TEST_IDS.fireButton}"]`)).toHaveLength(1);
  });

  it('fire button calls onFire; disabled when canFire is false', () => {
    const h = handlers();
    s.overlay.showHud(h);
    s.overlay.updateHud(state());
    click(q(TEST_IDS.fireButton));
    expect(h.calls).toEqual(['fire']);
    s.overlay.updateHud(state({ canFire: false }));
    expect(q<HTMLButtonElement>(TEST_IDS.fireButton)!.disabled).toBe(true);
    click(q(TEST_IDS.fireButton));
    expect(h.calls).toEqual(['fire']);
  });

  it('dragging a slider reports both angle and power', () => {
    const h = handlers();
    s.overlay.showHud(h);
    s.overlay.updateHud(state());
    const angle = q<HTMLInputElement>(TEST_IDS.angleControl)!;
    angle.value = '70';
    angle.dispatchEvent(new Event('input', { bubbles: true }));
    expect(h.aims.at(-1)).toEqual({ angleDeg: 70, power: 60 });
    const power = q<HTMLInputElement>(TEST_IDS.powerControl)!;
    power.value = '90';
    power.dispatchEvent(new Event('input', { bubbles: true }));
    expect(h.aims.at(-1)).toEqual({ angleDeg: 70, power: 90 });
  });

  it('the Mute button calls its handler', () => {
    const h = handlers();
    s.overlay.showHud(h);
    s.overlay.updateHud(state());
    click(q('hud-mute'));
    expect(h.calls).toEqual(['mute']);
  });

  it('has no How to Play (?) button of its own. The global chrome row owns it', () => {
    s.overlay.showHud(handlers());
    s.overlay.updateHud(state());
    expect(q(TEST_IDS.howToPlay)).toBeNull();
  });

  it('mute button text follows the settings', () => {
    s.overlay.showHud(handlers());
    expect(q('hud-mute')!.textContent).toBe(BUTTONS.soundOn);
    s.overlay.applySettings({ ...s.settings, muted: true });
    expect(q('hud-mute')!.textContent).toBe(BUTTONS.soundOff);
  });

  it('hideHud removes it and its key handler', () => {
    const h = handlers();
    s.overlay.showHud(h);
    s.overlay.updateHud(state());
    s.overlay.hideHud();
    expect(q(TEST_IDS.fireButton)).toBeNull();
    key(document.body, ' ');
    expect(h.calls).toEqual([]);
  });

  it('updateHud before showHud does nothing and does not throw', () => {
    expect(() => s.overlay.updateHud(state())).not.toThrow();
  });

  it('puts names in as text only', () => {
    s.overlay.showHud(handlers());
    s.overlay.updateHud(state({ names: { PAST: '<u>A</u>', FUTURE: 'S' } }));
    expect(document.querySelector('u')).toBeNull();
  });

  it('marks the active team and dims the waiting side with a label, not color alone', () => {
    s.overlay.showHud(handlers());
    s.overlay.updateHud(state({ activeTeam: 'FUTURE' }));
    expect(
      q(TEST_IDS.baseHp('FUTURE'))!.closest('[data-active]')!.getAttribute('data-active'),
    ).toBe('true');
    expect(q(TEST_IDS.baseHp('PAST'))!.closest('[data-active]')!.getAttribute('data-active')).toBe(
      'false',
    );
  });
});

describe('HUD keyboard', () => {
  const ready = () => {
    const h = handlers();
    s.overlay.showHud(h);
    s.overlay.updateHud(state());
    return h;
  };

  it('Up and Down change the angle by the fine step', () => {
    const h = ready();
    key(document.body, 'ArrowUp');
    expect(h.aims.at(-1)).toEqual({ angleDeg: 45 + AIM.stepFine, power: 60 });
    key(document.body, 'ArrowDown');
    expect(h.aims.at(-1)).toEqual({ angleDeg: 45, power: 60 });
  });

  it('Right and Left change the power; Shift uses the coarse step', () => {
    const h = ready();
    key(document.body, 'ArrowRight', { shiftKey: true });
    expect(h.aims.at(-1)).toEqual({ angleDeg: 45, power: 60 + AIM.stepCoarse });
    key(document.body, 'ArrowLeft');
    expect(h.aims.at(-1)).toEqual({ angleDeg: 45, power: 60 + AIM.stepCoarse - AIM.stepFine });
  });

  it('clamps at the ends', () => {
    const h = handlers();
    s.overlay.showHud(h);
    s.overlay.updateHud(state({ angleDeg: AIM.angleMaxDeg, power: AIM.powerMin }));
    key(document.body, 'ArrowUp');
    key(document.body, 'ArrowLeft');
    expect(h.aims.at(-1)).toEqual({ angleDeg: AIM.angleMaxDeg, power: AIM.powerMin });
  });

  it('Space fires from the page, and only when firing is allowed', () => {
    const h = ready();
    const e = key(document.body, ' ');
    expect(h.calls).toEqual(['fire']);
    expect(e.defaultPrevented).toBe(true);
    s.overlay.updateHud(state({ canFire: false }));
    key(document.body, ' ');
    expect(h.calls).toEqual(['fire']);
  });

  it('Space on the Fire button fires once (the button click does it, not the page)', () => {
    const h = ready();
    key(q(TEST_IDS.fireButton)!, ' ');
    expect(h.calls).toEqual([]);
  });

  it('arrow keys in a slider are left to the slider', () => {
    const h = ready();
    key(q(TEST_IDS.angleControl)!, 'ArrowUp');
    expect(h.aims).toEqual([]);
  });

  it('Space on an angle or power slider fires (a range input does not use Space itself)', () => {
    const h = ready();
    const e = key(q(TEST_IDS.angleControl)!, ' ');
    key(q(TEST_IDS.powerControl)!, ' ');
    expect(h.calls).toEqual(['fire', 'fire']);
    expect(e.defaultPrevented).toBe(true);
  });

  it('keys do nothing while the game is paused', () => {
    const h = ready();
    document.body.dataset.paused = 'true';
    key(document.body, ' ');
    key(q(TEST_IDS.angleControl)!, ' ');
    key(document.body, 'ArrowUp');
    expect(h.calls).toEqual([]);
    expect(h.aims).toEqual([]);
    delete document.body.dataset.paused;
  });

  it('focus moves to the HUD itself when the focused slider is switched off', () => {
    ready();
    const slider = q<HTMLInputElement>(TEST_IDS.angleControl)!;
    slider.focus();
    expect(document.activeElement).toBe(slider);
    s.overlay.updateHud(state({ canFire: false }));
    expect(document.activeElement).toBe(document.querySelector('.tc-hud'));
  });

  it('says whose turn it is in text, not only with a marker', () => {
    ready();
    s.overlay.updateHud(state({ activeTeam: 'FUTURE' }));
    const pastText = q(TEST_IDS.baseHp('PAST'))!.closest('[data-team]')!.textContent;
    const futureText = q(TEST_IDS.baseHp('FUTURE'))!.closest('[data-team]')!.textContent;
    expect(futureText).toContain(HUD.yourTurn);
    expect(pastText).not.toContain(HUD.yourTurn);
  });

  it('announces shots left politely', () => {
    ready();
    expect(q(TEST_IDS.shotsLeft)!.getAttribute('aria-live')).toBe('polite');
  });

  it('ignores keys while a cover is up', () => {
    const h = ready();
    void s.overlay.showPassScreen({ nextName: 'Sam', nextTeam: 'FUTURE' });
    key(document.body, ' ');
    key(document.body, 'ArrowUp');
    expect(h.calls).toEqual([]);
    expect(h.aims).toEqual([]);
  });

  it('ignores keys with ctrl or meta held (browser shortcuts)', () => {
    const h = ready();
    key(document.body, ' ', { ctrlKey: true });
    key(document.body, 'ArrowUp', { metaKey: true });
    expect(h.calls).toEqual([]);
    expect(h.aims).toEqual([]);
  });
});

describe('captions', () => {
  it('shows text in the caption bar and clears it', () => {
    s.overlay.setCaption('Hello there!');
    const bar = q(TEST_IDS.captionBar)!;
    expect(bar.textContent).toBe('Hello there!');
    expect(bar.hidden).toBe(false);
    s.overlay.setCaption(null);
    expect(bar.hidden).toBe(true);
    expect(bar.textContent).toBe('');
  });

  it('is hidden when captions are off, and comes back when turned on', () => {
    s.overlay.applySettings({ ...s.settings, captions: false });
    s.overlay.setCaption('Hello there!');
    expect(q(TEST_IDS.captionBar)!.hidden).toBe(true);
    s.overlay.applySettings({ ...s.settings, captions: true });
    expect(q(TEST_IDS.captionBar)!.hidden).toBe(false);
    expect(q(TEST_IDS.captionBar)!.textContent).toBe('Hello there!');
  });

  it('is text only', () => {
    s.overlay.setCaption('<b>x</b>');
    expect(q(TEST_IDS.captionBar)!.querySelector('b')).toBeNull();
  });

  it('is a polite live region off by default so it does not talk over the voice', () => {
    expect(q(TEST_IDS.captionBar)!.getAttribute('aria-live')).toBe('off');
  });

  it('empty string counts as no caption', () => {
    s.overlay.setCaption('');
    expect(q(TEST_IDS.captionBar)!.hidden).toBe(true);
  });
});

describe('speech bubble', () => {
  it('maps world coordinates onto the canvas rectangle', () => {
    vi.spyOn(s.canvas, 'getBoundingClientRect').mockReturnValue({
      left: 100,
      top: 50,
      width: 640,
      height: 360,
      right: 740,
      bottom: 410,
      x: 100,
      y: 50,
      toJSON: () => ({}),
    });
    s.overlay.showSpeechBubble({ text: 'Boing!', team: 'PAST', anchor: { x: 640, y: 360 } });
    const b = q(TEST_IDS.speechBubble)!;
    expect(b.textContent).toBe('Boing!');
    expect(b.style.left).toBe('420px');
    expect(b.style.top).toBe('230px');
  });

  it('goes away after its duration, default bubbleHoldMs', () => {
    s.overlay.showSpeechBubble({ text: 'Hi', team: 'PAST', anchor: { x: 0, y: 0 } });
    s.clock.advance(TIMING.bubbleHoldMs - 1);
    expect(q(TEST_IDS.speechBubble)).not.toBeNull();
    s.clock.advance(1);
    expect(q(TEST_IDS.speechBubble)).toBeNull();
  });

  it('a long line stays up longer, about 400 ms a word, so a slow reader can finish', () => {
    const text = 'Just checking the lawn for four-leaf clovers today!'; // 8 words
    const words = text.split(' ').length;
    const hold = Math.max(TIMING.bubbleHoldMs, words * TIMING.bubbleMsPerWord);
    expect(hold).toBeGreaterThan(TIMING.bubbleHoldMs);
    s.overlay.showSpeechBubble({ text, team: 'PAST', anchor: { x: 0, y: 0 } });
    s.clock.advance(hold - 1);
    expect(q(TEST_IDS.speechBubble)).not.toBeNull();
    s.clock.advance(1);
    expect(q(TEST_IDS.speechBubble)).toBeNull();
  });

  it('every tumble line stays up at least 400 ms per word', () => {
    for (const line of [...tumblePool('PAST'), ...tumblePool('FUTURE')]) {
      const sx = setup();
      sx.overlay.showSpeechBubble({ text: line, team: 'PAST', anchor: { x: 0, y: 0 } });
      sx.clock.advance(line.split(' ').length * TIMING.bubbleMsPerWord - 1);
      expect(document.querySelector('[data-testid="speech-bubble"]'), line).not.toBeNull();
    }
  });

  it('respects a custom duration', () => {
    s.overlay.showSpeechBubble({
      text: 'Hi',
      team: 'PAST',
      anchor: { x: 0, y: 0 },
      durationMs: 500,
    });
    s.clock.advance(500);
    expect(q(TEST_IDS.speechBubble)).toBeNull();
  });

  it('a new bubble from the same team replaces the old one', () => {
    s.overlay.showSpeechBubble({ text: 'One', team: 'PAST', anchor: { x: 0, y: 0 } });
    s.overlay.showSpeechBubble({ text: 'Two', team: 'PAST', anchor: { x: 0, y: 0 } });
    const all = qa(`[data-testid="${TEST_IDS.speechBubble}"]`);
    expect(all).toHaveLength(1);
    expect(all[0]!.textContent).toBe('Two');
  });

  it('the old bubble timer does not remove the new bubble', () => {
    s.overlay.showSpeechBubble({
      text: 'One',
      team: 'PAST',
      anchor: { x: 0, y: 0 },
      durationMs: 1000,
    });
    s.clock.advance(500);
    s.overlay.showSpeechBubble({
      text: 'Two',
      team: 'PAST',
      anchor: { x: 0, y: 0 },
      durationMs: 1000,
    });
    s.clock.advance(600);
    expect(q(TEST_IDS.speechBubble)!.textContent).toBe('Two');
  });

  it('both teams can talk at once', () => {
    s.overlay.showSpeechBubble({ text: 'One', team: 'PAST', anchor: { x: 0, y: 0 } });
    s.overlay.showSpeechBubble({ text: 'Two', team: 'FUTURE', anchor: { x: 0, y: 0 } });
    expect(qa(`[data-testid="${TEST_IDS.speechBubble}"]`)).toHaveLength(2);
  });

  it('is text only and has a status role', () => {
    s.overlay.showSpeechBubble({ text: '<b>x</b>', team: 'PAST', anchor: { x: 0, y: 0 } });
    const b = q(TEST_IDS.speechBubble)!;
    expect(b.querySelector('b')).toBeNull();
    expect(b.getAttribute('role')).toBe('status');
  });

  it('works with no canvas (uses the viewport)', () => {
    const t = setup();
    t.overlay.mount(t.root, null);
    expect(() =>
      t.overlay.showSpeechBubble({ text: 'Hi', team: 'FUTURE', anchor: { x: 640, y: 360 } }),
    ).not.toThrow();
  });
});

describe('layers', () => {
  it('stacks layers in the contract z-order', () => {
    const z = (name: string) =>
      Number(document.querySelector<HTMLElement>(`[data-layer="${name}"]`)!.style.zIndex);
    expect(z('hud')).toBe(Z.hud);
    expect(z('bubble')).toBe(Z.bubble);
    expect(z('banner')).toBe(Z.banner);
    expect(z('caption')).toBe(Z.caption);
    expect(z('screen')).toBe(Z.screen);
    expect(z('cover')).toBe(Z.cover);
  });
});

describe('speech bubble tail', () => {
  const box = () =>
    vi.spyOn(s.canvas, 'getBoundingClientRect').mockReturnValue({
      left: 100,
      top: 50,
      width: 640,
      height: 360,
      right: 740,
      bottom: 410,
      x: 100,
      y: 50,
      toJSON: () => ({}),
    });

  it('points the tail at the speaker: the shift is the speaker offset from the bubble center', () => {
    box();
    s.overlay.showSpeechBubble({
      text: 'Boing!',
      team: 'PAST',
      anchor: { x: 640, y: 360 },
      tailTarget: { x: 500, y: 600 },
    });
    const b = q(TEST_IDS.speechBubble)!;
    // 140 world units left of the bubble center, drawn at half scale (640 / 1280).
    expect(b.style.getPropertyValue('--tc-tail-shift')).toBe('-70px');
  });

  it('keeps the old centered tail when no target is given', () => {
    box();
    s.overlay.showSpeechBubble({ text: 'Hi', team: 'FUTURE', anchor: { x: 640, y: 360 } });
    expect(q(TEST_IDS.speechBubble)!.style.getPropertyValue('--tc-tail-shift')).toBe('');
  });
});

describe('HUD bar and coach line', () => {
  it('puts the team on the strip and on the bar, so the team shows as a shape and in words', () => {
    s.overlay.showHud(handlers());
    s.overlay.updateHud(state({ activeTeam: 'PAST' }));
    expect(document.querySelector('.tc-aim')!.getAttribute('data-team')).toBe('PAST');
    s.overlay.updateHud(state({ activeTeam: 'FUTURE' }));
    expect(document.querySelector('.tc-aim')!.getAttribute('data-team')).toBe('FUTURE');
    expect(document.querySelector('.tc-turn-strip')!.getAttribute('data-team')).toBe('FUTURE');
  });

  it('has no separate shots panel and no header inside the bar', () => {
    s.overlay.showHud(handlers());
    s.overlay.updateHud(state());
    expect(document.querySelector('.tc-hud-center')).toBeNull();
    expect(document.querySelector('.tc-aim-head')).toBeNull();
    // The shot count is still read out for assistive tech.
    expect(q(TEST_IDS.shotsLeft)!.classList.contains('tc-sr-only')).toBe(true);
  });

  it('shows a coach line that teaches the sliders, and keeps the key help for screen readers', () => {
    s.overlay.showHud(handlers());
    s.overlay.updateHud(state());
    const hint = document.querySelector<HTMLElement>('.tc-hint')!;
    expect(hint.hidden).toBe(false);
    expect(hint.textContent).toContain(HUD.coach);
    expect(hint.textContent).toContain(HUD.keyboardHint);
    expect(hint.querySelector('.tc-sr-only')!.textContent).toContain(HUD.keyboardHint);
    expect(HUD.coach).toBe('Slide Angle and Power. Then press Fire!');
  });

  it('hides the coach line after the first Fire tap, and keeps it hidden next turn', () => {
    const h = handlers();
    s.overlay.showHud(h);
    s.overlay.updateHud(state());
    click(q(TEST_IDS.fireButton));
    expect(h.calls).toEqual(['fire']);
    expect(document.querySelector<HTMLElement>('.tc-hint')!.hidden).toBe(true);
    s.overlay.hideHud();
    s.overlay.showHud(h);
    s.overlay.updateHud(state());
    expect(document.querySelector<HTMLElement>('.tc-hint')!.hidden).toBe(true);
  });

  it('hides the coach line after the first Space fire too', () => {
    const h = handlers();
    s.overlay.showHud(h);
    s.overlay.updateHud(state());
    key(document.body, ' ');
    expect(h.calls).toEqual(['fire']);
    expect(document.querySelector<HTMLElement>('.tc-hint')!.hidden).toBe(true);
  });

  it('keeps the coach line when a fire is refused (not allowed to fire yet)', () => {
    const h = handlers();
    s.overlay.showHud(h);
    s.overlay.updateHud(state({ canFire: false }));
    key(document.body, ' ');
    expect(h.calls).toEqual([]);
    expect(document.querySelector<HTMLElement>('.tc-hint')!.hidden).toBe(false);
  });
});

describe('HUD health with a raised maximum (Rebuild the Tower)', () => {
  it('shows health out of 100 when no maximum is given (a fresh game)', () => {
    s.overlay.showHud(handlers());
    s.overlay.updateHud(state({ baseHp: { PAST: 100, FUTURE: 75 } }));
    expect(q(TEST_IDS.baseHp('PAST'))!.textContent).toContain('100 / 100');
    const meter = document.querySelector('[data-team="PAST"] [role="meter"]')!;
    expect(meter.getAttribute('aria-valuemax')).toBe('100');
  });

  it('shows health out of the raised maximum, and the bar is full at the maximum', () => {
    s.overlay.showHud(handlers());
    s.overlay.updateHud(
      state({ baseHp: { PAST: 124, FUTURE: 100 }, maxBaseHp: { PAST: 124, FUTURE: 100 } }),
    );
    expect(q(TEST_IDS.baseHp('PAST'))!.textContent).toContain('124 / 124');
    const meter = document.querySelector('[data-team="PAST"] [role="meter"]')!;
    expect(meter.getAttribute('aria-valuemax')).toBe('124');
    expect(meter.getAttribute('aria-valuenow')).toBe('124');
    expect(meter.querySelector<HTMLElement>('.tc-hp-fill')!.style.width).toBe('100%');
  });

  it('scales the bar to the maximum when hurt', () => {
    s.overlay.showHud(handlers());
    s.overlay.updateHud(
      state({ baseHp: { PAST: 62, FUTURE: 100 }, maxBaseHp: { PAST: 124, FUTURE: 100 } }),
    );
    const fill = document.querySelector<HTMLElement>('[data-team="PAST"] .tc-hp-fill')!;
    expect(fill.style.width).toBe('50%');
  });

  it('never shows more than the maximum, and never below zero', () => {
    s.overlay.showHud(handlers());
    s.overlay.updateHud(
      state({ baseHp: { PAST: 999, FUTURE: -5 }, maxBaseHp: { PAST: 112, FUTURE: 100 } }),
    );
    expect(q(TEST_IDS.baseHp('PAST'))!.textContent).toContain('112 / 112');
    expect(q(TEST_IDS.baseHp('FUTURE'))!.textContent).toContain('0 / 100');
  });
});
