// A built base is big and stands on its place (owner reports, 2026-10-28: "still too small").
// Every castle place and Austin spot, with a tiny, a typical and a huge saved base for both teams:
// the base is drawn big, its bricks keep clear of the team cards and the control bar, the footing
// under it is as wide as it, and the message lane and the angle number touch no brick.
// Set BASE_SHOTS=<folder> to also save a screenshot of each one.
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { chooseSlot, freshBases, saveSlot, type BasesState } from '../src/game/baseBuilder';
import { FORTS, SPOTS, WORLD } from '../src/game/config';
import { MESSAGE_LANE } from '../src/ui/messageLane';
import { HUGE, TINY, TYPICAL } from '../tests/helpers/builtBases';
import { FUTURE_SIDE, PAST_SIDE, fillTeam, readyUp, tid, toSetup } from './support/game';

const SIZES = { tiny: TINY, typical: TYPICAL, huge: HUGE } as const;
type Size = keyof typeof SIZES;

function basesFor(past: Size, future: Size): BasesState {
  let st = freshBases();
  st = saveSlot(st, PAST_SIDE.name, 'PAST', 0, SIZES[past]('PAST').pieces);
  st = chooseSlot(st, PAST_SIDE.name, 'PAST', 0);
  st = saveSlot(st, FUTURE_SIDE.name, 'FUTURE', 0, SIZES[future]('FUTURE').pieces);
  return chooseSlot(st, FUTURE_SIDE.name, 'FUTURE', 0);
}

const forts = Object.keys(FORTS) as (keyof typeof FORTS)[];
const spots = Object.keys(SPOTS) as (keyof typeof SPOTS)[];

async function start(
  page: Page,
  fort: string,
  spot: string,
  past: Size,
  future: Size,
): Promise<void> {
  await toSetup(page);
  await fillTeam(page, 'PAST', PAST_SIDE);
  await fillTeam(page, 'FUTURE', FUTURE_SIDE);
  await page.evaluate(() => window.__timeclash!.setSeed(4242));
  await tid(page, 'setup-next').click();
  await expect(tid(page, 'camp-start')).toBeVisible({ timeout: 10_000 });
  const st = basesFor(past, future);
  await page.evaluate((s) => localStorage.setItem('timeclash.bases', JSON.stringify(s)), st);
  await tid(page, 'camp-start').click();
  await tid(page, `plan-fort-${fort}`).click();
  await tid(page, `plan-spot-${spot}`).click();
  await tid(page, 'plan-go').click();
  await expect(tid(page, 'pass-screen')).toBeVisible({ timeout: 10_000 });
  await readyUp(page);
}

type Box = { x: number; y: number; w: number; h: number };

for (const [index, fort] of forts.entries()) {
  const spot = spots[index]!;
  for (const [past, future] of [
    ['typical', 'typical'],
    ['tiny', 'huge'],
    ['huge', 'tiny'],
  ] as const) {
    test(`${fort} and ${spot}: a ${past} and a ${future} base are big, stand on the place and clear the HUD`, async ({
      page,
    }, info) => {
      await start(page, fort, spot, past, future);
      const layers = await page.evaluate(() => window.__timeclash!.bricks());
      expect(layers.map((l) => l.drawn).every((n) => n > 0)).toBe(true);
      const canvas = (await page.locator('canvas').first().boundingBox())!;
      const k = canvas.width / WORLD.width;
      const cards = [
        await tid(page, 'base-hp-PAST').locator('xpath=ancestor::*[@data-team][1]').boundingBox(),
        await tid(page, 'base-hp-FUTURE').locator('xpath=ancestor::*[@data-team][1]').boundingBox(),
        await tid(page, 'fire').boundingBox(),
      ];
      const lane = {
        x: MESSAGE_LANE.x,
        y: MESSAGE_LANE.y,
        w: MESSAGE_LANE.w,
        h: MESSAGE_LANE.h,
      };
      const want = { tiny: 40, typical: 330, huge: 330 } as const;
      for (const layer of layers) {
        const size = layer.team === 'PAST' ? past : future;
        const boxes = layer.boxes as Box[];
        const left = Math.min(...boxes.map((b) => b.x));
        const right = Math.max(...boxes.map((b) => b.x + b.w));
        expect(right - left, `${layer.team} ${size} width`).toBeGreaterThanOrEqual(want[size]);
        expect(right - left, `${layer.team} ${size} width`).toBeLessThanOrEqual(WORLD.width / 3);
        for (const b of boxes) {
          const s = {
            x: canvas.x + b.x * k,
            y: canvas.y + b.y * k,
            width: b.w * k,
            height: b.h * k,
          };
          for (const c of cards) {
            expect(c).not.toBeNull();
            const hit =
              s.x < c!.x + c!.width &&
              c!.x < s.x + s.width &&
              s.y < c!.y + c!.height &&
              c!.y < s.y + s.height;
            expect(hit, `${layer.team} brick under the HUD`).toBe(false);
          }
          const inLane =
            b.x < lane.x + lane.w &&
            lane.x < b.x + b.w &&
            b.y < lane.y + lane.h &&
            lane.y < b.y + b.h;
          expect(inLane, `${layer.team} brick in the message lane`).toBe(false);
        }
      }
      const dir = process.env.BASE_SHOTS;
      if (dir) {
        mkdirSync(dir, { recursive: true });
        await page.screenshot({
          path: join(dir, `${fort}-${spot}-${past}-${future}-${info.project.name}.png`),
        });
      }
    });
  }
}
