// Squads S1 end to end. Squads is on for everyone: a turn is 2 goes, then the covered reload,
// then the other side with its full crew. A wrong answer never skips the question or shrinks the
// next turn. The walking dasher goes out over the middle obstacle, then the player taps Bonk! (one
// of the 2 goes, never automatic) to bonk the enemy base, and he tumbles home when shells knock him down.
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { simulateShot } from '../src/game/ballistics';
import { AIM, CHARACTER_HEALTH, SQUADS, TEAM_FACING, TERRAIN, WORLD } from '../src/game/config';
import { dasherBox, groundSpotPoint } from '../src/game/crew';
import { classifyBlast } from '../src/game/damage';
import type { AimInput, BattleLayout, Team } from '../src/game/types';
import {
  answerReload,
  enterAim,
  readyUp,
  snap,
  startMatch,
  takeShot,
  tapGotIt,
  tid,
  toSetup,
  waitAiming,
  waitBonusAiming,
  waitPassScreen,
} from './support/game';
import { expectMessageClear } from './support/layout';
import { saveShot } from './support/shots';

async function toSquadMatch(page: Page, on: boolean | null): Promise<void> {
  await toSetup(page);
  if (on !== null) await page.evaluate((v) => window.__timeclash!.setSquads(v), on);
  await startMatch(page);
}

/** Every caption line shown from now on, kept in the page, so a short line is never missed. */
async function watchCaptions(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as { __captions?: string[] };
    w.__captions = [];
    new MutationObserver(() => {
      const t = document.querySelector('[data-testid="caption-bar"]')?.textContent ?? '';
      if (t && w.__captions!.at(-1) !== t) w.__captions!.push(t);
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  });
}
const captionsSeen = (page: Page) =>
  page.evaluate(() => (window as unknown as { __captions?: string[] }).__captions ?? []);

const dashers = (page: Page) => page.evaluate(() => window.__timeclash!.dashers());
const dasherOn = async (page: Page, team: Team) =>
  (await dashers(page)).find((d) => d.team === team)!;

/** A Team Future aim (the default launcher) that lands right on Team Past's dasher. */
function aimAtDasher(layout: BattleLayout, wind: number, spot: string): AimInput {
  const box = dasherBox(spot, layout);
  for (let power = AIM.powerMin; power <= AIM.powerMax; power++) {
    for (let angleDeg = AIM.angleMaxDeg; angleDeg >= AIM.angleMinDeg; angleDeg--) {
      const r = simulateShot({
        angleDeg,
        power,
        origin: layout.launchOrigins.FUTURE,
        facing: TEAM_FACING.FUTURE,
        wind,
        layout,
      });
      if (r.hit.kind === 'out_of_bounds' || r.hit.kind === 'timeout') continue;
      const got = classifyBlast(r.landing, box, {
        direct: CHARACTER_HEALTH.directScale,
        near: CHARACTER_HEALTH.nearScale,
      });
      if (got === 'direct') return { angleDeg, power };
    }
  }
  throw new Error('no aim at the dasher');
}

test('with Squads switched off the helper bar is not on the page', async ({ page }) => {
  await toSquadMatch(page, false);
  await readyUp(page);
  await expect(tid(page, 'go-banner')).toBeHidden();
  await expect(tid(page, 'helper-PAST-launcher')).toBeHidden();
  await expect(tid(page, 'helper-hear')).toBeHidden();
  await expect(tid(page, 'turn-banner')).toContainText('SHOT 1 OF 2');
  expect((await snap(page)).squads).toBeUndefined();
});

test('2 goes, then the covered reload, then the next side with its full crew', async ({ page }) => {
  await toSquadMatch(page, null);
  await readyUp(page);

  // The first go shows the finger hint and the words, and the bar counts goes.
  await expect(tid(page, 'go-banner')).toHaveText('GO 1 OF 2');
  await expect(tid(page, 'go-hint')).toBeVisible();
  await expect(tid(page, 'helper-PAST-launcher')).toHaveAttribute('aria-checked', 'true');

  // Hear it has a caption, and Back returns to the launcher.
  await tid(page, 'helper-hear').click();
  await expect(tid(page, 'caption-bar')).toContainText('Cannon Crew');
  await tid(page, 'helper-PAST-dasher').click();
  await expect(tid(page, 'helper-back')).toBeVisible();
  await expect(tid(page, 'fire')).toBeDisabled();
  await tid(page, 'helper-back').click();
  await expect(tid(page, 'helper-PAST-launcher')).toHaveAttribute('aria-checked', 'true');
  await expect(tid(page, 'helper-back')).toBeHidden();
  await expect(tid(page, 'fire')).toBeEnabled();

  // Go 1: walk the dasher out. It is a whole go.
  await tid(page, 'helper-PAST-dasher').click();
  const spots = page.locator('[data-testid^="dash-g"]');
  await expect(spots).toHaveCount(1);
  await spots.first().click();
  await expect.poll(async () => (await snap(page)).turn.shotsFired).toBe(1);
  await expect(tid(page, 'go-banner')).toHaveText('GO 2 OF 2');
  await expect(tid(page, 'go-hint')).toBeHidden();

  // Go 2: he is out, so Come back replaces Walk out. Back to the launcher, then fire.
  await expect(tid(page, 'helper-recall')).toBeVisible();
  await expect(spots).toHaveCount(0);
  // The bar wakes up once he has walked out.
  await expect(tid(page, 'helper-PAST-launcher')).toHaveAttribute('aria-disabled', 'false', {
    timeout: 20_000,
  });
  await tid(page, 'helper-back').click();
  await waitAiming(page, 1);
  await takeShot(page, 'miss');

  // The reload question always comes up, and a wrong answer is fine.
  await expect(tid(page, 'reload-modal')).toBeVisible({ timeout: 20_000 });
  expect(await page.evaluate(() => document.body.dataset.cover)).toBe('reload');
  await answerReload(page, 'wrong');
  await tapGotIt(page);
  await waitPassScreen(page);

  // The other side starts a fresh turn: full crew, 2 goes, its own first-go hint.
  await readyUp(page);
  const m = await snap(page);
  expect(m.turn.team).toBe('FUTURE');
  expect(m.turn.shotsFired).toBe(0);
  await expect(tid(page, 'go-banner')).toHaveText('GO 1 OF 2');
  await expect(tid(page, 'go-hint')).toBeVisible();
  await expect(tid(page, 'helper-FUTURE-launcher')).toBeVisible();
  await expect(tid(page, 'helper-FUTURE-dasher')).toBeVisible();
  await expect(tid(page, 'helper-PAST-launcher')).toBeHidden();
});

test('the dasher walks out past the middle, Bonk! is a go the player taps, and he tumbles home', async ({
  page,
  browserName,
}) => {
  await toSquadMatch(page, null);
  await readyUp(page);
  await watchCaptions(page);
  const layout = (await page.evaluate(() => window.__timeclash!.layout()))!;
  const middle = layout.terrain.obstacles[0]!;
  const middleRight = Math.max(...middle.map((p) => p.x));
  const attack = groundSpotPoint('g3', layout);

  // Walk out: he is drawn walking, then stands on his spot past the middle obstacle.
  await tid(page, 'helper-PAST-dasher').click();
  await tid(page, 'dash-g3').click();
  await expect.poll(async () => (await dasherOn(page, 'PAST')).doing).toBe('walk');
  await saveShot(page, browserName, 'squads-walk');
  await expect
    .poll(async () => {
      const d = await dasherOn(page, 'PAST');
      return d.doing === 'stand' && d.state === 'out' ? Math.round(d.x) : null;
    })
    .toBe(Math.round(attack.x));
  const out = await dasherOn(page, 'PAST');
  expect(out.visible).toBe(true);
  expect(out.x).toBeGreaterThan(middleRight);
  expect(out.y).toBe(attack.y);

  // Go 2: nothing bonks by itself. The player taps Bonk! (the one button, since only the base is next to him).
  await expect(tid(page, 'helper-recall')).toBeVisible({ timeout: 20_000 });
  expect((await snap(page)).baseHp.FUTURE).toBe((await snap(page)).maxBaseHp.FUTURE);
  const bonkButton = tid(page, 'helper-bonk-base');
  await expect(bonkButton).toContainText('Bonk!');
  const bb = (await bonkButton.boundingBox())!;
  expect(bb.width).toBeGreaterThanOrEqual(56);
  expect(bb.height).toBeGreaterThanOrEqual(56);
  const before = (await snap(page)).baseHp.FUTURE;
  await saveShot(page, browserName, 'squads-bonk-button');
  await bonkButton.click();
  await expect.poll(async () => (await dasherOn(page, 'PAST')).doing).toBe('bonk');
  await saveShot(page, browserName, 'squads-bonk');
  await expect
    .poll(async () => (await snap(page)).baseHp.FUTURE)
    .toBe(before - SQUADS.standBonkDamage);
  await expect.poll(async () => (await captionsSeen(page)).join('|')).toContain('Bonk!');
  // The Bonk! was go 2, so the reload comes next, then Team Future's turn starts with no bonk.
  await expect(tid(page, 'reload-modal')).toBeVisible({ timeout: 20_000 });
  await answerReload(page, 'wrong');
  await tapGotIt(page);
  await waitPassScreen(page);
  await tid(page, 'pass-ready').click();
  await waitAiming(page, 0);
  expect((await snap(page)).turn.team).toBe('FUTURE');
  expect((await snap(page)).baseHp.FUTURE).toBe(before - SQUADS.standBonkDamage);

  // Team Future lands its shells right on him: 2 hits, then the Power Shot knocks him down.
  const wind = (await snap(page)).wind;
  const aim = aimAtDasher(layout, wind, 'g3');
  for (const go of [0, 1] as const) {
    await waitAiming(page, go);
    await enterAim(page, 'FUTURE', aim);
    await page.keyboard.press('Space');
    await expect.poll(async () => (await snap(page)).stats.FUTURE.shotsFired).toBe(go + 1);
  }
  await expect(tid(page, 'reload-modal')).toBeVisible({ timeout: 20_000 });
  await answerReload(page, 'right-fast');
  await waitBonusAiming(page);
  await enterAim(page, 'FUTURE', aim);
  await page.keyboard.press('Space');
  await expect
    .poll(async () => (await dasherOn(page, 'PAST')).doing, { timeout: 20_000 })
    .toMatch(/tumble|walk/);
  await saveShot(page, browserName, 'squads-tumble');
  await expect.poll(async () => (await captionsSeen(page)).join('|')).toContain('tumbles');
  // The tumble caption sits in the message lane: clear of Pick one, Angle, Fire, the cards, every
  // fighter, the walking helper and the bases.
  await expect(tid(page, 'caption-bar')).toContainText('tumbles');
  await expectMessageClear(page, tid(page, 'caption-bar'), 'helper tumble caption');
  await page.screenshot({
    path: test.info().outputPath(`lane-tumble-${test.info().project.name}.png`),
  });
  // He walks home and rests there.
  await expect
    .poll(
      async () => {
        const d = await dasherOn(page, 'PAST');
        return `${d.state}:${d.doing}`;
      },
      { timeout: 20_000 },
    )
    .toBe('resting:stand');
  const home = await dasherOn(page, 'PAST');
  expect(home.x).toBeLessThan(layout.bases.PAST.x + layout.bases.PAST.w);
});

test('the helper buttons are big enough and the keyboard reaches them', async ({ page }) => {
  await toSquadMatch(page, null);
  await readyUp(page);
  for (const id of ['helper-PAST-launcher', 'helper-PAST-dasher', 'helper-hear']) {
    const box = (await tid(page, id).boundingBox())!;
    expect(box.width, id).toBeGreaterThanOrEqual(56);
    expect(box.height, id).toBeGreaterThanOrEqual(56);
    const size = await tid(page, id).evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(size, id).toBeGreaterThanOrEqual(20);
  }
  // The helper row sits under the ground line and above the turn strip, so it covers no fighter.
  const canvas = (await page.locator('#game canvas').boundingBox())!;
  const k = canvas.width / WORLD.width;
  const row = (await page.locator('.tc-squad-bar').boundingBox())!;
  const strip = (await page.locator('.tc-turn-strip').boundingBox())!;
  expect(row.y + 0.5).toBeGreaterThanOrEqual(canvas.y + TERRAIN.groundY * k);
  expect(row.y + row.height).toBeLessThanOrEqual(strip.y + 0.5);
  // Enter on a focused helper picks it.
  await tid(page, 'helper-PAST-dasher').focus();
  await page.keyboard.press('Enter');
  await expect(tid(page, 'helper-PAST-dasher')).toHaveAttribute('aria-checked', 'true');
  await expect(tid(page, 'helper-back')).toBeVisible();
  const walk = (await tid(page, 'dash-g3').boundingBox())!;
  expect(walk.width).toBeGreaterThanOrEqual(56);
  expect(walk.height).toBeGreaterThanOrEqual(56);
  await tid(page, 'helper-back').focus();
  await page.keyboard.press('Enter');
  await expect(tid(page, 'helper-PAST-launcher')).toHaveAttribute('aria-checked', 'true');
});

test('the hint finger holds still under reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await toSquadMatch(page, null);
  await readyUp(page);
  await expect(tid(page, 'go-hint')).toBeVisible();
  const anim = await page
    .locator('.tc-go-finger')
    .evaluate((el) => getComputedStyle(el).animationName);
  expect(anim).toBe('none');
});

test('the K key Bonk!s, and a Bonk! with nothing next to him is not offered', async ({ page }) => {
  await toSquadMatch(page, null);
  await readyUp(page);
  // At home there is nothing to bonk: no Bonk! button and the K key does nothing.
  await tid(page, 'helper-PAST-dasher').click();
  await expect(tid(page, 'helper-bonk-base')).toHaveCount(0);
  await page.keyboard.press('k');
  expect((await snap(page)).turn.shotsFired).toBe(0);
  // Walk out (go 1), then K is Bonk! (go 2).
  await tid(page, 'dash-g3').click();
  await expect.poll(async () => (await snap(page)).turn.shotsFired).toBe(1);
  await expect(tid(page, 'helper-bonk-base')).toBeVisible({ timeout: 20_000 });
  const full = (await snap(page)).maxBaseHp.FUTURE;
  await page.keyboard.press('k');
  await expect.poll(async () => (await snap(page)).turn.shotsFired).toBe(2);
  await expect
    .poll(async () => (await snap(page)).baseHp.FUTURE)
    .toBe(full - SQUADS.standBonkDamage);
  await expect(tid(page, 'reload-modal')).toBeVisible({ timeout: 20_000 });
});
