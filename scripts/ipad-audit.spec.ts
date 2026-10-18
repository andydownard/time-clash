// Walks every screen, saves a PNG and measures text size, tap targets and overflow from the DOM.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '../e2e/fixtures';
import { settle, smallTargets, smallText } from '../e2e/support/audit';
import {
  answerReload,
  quietTurn,
  readyUp,
  startMatch,
  takeShot,
  tapGotIt,
  tid,
  toSetup,
  waitAiming,
  waitPassScreen,
  playShots,
  snap,
} from '../e2e/support/game';

type Row = {
  screen: string;
  viewport: string;
  smallTargets: { what: string; detail: string }[];
  smallText: { what: string; detail: string }[];
  sidewaysScroll: number;
  verticalScroll: number;
  offscreen: string[];
  canvas: { x: number; y: number; w: number; h: number } | null;
  canvasPx: number | null;
};

test('ipad audit: every screen', async ({ page }, info) => {
  const { device, orientation, width, height } = info.project.metadata as {
    device: string;
    orientation: string;
    width: number;
    height: number;
  };
  const dir = join(
    import.meta.dirname,
    '../docs/screenshots/ipad-audit',
    `${device}-${orientation}`,
  );
  mkdirSync(dir, { recursive: true });
  const rows: Row[] = [];

  async function shot(name: string): Promise<void> {
    await page.waitForTimeout(400);
    await settle(page).catch(() => undefined);
    const facts = await page.evaluate(() => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const off: string[] = [];
      for (const el of document.querySelectorAll<HTMLElement>(
        'button, input, [role="radio"], [data-testid]',
      )) {
        const st = getComputedStyle(el);
        if (st.display === 'none' || st.visibility === 'hidden') continue;
        if (el.closest('[hidden], [inert], [aria-hidden="true"]')) continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (r.left < -1 || r.top < -1 || r.right > vw + 1 || r.bottom > vh + 1) {
          off.push(
            `${el.getAttribute('data-testid') ?? el.tagName} ${Math.round(r.left)},${Math.round(r.top)} to ${Math.round(r.right)},${Math.round(r.bottom)}`,
          );
        }
      }
      const c = document.querySelector('#game canvas');
      const cr = c?.getBoundingClientRect();
      return {
        sideways: document.documentElement.scrollWidth - vw,
        vertical: document.documentElement.scrollHeight - vh,
        off,
        canvas: cr
          ? {
              x: Math.round(cr.x),
              y: Math.round(cr.y),
              w: Math.round(cr.width),
              h: Math.round(cr.height),
            }
          : null,
      };
    });
    const canvasPx = await page
      .evaluate(() => window.__timeclash?.labelPx() ?? null)
      .catch(() => null);
    rows.push({
      screen: name,
      viewport: `${width}x${height}`,
      smallTargets: await smallTargets(page),
      smallText: await smallText(page),
      sidewaysScroll: facts.sideways,
      verticalScroll: facts.vertical,
      offscreen: facts.off,
      canvas: facts.canvas,
      canvasPx,
    });
    await page.screenshot({ path: join(dir, `${name}.png`) });
  }

  // Tap to Start, intro, loading (failed, then retried)
  await page.goto('/?e2e=1');
  await page.waitForFunction(() => Boolean(window.__timeclash));
  await shot('01-tap-to-start');
  await tid(page, 'tap-to-play').click();
  await expect(tid(page, 'intro-card').first()).toBeVisible();
  await shot('02-intro-card-1');
  await page.getByTestId('intro-next').click();
  await shot('03-intro-card-2');
  await page.getByTestId('intro-next').click();
  await page.getByTestId('intro-next').click();
  await shot('04-intro-card-4');
  await page.evaluate(() => window.__timeclash!.failNextLoads(1));
  await tid(page, 'intro-skip').click();
  await expect(tid(page, 'loading-retry')).toBeVisible({ timeout: 15_000 });
  await shot('05-loading-failed');
  await tid(page, 'loading-retry').click();
  await expect(tid(page, 'setup-next')).toBeVisible({ timeout: 15_000 });
  await shot('06-setup-empty');
  await tid(page, 'settings-button').click();
  await shot('07-settings');
  await page.keyboard.press('Escape');
  await tid(page, 'how-to-play').click();
  await expect(tid(page, 'intro-card').first()).toBeVisible();
  await shot('08-how-to-play-reopened');
  await tid(page, 'intro-skip').click();

  // Fresh run for a clean path through Setup, Camp, Forge, Upgrade, Battle
  await page.evaluate(() => localStorage.clear());
  await toSetup(page);
  await startMatch(page, undefined, undefined, undefined, async () => {
    await shot('09-camp');
    await tid(page, 'camp-forge').click();
    await expect(tid(page, 'forge-back')).toBeVisible();
    await shot('10-forge');
    await tid(page, 'forge-back').click();
    await tid(page, 'camp-upgrade').click();
    await expect(tid(page, 'upgrade-back')).toBeVisible();
    await shot('11-upgrade-base');
    await tid(page, 'upgrade-back').click();
    await expect(tid(page, 'camp-start')).toBeVisible();
  });
  await shot('12-pass-screen');
  await readyUp(page);
  await shot('13-battle-start');
  await tid(page, 'pause').click();
  await shot('14-pause');
  await tid(page, 'pause-leave').click();
  await shot('15-leave-dialog');
  await tid(page, 'pause-stay').click();
  await tid(page, 'pause-resume').click();

  // Mid-shot: aim, fire, capture while the ball flies
  const m = await snap(page);
  await takeShot(page, 'miss').catch(() => undefined);
  void m;
  await page.waitForTimeout(300);
  await shot('16-battle-mid-shot');
  await waitAiming(page, 1);
  await takeShot(page, 'miss');
  await expect(tid(page, 'reload-modal')).toBeVisible({ timeout: 45_000 });
  await shot('17-reload-question');
  await answerReload(page, 'wrong');
  await expect(tid(page, 'reload-next')).toBeVisible();
  await shot('18-reload-feedback');
  await tapGotIt(page);
  await waitPassScreen(page);
  await shot('19-pass-screen-turn-2');
  await readyUp(page);
  await playShots(page, ['miss', 'miss']);
  await expect(tid(page, 'reload-modal')).toBeVisible({ timeout: 45_000 });
  await answerReload(page, 'right-fast');
  await waitPassScreen(page);

  // Play to Victory: Past takes direct hits, Future quiet turns
  for (let i = 0; i < 8; i++) {
    const s = await snap(page).catch(() => null);
    if (!s) break;
    if (s.turn.team === 'PAST') {
      await readyUp(page);
      await takeShot(page, 'direct');
      if (
        await tid(page, 'victory')
          .isVisible()
          .catch(() => false)
      )
        break;
      try {
        await expect(tid(page, 'victory')).toBeVisible({ timeout: 4000 });
        break;
      } catch {
        await waitAiming(page, 1);
        await takeShot(page, 'direct');
        await expect(tid(page, 'reload-modal').or(tid(page, 'victory'))).toBeVisible({
          timeout: 45_000,
        });
        if (await tid(page, 'victory').isVisible()) break;
        await answerReload(page, 'right-fast');
        await waitPassScreen(page);
      }
    } else {
      await quietTurn(page);
    }
  }
  await expect(tid(page, 'victory')).toBeVisible({ timeout: 45_000 });
  await shot('20-victory');

  writeFileSync(join(dir, 'measurements.json'), JSON.stringify(rows, null, 2));
});
