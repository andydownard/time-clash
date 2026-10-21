// The real intro voice file plays after the tap. This spec keeps the REAL media element
// (no silent stubs) but mutes it, so it proves the browser can decode the m4a (AAC in MP4)
// and reports a real length. Chromium and WebKit both run it.
import { expect, test } from '@playwright/test';

type Seen = { src: string; muted: boolean };
declare global {
  interface Window {
    __voice: HTMLAudioElement[];
  }
}

test('card 1 plays its m4a voice file after the tap, with a real length', async ({ page }) => {
  await page.addInitScript(() => {
    window.__voice = [];
    const Real = window.Audio;
    // Keep the real element, but record it and keep it muted so the test makes no sound.
    window.Audio = function (src?: string) {
      const el = new Real(src);
      el.muted = true;
      window.__voice.push(el);
      return el;
    } as unknown as typeof Audio;
  });
  await page.goto('/');
  const seen = async (): Promise<Seen[]> =>
    page.evaluate(() => window.__voice.map((e) => ({ src: e.src, muted: e.muted })));
  // Nothing is created before the first tap.
  await expect(page.getByTestId('tap-to-play')).toBeVisible();
  expect(await seen()).toEqual([]);

  await page.getByTestId('tap-to-play').click();
  await expect(page.getByTestId('intro-card')).toBeVisible();
  await expect.poll(async () => (await seen()).length).toBeGreaterThan(0);
  expect((await seen())[0]!.src).toMatch(/\/audio\/voice\/intro-01-welcome\.m4a$/);

  // Wait for the browser to decode the file header, then check the length (6.4 s clip).
  const duration = await page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const el = window.__voice[0]!;
        const done = (): void => resolve(el.duration);
        if (el.readyState >= 1) done();
        else el.addEventListener('loadedmetadata', done, { once: true });
        el.addEventListener('error', () => resolve(-1), { once: true });
      }),
  );
  expect(duration, 'the browser could not decode the m4a').toBeGreaterThan(6);
  expect(duration).toBeLessThan(7);
});
