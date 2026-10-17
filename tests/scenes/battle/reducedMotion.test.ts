import { describe, expect, it } from 'vitest';
import { sceneReducedMotion } from '../../../src/scenes/battle/reducedMotion';
import { SERVICES_KEY } from '../../../src/scenes/registry';

const win = (matches: boolean) => ({ matchMedia: () => ({ matches }) as MediaQueryList });
const registry = (setting: 'system' | 'on' | 'off' | undefined) => ({
  get: (k: string) =>
    k === SERVICES_KEY
      ? {
          storage: {
            get: (key: string) =>
              key === 'timeclash.settings' && setting
                ? { muted: false, volume: 1, captions: true, musicOn: true, reducedMotion: setting }
                : undefined,
          },
        }
      : undefined,
});

describe('sceneReducedMotion', () => {
  it('follows the saved setting when it is on or off', () => {
    expect(sceneReducedMotion(registry('on'), win(false))).toBe(true);
    expect(sceneReducedMotion(registry('off'), win(true))).toBe(false);
  });
  it('asks the browser when the setting is system', () => {
    expect(sceneReducedMotion(registry('system'), win(true))).toBe(true);
    expect(sceneReducedMotion(registry('system'), win(false))).toBe(false);
  });
  it('asks the browser when there are no services or no saved settings', () => {
    expect(sceneReducedMotion({ get: () => undefined }, win(true))).toBe(true);
    expect(sceneReducedMotion(registry(undefined), win(false))).toBe(false);
  });
  it('is false when nothing can be read at all', () => {
    expect(sceneReducedMotion({ get: () => undefined }, undefined)).toBe(false);
    const boom = {
      matchMedia: () => {
        throw new Error('blocked');
      },
    };
    expect(sceneReducedMotion({ get: () => undefined }, boom as never)).toBe(false);
  });
});
