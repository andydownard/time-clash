// Risk 5: sound never blasts, never autoplays, and can always be skipped.
// Every browser here is silent (e2e/support/silent.ts), so these tests count calls instead.
import { soundCounts } from './support/silent';
import { expect, test } from './fixtures';
import { tid } from './support/game';

test('the test browser itself is silent: stubs are installed before the app runs', async ({
  page,
}) => {
  await page.goto('/');
  const stubbed = await page.evaluate(() => ({
    audio: window.AudioContext.name,
    synth: typeof window.speechSynthesis.speak,
    hasState: Boolean(window.__silent),
    realSpeak: String(window.speechSynthesis.speak).includes('[native code]'),
    realAudio: String(window.AudioContext).includes('[native code]'),
  }));
  expect(stubbed.hasState).toBe(true);
  expect(stubbed.realSpeak, 'speechSynthesis.speak must not be the real one').toBe(false);
  expect(stubbed.realAudio, 'AudioContext must not be the real one').toBe(false);
});

test('nothing speaks or plays before the first tap', async ({ page }) => {
  await page.goto('/');
  await expect(tid(page, 'tap-to-play')).toBeVisible();
  // Let boot and the first scene settle: wait for the canvas, not for a fixed time.
  await expect(page.locator('#game canvas')).toBeVisible();
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
  const c = await soundCounts(page);
  expect(c.log).toEqual([]);
});

test('sound starts only after the tap, and the intro has captions', async ({ page }) => {
  await page.goto('/');
  await tid(page, 'tap-to-play').click();
  await expect(tid(page, 'intro-card')).toBeVisible();
  await expect.poll(async () => (await soundCounts(page)).contexts).toBeGreaterThan(0);
  await expect
    .poll(async () => {
      const c = await soundCounts(page);
      return c.speak + c.plays;
    })
    .toBeGreaterThan(0);
  await expect(tid(page, 'caption-bar')).toBeVisible();
  await expect(tid(page, 'caption-bar')).not.toBeEmpty();
});

test('Skip stops the voice at once and the intro does not come back', async ({ page }) => {
  await page.goto('/');
  await tid(page, 'tap-to-play').click();
  await expect.poll(async () => (await soundCounts(page)).active).toBeGreaterThan(0);
  await tid(page, 'intro-skip').click();
  await expect.poll(async () => (await soundCounts(page)).active).toBe(0);
  await expect(tid(page, 'intro-card')).toBeHidden();
  const after = await soundCounts(page);
  await expect(tid(page, 'setup-next')).toBeVisible({ timeout: 10_000 });
  const later = await soundCounts(page);
  expect(later.active).toBe(0);
  expect(later.speak).toBe(after.speak);
});

test('Replay restarts the voice and Mute silences it', async ({ page }) => {
  await page.goto('/');
  await tid(page, 'tap-to-play').click();
  await expect.poll(async () => (await soundCounts(page)).active).toBeGreaterThan(0);
  await tid(page, 'intro-replay').click();
  await expect.poll(async () => (await soundCounts(page)).active).toBeGreaterThan(0);
  await tid(page, 'intro-mute').click();
  await expect.poll(async () => (await soundCounts(page)).active).toBe(0);
  await expect(tid(page, 'caption-bar')).toBeVisible();
});

test('a muted visit never starts speech or audio, even after the tap', async ({ page }) => {
  await page.goto('/');
  await tid(page, 'mute-toggle').click();
  await tid(page, 'tap-to-play').click();
  await expect(tid(page, 'intro-card')).toBeVisible();
  await expect(tid(page, 'caption-bar')).toBeVisible();
  const c = await soundCounts(page);
  expect(c.speak + c.plays).toBe(0);
});
