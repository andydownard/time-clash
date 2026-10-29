// A fresh game with the default fighters plays exactly like the one-launcher game did.
import { describe, expect, it } from 'vitest';
import { SQUADS } from '../../src/game/config';
import { DAMAGE } from '../../src/game/config';
import { createMatch } from '../../src/game/match';
import type { Players } from '../../src/game/types';

const PLAYERS: Players = [
  { name: 'Alex', team: 'PAST', grade: 5, subject: 'math' },
  { name: 'Sam', team: 'FUTURE', grade: 2, subject: 'reading' },
];

const AIMS = [
  { angleDeg: 40, power: 75 },
  { angleDeg: 55, power: 90 },
  { angleDeg: 30, power: 100 },
  { angleDeg: 62, power: 85 },
  { angleDeg: 48, power: 80 },
  { angleDeg: 35, power: 95 },
];

function playTrace(seed: number, extra: { squads?: boolean } = {}): string[] {
  const c = createMatch({ disturbances: false, players: PLAYERS, seed, ...extra });
  const out: string[] = [];
  let i = 0;
  for (let t = 0; t < 6 && c.snapshot().status === 'PLAYING'; t++) {
    c.ready();
    for (let s = 0; s < 2 && c.snapshot().status === 'PLAYING'; s++) {
      c.setAim(AIMS[i++ % AIMS.length] as (typeof AIMS)[number]);
      const r = c.fire();
      const o = c.shotLanded();
      const hp = c.snapshot().baseHp;
      // Health lost so far, so the trace does not depend on full health.
      const lost = `${DAMAGE.startingBaseHp - hp.PAST}/${DAMAGE.startingBaseHp - hp.FUTURE}`;
      out.push(
        `${r.steps}|${r.landing.x.toFixed(3)},${r.landing.y.toFixed(3)}|${o.result}|${o.damage}|${lost}`,
      );
    }
    if (c.snapshot().status === 'OVER') break;
    c.reloadDone({ correct: false, elapsedMs: 1000 });
    c.pass();
  }
  return out;
}

describe('default fighters reproduce the one-launcher game', () => {
  it('matches the trace recorded before fighters existed', () => {
    // The old game ended when a base lost 100. Full health is bigger now, so the match plays
    // on past the recording; every recorded shot must still match exactly.
    for (const [seed, golden] of [
      [7, GOLDEN_7],
      [12345, GOLDEN_12345],
    ] as const) {
      const trace = playTrace(seed);
      expect(trace.length).toBeGreaterThanOrEqual(golden.length);
      expect(trace.slice(0, golden.length)).toEqual(golden);
    }
  });
  it('is the same with Squads on or off while no dasher walks out', () => {
    const on = playTrace(7, { squads: true });
    expect(on.slice(0, GOLDEN_7.length)).toEqual(GOLDEN_7);
    expect(playTrace(7, { squads: false })).toEqual(on);
  });
});

/**
 * Both sides walk their dasher out whenever he is home, Bonk! with him whenever something is next
 * to him (the helper first), then fire the rest of their goes. Four turns, with health written as health lost, so the trace holds when balance numbers change.
 */
function dasherTrace(seed: number): string[] {
  const c = createMatch({ disturbances: false, players: PLAYERS, seed, squads: true });
  const max = c.snapshot().maxBaseHp;
  const full = c.snapshot().squads!.maxHp;
  const out: string[] = [];
  let i = 0;
  for (let t = 0; t < 4 && c.snapshot().status === 'PLAYING'; t++) {
    for (const w of c.ready()) out.push(`walk|${w.team}|${w.from}>${w.to}`);
    const team = c.snapshot().turn.team;
    if (c.snapshot().status === 'OVER') break;
    c.selectHelper(`${team}-dasher`);
    const [kind] = c.bonkTargets();
    if (
      c.snapshot().squads!.crew.helpers.find((h) => h.id === `${team}-dasher`)!.state === 'home'
    ) {
      out.push(`dash|${team}|${c.dash(c.helperTargets()[0]!).to}`);
    } else if (kind) {
      const b = c.bonk(kind);
      out.push(
        b.target.kind === 'base'
          ? `bonk|${team}|base-${b.target.damage === SQUADS.standBonkDamage ? 'bonk' : b.target.damage}`
          : `bonk|${team}|helper-lost-${full - b.target.hp}`,
      );
      if (c.snapshot().status === 'OVER') break;
    }
    c.selectHelper(`${team}-launcher`);
    while (c.snapshot().turn.phase === 'AIMING' && c.snapshot().status === 'PLAYING') {
      c.setAim(AIMS[i++ % AIMS.length] as (typeof AIMS)[number]);
      c.fire();
      const o = c.shotLanded();
      const hp = c.snapshot().baseHp;
      const d = o.dasher ? `|dasher-${o.dasher.result}-lost-${full - o.dasher.hp}` : '';
      const lost = `${max.PAST - hp.PAST}/${max.FUTURE - hp.FUTURE}`;
      out.push(
        `shot|${team}|${o.result}|${o.damage > 0 ? 'hit' : 'none'}|${lost === '0/0' ? 'none' : 'some'}${d}`,
      );
    }
    if (c.snapshot().status === 'OVER') break;
    c.reloadDone({ correct: false, elapsedMs: 1000 });
    c.pass();
  }
  return out;
}

describe('walking dashers replay exactly', () => {
  it('matches the trace recorded when Bonk! became a go the player chooses', () => {
    expect(dasherTrace(7)).toEqual(DASHER_GOLDEN_7);
  });
});

/** Recorded from the code before fighters existed (seeds 7 and 12345). The last field is health lost (Past/Future). */
const GOLDEN_7: string[] = [
  '92|1069.834,490.000|direct|25|0/25',
  '121|1271.753,342.082|miss|0|0/25',
  '80|2.770,410.000|miss|0|0/25',
  '135|207.049,470.000|direct|25|25/25',
  '111|1198.319,490.000|direct|25|25/50',
  '86|1279.986,370.582|miss|0|25/50',
  '101|240.000,592.372|direct|25|50/50',
  '132|117.878,470.000|direct|25|75/50',
  '80|1279.930,390.000|miss|0|75/50',
  '138|1104.414,490.000|direct|25|75/75',
  '107|218.218,470.000|direct|25|100/75',
];
const GOLDEN_12345: string[] = [
  '104|1040.000,598.923|direct|25|0/25',
  '136|1149.546,490.000|direct|25|0/50',
  '76|8.522,387.667|miss|0|0/50',
  '140|5.402,538.939|miss|0|0/50',
  '117|1040.000,549.450|direct|25|0/75',
  '97|1273.056,449.341|miss|0|0/75',
  '95|240.000,538.063|direct|25|25/75',
  '135|1.907,507.095|miss|0|25/75',
  '78|1278.609,378.500|miss|0|25/75',
  '138|1183.854,490.000|direct|25|25/100',
];

/** Recorded when Bonk! became a go the player chooses, 2026-10-28 (seed 7). */
const DASHER_GOLDEN_7: string[] = [
  'dash|PAST|g3',
  'shot|PAST|direct|hit|some',
  'dash|FUTURE|g4',
  'shot|FUTURE|miss|none|some',
  'bonk|PAST|helper-lost-2',
  'shot|PAST|miss|none|some',
  'bonk|FUTURE|helper-lost-2',
  'shot|FUTURE|direct|hit|some',
];
