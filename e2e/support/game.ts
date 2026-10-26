// Helpers that drive the game the way a family does: taps, typing, arrow keys, Space.
// The ?e2e=1 hook is used only to pin the seed and to read state (never questions).
import type { Locator, Page } from '@playwright/test';
import { expect } from '../fixtures';
import { BONUS, DAMAGE, RELOAD, TIMING } from '../../src/game/config';
import type { AimInput, BlastResult, Match, Subject, Team } from '../../src/game/types';
import { findAim } from './aim';
import { rightChoiceIndex } from './bank';
import './globals';

export const tid = (page: Page, id: string): Locator => page.getByTestId(id);

/** Seed used by every full-game test, so a run repeats. */
export const SEED = 4242;

/** `query` adds to the address, such as "&computer=0". */
export async function openGame(page: Page, query = ''): Promise<void> {
  await page.goto(`/?e2e=1${query}`);
  await page.waitForFunction(() => Boolean(window.__timeclash));
}

/** Adds `ms` to the page clock (performance.now), so a wait in the app ends without a sleep. */
async function skewClock(page: Page, ms: number): Promise<void> {
  await page.evaluate((add) => (window.__skew = (window.__skew ?? 0) + add), ms);
}

/**
 * Loading stays up so the jokes can be read: TIMING.loadingQuickMs under ?e2e=1, longer for a
 * real family. Tests that are not about Loading move the page clock past it instead of waiting.
 * (e2e/setup.spec.ts still times the real Loading screen.)
 */
export async function skipLoadingWait(page: Page): Promise<void> {
  const loading = page.locator('[data-screen="loading"]');
  // A very busy machine can be past Loading already. Then there is nothing to skip.
  await expect(loading.or(tid(page, 'setup-next')).first()).toBeVisible({ timeout: 10_000 });
  if (await loading.isVisible()) await skewClock(page, TIMING.loadingFirstMinMs);
}

/** First visit: tap, Skip the intro, skip past Loading, land on Setup. */
export async function toSetup(page: Page, query = ''): Promise<void> {
  await openGame(page, query);
  await tid(page, 'tap-to-play').click();
  await tid(page, 'intro-skip').click();
  await skipLoadingWait(page);
  await expect(tid(page, 'setup-next')).toBeVisible({ timeout: 10_000 });
}

export type Side = { name: string; grade: number; subject: Subject };

export async function fillTeam(page: Page, team: Team, side: Side): Promise<void> {
  await tid(page, `setup-name-${team}`).fill(side.name);
  await tid(page, `setup-grade-${team}`).selectOption(String(side.grade));
  await tid(page, `setup-subject-${team}-${side.subject}`).click();
}

export const PAST_SIDE: Side = { name: 'Alex', grade: 2, subject: 'math' };
export const FUTURE_SIDE: Side = { name: 'Sam', grade: 3, subject: 'math' };

/** Taps "Time to Clash!" at the Camp, then "Lock it in!" on the Battle Plan with what is picked. */
export async function clashFromCamp(page: Page): Promise<void> {
  await tid(page, 'camp-start').click();
  await expect(tid(page, 'plan-go')).toBeVisible({ timeout: 10_000 });
  await tid(page, 'plan-go').click();
}

/**
 * Fills Setup, pins the seed, taps "Let's clash!", then taps "Time to Clash!" at the Camp and
 * waits for the first pass screen. `atCamp` runs while the Camp is up (for checks and shots).
 */
export async function startMatch(
  page: Page,
  past: Side = PAST_SIDE,
  future: Side = FUTURE_SIDE,
  seed: number = SEED,
  atCamp?: () => Promise<void>,
): Promise<void> {
  await fillTeam(page, 'PAST', past);
  await fillTeam(page, 'FUTURE', future);
  await page.evaluate((s) => window.__timeclash!.setSeed(s), seed);
  await tid(page, 'setup-next').click();
  await expect(tid(page, 'camp-start')).toBeVisible({ timeout: 10_000 });
  await atCamp?.();
  await clashFromCamp(page);
  await expect(tid(page, 'pass-screen')).toBeVisible({ timeout: 10_000 });
}

export async function snap(page: Page): Promise<Match> {
  const m = await page.evaluate(() => window.__timeclash!.match());
  if (!m) throw new Error('There is no match yet.');
  return m;
}

/** Taps "I'm ready!" and waits until the first shot can be aimed. */
export async function readyUp(page: Page): Promise<void> {
  await tid(page, 'pass-ready').click();
  await expect(tid(page, 'pass-screen')).toBeHidden();
  await waitAiming(page, 0);
}

/** Waits until the active team can aim shot number `shotsFired + 1`. */
export async function waitAiming(page: Page, shotsFired: 0 | 1): Promise<void> {
  await expect
    .poll(
      async () => {
        const t = (await snap(page)).turn;
        return `${t.phase}:${t.shotsFired}`;
      },
      { timeout: 30_000 },
    )
    .toBe(`AIMING:${shotsFired}`);
  // The phase flips when the shot lands. Fire turns on after the blast, the fall and the bubble,
  // which take longer on a slow CI browser, so wait as long as the phase poll does.
  await expect(tid(page, 'fire')).toBeEnabled({ timeout: 30_000 });
}

async function pressAxis(page: Page, from: number, to: number, up: string, down: string) {
  const d = to - from;
  const key = d > 0 ? up : down;
  const coarse = Math.floor(Math.abs(d) / 5);
  const fine = Math.abs(d) % 5;
  for (let i = 0; i < coarse; i++) await page.keyboard.press(`Shift+${key}`);
  for (let i = 0; i < fine; i++) await page.keyboard.press(key);
}

/** Up/Down change the angle, Right/Left change the power. Shift moves by 5. */
export async function enterAim(page: Page, team: Team, to: AimInput): Promise<void> {
  const from = (await snap(page)).aim[team];
  // Keys are ignored while a button has focus, so start from the page itself.
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await pressAxis(page, from.angleDeg, to.angleDeg, 'ArrowUp', 'ArrowDown');
  await pressAxis(page, from.power, to.power, 'ArrowRight', 'ArrowLeft');
  await expect.poll(async () => (await snap(page)).aim[team]).toEqual(to);
}


/** Aims for a wanted result with the keyboard, then fires with Space. Returns the aim used. */
export async function takeShot(page: Page, wanted: BlastResult): Promise<AimInput> {
  const s = await snap(page);
  const team = s.turn.team;
  // The field as it stands now: the Battle Plan's biome and base spot, and any wall.
  const layout = await page.evaluate(() => window.__timeclash!.layout());
  const aim = findAim(team, s.wind, s.aim[team], wanted, layout ?? undefined);
  await enterAim(page, team, aim);
  const before = s.stats[team].shotsFired;
  await page.keyboard.press('Space');
  await expect.poll(async () => (await snap(page)).stats[team].shotsFired).toBe(before + 1);
  return aim;
}

/** Both shots of one turn, as given. Stops after the second shot lands. */
export async function playShots(page: Page, shots: [BlastResult, BlastResult]): Promise<void> {
  await takeShot(page, shots[0]);
  await waitAiming(page, 1);
  await takeShot(page, shots[1]);
}

export type HowToAnswer = 'right-fast' | 'right-slow' | 'wrong';

/** What the reload modal shows, read from the page. */
export async function readQuestion(page: Page): Promise<{ prompt: string; choices: string[] }> {
  const modal = tid(page, 'reload-modal');
  await expect(modal).toBeVisible();
  return modal.evaluate((el) => {
    const text = (n: Element) => n.getAttribute('aria-label') ?? n.textContent ?? '';
    const prompt = el.querySelector('[data-testid="reload-prompt"]')!;
    const choices = [...el.querySelectorAll('[data-testid^="reload-choice-"]')].map(text);
    return { prompt: text(prompt), choices };
  });
}

/**
 * Answers the open reload question. "slow" moves the page clock forward 9 seconds instead
 * of waiting, and "right-fast" answers 300 ms after the card showed on the page clock, however
 * busy the machine is. Returns the question, the right answer, and what was tapped.
 */
export async function answerReload(page: Page, how: HowToAnswer) {
  const q = await readQuestion(page);
  const right = rightChoiceIndex(q.prompt, q.choices);
  const wrong = [0, 1, 2, 3].find((i) => i !== right)!;
  if (how === 'right-slow') await skewClock(page, 9000);
  const pick = how === 'wrong' ? wrong : right;
  if (how === 'right-fast') {
    // Fast is judged on the page clock, from when the card showed. A busy machine can take
    // seconds to get here, so check the button is tappable, then tap it in one page task with the
    // clock set to 300 ms after the card appeared. The skew is put back at once.
    const choice = tid(page, `reload-choice-${pick}`);
    await choice.click({ trial: true });
    await choice.evaluate((el) => {
      const w = window;
      const saved = w.__skew ?? 0;
      if (w.__modalAt !== undefined) {
        w.__skew = saved - Math.max(0, w.performance.now() - w.__modalAt - 300);
      }
      try {
        (el as HTMLElement).click();
      } finally {
        w.__skew = saved;
      }
    });
  } else {
    await tid(page, `reload-choice-${pick}`).click();
  }
  return { ...q, rightIndex: right, rightAnswer: q.choices[right]!, picked: q.choices[pick]! };
}

/** After any answer the card waits for Got it. It ignores taps for a moment, so move the page clock past that. */
export async function tapGotIt(page: Page): Promise<void> {
  await expect(tid(page, 'reload-next')).toBeVisible();
  await skewClock(page, RELOAD.gotItDelayMs);
  await tid(page, 'reload-next').click();
}

/** Waits until the Power Shot (earned by a right answer) can be aimed. */
export async function waitBonusAiming(page: Page): Promise<void> {
  await expect
    .poll(async () => (await snap(page)).turn.phase, { timeout: 30_000 })
    .toBe('BONUS_AIMING');
  await expect(tid(page, 'fire')).toBeEnabled();
}

/** Takes the Power Shot with the keyboard, like any other shot. */
export async function takeBonusShot(page: Page, wanted: BlastResult = 'miss'): Promise<AimInput> {
  await waitBonusAiming(page);
  return takeShot(page, wanted);
}

/**
 * Waits for the next pass screen (the other team's turn). A right answer earns a Power Shot
 * first, so if one shows up this takes it as a harmless miss and then waits for the pass.
 */
export async function waitPassScreen(page: Page): Promise<void> {
  const state = async (): Promise<'pass' | 'bonus' | 'wait'> => {
    if (await tid(page, 'pass-screen').isVisible()) return 'pass';
    const m = await page.evaluate(() => window.__timeclash!.match());
    return m?.turn.phase === 'BONUS_AIMING' ? 'bonus' : 'wait';
  };
  await expect.poll(state, { timeout: 45_000 }).not.toBe('wait');
  if ((await state()) === 'bonus') await takeBonusShot(page, 'miss');
  await expect(tid(page, 'pass-screen')).toBeVisible({ timeout: 45_000 });
}

/** A whole turn with short harmless shots, a quick right answer, and the pass. */
export async function quietTurn(page: Page): Promise<void> {
  await readyUp(page);
  await playShots(page, ['miss', 'miss']);
  await expect(tid(page, 'reload-modal')).toBeVisible({ timeout: 20_000 });
  await answerReload(page, 'right-fast');
  await waitPassScreen(page);
}

/**
 * Full health is several turns of hits (the pace rule), so a test that plays to Victory first
 * wears the base down. Start on the shooter's pass screen. The shooter lands direct hits and
 * Power Shots, each only while it leaves the other base above 0, and the other team takes quiet
 * turns. Ends on the shooter's pass screen with the other base at one direct hit or less.
 */
export async function wearDown(page: Page): Promise<void> {
  const shooter = (await snap(page)).turn.team;
  const target: Team = shooter === 'PAST' ? 'FUTURE' : 'PAST';
  const powerHit = Math.round(DAMAGE.direct * BONUS.damageMultiplier);
  const hp = async (): Promise<number> => (await snap(page)).baseHp[target];
  const aimFor = async (hit: number): Promise<BlastResult> =>
    (await hp()) > hit ? 'direct' : 'miss';
  while ((await hp()) > DAMAGE.direct) {
    await readyUp(page);
    await takeShot(page, await aimFor(DAMAGE.direct));
    await waitAiming(page, 1);
    await takeShot(page, await aimFor(DAMAGE.direct));
    await expect(tid(page, 'reload-modal')).toBeVisible({ timeout: 45_000 });
    await answerReload(page, 'right-fast');
    await takeBonusShot(page, await aimFor(powerHit));
    await waitPassScreen(page);
    await quietTurn(page);
  }
  expect(await hp()).toBeGreaterThan(0);
}

/**
 * The turn banner only lasts about two seconds, and a slow machine can miss it when polling.
 * Call watchBanner() before the tap that shows it, then read bannerSeen().
 */
export async function watchBanner(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as { __banner?: string };
    w.__banner = '';
    new MutationObserver(() => {
      const el = document.querySelector('[data-testid="turn-banner"]');
      if (el?.textContent) w.__banner = el.textContent;
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  });
}

export async function bannerSeen(page: Page): Promise<string> {
  return page.evaluate(() => (window as unknown as { __banner?: string }).__banner ?? '');
}
