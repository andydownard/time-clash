import { describe, expect, it } from 'vitest';
import {
  answerReload,
  chooseShot,
  chooseShotWith,
  profileOf,
  reloadChance,
  type BotQuestion,
} from '../../src/game/bot';
import { playBotMatch } from '../../src/game/botPlay';
import { simulateShot } from '../../src/game/ballistics';
import { AIM, BOT_LEVELS, PHASE1_LAYOUT, PRACTICE_BOT, TEAM_FACING } from '../../src/game/config';
import { createMatch } from '../../src/game/match';
import { createRng } from '../../src/game/rng';
import { classifyBlast } from '../../src/game/damage';
import type { Match, Players } from '../../src/game/types';

const players: Players = [
  { name: 'Knight', team: 'PAST', grade: 3, subject: 'math' },
  { name: 'Rocket', team: 'FUTURE', grade: 3, subject: 'math' },
];
const fresh = (seed = 1): Match => {
  const m = createMatch({ players, seed });
  return m.snapshot();
};
const q = (grade: number, kind?: string): BotQuestion => ({
  grade,
  kind,
  choices: ['a', 'b', 'c', 'd'],
  answer: 'c',
});

describe('practice bot flag', () => {
  it('is off by default and named Computer player', () => {
    expect(PRACTICE_BOT.enabled).toBe(false);
    expect(PRACTICE_BOT.displayName).toBe('Computer player');
    expect(PRACTICE_BOT.displayName).not.toMatch(/\b(bot|ai|assistant)\b/i);
  });
});

describe('chooseShot', () => {
  it('is deterministic for the same seed', () => {
    for (const level of BOT_LEVELS) {
      const a = chooseShot(fresh(), 'PAST', level, createRng(5));
      const b = chooseShot(fresh(), 'PAST', level, createRng(5));
      expect(a).toEqual(b);
    }
  });

  it('always returns a legal, integer, in-range aim for both sides, all levels and winds', () => {
    const rng = createRng(9);
    for (const level of BOT_LEVELS)
      for (const side of ['PAST', 'FUTURE'] as const)
        for (let seed = 0; seed < 30; seed++) {
          const state = { ...fresh(seed), wind: rng.int(-80, 80) };
          const s = chooseShot(state, side, level, rng);
          expect(s.angleDeg).toBeGreaterThanOrEqual(AIM.angleMinDeg);
          expect(s.angleDeg).toBeLessThanOrEqual(AIM.angleMaxDeg);
          expect(s.power).toBeGreaterThanOrEqual(AIM.powerMin);
          expect(s.power).toBeLessThanOrEqual(AIM.powerMax);
          expect(Number.isInteger(s.angleDeg) && Number.isInteger(s.power)).toBe(true);
          const m = createMatch({ players, seed, firstTeam: side });
          m.ready();
          m.selectUnit(s.unit);
          m.setAim(s);
          expect(() => m.fire()).not.toThrow();
        }
  }, 60_000);

  it('hard lands near the enemy base far more often than easy', () => {
    const rate = (level: (typeof BOT_LEVELS)[number]): number => {
      const rng = createRng(77);
      let hits = 0;
      const n = 150;
      for (let i = 0; i < n; i++) {
        const state = { ...fresh(i), wind: rng.int(-80, 80) };
        const s = chooseShot(state, 'PAST', level, rng);
        const r = simulateShot({
          ...s,
          origin: PHASE1_LAYOUT.launchOrigins.PAST,
          facing: TEAM_FACING.PAST,
          wind: state.wind,
          layout: PHASE1_LAYOUT,
        });
        if (classifyBlast(r.landing, PHASE1_LAYOUT.bases.FUTURE) !== 'miss') hits++;
      }
      return hits / n;
    };
    const [easy, medium, hard] = [rate('easy'), rate('medium'), rate('hard')];
    expect(hard).toBeGreaterThan(medium);
    expect(medium).toBeGreaterThan(easy);
  }, 60_000);

  it('wind skill 0 ignores the wind, skill 1 compensates for it', () => {
    const base = { ...PRACTICE_BOT.scriptedHuman, angleSpreadDeg: 0, powerSpreadPct: 0 };
    const windy = { ...fresh(), wind: 70 };
    const calm = { ...fresh(), wind: 0 };
    const ignore = chooseShotWith(windy, 'PAST', { ...base, windSkill: 0 }, createRng(3));
    const noWind = chooseShotWith(calm, 'PAST', { ...base, windSkill: 0 }, createRng(3));
    expect(ignore).toEqual(noWind);
    const read = chooseShotWith(windy, 'PAST', { ...base, windSkill: 1 }, createRng(3));
    expect(read).not.toEqual(noWind);
  });

  it('uses a chosen fighter as the shooter and falls back to the default for a bad id', () => {
    const state = { ...fresh(), selected: { PAST: 'D', FUTURE: '1' } } as Match;
    expect(chooseShot(state, 'PAST', 'hard', createRng(1)).unit).toBe('D');
    const bad = { ...fresh(), selected: { PAST: 'zz', FUTURE: '1' } } as unknown as Match;
    expect(chooseShot(bad, 'PAST', 'hard', createRng(1)).unit).toBe('C');
  });

  it('plays the Future side too', () => {
    const s = chooseShot(fresh(), 'FUTURE', 'hard', createRng(2));
    expect(s.unit).toBe('1');
  });

  it('rejects an unknown level', () => {
    expect(() => profileOf('expert' as never)).toThrow(RangeError);
  });
});

describe('answerReload', () => {
  it('chance falls with grade, is floored, capped, and rises with level', () => {
    const [e, m, h] = BOT_LEVELS.map((l) => profileOf(l));
    expect(reloadChance(m!, 0)).toBeGreaterThan(reloadChance(m!, 12));
    expect(reloadChance(e!, 0)).toBeLessThan(reloadChance(m!, 0));
    expect(reloadChance(m!, 0)).toBeLessThan(reloadChance(h!, 0));
    expect(reloadChance({ ...e!, reloadAccuracy: 0 }, 5)).toBe(PRACTICE_BOT.reload.floor);
    expect(reloadChance({ ...e!, reloadAccuracy: 2 }, 0)).toBe(PRACTICE_BOT.reload.ceiling);
    expect(reloadChance(e!, Number.NaN)).toBe(reloadChance(e!, 0));
    expect(reloadChance(e!, -3)).toBe(reloadChance(e!, 0));
  });

  it('is right about as often as the chance says', () => {
    for (const level of BOT_LEVELS) {
      const rng = createRng(11);
      let right = 0;
      const n = 3000;
      for (let i = 0; i < n; i++) if (answerReload(q(4), level, rng).correct) right++;
      expect(Math.abs(right / n - reloadChance(profileOf(level), 4))).toBeLessThan(0.04);
    }
  });

  it('picks a real wrong choice when wrong, the key when right', () => {
    const rng = createRng(4);
    for (let i = 0; i < 200; i++) {
      const a = answerReload(q(6), 'easy', rng);
      expect(['a', 'b', 'c', 'd']).toContain(a.answer);
      expect(a.correct).toBe(a.answer === 'c');
    }
  });

  it('survives a question with no wrong choices', () => {
    const only: BotQuestion = { grade: 1, choices: ['c'], answer: 'c' };
    expect(answerReload(only, 'easy', createRng(1)).answer).toBe('c');
  });

  it('delay is human-like: in bounds, slower for reading and higher grades, easy slower than hard', () => {
    const r = PRACTICE_BOT.reload;
    const mean = (level: (typeof BOT_LEVELS)[number], grade: number, kind?: string): number => {
      const rng = createRng(8);
      let sum = 0;
      for (let i = 0; i < 300; i++) {
        const d = answerReload(q(grade, kind), level, rng).delayMs;
        expect(d).toBeGreaterThanOrEqual(r.minDelayMs);
        expect(d).toBeLessThanOrEqual(r.maxDelayMs);
        sum += d;
      }
      return sum / 300;
    };
    expect(mean('medium', 9, 'numeric')).toBeGreaterThan(mean('medium', 1, 'numeric'));
    expect(mean('medium', 5, 'vocab')).toBeGreaterThan(mean('medium', 5, 'numeric'));
    expect(mean('easy', 5, 'choice')).toBeGreaterThan(mean('hard', 5, 'choice'));
  });

  it('clamps the delay at both ends', () => {
    const slow = { ...profileOf('easy'), thinkScale: 100 };
    const quick = { ...profileOf('easy'), thinkScale: 0 };
    return import('../../src/game/bot').then(({ answerReloadWith }) => {
      expect(answerReloadWith(q(12, 'mainidea'), slow, createRng(1)).delayMs).toBe(
        PRACTICE_BOT.reload.maxDelayMs,
      );
      expect(answerReloadWith(q(0), quick, createRng(1)).delayMs).toBe(
        PRACTICE_BOT.reload.minDelayMs,
      );
    });
  });
});

describe('bot matches never stall', () => {
  it('1,000 seeded bot-vs-bot matches all end with a winner', () => {
    let capped = 0;
    for (let i = 0; i < 1000; i++) {
      const level = BOT_LEVELS[i % 3] as (typeof BOT_LEVELS)[number];
      const other = BOT_LEVELS[(i + 1 + (i % 2)) % 3] as (typeof BOT_LEVELS)[number];
      const r = playBotMatch({
        seed: 1000 + i,
        profiles: { PAST: profileOf(level), FUTURE: profileOf(other) },
        firstTeam: i % 2 ? 'FUTURE' : 'PAST',
        grade: (i % 13) as 0,
      });
      if (!r.ended || r.winner === null) capped++;
    }
    expect(capped).toBe(0);
  }, 120_000);

  it('reports not ended when the turn cap is hit', () => {
    const p = profileOf('easy');
    const r = playBotMatch({ seed: 1, profiles: { PAST: p, FUTURE: p }, maxTurns: 1 });
    expect(r).toMatchObject({ winner: null, turns: 1, ended: false });
  });
});
