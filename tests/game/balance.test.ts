// Balance guard (docs/BUILD.md Phase 3): no single purchase wins the game alone. We count how
// many direct hits it takes to wipe a base out, with the shooter's weapon and the defender's
// walls, health and force field. One purchase may change that count by one hit at most.
import { describe, expect, it } from 'vitest';
import {
  effectsFor,
  freshLoadout,
  type TeamEffects,
  type TeamLoadout,
} from '../../src/game/loadout';
import { TEAMS, otherTeam, type Team } from '../../src/game/types';
import { UPGRADES, UPGRADE_MAX_LEVEL } from '../../src/game/upgrades';
import { FORGE, WEAPONS } from '../../src/game/weapons';
import { AMMO, scaleDamage } from '../../src/game/ammo';
import { DAMAGE } from '../../src/game/config';

/** Direct hits needed to wipe out `defender`, ignoring misses and repair. */
function hitsToWipe(shooter: TeamEffects, defender: TeamEffects): number {
  const dmg = Math.max(1, shooter.direct + shooter.directBonus - defender.directCut);
  let hp = defender.maxHp;
  let blocks = defender.shieldHits;
  let hits = 0;
  while (hp > 0) {
    hits += 1;
    if (blocks > 0) blocks -= 1;
    else hp -= dmg;
  }
  return hits;
}

const baseline = (team: Team): TeamEffects => effectsFor(team, freshLoadout(team));

/** Every loadout one purchase away from a fresh one (any weapon or upgrade, at any level). */
function singlePurchases(team: Team): Array<{ what: string; loadout: TeamLoadout }> {
  const out: Array<{ what: string; loadout: TeamLoadout }> = [];
  const fresh = freshLoadout(team);
  for (const w of WEAPONS.filter((x) => x.team === team)) {
    for (let level = 1; level <= FORGE.maxLevel; level++) {
      out.push({
        what: `${w.id} level ${level}`,
        loadout: { ...fresh, weapon: w.id, owned: { ...fresh.owned, [w.id]: level } },
      });
    }
  }
  for (const u of UPGRADES.filter((x) => x.team === team)) {
    for (let level = 1; level <= UPGRADE_MAX_LEVEL; level++) {
      out.push({
        what: `${u.id} level ${level}`,
        loadout: { ...fresh, upgrades: { [u.id]: level } },
      });
    }
  }
  return out;
}

describe('balance: a fresh game', () => {
  it('takes four direct hits to win, for both teams', () => {
    for (const t of TEAMS) expect(hitsToWipe(baseline(t), baseline(otherTeam(t)))).toBe(4);
  });
});

describe('balance: no single purchase wins the game alone', () => {
  const cases = TEAMS.flatMap((t) =>
    singlePurchases(t).map((p) => [t, p.what, p.loadout] as const),
  );

  it.each(cases)('%s %s still leaves a real match (2 to 7 hits)', (team, _what, loadout) => {
    const mine = effectsFor(team, loadout);
    const foe = baseline(otherTeam(team));
    // Attacking with it: a direct-hit win never takes fewer than 2 hits.
    expect(hitsToWipe(mine, foe)).toBeGreaterThanOrEqual(2);
    // Defending with it: the other side still wins within 7 hits.
    expect(hitsToWipe(foe, mine)).toBeLessThanOrEqual(7);
  });

  it('each next level of one choice changes either hit count by at most one hit', () => {
    for (const team of TEAMS) {
      const foe = baseline(otherTeam(team));
      const steps = new Map<string, Array<{ attack: number; defend: number }>>();
      for (const p of singlePurchases(team)) {
        const key = p.what.replace(/ level \d$/, '');
        const mine = effectsFor(team, p.loadout);
        const list = steps.get(key) ?? [];
        list.push({ attack: hitsToWipe(mine, foe), defend: hitsToWipe(foe, mine) });
        steps.set(key, list);
      }
      for (const [key, list] of steps) {
        for (let i = 1; i < list.length; i++) {
          const now = list[i] as { attack: number; defend: number };
          const before = list[i - 1] as { attack: number; defend: number };
          expect(Math.abs(now.attack - before.attack), `${team} ${key} attack`).toBeLessThanOrEqual(
            1,
          );
          expect(Math.abs(now.defend - before.defend), `${team} ${key} defend`).toBeLessThanOrEqual(
            1,
          );
        }
      }
    }
  });
});

describe('balance: everything bought on both sides', () => {
  const maxed = (team: Team): TeamLoadout => {
    const owned = Object.fromEntries(
      WEAPONS.filter((w) => w.team === team).map((w) => [w.id, FORGE.maxLevel]),
    );
    const best = WEAPONS.filter((w) => w.team === team).at(-1)!;
    return {
      weapon: best.id,
      owned,
      upgrades: Object.fromEntries(
        UPGRADES.filter((u) => u.team === team).map((u) => [u.id, UPGRADE_MAX_LEVEL]),
      ),
    };
  };

  it('keeps both sides within one and a half times of each other', () => {
    const past = effectsFor('PAST', maxed('PAST'));
    const future = effectsFor('FUTURE', maxed('FUTURE'));
    const pastWins = hitsToWipe(past, future);
    const futureWins = hitsToWipe(future, past);
    const ratio = Math.max(pastWins, futureWins) / Math.min(pastWins, futureWins);
    expect(ratio).toBeLessThanOrEqual(1.5);
    // A match is still short: about a handful of direct hits, never a grind.
    expect(Math.max(pastWins, futureWins)).toBeLessThanOrEqual(8);
    expect(Math.min(pastWins, futureWins)).toBeGreaterThanOrEqual(3);
  });
});

describe('balance: ammo', () => {
  const special = AMMO.filter((a) => a.id !== 'standard');
  const bestWeapon = (team: Team) => WEAPONS.filter((w) => w.team === team).at(-1)!;

  it('no ammo lifts one hit past one and a half times the baseline direct damage', () => {
    for (const a of AMMO) {
      expect(a.damageScale).toBeLessThanOrEqual(1.5);
      for (const w of WEAPONS) {
        const top = w.direct + (FORGE.maxLevel - 1) * FORGE.directPerLevel;
        expect(scaleDamage(top, a.id), `${w.id} with ${a.id}`).toBeLessThanOrEqual(
          Math.round(top * 1.5),
        );
      }
      expect(scaleDamage(DAMAGE.direct, a.id)).toBeLessThanOrEqual(DAMAGE.direct * 1.5);
    }
  });

  it('a starter weapon with any special ammo still takes at least 3 direct hits', () => {
    for (const a of special) {
      const hits = Math.ceil(DAMAGE.startingBaseHp / scaleDamage(DAMAGE.direct, a.id));
      expect(hits, a.id).toBeGreaterThanOrEqual(3);
    }
  });

  it('keeps the special kinds a choice: limited uses, and a price near a weapon', () => {
    for (const a of special) {
      expect(a.uses).toBeGreaterThan(0);
      expect(a.uses).toBeLessThanOrEqual(3);
      expect(a.cost).toBeGreaterThanOrEqual(8);
      expect(a.cost).toBeLessThanOrEqual(bestWeapon('PAST').cost);
    }
  });

  it('unlocking all ammo costs less than all weapons plus forge levels, and one kind cannot win alone', () => {
    const ammoTotal = special.reduce((sum, a) => sum + a.cost, 0);
    const weaponTotal = WEAPONS.filter((w) => w.team === 'PAST').reduce((s, w) => s + w.cost, 0);
    const forgeTotal = FORGE.upgradeCost.reduce((s, c) => s + c, 0);
    expect(ammoTotal).toBeLessThan(weaponTotal + forgeTotal);
    for (const a of special) {
      expect(a.uses * scaleDamage(DAMAGE.direct, a.id)).toBeLessThan(DAMAGE.startingBaseHp);
    }
  });
});
