// @vitest-environment jsdom
// Runs the real scene classes against a stand-in for Phaser's scene manager, with the real
// overlay, audio manager and storage. This is the whole front-of-house flow, minus a canvas.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => {
  class Scene {
    key: string;
    constructor(key: string) {
      this.key = key;
    }
  }
  return { default: { Scene } };
});

import { LOADING } from '../../src/data/copy';
import { SCENE_KEYS, SERVICES_KEY, type SceneKey } from '../../src/scenes/registry';
import { BootScene } from '../../src/scenes/BootScene';
import { CampScene } from '../../src/scenes/CampScene';
import { IntroScene } from '../../src/scenes/IntroScene';
import { LoadingScene } from '../../src/scenes/LoadingScene';
import { SetupScene } from '../../src/scenes/SetupScene';
import { TapToStartScene } from '../../src/scenes/TapToStartScene';
import { VictoryScene } from '../../src/scenes/VictoryScene';
import type { BattleSceneData } from '../../src/scenes/battle/types';
import { TEST_IDS } from '../../src/ui/types';
import { click, flush, q } from '../ui/helpers';
import { fakeController, makeServices, players } from './fakes';

// Heavy under CPU load (a full run, or a build running beside it): a longer limit for this file only.
vi.setConfig({ testTimeout: 120_000 });

type FakeScene = {
  key: string;
  create(data?: unknown): void;
  events: { once(name: string, fn: () => void): void; emit(name: string): void };
  scene: { start(key: string, data?: unknown): void };
  registry: { get(k: string): unknown };
  add: { graphics(): unknown };
  game: { canvas: HTMLCanvasElement };
  cameras: { main: { setBackgroundColor(c: number): void } };
  controller?: unknown;
};

const graphicsStub = () => {
  const g: Record<string, unknown> = {};
  for (const m of ['fillStyle', 'fillRect', 'fillCircle', 'fillTriangle', 'setDepth'])
    g[m] = () => g;
  return g;
};

let t: ReturnType<typeof makeServices>;
let started: Array<{ key: string; data?: unknown }>;
let live: Map<string, FakeScene & { shutdownFns: Array<() => void> }>;

/** Builds a scene the way Phaser would: events, a scene manager, a registry. */
function launch(Ctor: new () => unknown, data?: unknown) {
  const scene = new Ctor() as FakeScene & { shutdownFns: Array<() => void> };
  scene.shutdownFns = [];
  scene.events = {
    once: (name, fn) => {
      if (name === 'shutdown') scene.shutdownFns.push(fn);
    },
    emit: (name) => {
      if (name === 'shutdown') scene.shutdownFns.splice(0).forEach((f) => f());
    },
  };
  scene.scene = { start: (key, d) => void started.push({ key, data: d }) };
  scene.registry = { get: (k) => (k === SERVICES_KEY ? t.services : undefined) };
  scene.add = { graphics: graphicsStub };
  scene.game = { canvas: document.querySelector('canvas')! };
  scene.cameras = { main: { setBackgroundColor: () => undefined } };
  live.set(scene.key, scene);
  scene.create(data);
  return scene;
}

beforeEach(() => {
  t = makeServices();
  started = [];
  live = new Map();
});
afterEach(() => {
  document.querySelectorAll('[data-tc-chrome]').forEach((e) => e.remove());
});

describe('scene keys', () => {
  it('each scene class uses its registered key', () => {
    const keys = [
      BootScene,
      TapToStartScene,
      IntroScene,
      LoadingScene,
      SetupScene,
      VictoryScene,
    ].map((C) => (new C() as unknown as { sceneKey: string }).sceneKey);
    expect(keys).toEqual([
      SCENE_KEYS.boot,
      SCENE_KEYS.tap,
      SCENE_KEYS.intro,
      SCENE_KEYS.loading,
      SCENE_KEYS.setup,
      SCENE_KEYS.victory,
    ]);
  });
});

describe('BootScene', () => {
  it('mounts the overlay and the buttons, then goes to the tap screen', () => {
    launch(BootScene);
    expect(document.querySelector('[data-tc-root]')).not.toBeNull();
    expect(q(TEST_IDS.howToPlay)).not.toBeNull();
    expect(started).toEqual([{ key: SCENE_KEYS.tap, data: undefined }]);
  });
  it('a returning family skips the tap screen: Loading, then the Camp', () => {
    t.storage.set('timeclash.introSeen', true);
    t.storage.set('timeclash.players', players);
    launch(BootScene);
    expect(started).toEqual([{ key: SCENE_KEYS.loading, data: { next: SCENE_KEYS.camp } }]);
  });
  it('a family that never saw the intro still gets the tap screen', () => {
    t.storage.set('timeclash.players', players);
    launch(BootScene);
    expect(started).toEqual([{ key: SCENE_KEYS.tap, data: undefined }]);
  });
  it('a family with the intro seen but no saved players gets the tap screen (it is a fresh start)', () => {
    t.storage.set('timeclash.introSeen', true);
    launch(BootScene);
    expect(started[0]!.key).toBe(SCENE_KEYS.tap);
  });
  it('is safe to run twice (no second set of buttons)', () => {
    launch(BootScene);
    launch(BootScene);
    expect(document.querySelectorAll(`[data-testid="${TEST_IDS.howToPlay}"]`).length).toBe(1);
  });
  it('applies saved settings (captions off stays off)', () => {
    t.storage.set('timeclash.settings', {
      muted: false,
      volume: 0.7,
      captions: false,
      musicOn: true,
      reducedMotion: 'system',
    });
    launch(BootScene);
    t.overlay.setCaption('hello');
    expect(q(TEST_IDS.captionBar)!.hidden).toBe(true);
  });
});

describe('the whole flow', () => {
  const next = async (): Promise<{ key: string; data?: unknown }> => {
    await flush();
    const n = started.shift();
    if (!n) throw new Error('no scene started');
    return n;
  };

  it('tap, intro, loading, setup, camp, then battle with a seeded setup', async () => {
    launch(TapToStartScene);
    await flush();
    expect(t.audio.unlocked).toBe(false);
    click(q(TEST_IDS.tapToPlay));
    expect((await next()).key).toBe(SCENE_KEYS.intro);

    launch(IntroScene);
    await flush();
    expect(t.howToOpened()).toBe(1);
    const afterIntro = await next();
    expect(afterIntro).toEqual({ key: SCENE_KEYS.loading, data: { next: SCENE_KEYS.setup } });

    launch(LoadingScene, afterIntro.data);
    await flush();
    t.clock.advance(4100);
    await flush();
    t.clock.advance(300);
    expect((await next()).key).toBe(SCENE_KEYS.setup);

    expect(t.services.session.bank).not.toBeNull();
    launch(SetupScene);
    click(q(TEST_IDS.setupNext));
    expect(await next()).toEqual({ key: SCENE_KEYS.camp });

    launch(CampScene);
    await flush();
    expect(q(TEST_IDS.campStart)).not.toBeNull();
    click(q(TEST_IDS.campStart));
    await flush();
    // The Battle Plan comes next. Lock it in! with the default plan starts the match.
    click(q(TEST_IDS.planGo));
    const battle = await next();
    expect(battle.key).toBe(SCENE_KEYS.battle);
    const data = battle.data as BattleSceneData;
    expect(data.match.snapshot().seed).toBe(1234);
    expect(data.match.snapshot().turn.team).toBe('PAST');
  });

  it('a returning family skips the intro', async () => {
    t.storage.set('timeclash.introSeen', true);
    launch(TapToStartScene);
    click(q(TEST_IDS.tapToPlay));
    expect((await next()).key).toBe(SCENE_KEYS.loading);
  });

  it('victory, rematch, loading, battle with the next seed', async () => {
    const c = fakeController();
    launch(VictoryScene, c);
    await flush();
    expect(q(TEST_IDS.victory)).not.toBeNull();
    click(q(TEST_IDS.rematch));
    const loading = await next();
    expect(loading.key).toBe(SCENE_KEYS.loading);

    launch(LoadingScene, loading.data);
    await flush();
    t.clock.advance(4100);
    await flush();
    t.clock.advance(300);
    const battle = await next();
    expect(battle.key).toBe(SCENE_KEYS.battle);
    const snap = (battle.data as BattleSceneData).match.snapshot();
    expect(snap.seed).toBe(c.rematchOptions().seed);
    expect(snap.turn.team).toBe('FUTURE');
  });

  it('victory, Back to Camp, returns to the Camp', async () => {
    launch(VictoryScene, { controller: fakeController() });
    await flush();
    click(q(TEST_IDS.backToCamp));
    expect((await next()).key).toBe(SCENE_KEYS.camp);
  });

  it('victory with a bad hand-off goes to setup, never a blank screen', async () => {
    launch(VictoryScene, undefined);
    expect((await next()).key).toBe(SCENE_KEYS.setup);
  });

  it('victory scene exposes its controller for the e2e hook', () => {
    const c = fakeController();
    const s = launch(VictoryScene, c);
    expect(s.controller).toBe(c);
  });

  it('loading failure shows Retry and the scene waits', async () => {
    let n = 0;
    t = makeServices({
      loadBank: async () => {
        n++;
        if (n === 1) throw new Error('lost');
        return (await import('./fakes')).tinyBank;
      },
    });
    launch(LoadingScene, { next: SCENE_KEYS.setup });
    await flush();
    t.clock.advance(150);
    await flush();
    expect(document.body.textContent).toContain(LOADING.errorTitle);
    expect(started).toEqual([]);
    click(q(TEST_IDS.loadingRetry));
    await flush();
    t.clock.advance(4100);
    await flush();
    t.clock.advance(300);
    expect((await next()).key).toBe(SCENE_KEYS.setup);
  });

  it('a scene that shut down does not start the next one', async () => {
    const s = launch(TapToStartScene);
    s.events.emit('shutdown');
    click(q(TEST_IDS.tapToPlay));
    await flush();
    expect(started).toEqual([]);
  });

  it('a step that throws falls back to the tap screen instead of freezing', async () => {
    t.services.overlay.showSetup = (() =>
      Promise.reject(new Error('boom'))) as typeof t.services.overlay.showSetup;
    launch(SetupScene);
    expect((await next()).key).toBe(SCENE_KEYS.tap);
  });
});

describe('scene keys type', () => {
  it('SceneKey covers every scene', () => {
    const k: SceneKey = SCENE_KEYS.battle;
    expect(k).toBe('BattleScene');
  });
});
