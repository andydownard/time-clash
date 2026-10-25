// The Weapon Workshop rules: a style, a point budget on three stats, a name, a Scrap cost, and an
// id that can never pass for a catalog weapon. No custom weapon is ever stronger than the best
// catalog weapon of its team at the same level.
import { describe, expect, it } from 'vitest';
import { WORKSHOP } from '../../src/game/config';
import {
  cleanCustomList,
  customAsWeapon,
  customCost,
  customStats,
  customWeaponId,
  designProblem,
  isCustomWeaponId,
  nameProblem,
  nextCustomId,
  parseCustomWeaponId,
  pointsLeft,
  powerScore,
  presetFor,
  rangeOf,
  styleOf,
  typedNameProblem,
  type CustomWeapon,
  type Points,
} from '../../src/game/customWeapons';
import { TEAMS, type Team } from '../../src/game/types';
import { FORGE, weaponById, weaponStats, weaponsOf } from '../../src/game/weapons';
import { BANNED_WORDS } from '../data/copyLintScan';

/** Every legal way to spend the points: each stat within its limits, total within the budget. */
function allAllocations(): Points[] {
  const out: Points[] = [];
  for (let power = WORKSHOP.minPoints; power <= WORKSHOP.maxPoints; power++)
    for (let reach = WORKSHOP.minPoints; reach <= WORKSHOP.maxPoints; reach++)
      for (let splash = WORKSHOP.minPoints; splash <= WORKSHOP.maxPoints; splash++)
        if (power + reach + splash <= WORKSHOP.budget) out.push({ power, reach, splash });
  return out;
}

const bestCatalogScore = (team: Team, level: number): number =>
  Math.max(...weaponsOf(team).map((w) => powerScore(weaponStats(w, level))));

describe('power score and the budget', () => {
  it('scores a weapon as direct + near + reachWeight x (speedScale - 1)', () => {
    expect(powerScore({ direct: 32, near: 12, speedScale: 1.2 })).toBeCloseTo(48, 9);
    expect(powerScore({ direct: 25, near: 10, speedScale: 1 })).toBe(35);
  });

  it('has many legal allocations to sweep', () => {
    expect(allAllocations().length).toBeGreaterThan(50);
  });

  it.each(TEAMS)('%s: no legal allocation at any level beats the best catalog weapon', (team) => {
    let max = 0;
    for (const base of weaponsOf(team)) {
      for (const p of allAllocations()) {
        expect(designProblem({ base: base.id, ...p }, team)).toBeNull();
        const cw = customAsWeapon({ id: customWeaponId(team, 1), base: base.id, name: 'X', ...p });
        for (let level = 1; level <= FORGE.maxLevel; level++) {
          const score = powerScore(weaponStats(cw, level));
          max = Math.max(max, score - (level - 1) * (FORGE.directPerLevel + FORGE.nearPerLevel));
          expect(score).toBeLessThanOrEqual(bestCatalogScore(team, level) + 1e-9);
        }
      }
    }
    // Pinned so a balance change is a deliberate one (docs/GAME_SPEC.md Weapon Workshop).
    expect(max).toBe(43);
    expect(bestCatalogScore(team, 1)).toBeCloseTo(48, 9);
  });

  it('turns points into stats with the config numbers', () => {
    expect(customStats({ power: 1, reach: 1, splash: 1 })).toEqual({
      direct: 19,
      near: 6,
      speedScale: 1,
    });
    expect(customStats({ power: 5, reach: 5, splash: 5 })).toEqual({
      direct: 31,
      near: 14,
      speedScale: 1.2,
    });
    expect(customStats({ power: 2, reach: 3, splash: 4 }).speedScale).toBe(1.1);
  });

  it('names the range like the catalog: short, long, far', () => {
    expect(rangeOf(1)).toBe('short');
    expect(rangeOf(1.05)).toBe('short');
    expect(rangeOf(1.1)).toBe('long');
    expect(rangeOf(1.15)).toBe('long');
    expect(rangeOf(1.2)).toBe('far');
  });

  it('counts the points left', () => {
    expect(pointsLeft({ power: 1, reach: 1, splash: 1 })).toBe(WORKSHOP.budget - 3);
    expect(pointsLeft({ power: 5, reach: 4, splash: 1 })).toBe(0);
  });
});

describe('styles', () => {
  it('uses the team catalog weapons as the three styles', () => {
    expect(styleOf('royalSword')).toBe('short');
    expect(styleOf('elderLongbow')).toBe('long');
    expect(styleOf('ironCannon')).toBe('heavy');
    expect(styleOf('plasmaBlade')).toBe('short');
    expect(styleOf('laserRifle')).toBe('long');
    expect(styleOf('railCannon')).toBe('heavy');
  });

  it('starts each style on a legal preset with points left to spend', () => {
    for (const team of TEAMS) {
      for (const w of weaponsOf(team)) {
        const p = presetFor(w.id);
        expect(designProblem({ base: w.id, ...p }, team)).toBeNull();
        expect(pointsLeft(p)).toBeGreaterThan(0);
      }
    }
    expect(presetFor('royalSword').power).toBeGreaterThan(presetFor('royalSword').reach);
    expect(presetFor('elderLongbow').reach).toBeGreaterThan(presetFor('elderLongbow').power);
    expect(presetFor('ironCannon').splash).toBeGreaterThan(presetFor('ironCannon').power);
  });
});

describe('designProblem (negative paths)', () => {
  const ok = { base: 'royalSword' as const, power: 3, reach: 3, splash: 3 };
  it('accepts a legal design', () => {
    expect(designProblem(ok, 'PAST')).toBeNull();
  });
  it('refuses a style from the other team', () => {
    expect(designProblem({ ...ok, base: 'plasmaBlade' }, 'PAST')).toBe('wrong_team');
    expect(designProblem(ok, 'FUTURE')).toBe('wrong_team');
  });
  it('refuses going over the budget', () => {
    expect(designProblem({ ...ok, power: 5, reach: 5, splash: 1 }, 'PAST')).toBe('bad_design');
  });
  it('refuses a stat under its min or over its max', () => {
    expect(designProblem({ ...ok, power: 0 }, 'PAST')).toBe('bad_design');
    expect(designProblem({ ...ok, power: 6, reach: 1, splash: 1 }, 'PAST')).toBe('bad_design');
  });
  it('refuses junk: fractions, NaN, strings, an unknown style, a custom id as a style', () => {
    expect(designProblem({ ...ok, power: 2.5 }, 'PAST')).toBe('bad_design');
    expect(designProblem({ ...ok, reach: Number.NaN }, 'PAST')).toBe('bad_design');
    expect(designProblem({ ...ok, splash: '3' as unknown as number }, 'PAST')).toBe('bad_design');
    expect(designProblem({ ...ok, base: 'nope' as 'royalSword' }, 'PAST')).toBe('bad_design');
    expect(designProblem({ ...ok, base: 'custom:P:1' as 'royalSword' }, 'PAST')).toBe('bad_design');
    expect(designProblem(null as unknown as typeof ok, 'PAST')).toBe('bad_design');
  });
});

describe('Scrap cost', () => {
  it('costs more for a stronger weapon, never less', () => {
    const rows = allAllocations()
      .map((p) => ({ score: powerScore(customStats(p)), cost: customCost(p) }))
      .sort((a, b) => a.score - b.score);
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i]!.cost).toBeGreaterThanOrEqual(rows[i - 1]!.cost);
    }
  });
  it('the cheapest costs what the first Forge level-up costs', () => {
    expect(Math.min(...allAllocations().map(customCost))).toBe(FORGE.upgradeCost[0]);
    expect(customCost({ power: 1, reach: 1, splash: 1 })).toBe(6);
  });
  it('the strongest costs the most, and as much as the Iron Cannon', () => {
    expect(customCost({ power: 5, reach: 1, splash: 4 })).toBe(24);
    expect(Math.max(...allAllocations().map(customCost))).toBe(weaponById('ironCannon')!.cost);
  });
  it('the table covers every legal score', () => {
    const top = WORKSHOP.cost[WORKSHOP.cost.length - 1]!.upTo;
    for (const p of allAllocations()) expect(powerScore(customStats(p))).toBeLessThanOrEqual(top);
  });
});

describe('weapon names', () => {
  it('accepts a short name of letters, digits and spaces', () => {
    expect(typedNameProblem('Zap 3000', [])).toBe('digits');
    expect(typedNameProblem('Zap 30', [])).toBeNull();
    expect(typedNameProblem('Big Bonk', [])).toBeNull();
    expect(typedNameProblem('  Big   Bonk ', [])).toBeNull();
  });
  it('refuses an empty name, a long name, and odd characters', () => {
    expect(typedNameProblem('', [])).toBe('empty');
    expect(typedNameProblem('   ', [])).toBe('empty');
    expect(typedNameProblem('A'.repeat(WORKSHOP.typedNameMax + 1), [])).toBe('long');
    expect(typedNameProblem('A'.repeat(WORKSHOP.typedNameMax), [])).toBeNull();
    expect(typedNameProblem('Zap!', [])).toBe('letters');
    expect(typedNameProblem('Zap@home.com', [])).toBe('letters');
    expect(typedNameProblem('Zäp', [])).toBe('letters');
    expect(typedNameProblem(42 as unknown as string, [])).toBe('empty');
  });
  it.each(BANNED_WORDS.filter((w) => !w.includes(' ')))('refuses the banned word "%s"', (word) => {
    expect(typedNameProblem(word, [])).toBe('blocked');
    expect(typedNameProblem(`Big ${word.toUpperCase()}`, [])).toBe('blocked');
  });
  it('refuses vocabulary words the game never says, and leet tricks', () => {
    for (const word of ['shop', 'coins', 'money', 'currency', 'k1ll', 'D1E', 'poop']) {
      expect(typedNameProblem(word, [])).toBe('blocked');
    }
  });
  it('keeps personal data out: no player name, no long numbers', () => {
    expect(typedNameProblem('Alex Zapper', ['Alex', 'Sam'])).toBe('private');
    expect(typedNameProblem('zapper sam', ['Alex', 'Sam'])).toBe('private');
    expect(typedNameProblem('Samurai', ['Alex', 'Sam'])).toBeNull();
    expect(typedNameProblem('Zap 555', [])).toBe('digits');
    expect(typedNameProblem('Zap 12', [])).toBeNull();
  });
  it('allows a longer saved name (two picked words) but keeps the same checks', () => {
    expect(nameProblem('Sparkly Pancake', [])).toBeNull();
    expect(nameProblem('A'.repeat(WORKSHOP.savedNameMax + 1), [])).toBe('long');
    expect(nameProblem('Bouncy kill', [])).toBe('blocked');
  });
});

describe('custom weapon ids', () => {
  it('makes an id that carries the side and a serial number', () => {
    expect(customWeaponId('PAST', 3)).toBe('custom:P:3');
    expect(customWeaponId('FUTURE', 12)).toBe('custom:F:12');
    expect(parseCustomWeaponId('custom:P:3')).toEqual({ team: 'PAST', serial: 3 });
    expect(parseCustomWeaponId('custom:F:12')).toEqual({ team: 'FUTURE', serial: 12 });
    expect(isCustomWeaponId('custom:F:12')).toBe(true);
  });
  it('can never read a catalog weapon or junk as a custom weapon', () => {
    for (const bad of [
      'royalSword',
      'custom:royalSword',
      'custom:P:royalSword',
      'custom:P:0',
      'custom:P:01',
      'custom:P:-1',
      'custom:P:1.5',
      'custom:X:1',
      'custom:P:1000',
      'custom:P:1 ',
      'own:P:11',
      '',
      null,
      7,
    ]) {
      expect(parseCustomWeaponId(bad), String(bad)).toBeNull();
      expect(isCustomWeaponId(bad), String(bad)).toBe(false);
      expect(weaponById(String(bad))?.id ?? null).toBe(bad === 'royalSword' ? 'royalSword' : null);
    }
  });
  it('gives each new weapon a fresh id, even with the same name', () => {
    const one: CustomWeapon = {
      id: 'custom:P:1',
      base: 'royalSword',
      name: 'Bonk',
      power: 3,
      reach: 1,
      splash: 1,
    };
    expect(nextCustomId('PAST', [])).toBe('custom:P:1');
    expect(nextCustomId('PAST', [one])).toBe('custom:P:2');
    expect(nextCustomId('PAST', [one, { ...one, id: 'custom:P:5' }])).toBe('custom:P:6');
  });
});

describe('customAsWeapon', () => {
  it('reads like a catalog weapon, with its style and a star of its own', () => {
    const w = customAsWeapon({
      id: 'custom:F:2',
      base: 'laserRifle',
      name: 'Zippy Taco',
      power: 2,
      reach: 5,
      splash: 2,
    });
    expect(w).toMatchObject({
      id: 'custom:F:2',
      team: 'FUTURE',
      name: 'Zippy Taco',
      base: 'laserRifle',
      mine: true,
      direct: 22,
      near: 8,
      speedScale: 1.2,
      range: 'far',
    });
    expect(w.cost).toBe(customCost({ power: 2, reach: 5, splash: 2 }));
    expect(weaponStats(w, 2).direct).toBe(22 + FORGE.directPerLevel);
  });
});

describe('cleanCustomList (a saved list, checked)', () => {
  const good = (n: number, extra: Partial<CustomWeapon> = {}): CustomWeapon => ({
    id: customWeaponId('PAST', n),
    base: 'elderLongbow',
    name: `Bonk ${n}`,
    power: 2,
    reach: 3,
    splash: 2,
    ...extra,
  });

  it('keeps a clean list as it is', () => {
    expect(cleanCustomList([good(1), good(2)], 'PAST')).toEqual([good(1), good(2)]);
  });
  it('returns an empty list for anything that is not a list', () => {
    for (const v of [undefined, null, 'x', 3, {}, { 0: good(1) }]) {
      expect(cleanCustomList(v, 'PAST')).toEqual([]);
    }
  });
  it('drops a corrupt entry and keeps the rest', () => {
    const list = [
      good(1),
      null,
      'custom:P:2',
      { ...good(3), id: 'royalSword' },
      { ...good(4), id: 'custom:F:4' },
      { ...good(5), base: 'laserRifle' },
      { ...good(6), power: 9 },
      { ...good(7), power: 5, reach: 5, splash: 5 },
      { ...good(8), name: 'kill zone' },
      { ...good(9), name: 42 },
      { ...good(10), name: '<b>hi</b>' },
      good(1, { name: 'Same id again' }),
      good(11),
    ];
    expect(cleanCustomList(list, 'PAST').map((c) => c.id)).toEqual(['custom:P:1', 'custom:P:11']);
  });
  it('keeps at most the cap, the first ones', () => {
    const many = Array.from({ length: WORKSHOP.maxPerTeam + 3 }, (_, i) => good(i + 1));
    const kept = cleanCustomList(many, 'PAST');
    expect(kept).toHaveLength(WORKSHOP.maxPerTeam);
    expect(kept[0]!.id).toBe('custom:P:1');
  });
  it('drops extra fields so nothing else rides along', () => {
    const kept = cleanCustomList([{ ...good(1), secret: 'x' }], 'PAST');
    expect(Object.keys(kept[0]!).sort()).toEqual(
      ['base', 'id', 'name', 'power', 'reach', 'splash'].sort(),
    );
  });
});
