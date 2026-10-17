// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { LOADING } from '../../src/data/copy';
import { SCENE_KEYS } from '../../src/scenes/registry';
import {
  runIntroStep,
  runLoadingStep,
  runSetupStep,
  runTapStep,
  runVictoryStep,
  runCampStep,
} from '../../src/scenes/steps';
import { TEST_IDS } from '../../src/ui/types';
import type { BattleSceneData } from '../../src/scenes/battle/types';
import { click, flush, q } from '../ui/helpers';
import { freshCamp, freshLoadout } from '../../src/game/loadout';
import { loadCamp } from '../../src/storage/storage';
import { fakeController, makeServices, players, tinyBank } from './fakes';
import { loadSettings } from '../../src/storage/storage';

let t: ReturnType<typeof makeServices>;
beforeEach(() => {
  t = makeServices();
});

describe('tap step', () => {
  it('stays silent until the tap, then unlocks audio and routes to the intro', async () => {
    const p = runTapStep(t.services);
    await flush();
    expect(t.audio.unlocked).toBe(false);
    click(q(TEST_IDS.tapToPlay));
    const route = await p;
    expect(t.audio.unlocked).toBe(true);
    expect(route.key).toBe(SCENE_KEYS.intro);
  });
  it('skips the intro for a family that has seen it', async () => {
    t.storage.set('timeclash.introSeen', true);
    const p = runTapStep(t.services);
    click(q(TEST_IDS.tapToPlay));
    expect((await p).key).toBe(SCENE_KEYS.loading);
  });
  it('mute toggle mutes the audio and saves it', async () => {
    void runTapStep(t.services);
    click(q(TEST_IDS.muteToggle));
    expect(t.audio.muted).toBe(true);
    expect(loadSettings(t.storage).muted).toBe(true);
    click(q(TEST_IDS.muteToggle));
    expect(t.audio.muted).toBe(false);
    expect(loadSettings(t.storage).muted).toBe(false);
  });
  it('captions toggle is saved', async () => {
    void runTapStep(t.services);
    expect(loadSettings(t.storage).captions).toBe(true);
    click(q(TEST_IDS.captionsToggle));
    expect(loadSettings(t.storage).captions).toBe(false);
    click(q(TEST_IDS.captionsToggle));
    expect(loadSettings(t.storage).captions).toBe(true);
  });
  it('keeps the mute choice made before the tap when the tap unlocks audio', async () => {
    const p = runTapStep(t.services);
    click(q(TEST_IDS.muteToggle));
    click(q(TEST_IDS.tapToPlay));
    await p;
    expect(t.audio.muted).toBe(true);
  });
});

describe('intro step', () => {
  it('opens How to Play through the shared opener, then loads and sets up', async () => {
    const route = await runIntroStep(t.services);
    expect(t.howToOpened()).toBe(1);
    expect(route).toEqual({ key: SCENE_KEYS.loading, data: { next: SCENE_KEYS.setup } });
  });
});

describe('loading step', () => {
  it('waits the minimum time, then goes where it was told', async () => {
    let done = false;
    const setup = { players, seed: 1, firstTeam: 'PAST' as const };
    const p = runLoadingStep(t.services, { next: SCENE_KEYS.battle, setup }).then((r) => {
      done = true;
      return r;
    });
    await flush();
    expect(document.querySelector('[data-screen="loading"]')).not.toBeNull();
    expect(done).toBe(false);
    t.clock.advance(1600);
    await flush();
    t.clock.advance(200);
    const route = await p;
    expect(route.key).toBe(SCENE_KEYS.battle);
    const data = route.data as BattleSceneData;
    expect(data.match.snapshot().seed).toBe(1);
    expect(data.match.snapshot().players).toEqual(players);
    expect(data.bank).toBe(tinyBank);
    expect(data.overlay).toBe(t.services.overlay);
    expect(t.services.session.match).toBe(data.match);
    expect(t.services.session.bank).toBe(tinyBank);
    expect(document.querySelector('[data-screen="loading"]')).toBeNull();
  });
  it('shows a friendly error with Retry when the load fails, then recovers', async () => {
    let calls = 0;
    const s = makeServices({
      loadBank: async () => {
        calls++;
        if (calls === 1) throw new Error('lost in time');
        return tinyBank;
      },
    });
    const p = runLoadingStep(s.services, { next: SCENE_KEYS.setup });
    await flush();
    s.clock.advance(100);
    await flush();
    expect(q(TEST_IDS.loadingRetry)).not.toBeNull();
    expect(document.body.textContent).toContain(LOADING.errorTitle);
    click(q(TEST_IDS.loadingRetry));
    await flush();
    s.clock.advance(2000);
    await flush();
    s.clock.advance(2000);
    const route = await p;
    expect(calls).toBe(2);
    expect(route.key).toBe(SCENE_KEYS.setup);
  });
  it('bad data still ends at Setup', async () => {
    const p = runLoadingStep(t.services, undefined);
    await flush();
    t.clock.advance(1600);
    await flush();
    t.clock.advance(300);
    expect((await p).key).toBe(SCENE_KEYS.setup);
  });
});

describe('setup step', () => {
  it('saves both players and goes to the Camp', async () => {
    t.services.session.bank = tinyBank;
    const p = runSetupStep(t.services);
    click(q(TEST_IDS.setupGrade('FUTURE', 7)));
    click(q(TEST_IDS.setupSubject('FUTURE', 'math')));
    click(q(TEST_IDS.setupNext));
    const route = await p;
    expect(route).toEqual({ key: SCENE_KEYS.camp });
    expect(t.storage.get('timeclash.players')![1]).toMatchObject({
      team: 'FUTURE',
      grade: 7,
      subject: 'math',
    });
  });
  it('lets the two sides differ and remembers them next time', async () => {
    t.storage.set('timeclash.players', players);
    const p = runSetupStep(t.services);
    expect(q<HTMLInputElement>(TEST_IDS.setupName('PAST'))!.value).toBe('Alex');
    expect(q<HTMLInputElement>(TEST_IDS.setupName('FUTURE'))!.value).toBe('Sam');
    click(q(TEST_IDS.setupNext));
    await p;
    const saved = t.storage.get('timeclash.players')!;
    expect(saved[0].grade).toBe(3);
    expect(saved[1].grade).toBe(5);
  });
  it('does not move on with an empty name', async () => {
    t.services.session.bank = tinyBank;
    let finished = false;
    const p = runSetupStep(t.services).then(() => (finished = true));
    const input = q<HTMLInputElement>(TEST_IDS.setupName('PAST'))!;
    input.value = '   ';
    input.dispatchEvent(new Event('input'));
    click(q(TEST_IDS.setupNext));
    await flush();
    expect(finished).toBe(false);
    expect(t.storage.get('timeclash.players')).toBeNull();
    input.value = 'Mia';
    input.dispatchEvent(new Event('input'));
    click(q(TEST_IDS.setupNext));
    await p;
    expect(t.storage.get('timeclash.players')![0].name).toBe('Mia');
  });
});

describe('camp step', () => {
  it('starts a seeded match for the saved players when Time to Clash! is tapped', async () => {
    t.services.session.bank = tinyBank;
    t.storage.set('timeclash.players', players);
    const p = runCampStep(t.services);
    click(q(TEST_IDS.campStart));
    const route = await p;
    expect(route.key).toBe(SCENE_KEYS.battle);
    const data = route.data as BattleSceneData;
    const m = data.match.snapshot();
    expect(m.seed).toBe(1234);
    expect(m.turn.team).toBe('PAST');
    expect(m.players).toEqual(players);
    expect(data.bank).toBe(tinyBank);
    expect(q(TEST_IDS.campStart)).toBeNull();
  });
  it('loads the bank first if it is somehow missing', async () => {
    t.storage.set('timeclash.players', players);
    const p = runCampStep(t.services);
    click(q(TEST_IDS.campStart));
    const route = await p;
    expect(route.key).toBe(SCENE_KEYS.loading);
    expect(route.data).toMatchObject({ next: SCENE_KEYS.battle, setup: { seed: 1234 } });
  });
  it('sends a family with no saved players back to Setup, with no Camp screen', async () => {
    const route = await runCampStep(t.services);
    expect(route.key).toBe(SCENE_KEYS.setup);
    expect(q(TEST_IDS.campStart)).toBeNull();
  });
  it('goes to Setup when Change players is tapped, and starts no match', async () => {
    t.services.session.bank = tinyBank;
    t.storage.set('timeclash.players', players);
    const p = runCampStep(t.services);
    click(q(TEST_IDS.campPlayers));
    const route = await p;
    expect(route).toEqual({ key: SCENE_KEYS.setup });
    expect(t.services.session.match).toBeNull();
  });
  it('stays on the Camp when a closed button is tapped', async () => {
    t.services.session.bank = tinyBank;
    t.storage.set('timeclash.players', players);
    let finished = false;
    const p = runCampStep(t.services).then((r) => {
      finished = true;
      return r;
    });
    click(q(TEST_IDS.campForge));
    click(q(TEST_IDS.campUpgrade));
    await flush();
    expect(finished).toBe(false);
    expect(q(TEST_IDS.campStart)).not.toBeNull();
    click(q(TEST_IDS.campStart));
    await p;
  });
});

describe('camp step: weapons and upgrades', () => {
  it('puts the saved weapons and upgrades into the new match', async () => {
    t.services.session.bank = tinyBank;
    t.storage.set('timeclash.players', players);
    t.storage.set('timeclash.camp', {
      ...freshCamp(),
      loadout: {
        PAST: { weapon: 'royalSword', owned: { royalSword: 1 }, upgrades: { tower: 2 } },
        FUTURE: freshLoadout('FUTURE'),
      },
    });
    const p = runCampStep(t.services);
    click(q(TEST_IDS.campStart));
    const data = (await p).data as BattleSceneData;
    expect(data.match.snapshot().maxBaseHp.PAST).toBe(100 + 2 * 12);
    expect(data.match.snapshot().maxBaseHp.FUTURE).toBe(100);
  });
  it('plays a fresh game with Phase 1 numbers when nothing was bought', async () => {
    t.services.session.bank = tinyBank;
    t.storage.set('timeclash.players', players);
    const p = runCampStep(t.services);
    click(q(TEST_IDS.campStart));
    const data = (await p).data as BattleSceneData;
    expect(data.match.snapshot().maxBaseHp).toEqual({ PAST: 100, FUTURE: 100 });
  });
  it('carries the same effects into the rematch', async () => {
    t.services.session.bank = tinyBank;
    t.storage.set('timeclash.players', players);
    t.storage.set('timeclash.camp', {
      ...freshCamp(),
      loadout: {
        PAST: freshLoadout('PAST'),
        FUTURE: { ...freshLoadout('FUTURE'), upgrades: { forceField: 1 } },
      },
    });
    const p = runCampStep(t.services);
    click(q(TEST_IDS.campStart));
    const data = (await p).data as BattleSceneData;
    expect(data.match.rematchOptions().effects?.FUTURE.shieldHits).toBe(1);
  });
});

describe('victory step: scrap goes to the camp', () => {
  it('adds each team scrap earned in the match', async () => {
    const p = runVictoryStep(t.services, fakeController());
    click(q(TEST_IDS.rematch));
    await p;
    const camp = loadCamp(t.storage);
    expect(camp.scrap).toEqual({ PAST: 3, FUTURE: 3 });
    expect(camp.creditedSeed).toBe(7);
  });
  it('adds it only once if the same match is shown again', async () => {
    for (let i = 0; i < 2; i++) {
      const p = runVictoryStep(t.services, fakeController());
      click(q(TEST_IDS.rematch));
      await p;
    }
    expect(loadCamp(t.storage).scrap).toEqual({ PAST: 3, FUTURE: 3 });
  });
  it('adds a rematch again (it has the next seed)', async () => {
    const p = runVictoryStep(t.services, fakeController());
    click(q(TEST_IDS.rematch));
    await p;
    const next = runVictoryStep(
      t.services,
      fakeController({ seed: 8 }, { players, seed: 9, firstTeam: 'PAST' }),
    );
    click(q(TEST_IDS.rematch));
    await next;
    expect(loadCamp(t.storage).scrap).toEqual({ PAST: 6, FUTURE: 6 });
  });
  it('adds nothing for a bad hand-off (no victory screen)', async () => {
    await runVictoryStep(t.services, undefined);
    expect(loadCamp(t.storage).scrap).toEqual({ PAST: 0, FUTURE: 0 });
  });
});

describe('victory step', () => {
  it('shows the winner and routes a rematch through Loading', async () => {
    const c = fakeController();
    const p = runVictoryStep(t.services, c);
    await flush();
    expect(q(TEST_IDS.victory)).not.toBeNull();
    expect(q(TEST_IDS.victory)!.textContent).toContain('Alex');
    click(q(TEST_IDS.rematch));
    const route = await p;
    expect(route.key).toBe(SCENE_KEYS.loading);
    expect(route.data).toMatchObject({
      next: SCENE_KEYS.battle,
      setup: { seed: 8, firstTeam: 'FUTURE' },
    });
    expect(t.services.session.match).toBeNull();
    expect(q(TEST_IDS.victory)).toBeNull();
  });
  it('accepts the wrapped controller and Back to Camp returns to the Camp', async () => {
    const p = runVictoryStep(t.services, { controller: fakeController() });
    click(q(TEST_IDS.backToCamp));
    expect((await p).key).toBe(SCENE_KEYS.camp);
  });
  it('hides the battle HUD first', async () => {
    t.overlay.showHud({
      onAim: () => undefined,
      onFire: () => undefined,
      onMuteToggle: () => undefined,
    });
    expect(document.querySelector('[data-layer="hud"]')!.childElementCount).toBeGreaterThan(0);
    const p = runVictoryStep(t.services, fakeController());
    click(q(TEST_IDS.backToCamp));
    await p;
    expect(document.querySelector('[data-layer="hud"]')!.childElementCount).toBe(0);
  });
  it.each([undefined, {}, 'oops', fakeController({ status: 'PLAYING', winner: null })])(
    'sends a bad hand-off to Setup without a victory screen %#',
    async (bad) => {
      const route = await runVictoryStep(t.services, bad);
      expect(route.key).toBe(SCENE_KEYS.setup);
      expect(q(TEST_IDS.victory)).toBeNull();
    },
  );
});

describe('battle data', () => {
  const toBattle = async () => {
    const setup = { players, seed: 3, firstTeam: 'PAST' as const };
    const p = runLoadingStep(t.services, { next: SCENE_KEYS.battle, setup });
    await flush();
    t.clock.advance(1600);
    await flush();
    t.clock.advance(300);
    return (await p).data as BattleSceneData;
  };
  it('saves question history as the game goes', async () => {
    const d = await toBattle();
    const h = { used: { 'math-3': ['math-3-0001'] }, lastSubject: {} };
    d.onHistory!(h as never);
    expect(t.storage.get('timeclash.history')).toEqual(h);
  });
  it('starts from saved history', async () => {
    const h = { used: { 'math-3': ['math-3-0001'] }, lastSubject: {} };
    t.storage.set('timeclash.history', h as never);
    expect((await toBattle()).history).toEqual(h);
  });
  it('starts from empty history when none is saved', async () => {
    expect((await toBattle()).history).toEqual({ used: {}, lastSubject: {} });
  });
  it('the HUD mute button mutes and saves', async () => {
    const d = await toBattle();
    d.onMuteToggle!();
    expect(t.audio.muted).toBe(true);
    expect(loadSettings(t.storage).muted).toBe(true);
  });
  it('a fresh match each time: a rematch is not the old controller', async () => {
    const a = await toBattle();
    const b = await toBattle();
    expect(a.match).not.toBe(b.match);
  });
});
