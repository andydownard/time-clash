// Layout checks that need a real browser: nothing may sit on top of the team cards.
import type { Locator, Page } from '@playwright/test';
import { BASES, BATTLE_BAND, CHARACTER_HEALTH, TERRAIN, WORLD } from '../../src/game/config';
import { fighterKeepOut } from '../../src/scenes/battle/angleLabel';
import { expect } from '../fixtures';
import { tid } from './game';

type Box = { x: number; y: number; width: number; height: number };
const overlaps = (a: Box, b: Box): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/** The ? and gear buttons, Sound and Pause must not cover a team card. */
export async function expectHudClear(page: Page, where: string): Promise<void> {
  await expect(tid(page, 'how-to-play'), `${where}: exactly one ? button`).toHaveCount(1);
  const chrome = [
    await tid(page, 'how-to-play').boundingBox(),
    await tid(page, 'settings-button').boundingBox(),
    await tid(page, 'hud-mute').boundingBox(),
    await tid(page, 'pause').boundingBox(),
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

/**
 * The control bar sits in the band under the picture, so it must clear the whole battlefield:
 * both bases, and the ground line the fighters stand on. The canvas has one uniform scale
 * (width / WORLD.width) and is taller than the world by BATTLE_BAND.
 */
export async function expectAimPanelClearOfBases(page: Page, where: string): Promise<void> {
  const canvas = await page.locator('#game canvas').boundingBox();
  const panel = await tid(page, 'aim-angle')
    .locator('xpath=ancestor::*[contains(@class,"tc-aim")][1]')
    .boundingBox();
  expect(canvas, `${where}: canvas`).not.toBeNull();
  expect(panel, `${where}: aim panel`).not.toBeNull();
  const k = canvas!.width / WORLD.width;
  expect(canvas!.height / k, `${where}: canvas is world plus band`).toBeCloseTo(
    WORLD.height + BATTLE_BAND,
    0,
  );
  const bar = await page.locator('.tc-hud-bottom').boundingBox();
  expect(bar, `${where}: control bar`).not.toBeNull();
  expect(
    bar!.y + 0.5,
    `${where}: control bar starts below the fighters' ground line`,
  ).toBeGreaterThanOrEqual(canvas!.y + TERRAIN.groundY * k);
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
  expect(
    overlaps(g.banner, g.future),
    `${where}: banner covers the Future card ${JSON.stringify(g)}`,
  ).toBe(false);
}

/**
 * A message in the lane (the caption bar, the coach line or the first-go hint) covers nothing that
 * matters: no control in the bar (Pick one, Angle, Power, Fire, the gear buttons, the helper row),
 * no team card or corner button, no fighter (body, letter tag and the arrow over it), no base, and
 * no built-base brick. Fighters, bases and bricks are read from the field the game drew.
 */
export async function expectMessageClear(
  page: Page,
  message: Locator | Box,
  where: string,
): Promise<void> {
  const box = 'boundingBox' in message ? await message.boundingBox() : message;
  expect(box, `${where}: the message is on screen`).not.toBeNull();
  const hud = await page.evaluate(() => {
    const out: Array<{
      name: string;
      box: { x: number; y: number; width: number; height: number };
    }> = [];
    const sel = [
      '.tc-hud-bottom',
      '.tc-hud-bottom button',
      '.tc-hud-bottom input',
      '.tc-hud-bottom [role="radio"]',
      '.tc-squad-bar',
      '.tc-hud-top > [data-team]',
      '.tc-hud-corner',
      '[data-testid="how-to-play"]',
      '[data-testid="settings-button"]',
      '[data-testid="pause"]',
    ].join(',');
    for (const el of document.querySelectorAll<HTMLElement>(sel)) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0 || getComputedStyle(el).visibility === 'hidden') continue;
      const name = el.dataset.testid ?? el.className ?? el.tagName;
      out.push({ name: String(name), box: { x: r.x, y: r.y, width: r.width, height: r.height } });
    }
    return out;
  });
  expect(hud.length, `${where}: HUD parts found`).toBeGreaterThan(8);
  for (const part of hud) {
    expect(
      overlaps(box!, part.box),
      `${where}: the message covers ${part.name} ${JSON.stringify({ box, part: part.box })}`,
    ).toBe(false);
  }
  const canvas = await page.locator('#game canvas').boundingBox();
  const layout = await page.evaluate(() => window.__timeclash!.layout());
  const bricks = await page.evaluate(() => window.__timeclash!.bricks());
  const dashers = await page.evaluate(() => window.__timeclash!.dashers());
  const { w: dw, h: dh } = CHARACTER_HEALTH.box;
  expect(canvas, `${where}: canvas`).not.toBeNull();
  expect(layout, `${where}: field`).not.toBeNull();
  const k = canvas!.width / WORLD.width;
  const onScreen = (r: { x: number; y: number; w: number; h: number }): Box => ({
    x: canvas!.x + r.x * k,
    y: canvas!.y + r.y * k,
    width: r.w * k,
    height: r.h * k,
  });
  const field: Array<[string, Box]> = [
    // A fighter on a built base stands on its top brick, lower than on the old castle.
    ...fighterKeepOut(
      layout!,
      Object.fromEntries(bricks.flatMap((l) => l.riders ?? []).map((r) => [r.id, r.dy])),
    ).map((r, i): [string, Box] => [`fighter part ${i}`, onScreen(r)]),
    ['Past base', onScreen(layout!.bases.PAST)],
    ['Future base', onScreen(layout!.bases.FUTURE)],
    ...bricks.flatMap((l) => l.boxes.map((b): [string, Box] => [`${l.team} brick`, onScreen(b)])),
    ...dashers
      .filter((d) => d.visible)
      .map((d): [string, Box] => [
        `${d.team} walking helper`,
        onScreen({ x: d.x - dw / 2, y: d.y - dh, w: dw, h: dh }),
      ]),
  ];
  for (const [name, b] of field) {
    expect(
      overlaps(box!, b),
      `${where}: the message covers the ${name} ${JSON.stringify({ box, b })}`,
    ).toBe(false);
  }
}

/**
 * Chrono's first-go caption shows as the turn starts and lasts about 2.5 seconds, so record its
 * box the moment it shows a line with `words` in it. Read it back with `recordedCaptionBox`.
 */
export async function recordCaptionBox(page: Page, words: string): Promise<void> {
  await page.evaluate((want) => {
    const w = window as unknown as { __captionBox?: unknown };
    const look = (): void => {
      const el = document.querySelector<HTMLElement>('[data-testid="caption-bar"]');
      if (!el || w.__captionBox || el.hidden || !(el.textContent ?? '').includes(want)) return;
      const r = el.getBoundingClientRect();
      if (r.width === 0) return;
      w.__captionBox = { x: r.x, y: r.y, width: r.width, height: r.height };
    };
    new MutationObserver(look).observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
    });
  }, words);
}

export async function recordedCaptionBox(page: Page): Promise<Box> {
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __captionBox?: Box }).__captionBox))
    .toBeTruthy();
  return (await page.evaluate(
    () => (window as unknown as { __captionBox: Box }).__captionBox,
  )) as Box;
}
