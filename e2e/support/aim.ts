// Finds an aim (angle and power) that gives a wanted result, using the real game rules.
// The test then enters it with the arrow keys, exactly as a player would.
import { simulateShot } from '../../src/game/ballistics';
import { AIM, PHASE1_LAYOUT, TEAM_FACING } from '../../src/game/config';
import { classifyBlast } from '../../src/game/damage';
import { otherTeam, type AimInput, type BlastResult, type Team } from '../../src/game/types';

export type Wanted = BlastResult;

type Found = { aim: AimInput; steps: number };

/** How a shot would be scored. Mirrors createMatch().shotLanded() with no hidden extras. */
export function scoreAim(
  team: Team,
  wind: number,
  aim: AimInput,
): { result: BlastResult; steps: number } {
  const flight = simulateShot({
    ...aim,
    origin: PHASE1_LAYOUT.launchOrigins[team],
    facing: TEAM_FACING[team],
    wind,
    layout: PHASE1_LAYOUT,
  });
  const flewAway = flight.hit.kind === 'out_of_bounds' || flight.hit.kind === 'timeout';
  const result: BlastResult = flewAway
    ? 'miss'
    : classifyBlast(flight.landing, PHASE1_LAYOUT.bases[otherTeam(team)]);
  return { result, steps: flight.steps };
}

/** Key presses needed to go from one value to another (Shift+arrow moves by 5). */
export function pressesFor(from: number, to: number): number {
  const d = Math.abs(to - from);
  return Math.floor(d / AIM.stepCoarse) + (d % AIM.stepCoarse);
}

/**
 * The cheapest aim that scores `wanted`. Cost is key presses, plus a small cost for long
 * flights so a wanted 'miss' is also a short one.
 */
export function findAim(team: Team, wind: number, from: AimInput, wanted: Wanted): AimInput {
  let best: (Found & { cost: number }) | null = null;
  for (let angleDeg = AIM.angleMinDeg; angleDeg <= AIM.angleMaxDeg; angleDeg++) {
    for (let power = AIM.powerMin; power <= AIM.powerMax; power++) {
      const aim = { angleDeg, power };
      const s = scoreAim(team, wind, aim);
      if (s.result !== wanted) continue;
      const cost =
        pressesFor(from.angleDeg, angleDeg) + pressesFor(from.power, power) + s.steps / 30;
      if (!best || cost < best.cost) best = { aim, steps: s.steps, cost };
    }
  }
  if (!best) throw new Error(`No aim gives a ${wanted} for ${team} with wind ${wind}.`);
  return best.aim;
}
