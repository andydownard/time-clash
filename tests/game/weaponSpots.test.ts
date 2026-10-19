// Weapon spots on a base: the catalog, assign, replace, clear, pinned places, Undo, saving, old
// saves, and bad saved data. Rules only, no screen.
import { describe, expect, it } from 'vitest';
import {
  PLOT_STEPS,
  SPOT_WEAPONS,
  assignWeapon,
  chooseSlot,
  chosenSpots,
  clearSpot,
  emptySpots,
  freshBases,
  moveSpot,
  newBuild,
  ownedSpotWeaponIds,
  parseBases,
  placePiece,
  repairSpots,
  resolveSpots,
  saveSlot,
  serializeBase,
  slotPieces,
  slotSpots,
  spotWeaponById,
  spotWeaponsOf,
  spotsUsed,
  toSaved,
  undoBuild,
  type BuildState,
  type SpotResult,
} from '../../src/game/baseBuilder';
import { BASE_BUILDER as B } from '../../src/game/config';
import { unlockSpotWeapon } from '../../src/game/economy';
import { walletOf } from '../../src/game/loadout';
import { campWith } from '../helpers/camp';

const ok = (r: SpotResult): BuildState => {
  if (!r.ok) throw new Error(`expected ok, got ${r.reason}`);
  return r.state;
};

describe('the weapon catalog', () => {
  it('has four weapons per side, with the Past and Future names from the design', () => {
    expect(spotWeaponsOf('PAST').map((w) => w.name)).toEqual([
      'Cannon',
      'Catapult',
      'Archer post',
      'Ballista',
    ]);
    expect(spotWeaponsOf('FUTURE').map((w) => w.name)).toEqual([
      'Laser',
      'Missile pod',
      'Turret',
      'Shield generator',
    ]);
  });
  it('has unique ids, a role, damage and hit points for battle, and one locked weapon per side', () => {
    expect(new Set(SPOT_WEAPONS.map((w) => w.id)).size).toBe(SPOT_WEAPONS.length);
    for (const w of SPOT_WEAPONS) {
      expect(['direct', 'lob', 'volley', 'guard']).toContain(w.role);
      expect(w.hp).toBeGreaterThan(0);
      expect(w.damage).toBeGreaterThanOrEqual(0);
    }
    for (const team of ['PAST', 'FUTURE'] as const) {
      expect(spotWeaponsOf(team).filter((w) => w.scrap !== null)).toHaveLength(1);
    }
  });
  it('owns the free weapons from the start and adds unlocked ones for the right side only', () => {
    expect([...ownedSpotWeaponIds('PAST', undefined)].sort()).toEqual([
      'archerPost',
      'cannon',
      'catapult',
    ]);
    expect(ownedSpotWeaponIds('PAST', ['ballista', 'shieldGen', 'nope']).has('ballista')).toBe(
      true,
    );
    expect(ownedSpotWeaponIds('PAST', ['shieldGen']).has('shieldGen')).toBe(false);
  });
  it('finds a weapon by id and refuses junk', () => {
    expect(spotWeaponById('laser')?.team).toBe('FUTURE');
    expect(spotWeaponById('stone')).toBeUndefined();
    expect(spotWeaponById(7)).toBeUndefined();
  });
});

describe('assign, replace and clear', () => {
  it('starts with four empty spots', () => {
    const s = newBuild('PAST');
    expect(s.spots).toHaveLength(B.spots.count);
    expect(spotsUsed(s.spots)).toBe(0);
  });
  it('puts a weapon on a spot and counts it', () => {
    const s = ok(assignWeapon(newBuild('PAST'), 1, 'catapult'));
    expect(s.spots[1]?.weapon).toBe('catapult');
    expect(spotsUsed(s.spots)).toBe(1);
  });
  it('replaces the weapon on a spot and leaves the other spots alone', () => {
    let s = ok(assignWeapon(newBuild('PAST'), 0, 'cannon'));
    s = ok(assignWeapon(s, 2, 'archerPost'));
    s = ok(assignWeapon(s, 0, 'catapult'));
    expect(s.spots.map((x) => x.weapon)).toEqual(['catapult', undefined, 'archerPost', undefined]);
  });
  it('allows the same weapon on two spots', () => {
    let s = ok(assignWeapon(newBuild('PAST'), 0, 'cannon'));
    s = ok(assignWeapon(s, 1, 'cannon'));
    expect(spotsUsed(s.spots)).toBe(2);
  });
  it('the same weapon on the same spot changes nothing and adds no undo step', () => {
    const a = ok(assignWeapon(newBuild('PAST'), 0, 'cannon'));
    const b = ok(assignWeapon(a, 0, 'cannon'));
    expect(b).toBe(a);
    expect(b.undo).toHaveLength(1);
  });
  it('refuses a weapon of the other side, an unknown id, a missing spot and a locked weapon', () => {
    const s = newBuild('PAST');
    expect(assignWeapon(s, 0, 'laser')).toEqual({ ok: false, reason: 'unknown' });
    expect(assignWeapon(s, 0, 'stone')).toEqual({ ok: false, reason: 'unknown' });
    expect(assignWeapon(s, 4, 'cannon')).toEqual({ ok: false, reason: 'nospot' });
    expect(assignWeapon(s, -1, 'cannon')).toEqual({ ok: false, reason: 'nospot' });
    expect(assignWeapon(s, 0, 'ballista', ownedSpotWeaponIds('PAST', []))).toEqual({
      ok: false,
      reason: 'locked',
    });
    expect(assignWeapon(s, 0, 'ballista', ownedSpotWeaponIds('PAST', ['ballista'])).ok).toBe(true);
  });
  it('never changes the old state', () => {
    const s = newBuild('FUTURE');
    ok(assignWeapon(s, 0, 'laser'));
    expect(spotsUsed(s.spots)).toBe(0);
    expect(s.undo).toHaveLength(0);
  });
  it('clears a weapon, keeps the pad, and refuses to clear an empty spot', () => {
    let s = ok(assignWeapon(newBuild('PAST'), 3, 'cannon'));
    s = ok(clearSpot(s, 3));
    expect(s.spots[3]).toEqual({});
    expect(clearSpot(s, 3)).toEqual({ ok: false, reason: 'empty' });
    expect(clearSpot(s, 9)).toEqual({ ok: false, reason: 'nospot' });
  });
  it('a weapon is not touched when bricks are placed', () => {
    const s = ok(assignWeapon(newBuild('PAST'), 0, 'cannon'));
    const r = placePiece(s, 'stone', { x: 4, y: 9, ox: 0, oy: 0 });
    if (!r.ok) throw new Error('place');
    expect(r.state.spots[0]?.weapon).toBe('cannon');
  });
});

describe('where the pads sit', () => {
  it('makes a row on the foundation with no bricks, left to right, inside the plot', () => {
    const r = resolveSpots([], emptySpots());
    expect(r).toHaveLength(B.spots.count);
    const xs = r.map((p) => p.x);
    expect([...xs].sort((a, b) => a - b)).toEqual(xs);
    expect(new Set(r.map((p) => p.y)).size).toBe(1);
    for (const p of r) {
      expect(p.x).toBeGreaterThanOrEqual(B.spots.padSteps);
      expect(p.x).toBeLessThanOrEqual(PLOT_STEPS.w - B.spots.padSteps);
      expect(p.y).toBe(PLOT_STEPS.h - B.spots.padSteps);
    }
  });
  it('rests on top of the built base: a tall tower lifts a pad above the foundation row', () => {
    const r = placePiece(newBuild('PAST'), 'tower', { x: 11, y: 8, ox: 0, oy: 0 });
    if (!r.ok) throw new Error('place');
    const far = placePiece(r.state, 'long', { x: 8, y: 10, ox: 0, oy: 0 });
    if (!far.ok) throw new Error('place');
    const pads = resolveSpots(far.state.pieces, far.state.spots);
    const low = PLOT_STEPS.h - B.spots.padSteps;
    expect(Math.min(...pads.map((p) => p.y))).toBeLessThan(low);
    for (const p of pads) {
      expect(p.y).toBeGreaterThanOrEqual(B.spots.topRows * B.freeSteps + B.spots.padSteps);
    }
  });
  it('stays four clear pads even for one narrow brick', () => {
    const r = placePiece(newBuild('PAST'), 'tower', { x: 12, y: 9, ox: 0, oy: 0 });
    if (!r.ok) throw new Error('place');
    const xs = resolveSpots(r.state.pieces, r.state.spots).map((p) => p.x);
    for (let i = 1; i < xs.length; i++) {
      expect(xs[i]! - xs[i - 1]!).toBeGreaterThanOrEqual(2 * B.spots.padSteps);
    }
  });
  it('pins a pad, keeps it inside the plot, and lets it go back to automatic', () => {
    let s = newBuild('PAST');
    const pad = B.spots.padSteps;
    s = ok(moveSpot(s, 0, { x: 40, y: 50 }));
    expect(resolveSpots(s.pieces, s.spots)[0]).toMatchObject({ x: 40, y: 50 });
    expect(moveSpot(s, 0, { x: pad - 1, y: 50 })).toEqual({ ok: false, reason: 'outside' });
    expect(moveSpot(s, 0, { x: 40, y: PLOT_STEPS.h })).toEqual({ ok: false, reason: 'outside' });
    expect(moveSpot(s, 0, { x: PLOT_STEPS.w, y: 40 })).toEqual({ ok: false, reason: 'outside' });
    expect(moveSpot(s, 0, { x: 1.5, y: 40 })).toEqual({ ok: false, reason: 'outside' });
    expect(moveSpot(s, 7, { x: 40, y: 50 })).toEqual({ ok: false, reason: 'nospot' });
    s = ok(moveSpot(s, 0, null));
    expect(s.spots[0]).toEqual({});
  });
  it('keeps a pinned place when the weapon changes', () => {
    let s = ok(moveSpot(newBuild('PAST'), 1, { x: 100, y: 60 }));
    s = ok(assignWeapon(s, 1, 'cannon'));
    expect(s.spots[1]).toEqual({ weapon: 'cannon', x: 100, y: 60 });
  });
});

describe('Undo covers weapons', () => {
  it('undoes assign, replace, clear and move, one step each', () => {
    let s = ok(assignWeapon(newBuild('PAST'), 0, 'cannon'));
    s = ok(assignWeapon(s, 0, 'catapult'));
    s = ok(clearSpot(s, 0));
    s = ok(moveSpot(s, 2, { x: 90, y: 60 }));
    s = undoBuild(s);
    expect(s.spots[2]).toEqual({});
    s = undoBuild(s);
    expect(s.spots[0]?.weapon).toBe('catapult');
    s = undoBuild(s);
    expect(s.spots[0]?.weapon).toBe('cannon');
    s = undoBuild(s);
    expect(spotsUsed(s.spots)).toBe(0);
    expect(undoBuild(s)).toBe(s);
  });
  it('undoes bricks and weapons in the order they were done', () => {
    const s = ok(assignWeapon(newBuild('PAST'), 0, 'cannon'));
    const r = placePiece(s, 'stone', { x: 2, y: 3, ox: 0, oy: 0 });
    if (!r.ok) throw new Error('place');
    const back = undoBuild(r.state);
    expect(back.pieces).toHaveLength(0);
    expect(back.spots[0]?.weapon).toBe('cannon');
  });
  it('keeps no more than the undo depth', () => {
    let s = newBuild('PAST');
    for (let i = 0; i < B.undoDepth + 10; i++) {
      s = ok(assignWeapon(s, 0, i % 2 ? 'cannon' : 'catapult'));
    }
    expect(s.undo.length).toBeLessThanOrEqual(B.undoDepth);
  });
});

describe('unlocking a weapon with Scrap', () => {
  it('spends the Scrap once and keeps the weapon for that side', () => {
    const out = unlockSpotWeapon(campWith(50), 'Alex', 'PAST', 'ballista');
    if (!out.ok) throw new Error('unlock');
    const w = walletOf(out.camp, 'Alex');
    expect(w.scrap).toBe(50 - 35);
    expect(w.loadout.PAST.mounts).toEqual(['ballista']);
    expect(w.loadout.FUTURE.mounts).toBeUndefined();
  });
  it('is idempotent: the second try pays nothing', () => {
    const first = unlockSpotWeapon(campWith(80), 'Alex', 'PAST', 'ballista');
    if (!first.ok) throw new Error('first');
    expect(unlockSpotWeapon(first.camp, 'Alex', 'PAST', 'ballista')).toEqual({
      ok: false,
      reason: 'already_owned',
    });
    expect(walletOf(first.camp, 'Alex').scrap).toBe(45);
  });
  it('never goes below zero and changes nothing when short', () => {
    expect(unlockSpotWeapon(campWith(34), 'Alex', 'PAST', 'ballista')).toEqual({
      ok: false,
      reason: 'not_enough_scrap',
    });
  });
  it('refuses a free weapon, the other side, an unknown id and a blank name', () => {
    const camp = campWith(99);
    expect(unlockSpotWeapon(camp, 'Alex', 'PAST', 'cannon')).toEqual({
      ok: false,
      reason: 'already_owned',
    });
    expect(unlockSpotWeapon(camp, 'Alex', 'PAST', 'shieldGen')).toEqual({
      ok: false,
      reason: 'wrong_team',
    });
    expect(unlockSpotWeapon(camp, 'Alex', 'PAST', 'stone')).toEqual({
      ok: false,
      reason: 'unknown',
    });
    expect(unlockSpotWeapon(camp, '  ', 'PAST', 'ballista')).toEqual({
      ok: false,
      reason: 'unknown',
    });
  });
});

describe('saving and loading', () => {
  const piece = (() => {
    const r = placePiece(newBuild('PAST'), 'stone', { x: 2, y: 3, ox: 0, oy: 0 });
    if (!r.ok) throw new Error('place');
    return r.state.pieces;
  })();
  const stoneRow = ['stone', 2, 3, 0, 0, 0, 20];

  it('leaves `s` out of the save when no spot has anything, so a plain base is unchanged', () => {
    expect(toSaved(piece)).toEqual({ v: 1, p: [stoneRow] });
    expect(toSaved(piece, emptySpots()).s).toBeUndefined();
  });
  it('round trips weapons and pinned places through JSON', () => {
    let s = ok(assignWeapon(newBuild('PAST', piece), 1, 'catapult'));
    s = ok(moveSpot(s, 3, { x: 60, y: 70 }));
    const back = repairSpots(serializeBase(s.pieces, s.spots), 'PAST');
    expect(back).toEqual([{}, { weapon: 'catapult' }, {}, { x: 60, y: 70 }]);
  });
  it('an old save with no spots loads with four empty spots', () => {
    const old = { v: 1, p: [stoneRow] };
    expect(repairSpots(old, 'PAST')).toEqual(emptySpots());
    const parsed = parseBases({
      players: { alex: { PAST: { chosen: 0, slots: [old, null, null] } } },
    });
    expect(parsed?.players.alex?.PAST.slots[0]).toEqual(old);
    expect(slotSpots(parsed!, 'Alex', 'PAST', 0)).toEqual(emptySpots());
    expect(slotPieces(parsed!, 'Alex', 'PAST', 0)).toHaveLength(1);
  });
  it('keeps a slot that holds only weapons, and empties a slot with nothing', () => {
    const s = ok(assignWeapon(newBuild('PAST'), 0, 'cannon'));
    const withWeapon = saveSlot(freshBases(), 'Alex', 'PAST', 0, [], s.spots);
    expect(withWeapon.players.alex?.PAST.slots[0]).not.toBeNull();
    const emptied = saveSlot(withWeapon, 'Alex', 'PAST', 0, [], emptySpots());
    expect(emptied.players.alex?.PAST.slots[0]).toBeNull();
  });
  it('saving bricks without spots keeps the spots already in the slot', () => {
    const s = ok(assignWeapon(newBuild('PAST'), 0, 'cannon'));
    let st = saveSlot(freshBases(), 'Alex', 'PAST', 1, piece, s.spots);
    st = saveSlot(st, 'Alex', 'PAST', 1, []);
    expect(slotSpots(st, 'Alex', 'PAST', 1)[0]?.weapon).toBe('cannon');
  });
  it('slots keep their own weapons', () => {
    const a = ok(assignWeapon(newBuild('PAST'), 0, 'cannon'));
    const b = ok(assignWeapon(newBuild('PAST'), 0, 'catapult'));
    let st = saveSlot(freshBases(), 'Alex', 'PAST', 0, [], a.spots);
    st = saveSlot(st, 'Alex', 'PAST', 2, [], b.spots);
    expect(slotSpots(st, 'Alex', 'PAST', 0)[0]?.weapon).toBe('cannon');
    expect(slotSpots(st, 'Alex', 'PAST', 2)[0]?.weapon).toBe('catapult');
    expect(slotSpots(st, 'Alex', 'PAST', 1)[0]).toEqual({});
  });
  it('chosenSpots gives the chosen slot with places and weapon ids for battle', () => {
    const a = ok(assignWeapon(newBuild('PAST', piece), 2, 'archerPost'));
    let st = saveSlot(freshBases(), 'Alex', 'PAST', 1, piece, a.spots);
    st = chooseSlot(st, 'Alex', 'PAST', 1);
    const spots = chosenSpots(st, 'Alex', 'PAST');
    expect(spots).toHaveLength(B.spots.count);
    expect(spots[2]?.weapon).toBe('archerPost');
    expect(spots[0]?.weapon).toBeNull();
    expect(chosenSpots(freshBases(), 'Nobody', 'PAST').every((p) => p.weapon === null)).toBe(true);
  });
});

describe('bad saved data is repaired', () => {
  it('drops unknown weapons, the other side, and weapons that are not owned', () => {
    const raw = {
      v: 1,
      p: [],
      s: [{ w: 'cannon' }, { w: 'laser' }, { w: 'ballista' }, { w: 'junk' }],
    };
    expect(repairSpots(raw, 'PAST').map((x) => x.weapon)).toEqual([
      'cannon',
      undefined,
      'ballista',
      undefined,
    ]);
    expect(repairSpots(raw, 'PAST', ownedSpotWeaponIds('PAST', [])).map((x) => x.weapon)).toEqual([
      'cannon',
      undefined,
      undefined,
      undefined,
    ]);
  });
  it('sends a pad that is outside the plot or half set back to its automatic place', () => {
    const raw = { s: [{ x: -5, y: 40 }, { x: 40 }, { x: 40.5, y: 40 }, { x: 99999, y: 40 }] };
    expect(repairSpots(raw, 'PAST')).toEqual(emptySpots());
  });
  it('always returns exactly four spots, whatever is stored', () => {
    for (const raw of [
      null,
      undefined,
      7,
      'not json',
      '{"s":5}',
      [],
      { s: 'x' },
      { s: [null, 3, 'a', [], {}, {}, {}, {}] },
      { s: Array.from({ length: 50 }, () => ({ w: 'cannon' })) },
    ]) {
      expect(repairSpots(raw, 'PAST')).toHaveLength(B.spots.count);
    }
    const many = repairSpots({ s: Array.from({ length: 50 }, () => ({ w: 'cannon' })) }, 'PAST');
    expect(many.filter((x) => x.weapon)).toHaveLength(B.spots.count);
  });
  it('ignores a prototype-pollution style row and non-string weapon ids', () => {
    const raw = JSON.parse('{"s":[{"__proto__":{"w":"cannon"}},{"w":7},{"w":["cannon"]}]}');
    expect(repairSpots(raw, 'PAST')).toEqual(emptySpots());
  });
  it('parseBases repairs spots inside every slot', () => {
    const parsed = parseBases({
      players: {
        alex: {
          PAST: { chosen: 0, slots: [{ v: 1, p: [], s: [{ w: 'laser' }, { w: 'cannon' }] }] },
        },
      },
    });
    expect(parsed?.players.alex?.PAST.slots[0]?.s).toEqual([{}, { w: 'cannon' }, {}, {}]);
  });
});
