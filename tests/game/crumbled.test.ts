// Which sides lost bricks of their saved built base in a match. Victory tells those sides their
// saved base is safe (owner, 2026-10-25). A match never changes a saved base.
import { describe, expect, it } from 'vitest';
import { crumbledTeams } from '../../src/game/crumbled';
import { createMatch } from '../../src/game/match';
import type { BrickView, Match, MatchOptions } from '../../src/game/types';
import { PLAYERS } from '../scenes/battle/flowHarness';
import { HUGE, TYPICAL } from '../helpers/builtBases';

const brickView = (team: BrickView['team'], alive: boolean): BrickView => ({
  team,
  piece: 'stone',
  hp: alive ? 10 : 0,
  maxHp: 10,
  box: { x: 0, y: 0, w: 10, h: 10 },
  alive,
});

const withBricks = (bricks: Record<string, BrickView> | undefined): Pick<Match, 'bricks'> =>
  ({ bricks }) as Pick<Match, 'bricks'>;

describe('crumbledTeams', () => {
  it('is empty when no side brought a built base', () => {
    expect(crumbledTeams(withBricks(undefined))).toEqual([]);
  });

  it('is empty when every brick still stands', () => {
    expect(
      crumbledTeams(
        withBricks({ 'PAST:0': brickView('PAST', true), 'FUTURE:0': brickView('FUTURE', true) }),
      ),
    ).toEqual([]);
  });

  it('names a side once, however many of its bricks fell', () => {
    expect(
      crumbledTeams(
        withBricks({
          'PAST:0': brickView('PAST', true),
          'FUTURE:0': brickView('FUTURE', false),
          'FUTURE:1': brickView('FUTURE', false),
        }),
      ),
    ).toEqual(['FUTURE']);
  });

  it('names both sides, Team Past first, when both lost bricks', () => {
    expect(
      crumbledTeams(
        withBricks({ 'FUTURE:0': brickView('FUTURE', false), 'PAST:3': brickView('PAST', false) }),
      ),
    ).toEqual(['PAST', 'FUTURE']);
  });

  it('reads a real match: nothing at the start, the hit side after a brick falls', () => {
    const opts: MatchOptions = {
      players: PLAYERS,
      seed: 7,
      disturbances: false,
      characterHealth: false,
      baseInBattle: true,
      squads: false,
      bases: { PAST: TYPICAL('PAST'), FUTURE: HUGE('FUTURE') },
    };
    const fresh = createMatch(opts);
    expect(crumbledTeams(fresh.snapshot())).toEqual([]);
    for (let power = 100; power >= 20; power -= 2) {
      for (let angleDeg = 5; angleDeg <= 85; angleDeg += 1) {
        const m = createMatch(opts);
        m.ready();
        m.setAim({ angleDeg, power });
        m.fire();
        if ((m.shotLanded().built?.bricksFell.length ?? 0) > 0) {
          expect(crumbledTeams(m.snapshot())).toEqual(['FUTURE']);
          return;
        }
      }
    }
    throw new Error('no aim knocks out a brick');
  });
});
