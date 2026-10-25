// The walking dasher in the battle flow: he walks out, bonks at the start of every turn (both
// sides' turns), comes back, wobbles when a shell lands near, and tumbles home dizzy at 0.
// Every line has a caption. The view only draws; the rules decide.
import { describe, expect, it } from 'vitest';
import { SQUAD_COPY } from '../../../src/data/copy';
import { CHARACTER_HEALTH, SQUADS } from '../../../src/game/config';
import { dasherBox, dasherHomePoint, dasherOf, groundSpotPoint } from '../../../src/game/crew';
import { classifyBlast } from '../../../src/game/damage';
import { createMatch } from '../../../src/game/match';
import type { AimInput, MatchController } from '../../../src/game/types';
import { PLAYERS, makeWorld, settle } from './flowHarness';

const SEED = 7;
const PAST_NAME = SQUAD_COPY.helperName['PAST-dasher'] as string;
const FUTURE_NAME = SQUAD_COPY.helperName['FUTURE-dasher'] as string;
const SAFE: AimInput = { angleDeg: 90, power: 0 };

type World = ReturnType<typeof makeWorld>;
const start = async (): Promise<World> => {
  const w = makeWorld({ seed: SEED, matchOptions: { squads: true } });
  void w.flow.run();
  await settle();
  return w;
};
const dash = async (w: World, team: 'PAST' | 'FUTURE') => {
  w.handlers()!.onHelper!(`${team}-dasher`);
  w.handlers()!.onDash!(w.match.helperTargets()[0]!);
  await settle();
};
const fire = async (w: World, team: 'PAST' | 'FUTURE', aim: AimInput = SAFE) => {
  w.handlers()!.onHelper!(`${team}-launcher`);
  w.handlers()!.onAim(aim);
  w.handlers()!.onFire();
  await settle();
};
const LAYOUT = createMatch({ players: PLAYERS, seed: SEED }).layout;
const x = (spot: string) => Math.round(groundSpotPoint(spot, LAYOUT).x);
const home = (team: 'PAST' | 'FUTURE') => Math.round(dasherHomePoint(team, LAYOUT).x);

describe('the dasher in the battle flow', () => {
  it('walks out from home to his spot over the middle, with a caption and a step sound', async () => {
    const w = await start();
    await dash(w, 'PAST');
    expect(w.log).toContain(`walk:PAST:${home('PAST')}>${x('g3')}`);
    expect(w.captions).toContain(SQUAD_COPY.walked(PAST_NAME));
    expect(w.sfx).toContain('step');
    expect(dasherOf(w.match.snapshot().squads!.crew, 'PAST').state).toBe('out');
    // The field now draws him on his spot, past the middle obstacle.
    const field = w.fields.at(-1)!;
    const past = field.dashers.find((d) => d.team === 'PAST')!;
    expect(past.at.x).toBe(groundSpotPoint('g3', w.match.layout).x);
    expect(past.at.x).toBeGreaterThan(w.match.layout.width / 2);
    expect(w.coverViolations).toEqual([]);
    w.flow.destroy();
  });

  it('shows spot markers and the target spot while the dasher is picked', async () => {
    const w = await start();
    w.handlers()!.onHelper!('PAST-dasher');
    const field = w.fields.at(-1)!;
    expect(field.spots).toHaveLength(SQUADS.groundSpots);
    expect(field.target?.x).toBe(groundSpotPoint('g3', w.match.layout).x);
    w.flow.destroy();
  });

  it('bonks the enemy base at the start of the enemy turn, after the cover lifts', async () => {
    const w = await start();
    const full = w.match.snapshot().maxBaseHp.FUTURE;
    await dash(w, 'PAST');
    await fire(w, 'PAST');
    const pass = w.log.indexOf('pass:FUTURE');
    const bonk = w.log.findIndex((l) => l.startsWith('bonk:PAST:'));
    expect(pass).toBeGreaterThan(-1);
    expect(bonk).toBeGreaterThan(pass);
    expect(w.log[bonk]).toContain(SQUAD_COPY.bonkWord);
    expect(w.match.snapshot().baseHp.FUTURE).toBe(full - SQUADS.standBonkDamage);
    expect(w.captions).toContain(SQUAD_COPY.bonkBase(PAST_NAME));
    expect(w.sfx).toContain('bonk');
    // The new health shows in the HUD before Team Future aims.
    const aiming = w.hudStates.find((h) => h.activeTeam === 'FUTURE' && h.canFire)!;
    expect(aiming.baseHp.FUTURE).toBe(full - SQUADS.standBonkDamage);
    expect(w.coverViolations).toEqual([]);
    w.flow.destroy();
  });

  it('Come back walks him home as a whole go, and the bar shows him resting', async () => {
    const w = await start();
    await dash(w, 'PAST');
    w.handlers()!.onHelper!('PAST-dasher');
    expect(w.hudStates.at(-1)!.squads!.dasher!.state).toBe('out');
    w.handlers()!.onRecall!();
    await settle();
    expect(w.log).toContain(`walk:PAST:${x('g3')}>${home('PAST')}`);
    expect(w.captions).toContain(SQUAD_COPY.cameBack(PAST_NAME));
    expect(w.log).toContain('reload:PAST');
    expect(dasherOf(w.match.snapshot().squads!.crew, 'PAST').state).toBe('resting');
    w.flow.destroy();
  });

  it('two dashers bonk each other until both tumble and walk home dizzy, with a caption', async () => {
    const w = await start();
    await dash(w, 'PAST');
    await fire(w, 'PAST');
    await dash(w, 'FUTURE');
    await fire(w, 'FUTURE');
    for (let i = 0; i < CHARACTER_HEALTH.hp + 2; i++) {
      const team = w.match.snapshot().turn.team;
      if (dasherOf(w.match.snapshot().squads!.crew, team).state === 'home') break;
      await fire(w, team);
      await fire(w, team);
    }
    expect(w.log).toContain('dasherHit:FUTURE:tumble');
    expect(w.log.some((l) => l.startsWith('walk:FUTURE:') && l.endsWith(':dizzy'))).toBe(true);
    expect(w.captions.some((c) => c?.startsWith(SQUAD_COPY.tumbleHome(FUTURE_NAME)))).toBe(true);
    expect(w.coverViolations).toEqual([]);
    w.flow.destroy();
  });

  it('a shell that lands on him costs a heart: he wobbles, with a caption', async () => {
    const w = await start();
    await dash(w, 'PAST');
    await fire(w, 'PAST');
    const aim = aimAt(w.match);
    await fire(w, 'FUTURE', aim);
    expect(w.log).toContain('dasherHit:PAST:wobble');
    expect(w.captions).toContain(SQUAD_COPY.loseHeart(PAST_NAME));
    expect(dasherOf(w.match.snapshot().squads!.crew, 'PAST').hp).toBe(
      CHARACTER_HEALTH.hp - CHARACTER_HEALTH.directHit,
    );
    w.flow.destroy();
  });
});

/** A Team Future aim that lands right on Team Past's dasher, found with the rules' own preview. */
function aimAt(live: MatchController): AimInput {
  const box = dasherBox(dasherOf(live.snapshot().squads!.crew, 'PAST').spot!, live.layout);
  const before = live.snapshot().aim.FUTURE;
  try {
    for (let power = 0; power <= 100; power++) {
      for (let angleDeg = 90; angleDeg >= 0; angleDeg--) {
        live.setAim({ angleDeg, power });
        const r = live.previewShot();
        if (r.hit.kind === 'out_of_bounds' || r.hit.kind === 'timeout') continue;
        const got = classifyBlast(r.landing, box, {
          direct: CHARACTER_HEALTH.directScale,
          near: CHARACTER_HEALTH.nearScale,
        });
        if (got === 'direct') return { angleDeg, power };
      }
    }
  } finally {
    live.setAim(before);
  }
  throw new Error('no aim at the dasher');
}
