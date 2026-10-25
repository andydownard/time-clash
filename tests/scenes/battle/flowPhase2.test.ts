// BattleFlow with Phase 2 gear: the ammo and evasion buttons, walls and dodges, and the turn shape
// staying exactly two shots then a reload (Gate 3).
import { describe, expect, it } from 'vitest';
import { buildLayout } from '../../../src/game/battlefield';
import { DAMAGE, EVASION } from '../../../src/game/config';
import type { Rect, Team } from '../../../src/game/types';
import { GEAR_COPY } from '../../../src/data/copy';
import { makeWorld, settle } from './flowHarness';

type Extra = {
  walls: Rect[][];
  dodges: Team[];
  spoken: string[];
};

/** Start a match and stop where the first player is aiming. Records the optional view calls. */
async function aiming(opts: Parameters<typeof makeWorld>[0] = {}) {
  const w = makeWorld({ seed: 7, ...opts });
  const extra: Extra = { walls: [], dodges: [], spoken: [] };
  const view = w.deps.view as unknown as Record<string, unknown>;
  view.setWalls = (walls: Rect[]) => void extra.walls.push(walls);
  view.playDodge = async (team: Team) => void extra.dodges.push(team);
  const audio = w.deps.audio as unknown as Record<string, unknown>;
  audio.speak = (line: { text: string }) => void extra.spoken.push(line.text);
  void w.flow.run();
  await settle();
  return { ...w, extra };
}

describe('BattleFlow: gear in the HUD', () => {
  it('sends the active team’s ammo and evasion to the HUD', async () => {
    const w = await aiming({ matchOptions: { ammo: { PAST: ['confetti'] } } });
    const gear = w.hudStates.at(-1)!.gear!;
    expect(gear.ammo).toBe('standard');
    expect(gear.ammoLeft).toEqual({ confetti: 3 });
    expect(gear.evasion).toMatchObject({ id: 'barricade', phase: 'ready' });
    w.flow.destroy();
  });

  it('onAmmo loads a kind the team owns, and ignores one it does not', async () => {
    const w = await aiming({ matchOptions: { ammo: { PAST: ['bowling'] } } });
    w.handlers()!.onAmmo!('bowling');
    expect(w.match.snapshot().ammo.PAST).toBe('bowling');
    expect(w.hudStates.at(-1)!.gear!.ammo).toBe('bowling');
    w.handlers()!.onAmmo!('plasma');
    expect(w.match.snapshot().ammo.PAST).toBe('bowling');
    w.flow.destroy();
  });

  it('a special shot uses one, and the turn still has exactly two shots then a reload', async () => {
    const w = await aiming({ matchOptions: { ammo: { PAST: ['confetti'] } }, answers: ['wrong'] });
    w.handlers()!.onAmmo!('confetti');
    w.handlers()!.onAim({ angleDeg: 45, power: 10 });
    w.handlers()!.onFire();
    await settle();
    expect(w.match.snapshot().ammoLeft.PAST.confetti).toBe(2);
    w.handlers()!.onAim({ angleDeg: 45, power: 10 });
    w.handlers()!.onFire();
    await settle();
    // A third Fire does nothing: the reload comes next, then the other team.
    w.handlers()!.onFire();
    await settle();
    expect(w.log.filter((l) => l === 'reload:PAST')).toHaveLength(1);
    expect(w.match.snapshot().stats.PAST.shotsFired).toBe(2);
    expect(w.match.snapshot().turn.team).toBe('FUTURE');
    w.flow.destroy();
  });

  it('onEvasion arms the ability, says so out loud, and a second tap takes it back', async () => {
    const w = await aiming();
    w.handlers()!.onEvasion!();
    expect(w.match.snapshot().evasion.PAST.phase).toBe('armed');
    expect(w.hudStates.at(-1)!.gear!.evasion.phase).toBe('armed');
    expect(w.extra.spoken).toEqual([GEAR_COPY.armedLine.barricade]);
    expect(w.captions).toContain(GEAR_COPY.armedLine.barricade);
    w.handlers()!.onEvasion!();
    expect(w.match.snapshot().evasion.PAST.phase).toBe('ready');
    w.flow.destroy();
  });

  it('gear does nothing while a shot is in the air or a cover is up', async () => {
    const w = await aiming({ matchOptions: { ammo: { PAST: ['bowling'] } } });
    w.handlers()!.onAim({ angleDeg: 45, power: 10 });
    w.handlers()!.onFire();
    // The shot is now flying (no settle yet).
    w.handlers()!.onEvasion!();
    w.handlers()!.onAmmo!('bowling');
    expect(w.match.snapshot().evasion.PAST.phase).toBe('ready');
    expect(w.match.snapshot().ammo.PAST).toBe('standard');
    expect(w.coverViolations).toEqual([]);
    w.flow.destroy();
  });
});

describe('BattleFlow: walls and dodges on the field', () => {
  it('draws the barricade wall during the other team’s turn, and clears it after', async () => {
    const w = await aiming({ answers: ['wrong'] });
    w.handlers()!.onEvasion!();
    // Past fires two weak shots, misses the question, the turn passes to Future.
    w.handlers()!.onAim({ angleDeg: 45, power: 10 });
    w.handlers()!.onFire();
    await settle();
    w.handlers()!.onAim({ angleDeg: 45, power: 10 });
    w.handlers()!.onFire();
    await settle();
    expect(w.match.snapshot().turn.team).toBe('FUTURE');
    expect(w.extra.walls.at(-1)).toEqual([EVASION.barricade.wall]);
    w.flow.destroy();
  });

  it('a dodged hit plays the dodge and floats the dodge words', async () => {
    // Future arms its dodge first, then Past lands a direct hit.
    const layout = buildLayout({ biome: 'aspen', spot: 'foodTruck' });
    const w = await aiming({ matchOptions: { firstTeam: 'FUTURE', layout }, answers: ['wrong'] });
    w.handlers()!.onEvasion!();
    for (let i = 0; i < 2; i++) {
      w.handlers()!.onAim({ angleDeg: 45, power: 10 });
      w.handlers()!.onFire();
      await settle();
    }
    expect(w.match.snapshot().turn.team).toBe('PAST');
    expect(w.match.snapshot().evasion.FUTURE.phase).toBe('active');
    // Find Past's direct hit on the real field.
    const { simulateShot } = await import('../../../src/game/ballistics');
    const { classifyBlast } = await import('../../../src/game/damage');
    const s = w.match.snapshot();
    let aim = { angleDeg: 45, power: 60 };
    search: for (let power = 100; power >= 10; power--)
      for (let angleDeg = 0; angleDeg <= 90; angleDeg++) {
        const r = simulateShot({
          angleDeg,
          power,
          wind: s.wind,
          origin: layout.launchOrigins.PAST,
          facing: 1,
          layout,
        });
        if (
          r.hit.kind !== 'out_of_bounds' &&
          classifyBlast(r.landing, layout.bases.FUTURE) === 'direct'
        ) {
          aim = { angleDeg, power };
          break search;
        }
      }
    w.handlers()!.onAim(aim);
    w.handlers()!.onFire();
    await settle();
    expect(w.extra.dodges).toEqual(['FUTURE']);
    expect(w.impacts.at(-1)!.label).toBe(GEAR_COPY.dodgedLine);
    expect(w.match.snapshot().baseHp.FUTURE).toBe(DAMAGE.startingBaseHp);
    w.flow.destroy();
  });
});
