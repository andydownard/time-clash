// Birds, gusts and recoil inside the battle loop: the birds show while aiming, the shot is fired
// on the bird clock, bumps and gusts get a picture, a word and a sound, and the dials slide.
import { describe, expect, it } from 'vitest';
import { DISTURBANCE } from '../../../src/game/config';
import { birdsForTurn, type BirdPath } from '../../../src/game/disturbance';
import type { BirdBump, FireOptions, GustHit, ShotResult } from '../../../src/game/types';
import { findAim, makeWorld, settle } from './flowHarness';

const SEED = 7;

/** A world with disturbances on and a fake view that records the bird calls. */
function birdWorld(
  extra: { reduced?: boolean; clockMs?: number; fake?: Partial<ShotResult> } = {},
) {
  const miss = findAim(SEED, 0, 'PAST', 'miss');
  const w = makeWorld({
    seed: SEED,
    script: [miss, { angleDeg: 40, power: 50 }],
    answers: ['wrong'],
    matchOptions: { disturbances: true },
  });
  const shown: Array<readonly BirdPath[] | null> = [];
  const bumps: BirdBump[] = [];
  const gusts: GustHit[] = [];
  const fired: Array<FireOptions | undefined> = [];
  Object.assign(w.deps.view, {
    showBirds: (b: readonly BirdPath[] | null) => void shown.push(b),
    birdClockMs: () => extra.clockMs ?? 0,
    playBirdBump: (b: BirdBump) => void bumps.push(b),
    playGust: (g: GustHit) => void gusts.push(g),
  });
  if (extra.reduced) w.deps.reducedMotion = () => true;
  const real = w.match.fire.bind(w.match);
  w.match.fire = (o?: FireOptions) => {
    fired.push(o);
    return { ...real(o), ...(extra.fake ?? {}) };
  };
  return { w, shown, bumps, gusts, fired };
}

describe('BattleFlow: disturbances', () => {
  it('clears the old birds at the turn start, then shows this turn birds after Ready', async () => {
    const { w, shown } = birdWorld();
    void w.flow.run();
    await settle();
    expect(shown[0]).toBeNull();
    expect(shown[1]).toEqual(birdsForTurn(SEED, 0));
    expect((shown[1] ?? []).length).toBeGreaterThan(0);
    w.flow.destroy();
  });

  it('fires on the bird clock the view shows', async () => {
    const { w, fired } = birdWorld({ clockMs: 4321 });
    void w.flow.run();
    await settle();
    expect(fired[0]).toEqual({ birdMs: 4321 });
    expect(w.match.snapshot().stats.PAST.shotsFired).toBeGreaterThanOrEqual(1);
    w.flow.destroy();
  });

  it('a bump plays the bird picture and a squawk; a gust plays the arrow and a whoosh', async () => {
    const bump: BirdBump = {
      bird: 0,
      step: 30,
      at: { x: 500, y: 300 },
      birdAt: { x: 505, y: 310 },
    };
    const gust: GustHit = { push: 200, fromStep: 20, toStep: 44, at: { x: 420, y: 330 } };
    const { w, bumps, gusts } = birdWorld({ fake: { bumps: [bump], gust } });
    void w.flow.run();
    await settle();
    expect(bumps[0]).toEqual(bump);
    expect(gusts[0]).toEqual(gust);
    // The gust comes first in the flight, so its whoosh sounds before the squawk.
    const whoosh = w.sfx.indexOf('whoosh');
    const squawk = w.sfx.indexOf('squawk');
    expect(whoosh).toBeGreaterThan(-1);
    expect(squawk).toBeGreaterThan(whoosh);
    w.flow.destroy();
  });

  it('a calm flight plays no squawk and no whoosh', async () => {
    const { w } = birdWorld({ fake: { bumps: [] } });
    // Remove the real gust too, so the flight is calm.
    const fire = w.match.fire;
    w.match.fire = (o?: FireOptions) => {
      const r = fire(o);
      delete r.gust;
      return r;
    };
    void w.flow.run();
    await settle();
    expect(w.sfx).not.toContain('squawk');
    expect(w.sfx).not.toContain('whoosh');
    w.flow.destroy();
  });

  it('recoil slides the dials in steps from the fired aim to the kicked aim', async () => {
    const { w } = birdWorld();
    void w.flow.run();
    await settle();
    const fired = w.match.snapshot().lastShot!;
    const kicked = w.match.snapshot().aim.PAST;
    // The HUD between the first fire and the next go shows the slide, ending on the kicked aim.
    const firstFire = w.hudStates.findIndex(
      (s) => !s.canFire && s.angleDeg === fired.angleDeg && s.power === fired.power,
    );
    expect(firstFire).toBeGreaterThan(-1);
    const after = w.hudStates.slice(firstFire);
    const moved = after.findIndex((s) => s.angleDeg !== fired.angleDeg || s.power !== fired.power);
    if (kicked.angleDeg !== fired.angleDeg || kicked.power !== fired.power) {
      expect(moved).toBeGreaterThan(0);
    }
    w.flow.destroy();
  });

  it('with reduced motion the dials jump straight to the kicked aim', async () => {
    const { w } = birdWorld({ reduced: true });
    const key = (a: { angleDeg: number; power: number }) => `${a.angleDeg}:${a.power}`;
    // After each fire, until the next go can fire, the dials show only the fired or kicked aim.
    const windows: Array<{ allowed: Set<string>; seen: Set<string> }> = [];
    let open = false;
    const fire = w.match.fire;
    w.match.fire = (o?: FireOptions) => {
      const from = key(w.match.snapshot().aim.PAST);
      const r = fire(o);
      windows.push({ allowed: new Set([from, key(w.match.snapshot().aim.PAST)]), seen: new Set() });
      open = w.match.snapshot().turn.team === 'PAST';
      return r;
    };
    const overlay = w.deps.overlay as unknown as {
      updateHud: (s: {
        angleDeg: number;
        power: number;
        canFire: boolean;
        activeTeam: string;
      }) => void;
    };
    const update = overlay.updateHud;
    overlay.updateHud = (s) => {
      if (s.canFire || s.activeTeam !== 'PAST') open = false;
      if (open) windows[windows.length - 1]!.seen.add(key(s));
      update(s);
    };
    void w.flow.run();
    await settle();
    expect(windows.length).toBeGreaterThan(0);
    for (const win of windows) for (const s of win.seen) expect(win.allowed).toContain(s);
    w.flow.destroy();
  });

  it('turned off, the loop shows no birds and the dials stay put', async () => {
    const miss = findAim(SEED, 0, 'PAST', 'miss');
    const w = makeWorld({ seed: SEED, script: [miss, miss], answers: ['wrong'] });
    const shown: Array<readonly BirdPath[] | null> = [];
    Object.assign(w.deps.view, {
      showBirds: (b: readonly BirdPath[] | null) => void shown.push(b),
    });
    void w.flow.run();
    await settle();
    expect(shown.every((b) => b === null)).toBe(true);
    expect(w.match.snapshot().aim.PAST).toEqual(miss);
    expect(w.sfx).not.toContain('squawk');
    w.flow.destroy();
  });

  it('the slide numbers live in config', () => {
    expect(DISTURBANCE.recoilSlideSteps).toBeGreaterThan(1);
    expect(DISTURBANCE.recoilSlideMs).toBeLessThan(1000);
  });
});
