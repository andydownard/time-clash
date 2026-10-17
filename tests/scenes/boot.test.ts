// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { bootApp } from '../../src/scenes/boot';
import { makeServices } from './fakes';

const setHidden = (hidden: boolean): void => {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
  document.dispatchEvent(new Event('visibilitychange'));
};

afterEach(() => {
  document.querySelectorAll('[data-tc-chrome]').forEach((e) => e.remove());
  setHidden(false);
});

describe('bootApp: sound keeps working', () => {
  it('rests the sound when the page is hidden, and wakes it when it is back', () => {
    const t = makeServices();
    const calls: boolean[] = [];
    t.services.audio.setPageHidden = (h) => void calls.push(h);
    bootApp(t.services, document, document.querySelector('canvas'));
    setHidden(true);
    setHidden(false);
    expect(calls).toEqual([true, false]);
  });

  it('a tap after the first one asks the sound to wake up again', () => {
    const t = makeServices();
    const unlock = vi.fn(() => Promise.resolve());
    t.services.audio.unlock = unlock;
    Object.defineProperty(t.services.audio, 'unlocked', { configurable: true, get: () => true });
    bootApp(t.services, document, document.querySelector('canvas'));
    document.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(unlock).toHaveBeenCalledTimes(1);
  });

  it('the first tap or key press anywhere unlocks the sound, so no Tap to Play screen is needed', () => {
    const t = makeServices();
    const unlock = vi.fn(() => Promise.resolve());
    t.services.audio.unlock = unlock;
    bootApp(t.services, document, document.querySelector('canvas'));
    document.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(unlock).toHaveBeenCalledTimes(1);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
    expect(unlock).toHaveBeenCalledTimes(2);
  });

  it('but with no tap or key press, nothing unlocks and no sound can start', () => {
    const t = makeServices();
    const unlock = vi.fn(() => Promise.resolve());
    t.services.audio.unlock = unlock;
    bootApp(t.services, document, document.querySelector('canvas'));
    expect(unlock).not.toHaveBeenCalled();
    expect(t.audio.unlocked).toBe(false);
  });
});
