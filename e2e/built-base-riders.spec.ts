// Fighters on a built base (owner, 2026-10-25: "Lower them onto the top brick and when the
// building gets destroyed they fall awkwardly and say something funny"). The Cannon Knight and
// the Tank stand on a thin tower on top of their bases. Team Past knocks the Tank's antenna out:
// the Tank falls, flops, stands up on the brick below and says a funny line in a bubble and the
// caption bar. Its next shot leaves from the lower spot. Nothing covers the cards or the bar.
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { simulateShot } from '../src/game/ballistics';
import { chooseSlot, freshBases, saveSlot, type BasesState } from '../src/game/baseBuilder';
import { cutAtWalls, flightLayout, type Wall } from '../src/game/builtBase';
import { AIM, TEAM_FACING, WORLD } from '../src/game/config';
import { RIDER_IDS, riderBricks, riderOrigin } from '../src/game/riders';
import { UNITS } from '../src/game/units';
import type { AimInput, BattleLayout, BrickId, BrickView, Match } from '../src/game/types';
import { baseFallPool } from '../src/data/copy';
import { fighterKeepOut } from '../src/scenes/battle/angleLabel';
import type { RiderDebug } from '../src/scenes/battle/riderArt';
import { baseOf, brick } from '../tests/helpers/builtBases';
import { pressesFor } from './support/aim';
import {
  FUTURE_SIDE,
  PAST_SIDE,
  answerReload,
  enterAim,
  readyUp,
  snap,
  startMatch,
  tapGotIt,
  tid,
  toSetup,
  waitAiming,
  waitPassScreen,
} from './support/game';
import { expectMessageClear } from './support/layout';

/** A foundation and one thin tower on it, right under the side's default fighter. */
const SHAKY = {
  PAST: baseOf([
    ...[6, 8, 10, 12, 14, 16].map((x) => brick('stone', x, 10, 20)),
    brick('tower', 9, 7, 35),
  ]),
  // A strong panel on top takes most of the top bricks' share, so one hit knocks the antenna out.
  FUTURE: baseOf([
    ...[6, 8, 10, 12, 14, 16].map((x) => brick('panel', x, 10, 20)),
    brick('antenna', 11, 7, 10),
    brick('panel', 6, 9, 50),
  ]),
};

function shakyBases(): BasesState {
  let st = freshBases();
  st = saveSlot(st, PAST_SIDE.name, 'PAST', 0, SHAKY.PAST.pieces);
  st = chooseSlot(st, PAST_SIDE.name, 'PAST', 0);
  st = saveSlot(st, FUTURE_SIDE.name, 'FUTURE', 0, SHAKY.FUTURE.pieces);
  return chooseSlot(st, FUTURE_SIDE.name, 'FUTURE', 0);
}

async function start(page: Page): Promise<Match> {
  await toSetup(page);
  const st = shakyBases();
  await startMatch(page, PAST_SIDE, FUTURE_SIDE, 4242, async () => {
    await page.evaluate((s) => localStorage.setItem('timeclash.bases', JSON.stringify(s)), st);
  });
  const m = await snap(page);
  expect(m.builtBase).toEqual({ PAST: true, FUTURE: true });
  return m;
}

const riders = async (page: Page): Promise<RiderDebug[]> =>
  (await page.evaluate(() => window.__timeclash!.bricks())).flatMap((l) => l.riders ?? []);

async function waitDrawn(page: Page, m: Match): Promise<void> {
  const want = Object.values(m.bricks!).length;
  await expect
    .poll(
      async () =>
        (await page.evaluate(() => window.__timeclash!.bricks())).reduce((a, l) => a + l.drawn, 0),
      {
        timeout: 15_000,
      },
    )
    .toBe(want);
}

/** The top of the highest standing brick of this team under x, world px. */
const brickTopUnder = (m: Match, team: 'PAST' | 'FUTURE', x: number): number | null => {
  const tops = Object.values(m.bricks!)
    .filter((b) => b.team === team && b.alive && b.box.x <= x && b.box.x + b.box.w >= x)
    .map((b) => b.box.y);
  return tops.length ? Math.min(...tops) : null;
};

/** A Team Past aim from its default fighter (where it stands now) that stops on `target`. */
function aimAt(m: Match, layout: BattleLayout, target: BrickId): AimInput {
  const origin = riderOrigin('PAST', 'C', layout, riderBricks(m, 'PAST'));
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
          origin,
          facing: TEAM_FACING.PAST,
          wind: m.wind,
          layout: fly,
        }),
        walls,
        false,
      );
      if (r.stoppedBy?.id !== target) continue;
      const from = m.aim.PAST;
      const cost = pressesFor(from.angleDeg, angleDeg) + pressesFor(from.power, power);
      if (!best || cost < best.cost) best = { aim: { angleDeg, power }, cost };
    }
  }
  if (!best) throw new Error(`no aim at ${target}`);
  return best.aim;
}

type Box = { x: number; y: number; width: number; height: number };
const overlaps = (a: Box, b: Box): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/**
 * No fighter that stands on a base (body, tag and arrow), where it stands now, sits under a team
 * card or the bar. The other fighters never move, and layout.spec.ts checks them.
 */
async function expectFightersClear(page: Page, where: string): Promise<void> {
  const layout = (await page.evaluate(() => window.__timeclash!.layout()))!;
  const drops = Object.fromEntries((await riders(page)).map((r) => [r.id, r.dy]));
  const canvas = (await page.locator('#game canvas').boundingBox())!;
  const k = canvas.width / WORLD.width;
  const hud = [
    await tid(page, 'base-hp-PAST').locator('xpath=ancestor::*[@data-team][1]').boundingBox(),
    await tid(page, 'base-hp-FUTURE').locator('xpath=ancestor::*[@data-team][1]').boundingBox(),
    await page.locator('.tc-hud-bottom').first().boundingBox(),
  ];
  const keep = fighterKeepOut(layout, drops);
  const parts = UNITS.flatMap((u, i) =>
    RIDER_IDS.includes(u.id) ? [keep[i * 2]!, keep[i * 2 + 1]!] : [],
  );
  expect(parts).toHaveLength(RIDER_IDS.length * 2);
  for (const r of parts) {
    const s = { x: canvas.x + r.x * k, y: canvas.y + r.y * k, width: r.w * k, height: r.h * k };
    for (const h of hud) {
      expect(h, `${where}: HUD box`).not.toBeNull();
      expect(overlaps(s, h!), `${where}: a fighter sits under the HUD ${JSON.stringify(r)}`).toBe(
        false,
      );
    }
  }
}

async function riderMatch(page: Page, shot: (name: string) => string): Promise<void> {
  const m = await start(page);
  await readyUp(page);
  await waitDrawn(page, m);
  const layout = (await page.evaluate(() => window.__timeclash!.layout()))!;

  // Both default fighters stand on the tower under them, not in the air.
  const before = await riders(page);
  for (const id of ['C', '1'] as const) {
    const r = before.find((x) => x.id === id)!;
    const top = brickTopUnder(m, r.team, r.feet.x);
    expect(top, `${id} has a brick under it`).not.toBeNull();
    expect(r.dy, `${id} stands on its base, not on the old castle spot`).not.toBe(0);
    expect(Math.abs(r.feet.y - top!), `${id} stands on the brick top`).toBeLessThan(1);
  }
  // The angle guide starts where the Cannon Knight stands.
  const aim0 = await page.evaluate(() => window.__timeclash!.aim());
  expect(aim0!.origin).toEqual(riderOrigin('PAST', 'C', layout, riderBricks(m, 'PAST')));
  await expectFightersClear(page, 'standing');
  await page.screenshot({ path: shot('standing') });

  // Knock out the antenna under the Tank with one hit.
  const tank = before.find((x) => x.id === '1')!;
  const antenna = (Object.entries(m.bricks!) as Array<[BrickId, BrickView]>).find(
    ([, b]) => b.team === 'FUTURE' && b.piece === 'antenna',
  )![0];
  expect(m.bricks![antenna]!.hp, 'one direct hit knocks the antenna out').toBeLessThanOrEqual(25);
  // The bubble and the caption last a few seconds, so note them the moment they show.
  await page.evaluate(
    (pool) => {
      const w = window as unknown as { __fall?: Record<string, unknown> };
      w.__fall = {};
      const seen = w.__fall;
      const box = (el: HTMLElement) => {
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height };
      };
      const look = (): void => {
        const cap = document.querySelector<HTMLElement>('[data-testid="caption-bar"]');
        const capText = (cap?.textContent ?? '').trim();
        if (cap && !seen.caption && !cap.hidden && pool.includes(capText) && box(cap).width > 0)
          seen.caption = { text: capText, box: box(cap) };
        const b = document.querySelector<HTMLElement>(
          '[data-testid="speech-bubble"][data-team="FUTURE"]',
        );
        const bText = (b?.textContent ?? '').trim();
        if (b && !seen.bubble && pool.includes(bText)) seen.bubble = { text: bText, box: box(b) };
      };
      new MutationObserver(look).observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
      });
    },
    baseFallPool('FUTURE') as string[],
  );
  await enterAim(page, 'PAST', aimAt(m, layout, antenna));
  await page.keyboard.press('Space');
  await expect
    .poll(async () => (await riders(page)).find((x) => x.id === '1')!.falls, { timeout: 20_000 })
    .toBe(1);
  // It says a funny line: a Team Future bubble and the same words in the caption bar.
  type Seen = { text: string; box: { x: number; y: number; width: number; height: number } };
  const fall = () =>
    page.evaluate(
      () => (window as unknown as { __fall: { bubble?: Seen; caption?: Seen } }).__fall,
    );
  await expect
    .poll(async () => Boolean((await fall()).bubble && (await fall()).caption))
    .toBe(true);
  await page.screenshot({ path: shot('fallen') });
  const { bubble, caption } = (await fall()) as { bubble: Seen; caption: Seen };
  expect(baseFallPool('FUTURE')).toContain(bubble.text);
  expect(caption.text).toBe(bubble.text);
  await expectMessageClear(page, caption.box, 'fall caption');
  await waitAiming(page, 1);

  // It stands on the brick below now, and its next shot leaves from there.
  const after = await snap(page);
  expect(after.bricks![antenna]!.alive).toBe(false);
  const fallen = (await riders(page)).find((x) => x.id === '1')!;
  expect(fallen.dy).toBeGreaterThan(tank.dy);
  const top = brickTopUnder(after, 'FUTURE', fallen.feet.x);
  expect(
    Math.abs(fallen.feet.y - (top ?? layout.bases.FUTURE.y + layout.bases.FUTURE.h)),
  ).toBeLessThan(1);
  const origin = riderOrigin('FUTURE', '1', layout, riderBricks(after, 'FUTURE'));
  expect(origin.y).toBeCloseTo(layout.launchOrigins.FUTURE.y + fallen.dy, 5);
  // Nobody is hurt: every fighter keeps its health.
  expect(Object.values(after.unitHp).every((hp) => hp === after.maxUnitHp)).toBe(true);
  await expectFightersClear(page, 'after the fall');

  // Play on to Team Future's turn: its angle guide starts at the Tank's new spot.
  await enterAim(page, 'PAST', { angleDeg: 85, power: 20 });
  await page.keyboard.press('Space');
  await expect(tid(page, 'reload-modal')).toBeVisible({ timeout: 20_000 });
  await answerReload(page, 'wrong');
  await tapGotIt(page);
  await waitPassScreen(page);
  await readyUp(page);
  const aim1 = await page.evaluate(() => window.__timeclash!.aim());
  expect(aim1!.team).toBe('FUTURE');
  expect(aim1!.origin!.y).toBeCloseTo(origin.y, 5);
  expect(aim1!.origin!.x).toBeCloseTo(origin.x, 5);
  await expectFightersClear(page, 'Team Future aiming');
  await page.screenshot({ path: shot('future-aims') });
}

test('riders stand on the top brick; knock it out and the Tank falls, gets up and says something funny', async ({
  page,
}, info) => {
  await riderMatch(page, (n) => info.outputPath(`riders-${n}-${info.project.name}.png`));
});

test('iPad mini (1133x744): riders on the top brick, the fall and its line', async ({
  page,
}, info) => {
  test.skip(!info.project.name.endsWith('1280x800'), 'one run of this size is enough');
  await page.setViewportSize({ width: 1133, height: 744 });
  await riderMatch(page, (n) => info.outputPath(`riders-${n}-1133x744-${info.project.name}.png`));
});
