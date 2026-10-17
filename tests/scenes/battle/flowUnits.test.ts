import { describe, expect, it } from 'vitest';
import { unitById, unitsOf } from '../../../src/game/units';
import { kindForRole } from '../../../src/scenes/battle/projectileKinds';
import { makeWorld, settle } from './flowHarness';

/** Start a match and stop where the first player is aiming. */
async function aiming() {
  const w = makeWorld({ seed: 7 });
  void w.flow.run();
  await settle();
  return w;
}

describe('BattleFlow: fighter selection', () => {
  it('pushes the selected fighter and the five fighters to the HUD', async () => {
    const w = await aiming();
    const last = w.hudStates.at(-1)!;
    expect(last.canFire).toBe(true);
    expect(last.selected).toBe('C');
    expect(last.units.map((u) => u.id)).toEqual(unitsOf('PAST').map((u) => u.id));
    expect(last.units[2]).toEqual({ id: 'C', name: 'Cannon Knight' });
    w.flow.destroy();
  });

  it('onSelect picks the fighter, tells the view and the HUD, and redraws the preview', async () => {
    const w = await aiming();
    const before = w.previews.length;
    w.handlers()!.onSelect('D');
    expect(w.match.snapshot().selected.PAST).toBe('D');
    expect(w.selections.at(-1)).toEqual({ team: 'PAST', id: 'D' });
    expect(w.hudStates.at(-1)!.selected).toBe('D');
    expect(w.previews.length).toBeGreaterThan(before);
    w.flow.destroy();
  });

  it('the preview starts from the selected fighter, not the default launcher', async () => {
    const w = await aiming();
    const first = w.previews.at(-1)!.dots![0]!;
    w.handlers()!.onSelect('A');
    const next = w.previews.at(-1)!.dots![0]!;
    const origin = unitById('A')!.origin;
    expect(Math.abs(next.x - origin.x)).toBeLessThan(Math.abs(first.x - origin.x));
    w.flow.destroy();
  });

  it('the shot starts at the selected fighter and uses its projectile kind', async () => {
    const w = await aiming();
    w.handlers()!.onSelect('B');
    w.handlers()!.onFire();
    await settle();
    const shot = w.shots[0]!;
    expect(shot.kind).toBe(kindForRole(unitById('B')!.role));
    expect(Math.abs(shot.start.x - unitById('B')!.origin.x)).toBeLessThan(40);
    w.flow.destroy();
  });

  it('the default fighter shoots its default kind', async () => {
    const w = await aiming();
    w.handlers()!.onFire();
    await settle();
    expect(w.shots[0]!.kind).toBe(kindForRole('cannon'));
    w.flow.destroy();
  });

  it('an illegal select (other team, unknown id) does not throw or change anything', async () => {
    const w = await aiming();
    const h = w.handlers()!;
    expect(() => h.onSelect('1')).not.toThrow();
    expect(() => h.onSelect('Z' as never)).not.toThrow();
    expect(w.match.snapshot().selected.PAST).toBe('C');
    w.flow.destroy();
  });

  it('a select while a shot is in flight is ignored', async () => {
    const w = await aiming();
    const h = w.handlers()!;
    h.onFire();
    expect(() => h.onSelect('A')).not.toThrow();
    await settle();
    expect(w.match.snapshot().selected.PAST).toBe('C');
    w.flow.destroy();
  });

  it('aiming and firing still work after a pick', async () => {
    const w = await aiming();
    const h = w.handlers()!;
    h.onSelect('E');
    h.onAim({ angleDeg: 30, power: 50 });
    expect(w.hudStates.at(-1)!.angleDeg).toBe(30);
    h.onFire();
    await settle();
    expect(w.log).toContain('fly:PAST');
    expect(w.hudStates.some((s) => s.shotsLeft === 1)).toBe(true);
    w.flow.destroy();
  });
});
