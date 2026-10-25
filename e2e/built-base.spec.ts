// Built bases in battle (on for everyone, 2026-10-25). A family builds a base, starts a match,
// and sees its own bricks on the field where the castle was. Shells hit the bricks, the HUD shows
// the brick total, and a brick that is knocked out puffs, tumbles and fades. Nobody is hurt.
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { simulateShot } from '../src/game/ballistics';
import { chooseSlot, freshBases, saveSlot, type BasesState } from '../src/game/baseBuilder';
import { cutAtWalls, flightLayout, type Wall } from '../src/game/builtBase';
import { AIM, TEAM_FACING, WORLD } from '../src/game/config';
import type { AimInput, BattleLayout, BrickId, BrickView, Match, Team } from '../src/game/types';
import { HUGE, TINY, TYPICAL } from '../tests/helpers/builtBases';
import { pressesFor } from './support/aim';
import {
  FUTURE_SIDE,
  PAST_SIDE,
  enterAim,
  readyUp,
  snap,
  startMatch,
  tid,
  toSetup,
} from './support/game';

const SIZES = { tiny: TINY, typical: TYPICAL, huge: HUGE } as const;
type Size = keyof typeof SIZES;

/** Saves a base for each player and picks it, the way Build Base does. */
function basesFor(past: Size, future: Size): BasesState {
  let st = freshBases();
  st = saveSlot(st, PAST_SIDE.name, 'PAST', 0, SIZES[past]('PAST').pieces);
  st = chooseSlot(st, PAST_SIDE.name, 'PAST', 0);
  st = saveSlot(st, FUTURE_SIDE.name, 'FUTURE', 0, SIZES[future]('FUTURE').pieces);
  return chooseSlot(st, FUTURE_SIDE.name, 'FUTURE', 0);
}

async function startWithBases(page: Page, past: Size, future: Size): Promise<Match> {
  await toSetup(page);
  const st = basesFor(past, future);
  await startMatch(page, PAST_SIDE, FUTURE_SIDE, 4242, async () => {
    await page.evaluate((s) => localStorage.setItem('timeclash.bases', JSON.stringify(s)), st);
  });
  const m = await snap(page);
  expect(m.builtBase).toEqual({ PAST: true, FUTURE: true });
  return m;
}

const bricksDrawn = (page: Page) => page.evaluate(() => window.__timeclash!.bricks());

/** Every brick picture is on the field (the pictures load as images, so wait for them). */
async function waitDrawn(page: Page, m: Match): Promise<void> {
  const want = (team: Team) => Object.values(m.bricks!).filter((b) => b.team === team).length;
  await expect
    .poll(async () => (await bricksDrawn(page)).map((l) => `${l.team}:${l.drawn}`).join(' '), {
      timeout: 15_000,
    })
    .toBe(`PAST:${want('PAST')} FUTURE:${want('FUTURE')}`);
}

type Box = { x: number; y: number; width: number; height: number };
const overlaps = (a: Box, b: Box): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/** No brick may sit under a team card or the control bar. */
async function expectBricksClear(page: Page, where: string): Promise<void> {
  const canvas = (await page.locator('canvas').first().boundingBox())!;
  const k = canvas.width / WORLD.width;
  const cards = [
    await tid(page, 'base-hp-PAST').locator('xpath=ancestor::*[@data-team][1]').boundingBox(),
    await tid(page, 'base-hp-FUTURE').locator('xpath=ancestor::*[@data-team][1]').boundingBox(),
    await tid(page, 'fire').boundingBox(),
  ];
  for (const layer of await bricksDrawn(page)) {
    for (const b of layer.boxes) {
      const s = { x: canvas.x + b.x * k, y: canvas.y + b.y * k, width: b.w * k, height: b.h * k };
      for (const c of cards) {
        expect(c, `${where}: card box`).not.toBeNull();
        expect(overlaps(s, c!), `${where}: a ${layer.team} brick sits under the HUD`).toBe(false);
      }
    }
  }
}

/** A Team Past aim (default launcher) whose shell stops on a Future brick picked by `pick`. */
function aimAtBrick(m: Match, layout: BattleLayout, pick: (id: BrickId) => boolean): AimInput {
  const fly = flightLayout(layout, m.builtBase!);
  const walls: Wall[] = (Object.entries(m.bricks!) as Array<[BrickId, BrickView]>)
    .filter(([, b]) => b.team === 'FUTURE' && b.alive)
    .map(([id, b]) => ({ kind: 'brick', id, box: b.box }));
  let best: { aim: AimInput; cost: number } | null = null;
  for (let angleDeg = AIM.angleMinDeg; angleDeg <= AIM.angleMaxDeg; angleDeg++) {
    for (let power = AIM.powerMin; power <= AIM.powerMax; power++) {
      const r = cutAtWalls(
        simulateShot({
          angleDeg,
          power,
          origin: layout.launchOrigins.PAST,
          facing: TEAM_FACING.PAST,
          wind: m.wind,
          layout: fly,
        }),
        walls,
        false,
      );
      const id = r.stoppedBy?.id as BrickId | undefined;
      if (!id || !pick(id)) continue;
      const from = m.aim.PAST;
      const cost = pressesFor(from.angleDeg, angleDeg) + pressesFor(from.power, power);
      if (!best || cost < best.cost) best = { aim: { angleDeg, power }, cost };
    }
  }
  if (!best) throw new Error('no aim at a brick');
  return best.aim;
}

for (const [past, future] of [
  ['tiny', 'huge'],
  ['typical', 'typical'],
  ['huge', 'tiny'],
] as const) {
  test(`a ${past} Past base and a ${future} Future base stand where the castles were`, async ({
    page,
  }, info) => {
    const m = await startWithBases(page, past, future);
    await readyUp(page);
    await waitDrawn(page, m);
    // The HUD shows the brick total on one line, as "N / M".
    const pill = tid(page, 'base-hp-FUTURE');
    await expect(pill).toContainText(`${m.baseHp.FUTURE}`);
    await expectBricksClear(page, `${past}/${future}`);
    await page.screenshot({
      path: info.outputPath(`built-${past}-${future}-${info.project.name}.png`),
    });
  });
}

test('a shell knocks out a top brick: it crumbles, the HUD drops, nobody is hurt', async ({
  page,
}, info) => {
  const m = await startWithBases(page, 'typical', 'typical');
  await readyUp(page);
  await waitDrawn(page, m);
  const layout = (await page.evaluate(() => window.__timeclash!.layout()))!;
  // A top brick holds a small share of the health, so one direct hit knocks it out.
  const aim = aimAtBrick(m, layout, (id) => m.bricks![id]!.grounded === false);
  await enterAim(page, 'PAST', aim);
  await page.keyboard.press('Space');
  await expect
    .poll(async () => (await snap(page)).stats.PAST.shotsFired, { timeout: 15_000 })
    .toBe(1);
  // The crumble plays after the blast.
  await expect
    .poll(async () => (await bricksDrawn(page)).find((l) => l.team === 'FUTURE')!.crumbled, {
      timeout: 20_000,
    })
    .toBeGreaterThan(0);
  await page.screenshot({ path: info.outputPath(`built-crumble-${info.project.name}.png`) });
  const after = await snap(page);
  expect(after.baseHp.FUTURE).toBeLessThan(m.baseHp.FUTURE);
  expect(after.maxBaseHp.FUTURE).toBe(m.maxBaseHp.FUTURE);
  await expect(tid(page, 'base-hp-FUTURE')).toContainText(`${after.baseHp.FUTURE}`);
  // The shooter's own fighters and base are untouched.
  expect(after.baseHp.PAST).toBe(m.baseHp.PAST);
  await expectBricksClear(page, 'after the crumble');
});
