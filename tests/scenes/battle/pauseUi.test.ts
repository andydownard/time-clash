// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BUTTONS } from '../../../src/data/copy';
import { UI } from '../../../src/game/config';
import { createPauseControl } from '../../../src/scenes/battle/pauseUi';

const q = (id: string): HTMLElement | null => document.querySelector(`[data-testid="${id}"]`);

beforeEach(() => {
  document.body.innerHTML = '';
  document.head.innerHTML = '';
  delete document.body.dataset.cover;
});

describe('pause control: modal behavior', () => {
  it('marks the page paused, and makes the HUD inert, while the panel is open', () => {
    const hud = document.createElement('div');
    hud.dataset.layer = 'hud';
    document.body.append(hud);
    const c = createPauseControl(document, { onPause: vi.fn(), onResume: vi.fn() });
    c.pause();
    expect(document.body.dataset.paused).toBe('true');
    expect(hud.hasAttribute('inert')).toBe(true);
    c.resume();
    expect(document.body.dataset.paused).toBeUndefined();
    expect(hud.hasAttribute('inert')).toBe(false);
  });

  it('keeps Tab inside the panel', () => {
    const c = createPauseControl(document, { onPause: vi.fn(), onResume: vi.fn() });
    c.pause();
    const resume = q('pause-resume')!;
    resume.focus();
    const e = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    resume.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(true);
  });

  it('ignores Escape while the Settings panel is open', () => {
    const onPause = vi.fn();
    createPauseControl(document, { onPause, onResume: vi.fn() });
    const settings = document.createElement('section');
    settings.dataset.testid = 'settings-panel';
    settings.setAttribute('data-testid', 'settings-panel');
    document.body.append(settings);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(onPause).not.toHaveBeenCalled();
  });

  it('destroy while paused clears the paused mark', () => {
    const c = createPauseControl(document, { onPause: vi.fn(), onResume: vi.fn() });
    c.pause();
    c.destroy();
    expect(document.body.dataset.paused).toBeUndefined();
  });
});

describe('pause control', () => {
  it('adds a Pause button with the copy.ts label and a 56px tap target', () => {
    createPauseControl(document, { onPause: vi.fn(), onResume: vi.fn() });
    const b = q('pause') as HTMLButtonElement;
    expect(b.tagName).toBe('BUTTON');
    expect(b.textContent).toBe(BUTTONS.pause);
    expect(parseInt(b.style.minHeight, 10)).toBeGreaterThanOrEqual(UI.tapTargetMinPx);
    expect(q('pause-panel')).toBeNull();
  });

  it('pauses on click and resumes with Keep playing', () => {
    const onPause = vi.fn();
    const onResume = vi.fn();
    const c = createPauseControl(document, { onPause, onResume });
    q('pause')!.click();
    expect(onPause).toHaveBeenCalledTimes(1);
    expect(c.isPaused()).toBe(true);
    const panel = q('pause-panel')!;
    expect(panel.getAttribute('role')).toBe('dialog');
    const resume = q('pause-resume')!;
    expect(resume.textContent).toBe(BUTTONS.resume);
    resume.click();
    expect(onResume).toHaveBeenCalledTimes(1);
    expect(c.isPaused()).toBe(false);
    expect(q('pause-panel')).toBeNull();
  });

  it('Escape toggles pause', () => {
    const onPause = vi.fn();
    const onResume = vi.fn();
    createPauseControl(document, { onPause, onResume });
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(onPause).toHaveBeenCalledTimes(1);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(onResume).toHaveBeenCalledTimes(1);
  });

  it('does not pause twice or resume when not paused', () => {
    const onPause = vi.fn();
    const onResume = vi.fn();
    const c = createPauseControl(document, { onPause, onResume });
    c.resume();
    expect(onResume).not.toHaveBeenCalled();
    c.pause();
    c.pause();
    expect(onPause).toHaveBeenCalledTimes(1);
  });

  it('ignores Escape while a cover (pass screen or reload) is up', () => {
    const onPause = vi.fn();
    createPauseControl(document, { onPause, onResume: vi.fn() });
    document.body.dataset.cover = 'reload';
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(onPause).not.toHaveBeenCalled();
  });

  it('hides the button under a cover with CSS', () => {
    createPauseControl(document, { onPause: vi.fn(), onResume: vi.fn() });
    const css = [...document.querySelectorAll('style')].map((s) => s.textContent).join('');
    expect(css).toContain('body[data-cover]');
    expect(css).toContain('display: none');
  });

  it('destroy removes the button, panel, style and key listener', () => {
    const onPause = vi.fn();
    const c = createPauseControl(document, { onPause, onResume: vi.fn() });
    c.pause();
    c.destroy();
    expect(q('pause')).toBeNull();
    expect(q('pause-panel')).toBeNull();
    expect(document.querySelectorAll('style')).toHaveLength(0);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(onPause).toHaveBeenCalledTimes(1);
  });

  it('puts text in with textContent, never markup', () => {
    createPauseControl(document, { onPause: vi.fn(), onResume: vi.fn() });
    expect(document.querySelectorAll('[data-tc-pause] img, [data-tc-pause] script')).toHaveLength(
      0,
    );
  });
});

describe('Leave game', () => {
  const open = (onLeave?: () => void) => {
    const onResume = vi.fn();
    const c = createPauseControl(document, {
      onPause: vi.fn(),
      onResume,
      ...(onLeave ? { onLeave } : {}),
    });
    c.pause();
    return { c, onResume };
  };

  it('is not offered when nothing can handle it', () => {
    open();
    expect(q('pause-leave')).toBeNull();
    expect(q('pause-resume')).not.toBeNull();
  });

  it('is offered next to Keep playing when it can be handled', () => {
    open(vi.fn());
    expect(q('pause-resume')).not.toBeNull();
    expect(q('pause-leave')).not.toBeNull();
    expect(q('pause-leave')!.textContent).toBe('Leave game');
  });

  it('asks first, and focuses the safe choice (Stay), so a stray key cannot end the game', () => {
    const onLeave = vi.fn();
    open(onLeave);
    (q('pause-leave') as HTMLElement).click();
    expect(onLeave).not.toHaveBeenCalled();
    expect(document.querySelector('#tc-pause-heading')!.textContent).toBe('Leave this game?');
    expect(document.body.textContent).toContain('Your match will end.');
    expect(document.activeElement).toBe(q('pause-stay'));
  });

  it('Stay goes back to the pause choices and leaves nothing', () => {
    const onLeave = vi.fn();
    open(onLeave);
    (q('pause-leave') as HTMLElement).click();
    (q('pause-stay') as HTMLElement).click();
    expect(onLeave).not.toHaveBeenCalled();
    expect(document.querySelector('#tc-pause-heading')!.textContent).toBe('Pause');
    expect(q('pause-resume')).not.toBeNull();
    expect(document.activeElement).toBe(q('pause-resume'));
  });

  it('Leave game on the question leaves, once', () => {
    const onLeave = vi.fn();
    open(onLeave);
    (q('pause-leave') as HTMLElement).click();
    (q('pause-leave-yes') as HTMLElement).click();
    expect(onLeave).toHaveBeenCalledTimes(1);
  });

  it('every button is a real button of at least 56px', () => {
    open(vi.fn());
    (q('pause-leave') as HTMLElement).click();
    for (const id of ['pause-stay', 'pause-leave-yes']) {
      const b = q(id) as HTMLButtonElement;
      expect(b.tagName).toBe('BUTTON');
      expect(parseInt(b.style.minHeight, 10)).toBeGreaterThanOrEqual(56);
    }
  });

  it('Keep playing still resumes the match', () => {
    const { onResume } = open(vi.fn());
    (q('pause-resume') as HTMLElement).click();
    expect(onResume).toHaveBeenCalledTimes(1);
    expect(q('pause-panel')).toBeNull();
  });
});
