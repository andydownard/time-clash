// Recoil's "Kick!" cue: the first time recoil moves the dials in a match, a short caption in the
// message lane says why (owner, 2026-10-25). Once per match, never stored, and a new match (a
// rematch builds a new flow) shows it again.
import { describe, expect, it } from 'vitest';
import { DISTURBANCE_COPY } from '../../../src/data/copy';
import { DISTURBANCE } from '../../../src/game/config';
import type { FireOptions } from '../../../src/game/types';
import { findAim, makeWorld, settle } from './flowHarness';

const SEED = 7;

/** A world with recoil on and several shots, counting the kicks that moved the dials. */
function kickWorld(extra: { reduced?: boolean; disturbances?: boolean } = {}) {
  const miss = findAim(SEED, 0, 'PAST', 'miss');
  const w = makeWorld({
    seed: SEED,
    script: [miss, miss, miss, miss, miss, miss],
    answers: ['wrong', 'wrong', 'wrong'],
    matchOptions: { disturbances: extra.disturbances ?? true },
  });
  if (extra.reduced) w.deps.reducedMotion = () => true;
  let moved = 0;
  const fire = w.match.fire.bind(w.match);
  w.match.fire = (o?: FireOptions) => {
    const team = w.match.snapshot().turn.team;
    const before = { ...w.match.snapshot().aim[team] };
    const r = fire(o);
    const after = w.match.snapshot().aim[team];
    if (after.angleDeg !== before.angleDeg || after.power !== before.power) moved++;
    return r;
  };
  return { w, moved: () => moved };
}

const kicks = (captions: Array<string | null>) =>
  captions.filter((c) => c === DISTURBANCE_COPY.kick).length;

describe('BattleFlow: the Kick! cue', () => {
  it('is a short line that starts with Kick!', () => {
    expect(DISTURBANCE_COPY.kick.startsWith('Kick!')).toBe(true);
    expect(DISTURBANCE_COPY.kick.split(/\s+/).length).toBeLessThanOrEqual(5);
  });

  it('shows once in a match, even when recoil moves the dials again', async () => {
    const { w, moved } = kickWorld();
    void w.flow.run();
    await settle();
    expect(moved()).toBeGreaterThanOrEqual(2);
    expect(kicks(w.captions)).toBe(1);
    w.flow.destroy();
  });

  it('shows once the shot has landed, so it never hides the shell or the Gust! word', async () => {
    const { w } = kickWorld();
    const setCaption = w.deps.overlay.setCaption;
    w.deps.overlay.setCaption = (t) => {
      w.log.push(`caption:${t}`);
      setCaption(t);
    };
    void w.flow.run();
    await settle();
    const kick = w.log.indexOf(`caption:${DISTURBANCE_COPY.kick}`);
    expect(kick).toBeGreaterThan(-1);
    const impact = w.log.findIndex((l) => l.startsWith('impact:'));
    expect(impact).toBeGreaterThan(-1);
    expect(kick).toBeGreaterThan(impact);
    w.flow.destroy();
  });

  it('comes down before the next shot or the reload cover, so the lane is free again', async () => {
    const { w } = kickWorld();
    const setCaption = w.deps.overlay.setCaption;
    w.deps.overlay.setCaption = (t) => {
      w.log.push(`caption:${t}`);
      setCaption(t);
    };
    void w.flow.run();
    await settle();
    const kick = w.log.indexOf(`caption:${DISTURBANCE_COPY.kick}`);
    const next = w.log.findIndex(
      (l, i) => i > kick && (l.startsWith('reload:') || l.startsWith('impact:')),
    );
    expect(next).toBeGreaterThan(kick);
    expect(w.log.slice(kick + 1, next)).toContain('caption:null');
    expect(w.coverViolations).toEqual([]);
    w.flow.destroy();
  });

  it('the beat it stays up before a reload lives in config', () => {
    expect(DISTURBANCE.kickCueMs).toBeGreaterThanOrEqual(1000);
    expect(DISTURBANCE.kickCueMs).toBeLessThanOrEqual(3000);
  });

  it('shows with reduced motion too (the dials jump, the words still say why)', async () => {
    const { w, moved } = kickWorld({ reduced: true });
    void w.flow.run();
    await settle();
    expect(moved()).toBeGreaterThanOrEqual(1);
    expect(kicks(w.captions)).toBe(1);
    w.flow.destroy();
  });

  it('never shows when recoil is off', async () => {
    const { w } = kickWorld({ disturbances: false });
    void w.flow.run();
    await settle();
    expect(kicks(w.captions)).toBe(0);
    w.flow.destroy();
  });

  it('shows again in the next match (a rematch is a new flow, nothing is saved)', async () => {
    const first = kickWorld();
    void first.w.flow.run();
    await settle();
    first.w.flow.destroy();
    const second = kickWorld();
    void second.w.flow.run();
    await settle();
    expect(kicks(second.w.captions)).toBe(1);
    second.w.flow.destroy();
  });
});
