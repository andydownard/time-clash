// A fresh game with the default fighters plays exactly like the one-launcher game did.
import { describe, expect, it } from 'vitest';
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

function playTrace(seed: number): string[] {
  const c = createMatch({ players: PLAYERS, seed });
  const out: string[] = [];
  let i = 0;
  for (let t = 0; t < 6 && c.snapshot().status === 'PLAYING'; t++) {
    c.ready();
    for (let s = 0; s < 2 && c.snapshot().status === 'PLAYING'; s++) {
      c.setAim(AIMS[i++ % AIMS.length] as (typeof AIMS)[number]);
      const r = c.fire();
      const o = c.shotLanded();
      const hp = c.snapshot().baseHp;
      out.push(
        `${r.steps}|${r.landing.x.toFixed(3)},${r.landing.y.toFixed(3)}|${o.result}|${o.damage}|${hp.PAST}/${hp.FUTURE}`,
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
    expect(playTrace(7)).toEqual(GOLDEN_7);
    expect(playTrace(12345)).toEqual(GOLDEN_12345);
  });
});

/** Recorded from the code before fighters existed (seeds 7 and 12345). */
const GOLDEN_7: string[] = [
  '92|1069.834,490.000|direct|25|100/75',
  '121|1271.753,342.082|miss|0|100/75',
  '80|2.770,410.000|miss|0|100/75',
  '135|207.049,470.000|direct|25|75/75',
  '111|1198.319,490.000|direct|25|75/50',
  '86|1279.986,370.582|miss|0|75/50',
  '101|240.000,592.372|direct|25|50/50',
  '132|117.878,470.000|direct|25|25/50',
  '80|1279.930,390.000|miss|0|25/50',
  '138|1104.414,490.000|direct|25|25/25',
  '107|218.218,470.000|direct|25|0/25',
];
const GOLDEN_12345: string[] = [
  '104|1040.000,598.923|direct|25|100/75',
  '136|1149.546,490.000|direct|25|100/50',
  '76|8.522,387.667|miss|0|100/50',
  '140|5.402,538.939|miss|0|100/50',
  '117|1040.000,549.450|direct|25|100/25',
  '97|1273.056,449.341|miss|0|100/25',
  '95|240.000,538.063|direct|25|75/25',
  '135|1.907,507.095|miss|0|75/25',
  '78|1278.609,378.500|miss|0|75/25',
  '138|1183.854,490.000|direct|25|75/0',
];
