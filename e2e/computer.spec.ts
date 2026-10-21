// The Computer player: one child plays alone. It is behind PRACTICE_BOT.enabled (off) and the
// ?computer=1 address, so these tests prove both that it works when on and that nothing shows when off.
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { smallTargets, smallText } from './support/audit';
import {
  SEED,
  answerReload,
  clashFromCamp,
  fillTeam,
  PAST_SIDE,
  takeShot,
  tid,
} from './support/game';
import { saveShot } from './support/shots';
import './support/globals';

async function toSetupWith(page: Page, query: string): Promise<void> {
  await page.goto(`/?e2e=1${query}`);
  await page.waitForFunction(() => Boolean(window.__timeclash));
  await tid(page, 'tap-to-play').click();
  await tid(page, 'intro-skip').click();
  await expect(tid(page, 'setup-next')).toBeVisible({ timeout: 10_000 });
}

test('flag off: Setup shows no computer choice anywhere', async ({ page }) => {
  await toSetupWith(page, '');
  await expect(tid(page, 'play-with-computer')).toHaveCount(0);
  await expect(tid(page, 'play-with-person')).toHaveCount(0);
  await expect(tid(page, 'computer-card')).toHaveCount(0);
  await expect(page.getByText('Computer player')).toHaveCount(0);
  await expect(page.getByText('How hard?')).toHaveCount(0);
  // Both human cards are there, as always.
  await expect(tid(page, 'setup-name-PAST')).toBeVisible();
  await expect(tid(page, 'setup-name-FUTURE')).toBeVisible();
});

test('flag off: only ?computer=1 turns it on (other values do nothing)', async ({ page }) => {
  await toSetupWith(page, '&computer=true');
  await expect(tid(page, 'play-with-computer')).toHaveCount(0);
});

test('flag on: pick Computer player and Hard, play a whole match to Victory', async ({
  page,
  browserName,
}) => {
  test.slow();
  await toSetupWith(page, '&computer=1');
  await expect(tid(page, 'play-with-person')).toHaveAttribute('aria-checked', 'true');
  await saveShot(page, browserName, 'computer-player-setup-choice');

  await fillTeam(page, 'PAST', PAST_SIDE);
  await tid(page, 'play-with-computer').click();
  await expect(tid(page, 'computer-level-medium')).toHaveAttribute('aria-checked', 'true');
  await tid(page, 'computer-level-hard').click();
  await expect(tid(page, 'computer-level-hard')).toHaveAttribute('aria-checked', 'true');
  await expect(tid(page, 'computer-card')).toContainText('Computer player');
  await saveShot(page, browserName, 'computer-player-setup');
  expect(await smallTargets(page)).toEqual([]);
  expect(await smallText(page)).toEqual([]);
  // Setup still fits the window.
  await page.evaluate(() => document.fonts.ready);
  const spill = await page.evaluate(() => {
    const el = document.querySelector<HTMLElement>('[data-screen="setup"]')!;
    return el.scrollHeight - el.clientHeight;
  });
  expect(spill).toBeLessThanOrEqual(1);

  await page.evaluate((s) => window.__timeclash!.setSeed(s), SEED);
  await tid(page, 'setup-next').click();
  await expect(tid(page, 'camp-start')).toBeVisible({ timeout: 10_000 });
  const saved = await page.evaluate(() => window.__timeclash!.players());
  expect(saved![1]).toMatchObject({ name: 'Computer player', team: 'FUTURE' });
  await clashFromCamp(page);
  await page.waitForFunction(() => window.__timeclash!.match() !== null);

  // No pass-the-mouse screen at all: the child keeps the screen.
  const seen = { thinkingAim: false, thinkingAsk: false, coverOnComputer: false };
  let humanTurns = 0;
  const deadline = Date.now() + 160_000;
  for (;;) {
    expect(Date.now(), 'the match took too long').toBeLessThan(deadline);
    await expect(tid(page, 'pass-screen')).toHaveCount(0);
    if (await tid(page, 'victory').isVisible()) break;
    // The match is cleared just before the Victory screen shows, so a null here means "almost there".
    const m = await page.evaluate(() => window.__timeclash!.match());
    if (!m) {
      await page.waitForTimeout(150);
      continue;
    }
    if (m.status === 'OVER') {
      await page.waitForTimeout(500);
      continue;
    }
    if (m.turn.team === 'FUTURE') {
      // The computer never gets a question card, and nothing covers the board.
      if (await tid(page, 'reload-modal').count()) seen.coverOnComputer = true;
      if (await page.evaluate(() => document.body.dataset.cover)) seen.coverOnComputer = true;
      const note = tid(page, 'computer-thinking');
      if (await note.isVisible()) {
        const text = (await note.textContent()) ?? '';
        if (text.includes('aiming') && !seen.thinkingAim) {
          seen.thinkingAim = true;
          await saveShot(page, browserName, 'computer-player-battle');
        }
        if (text.includes('thinking') && !seen.thinkingAsk) {
          seen.thinkingAsk = true;
          expect(text).not.toMatch(/\?|\d/);
          await saveShot(page, browserName, 'computer-player-thinking');
        }
        // The controls are locked for the child while the computer plays.
        await expect(tid(page, 'fire')).toBeDisabled();
      }
    } else if (m.turn.phase === 'AIMING' || m.turn.phase === 'BONUS_AIMING') {
      if (await tid(page, 'fire').isEnabled()) {
        if (m.turn.phase === 'AIMING' && m.turn.shotsFired === 0) humanTurns++;
        await takeShot(page, 'direct');
      }
    } else if (m.turn.phase === 'RELOAD' && (await tid(page, 'reload-modal').isVisible())) {
      await answerReload(page, 'right-fast');
      // Got it is optional: the card also closes on its own, and a busy machine can beat the tap.
      await tid(page, 'reload-next')
        .click({ timeout: 4_000 })
        .catch(() => undefined);
      // Never answer the same card twice: wait for it to close.
      await expect(tid(page, 'reload-modal')).toHaveCount(0, { timeout: 30_000 });
    }
    await page.waitForTimeout(150);
  }

  expect(seen.coverOnComputer, 'a question card or cover showed on the computer turn').toBe(false);
  expect(seen.thinkingAim, 'the aiming note showed').toBe(true);
  expect(humanTurns).toBeGreaterThan(0);
  await expect(tid(page, 'victory')).toContainText('Computer player');
  await saveShot(page, browserName, 'computer-player-victory');
});

test('flag on: the last choice is remembered next time', async ({ page }) => {
  await toSetupWith(page, '&computer=1');
  await tid(page, 'play-with-computer').click();
  await tid(page, 'computer-level-easy').click();
  await tid(page, 'setup-next').click();
  await expect(tid(page, 'camp-start')).toBeVisible({ timeout: 10_000 });
  await page.reload();
  await page.waitForFunction(() => Boolean(window.__timeclash));
  // A returning family lands on the Camp. "Change players" goes back to Setup.
  await expect(tid(page, 'camp-players')).toBeVisible({ timeout: 15_000 });
  await tid(page, 'camp-players').click();
  await expect(tid(page, 'play-with-computer')).toHaveAttribute('aria-checked', 'true');
  await expect(tid(page, 'computer-level-easy')).toHaveAttribute('aria-checked', 'true');
});
