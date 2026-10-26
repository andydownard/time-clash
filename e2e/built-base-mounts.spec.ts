// Weapons on the base pads fire in battle (docs/GAME_SPEC.md "Weapons on the pads"). A family
// builds a base with weapons, starts a match, taps Base weapons in "Pick one", fires, and the
// shot leaves the pad. The selector, the sliders and Fire still share one row under the ground
// line, and nothing covers the team cards, the fighters or the bar.
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import {
  chooseSlot,
  freshBases,
  saveSlot,
  type BasesState,
  type Spot,
} from '../src/game/baseBuilder';
import { WORLD } from '../src/game/config';
import type { Match, Team } from '../src/game/types';
import { TYPICAL } from '../tests/helpers/builtBases';
import { expectAimPanelClearOfBases, expectHudClear } from './support/layout';
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

const WEAPONS: Record<Team, Spot[]> = {
  PAST: [{ weapon: 'cannon' }, {}, { weapon: 'catapult' }, { weapon: 'archerPost' }],
  FUTURE: [
    { weapon: 'laser' },
    { weapon: 'missilePod' },
    { weapon: 'turret' },
    { weapon: 'laser' },
  ],
};

/** A typical base with weapons on its pads for each player, picked the way Build Base does. */
function armedBases(): BasesState {
  let st = freshBases();
  st = saveSlot(st, PAST_SIDE.name, 'PAST', 0, TYPICAL('PAST').pieces, WEAPONS.PAST);
  st = chooseSlot(st, PAST_SIDE.name, 'PAST', 0);
  st = saveSlot(st, FUTURE_SIDE.name, 'FUTURE', 0, TYPICAL('FUTURE').pieces, WEAPONS.FUTURE);
  return chooseSlot(st, FUTURE_SIDE.name, 'FUTURE', 0);
}

async function startArmed(page: Page): Promise<Match> {
  await toSetup(page);
  const st = armedBases();
  await startMatch(page, PAST_SIDE, FUTURE_SIDE, 4242, async () => {
    await page.evaluate((s) => localStorage.setItem('timeclash.bases', JSON.stringify(s)), st);
  });
  const m = await snap(page);
  expect(m.builtBase).toEqual({ PAST: true, FUTURE: true });
  expect(m.mounts?.PAST.map((x) => x.id)).toEqual(['mount:0', 'mount:2', 'mount:3']);
  expect(m.mounts?.FUTURE).toHaveLength(4);
  return m;
}

type Box = { x: number; y: number; width: number; height: number };
const overlaps = (a: Box, b: Box): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/** The selector, the sliders and Fire share one row; every token is 56px; nothing covers a card. */
async function expectBarFits(page: Page, where: string): Promise<void> {
  await expectAimPanelClearOfBases(page, where);
  await expectHudClear(page, where);
  const units = (await page.locator('.tc-units').boundingBox())!;
  const aim = (await page.locator('.tc-aim').boundingBox())!;
  const fire = (await tid(page, 'fire').boundingBox())!;
  const vp = page.viewportSize()!;
  for (const [name, b] of [
    ['selector', units],
    ['aim panel', aim],
    ['Fire', fire],
  ] as const) {
    expect(b.x, `${where}: ${name} inside the window`).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width, `${where}: ${name} inside the window`).toBeLessThanOrEqual(vp.width);
    expect(b.y + b.height, `${where}: ${name} inside the window`).toBeLessThanOrEqual(vp.height);
  }
  // One row: the three overlap from top to bottom.
  const rowTop = Math.max(units.y, aim.y, fire.y);
  const rowBottom = Math.min(units.y + units.height, aim.y + aim.height, fire.y + fire.height);
  expect(rowBottom, `${where}: selector, sliders and Fire share one row`).toBeGreaterThan(rowTop);
  for (const t of await page.locator('.tc-unit').all()) {
    const b = (await t.boundingBox())!;
    expect(b.width, `${where}: token width`).toBeGreaterThanOrEqual(56);
    expect(b.height, `${where}: token height`).toBeGreaterThanOrEqual(56);
  }
  const cards = [
    await tid(page, 'base-hp-PAST').locator('xpath=ancestor::*[@data-team][1]').boundingBox(),
    await tid(page, 'base-hp-FUTURE').locator('xpath=ancestor::*[@data-team][1]').boundingBox(),
  ];
  for (const c of cards)
    expect(overlaps(units, c!), `${where}: selector covers a card`).toBe(false);
  const px = await page.evaluate(() =>
    Math.min(
      ...[...document.querySelectorAll('.tc-unit-name, .tc-units-label, .tc-unit-spot')].map((e) =>
        parseFloat(getComputedStyle(e).fontSize),
      ),
    ),
  );
  expect(px, `${where}: selector text size`).toBeGreaterThanOrEqual(20);
}

/** Every weapon pad picture is on the field. */
async function waitPads(page: Page): Promise<void> {
  await expect
    .poll(
      async () =>
        (await page.evaluate(() => window.__timeclash!.bricks()))
          .map((l) => `${l.team}:${l.pads.filter((p) => p.drawn).length}`)
          .join(' '),
      { timeout: 15_000 },
    )
    .toBe('PAST:3 FUTURE:4');
}

/** Picks the team's first weapon with the Base weapons token and fires one go from it. */
async function fireFromPad(page: Page, team: Team): Promise<void> {
  await tid(page, 'unit-weapons').click();
  await expect.poll(async () => (await snap(page)).selectedMount?.[team]).toBe('mount:0');
  await expect(tid(page, 'unit-mount:0')).toHaveAttribute('aria-checked', 'true');
  const m = await snap(page);
  const pad = m.mounts![team].find((x) => x.id === 'mount:0')!;
  // The angle guide on the field starts at the pad.
  const aim = await page.evaluate(() => window.__timeclash!.aim());
  expect(aim!.origin!.x).toBeCloseTo(pad.origin.x, 0);
  expect(aim!.origin!.y).toBeCloseTo(pad.origin.y, 0);
  await enterAim(page, team, { angleDeg: 30, power: 55 });
  const before = m.stats[team].shotsFired;
  await page.keyboard.press('Space');
  await expect.poll(async () => (await snap(page)).stats[team].shotsFired).toBe(before + 1);
  const after = await snap(page);
  expect(after.lastShot?.mount).toBe('mount:0');
  // The pad flashed as the shot left it.
  await expect
    .poll(async () => {
      const layer = (await page.evaluate(() => window.__timeclash!.bricks())).find(
        (l) => l.team === team,
      );
      return layer?.pads.find((p) => p.spot === 0)?.flashes ?? 0;
    })
    .toBeGreaterThan(0);
}

test('a weapon on a pad fires for both teams, and the bar still fits', async ({ page }, info) => {
  await startArmed(page);
  await readyUp(page);
  await waitPads(page);
  await expect(tid(page, 'unit-weapons')).toBeVisible();
  await expectBarFits(page, 'Past, fighters');
  await page.screenshot({ path: info.outputPath(`mounts-past-fighters-${info.project.name}.png`) });
  await fireFromPad(page, 'PAST');
  await waitAiming(page, 1);
  await expectBarFits(page, 'Past, weapons');
  await page.screenshot({ path: info.outputPath(`mounts-past-weapons-${info.project.name}.png`) });
  // The second go: back to a fighter with the letter token, then a harmless shot.
  await tid(page, 'unit-fighters').click();
  await expect.poll(async () => (await snap(page)).selectedMount?.PAST).toBeNull();
  await enterAim(page, 'PAST', { angleDeg: 80, power: 25 });
  await page.keyboard.press('Space');
  await expect(tid(page, 'reload-modal')).toBeVisible({ timeout: 30_000 });
  await answerReload(page, 'wrong');
  await tapGotIt(page);
  await waitPassScreen(page);
  await readyUp(page);
  await expectBarFits(page, 'Future, fighters');
  await fireFromPad(page, 'FUTURE');
  await waitAiming(page, 1);
  await expectBarFits(page, 'Future, weapons');
  await page.screenshot({
    path: info.outputPath(`mounts-future-weapons-${info.project.name}.png`),
  });
  const canvas = (await page.locator('#game canvas').boundingBox())!;
  expect(canvas.width / WORLD.width).toBeGreaterThan(0);
});

test('iPad mini (1133x744): the weapons view fits on one row', async ({ page }, info) => {
  test.skip(info.project.name !== 'chromium-1280x800', 'one size is enough for this check');
  await page.setViewportSize({ width: 1133, height: 744 });
  await startArmed(page);
  await readyUp(page);
  await waitPads(page);
  await expectBarFits(page, '1133 fighters');
  await tid(page, 'unit-weapons').click();
  await expect.poll(async () => (await snap(page)).selectedMount?.PAST).toBe('mount:0');
  await expectBarFits(page, '1133 weapons');
  await page.screenshot({ path: info.outputPath('mounts-past-weapons-1133x744.png') });
});
