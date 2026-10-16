// Layout checks that need a real browser: nothing may sit on top of the team cards.
import type { Page } from '@playwright/test';
import { BASES, WORLD } from '../../src/game/config';
import { expect } from '../fixtures';
import { tid } from './game';

type Box = { x: number; y: number; width: number; height: number };
const overlaps = (a: Box, b: Box): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/** The ? and gear buttons, and the turn banner, must not cover a team card. */
export async function expectHudClear(page: Page, where: string): Promise<void> {
  await expect(tid(page, 'how-to-play'), `${where}: exactly one ? button`).toHaveCount(1);
  const chrome = [
    await tid(page, 'how-to-play').boundingBox(),
    await tid(page, 'settings-button').boundingBox(),
  ];
  const cards = [
    await tid(page, 'base-hp-PAST').locator('xpath=ancestor::*[@data-team][1]').boundingBox(),
    await tid(page, 'base-hp-FUTURE').locator('xpath=ancestor::*[@data-team][1]').boundingBox(),
  ];
  for (const c of chrome) {
    for (const card of cards) {
      expect(c, `${where}: chrome button box`).not.toBeNull();
      expect(card, `${where}: team card box`).not.toBeNull();
      expect(overlaps(c!, card!), `${where}: corner button covers a team card`).toBe(false);
    }
  }
}

/** The banner only lasts about two seconds, so record its box the moment it appears. */
export async function recordBannerBox(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as { __bannerGeom?: unknown; __bannerWatching?: boolean };
    new MutationObserver(() => {
      const el = document.querySelector('[data-testid="turn-banner"]');
      if (!el || w.__bannerGeom || w.__bannerWatching) return;
      w.__bannerWatching = true;
      const box = (n: Element | null) => {
        const r = n?.getBoundingClientRect();
        return r ? { x: r.x, y: r.y, width: r.width, height: r.height } : null;
      };
      const card = (team: string) =>
        box(
          document.querySelector(`[data-testid="base-hp-${team}"]`)?.closest('[data-team]') ?? null,
        );
      // Read the resting box, not a frame from the 400ms drop-in.
      (el as HTMLElement).style.animation = 'none';
      {
        w.__bannerGeom = { banner: box(el), past: card('PAST'), future: card('FUTURE') };
      }
    }).observe(document.body, { childList: true, subtree: true });
  });
}

/** The aim panel must not sit on top of either base, so a child can see what they aim from. */
export async function expectAimPanelClearOfBases(page: Page, where: string): Promise<void> {
  const canvas = await page.locator('#game canvas').boundingBox();
  const panel = await tid(page, 'aim-angle')
    .locator('xpath=ancestor::*[contains(@class,"tc-aim")][1]')
    .boundingBox();
  expect(canvas, `${where}: canvas`).not.toBeNull();
  expect(panel, `${where}: aim panel`).not.toBeNull();
  const k = canvas!.width / WORLD.width;
  for (const team of ['PAST', 'FUTURE'] as const) {
    const b = BASES[team];
    const box = { x: canvas!.x + b.x * k, y: canvas!.y + b.y * k, width: b.w * k, height: b.h * k };
    expect(
      overlaps(panel!, box),
      `${where}: aim panel covers the ${team} base ${JSON.stringify({ panel, box, canvas })}`,
    ).toBe(false);
  }
}

export async function expectBannerClear(page: Page, where: string): Promise<void> {
  type G = { banner: Box; past: Box; future: Box };
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __bannerGeom?: G }).__bannerGeom))
    .toBeTruthy();
  const g = (await page.evaluate(
    () => (window as unknown as { __bannerGeom: G }).__bannerGeom,
  )) as G;
  expect(
    overlaps(g.banner, g.past),
    `${where}: banner covers the Past card ${JSON.stringify(g)}`,
  ).toBe(false);
  expect(overlaps(g.banner, g.future), `${where}: banner covers the Future card`).toBe(false);
}
