// "My weapons" in Build Base: a weapon the player made in the Workshop goes on a base pad like a
// catalog weapon, for no Scrap. The pad keeps its own copy of the weapon, so a weapon renamed or
// gone from the Forge later never breaks a saved base. Old saves load unchanged. Rules only.
import { describe, expect, it } from 'vitest';
import {
  assignWeapon,
  chosenSpots,
  clearSpot,
  emptySpots,
  freshBases,
  newBuild,
  ownedSpotWeaponIds,
  parseBases,
  repairSpots,
  resolveSpots,
  saveSlot,
  serializeBase,
  slotSpots,
  spotDef,
  spotsUsed,
  toSaved,
  undoBuild,
  type BuildState,
  type SpotResult,
} from '../../src/game/baseBuilder';
import { WORKSHOP } from '../../src/game/config';
import { customMountDef, customMountWeapons } from '../../src/game/customMounts';
import type { CustomWeapon } from '../../src/game/customWeapons';
import { forgeCustomWeapon } from '../../src/game/economy';
import { walletOf, type CampState } from '../../src/game/loadout';
import { NAMES, campWith } from '../helpers/camp';

const ok = (r: SpotResult): BuildState => {
  if (!r.ok) throw new Error(`expected ok, got ${r.reason}`);
  return r.state;
};

const BONK: CustomWeapon = {
  id: 'custom:P:1',
  base: 'royalSword',
  name: 'Bonk',
  power: 4,
  reach: 3,
  splash: 3,
};
const ZAP: CustomWeapon = {
  id: 'custom:F:1',
  base: 'plasmaBlade',
  name: 'Zap Zap',
  power: 3,
  reach: 4,
  splash: 3,
};

/** Alex with two Team Past weapons of his own, and Sam with one for Team Future. */
function madeCamp(): CampState {
  let camp = campWith(999, 999);
  const make = (team: 'PAST' | 'FUTURE', w: CustomWeapon) => {
    const out = forgeCustomWeapon(camp, NAMES[team], team, w, w.name);
    if (!out.ok) throw new Error(out.reason);
    camp = out.camp;
  };
  make('PAST', BONK);
  make('PAST', { ...BONK, base: 'ironCannon', power: 5, reach: 1, splash: 4, name: 'Kaboom' });
  make('FUTURE', ZAP);
  return camp;
}
const mineOf = (camp: CampState, team: 'PAST' | 'FUTURE') =>
  walletOf(camp, NAMES[team]).loadout[team].custom ?? [];

describe('customMountDef', () => {
  it('is free, marked as yours, and drawn like the catalog weapon of its style', () => {
    const def = customMountDef(BONK, 'PAST');
    expect(def).toMatchObject({ id: 'custom:P:1', name: 'Bonk', scrap: null, mine: true });
    expect(def.role).toBe('direct');
    expect(def.art).toBe('cannon');
    expect(customMountDef({ ...BONK, base: 'ironCannon' }, 'PAST').art).toBe('catapult');
    expect(customMountDef({ ...BONK, base: 'elderLongbow' }, 'PAST').art).toBe('archerPost');
    expect(customMountDef(ZAP, 'FUTURE').art).toBe('laser');
  });
  it('every style of each team has a catalog picture of the same role', () => {
    for (const team of ['PAST', 'FUTURE'] as const) {
      for (const style of ['short', 'long', 'heavy'] as const) {
        expect(WORKSHOP.mount.art[team][style]).toBeTruthy();
      }
    }
  });
});

describe('mounting a weapon of your own', () => {
  it('puts it on the pad, with a copy of the weapon, for no Scrap', () => {
    const camp = madeCamp();
    const mine = mineOf(camp, 'PAST');
    const s = ok(assignWeapon(newBuild('PAST'), 1, 'custom:P:1', undefined, mine));
    expect(s.spots[1]).toEqual({ weapon: 'custom:P:1', mine: BONK });
    expect(spotsUsed(s.spots)).toBe(1);
    expect(spotDef(s.spots[1]!)).toEqual(customMountDef(BONK, 'PAST'));
    // Owned catalog weapons do not limit it: it was paid for when it was forged.
    const owned = ownedSpotWeaponIds('PAST', []);
    expect(assignWeapon(newBuild('PAST'), 0, 'custom:P:2', owned, mine).ok).toBe(true);
    expect(walletOf(camp, 'Alex').scrap).toBe(walletOf(madeCamp(), 'Alex').scrap);
  });
  it('the same weapon on the same pad changes nothing', () => {
    const mine = mineOf(madeCamp(), 'PAST');
    const s = ok(assignWeapon(newBuild('PAST'), 0, 'custom:P:1', undefined, mine));
    expect(ok(assignWeapon(s, 0, 'custom:P:1', undefined, mine))).toBe(s);
  });
  it('replaces a catalog weapon, is replaced by one, and Undo and Clear spot work', () => {
    const mine = mineOf(madeCamp(), 'PAST');
    let s = ok(assignWeapon(newBuild('PAST'), 2, 'cannon'));
    s = ok(assignWeapon(s, 2, 'custom:P:2', undefined, mine));
    expect(s.spots[2]?.weapon).toBe('custom:P:2');
    expect(s.spots[2]?.mine?.name).toBe('Kaboom');
    s = ok(assignWeapon(s, 2, 'catapult'));
    expect(s.spots[2]).toEqual({ weapon: 'catapult' });
    s = undoBuild(s);
    expect(s.spots[2]?.weapon).toBe('custom:P:2');
    s = ok(clearSpot(s, 2));
    expect(s.spots[2]).toEqual({});
  });
  it('refuses a weapon of the other team, an id not in the list, and junk', () => {
    const camp = madeCamp();
    const past = mineOf(camp, 'PAST');
    const future = mineOf(camp, 'FUTURE');
    const build = newBuild('PAST');
    const refused = (r: SpotResult) => (r.ok ? 'ok' : r.reason);
    // Team Future's weapon, offered to Team Past, even if it sneaks into the list.
    expect(refused(assignWeapon(build, 0, 'custom:F:1', undefined, future))).toBe('unknown');
    expect(refused(assignWeapon(build, 0, 'custom:F:1', undefined, [...past, ZAP]))).toBe(
      'unknown',
    );
    expect(refused(assignWeapon(build, 0, 'custom:P:9', undefined, past))).toBe('unknown');
    expect(refused(assignWeapon(build, 0, 'custom:P:1'))).toBe('unknown');
    expect(refused(assignWeapon(build, 0, 'custom:P:1', undefined, []))).toBe('unknown');
    expect(refused(assignWeapon(build, 0, 'custom:X:1', undefined, past))).toBe('unknown');
    expect(refused(assignWeapon(build, 9, 'custom:P:1', undefined, past))).toBe('nospot');
    // A bad weapon in the list (over budget) is refused too.
    const bad = [{ ...BONK, power: 5, reach: 5, splash: 5 }];
    expect(refused(assignWeapon(build, 0, 'custom:P:1', undefined, bad))).toBe('unknown');
  });
  it('a renamed weapon mounted again takes the new copy', () => {
    const s = ok(assignWeapon(newBuild('PAST'), 0, 'custom:P:1', undefined, [BONK]));
    const renamed = { ...BONK, name: 'Big Bonk' };
    const t = ok(assignWeapon(s, 0, 'custom:P:1', undefined, [renamed]));
    expect(t.spots[0]?.mine?.name).toBe('Big Bonk');
  });
  it('resolveSpots carries the copy for drawing and battle', () => {
    const s = ok(assignWeapon(newBuild('PAST'), 3, 'custom:P:1', undefined, [BONK]));
    const r = resolveSpots(s.pieces, s.spots);
    expect(r[3]?.weapon).toBe('custom:P:1');
    expect(r[3]?.custom).toEqual(customMountDef(BONK, 'PAST'));
    expect(r[0]).not.toHaveProperty('custom');
  });
  it('customMountWeapons lists only the side asked for', () => {
    const camp = madeCamp();
    expect(customMountWeapons(camp, 'Alex', 'PAST').map((d) => d.id)).toEqual([
      'custom:P:1',
      'custom:P:2',
    ]);
    expect(customMountWeapons(camp, 'Sam', 'FUTURE').map((d) => d.id)).toEqual(['custom:F:1']);
    expect(customMountWeapons(camp, 'Alex', 'FUTURE')).toEqual([]);
  });
});

describe('saving a pad with a weapon of your own', () => {
  const mounted = (): BuildState =>
    ok(assignWeapon(newBuild('PAST'), 1, 'custom:P:1', undefined, [BONK]));

  it('saves a short copy and loads it back the same', () => {
    const s = mounted();
    const saved = toSaved(s.pieces, s.spots);
    expect(saved.s?.[1]).toEqual({
      w: 'custom:P:1',
      m: { b: 'royalSword', n: 'Bonk', p: 4, r: 3, s: 3 },
    });
    expect(repairSpots(serializeBase(s.pieces, s.spots), 'PAST')).toEqual(s.spots);
  });
  it('keeps working after the weapon is renamed or gone from the Forge', () => {
    const s = mounted();
    // Spots are saved in the bases, apart from the camp: the camp losing the weapon changes nothing.
    const st = saveSlot(freshBases(), 'Alex', 'PAST', 0, [], s.spots);
    const back = parseBases(JSON.parse(JSON.stringify(st)));
    expect(slotSpots(back!, 'Alex', 'PAST', 0)[1]).toEqual({ weapon: 'custom:P:1', mine: BONK });
    const owned = ownedSpotWeaponIds('PAST', []);
    expect(slotSpots(back!, 'Alex', 'PAST', 0, owned)[1]?.weapon).toBe('custom:P:1');
    const battle = chosenSpots(back!, 'Alex', 'PAST');
    expect(battle[1]?.custom?.name).toBe('Bonk');
  });
  it('an old save (no copies at all) loads exactly as before', () => {
    const old = { v: 1, p: [], s: [{ w: 'cannon' }, {}, { x: 60, y: 70 }, {}] };
    expect(repairSpots(old, 'PAST')).toEqual([{ weapon: 'cannon' }, {}, { x: 60, y: 70 }, {}]);
    const parsed = parseBases({ players: { alex: { PAST: { chosen: 0, slots: [old] } } } });
    expect(parsed?.players.alex?.PAST.slots[0]).toEqual(old);
  });
  it('drops a copy that is missing, broken, over budget, badly named or for the other side', () => {
    const m = { b: 'royalSword', n: 'Bonk', p: 4, r: 3, s: 3 };
    const raw = {
      v: 1,
      p: [],
      s: [
        { w: 'custom:P:1' },
        { w: 'custom:P:1', m: { ...m, p: 5, r: 5, s: 5 } },
        { w: 'custom:P:1', m: { ...m, n: 'kill' } },
        { w: 'custom:F:1', m: { ...m, b: 'plasmaBlade' } },
      ],
    };
    expect(repairSpots(raw, 'PAST')).toEqual(emptySpots());
    expect(
      repairSpots({ s: [{ w: 'custom:P:1', m: { ...m, b: 'plasmaBlade' } }] }, 'PAST'),
    ).toEqual(emptySpots());
    expect(repairSpots({ s: [{ w: 'custom:P:1', m: 'Bonk' }] }, 'PAST')).toEqual(emptySpots());
    expect(repairSpots({ s: [{ w: 'cannon', m }] }, 'PAST')).toEqual([
      { weapon: 'cannon' },
      {},
      {},
      {},
    ]);
  });
  it('a pinned pad keeps its place with a weapon of your own', () => {
    const raw = {
      s: [{ w: 'custom:P:1', m: { b: 'royalSword', n: 'Bonk', p: 4, r: 3, s: 3 }, x: 60, y: 70 }],
    };
    expect(repairSpots(raw, 'PAST')[0]).toEqual({ weapon: 'custom:P:1', mine: BONK, x: 60, y: 70 });
  });
  it('newBuild drops a spot whose copy does not match its id', () => {
    const s = newBuild(
      'PAST',
      [],
      [{ weapon: 'custom:P:2', mine: BONK }, { weapon: 'custom:P:1' }],
    );
    expect(s.spots).toEqual(emptySpots());
  });
});
