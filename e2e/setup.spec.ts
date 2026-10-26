// Setup: names are checked, choices are remembered, and each side picks its own grade.
import { expect, test } from './fixtures';
import { FUTURE_SIDE, PAST_SIDE, fillTeam, snap, startMatch, tid, toSetup } from './support/game';

const err = (page: Parameters<typeof tid>[0], team: 'PAST' | 'FUTURE') =>
  tid(page, `setup-error-${team}`);

test('an empty name shows a kind message and stays on Setup', async ({ page }) => {
  await toSetup(page);
  await tid(page, 'setup-name-PAST').fill('   ');
  await tid(page, 'setup-next').click();
  await expect(err(page, 'PAST')).toHaveText('Type a name first.');
  await expect(tid(page, 'setup-name-PAST')).toHaveAttribute('aria-invalid', 'true');
  await expect(tid(page, 'setup-name-PAST')).toBeFocused();
  await expect(tid(page, 'pass-screen')).toHaveCount(0);
});

test('typing is capped at 12 letters, and a longer name is still refused', async ({ page }) => {
  await toSetup(page);
  const input = tid(page, 'setup-name-FUTURE');
  await input.fill('');
  await input.pressSequentially('ABCDEFGHIJKLMNOP');
  await expect(input).toHaveValue('ABCDEFGHIJKL');
  // A paste or script can still set a long value. Setup must refuse it.
  await input.evaluate((el: HTMLInputElement) => {
    el.value = 'ABCDEFGHIJKLM';
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await tid(page, 'setup-next').click();
  await expect(err(page, 'FUTURE')).toHaveText('Names can be up to 12 letters.');
  await expect(tid(page, 'pass-screen')).toHaveCount(0);
});

// Setup and src/game/names.ts must refuse the same words ("poop", "butt", "fart" ...).
test('a rude name is refused, and fixing it lets the match start', async ({ page }) => {
  await toSetup(page);
  for (const rude of ['Hell', 'Poop']) {
    await tid(page, 'setup-name-PAST').fill(rude);
    await tid(page, 'setup-next').click();
    await expect(err(page, 'PAST'), rude).toHaveText("Let's pick a different name.");
  }
  await tid(page, 'setup-name-PAST').fill('Alex');
  await expect(err(page, 'PAST')).toBeEmpty();
  await tid(page, 'setup-next').click();
  await expect(tid(page, 'camp-start')).toBeVisible();
});

test('each side keeps its own grade and subject, and they reach the match', async ({ page }) => {
  await toSetup(page);
  await startMatch(
    page,
    { name: 'Alex', grade: 3, subject: 'reading' },
    { name: 'Sam', grade: 8, subject: 'math' },
  );
  const m = await snap(page);
  expect(m.players.map((p) => [p.team, p.name, p.grade, p.subject])).toEqual([
    ['PAST', 'Alex', 3, 'reading'],
    ['FUTURE', 'Sam', 8, 'math'],
  ]);
});

test('names, grades and subjects are remembered after a reload', async ({ page }) => {
  await toSetup(page);
  await fillTeam(page, 'PAST', PAST_SIDE);
  await fillTeam(page, 'FUTURE', FUTURE_SIDE);
  await tid(page, 'setup-next').click();
  await expect(tid(page, 'camp-start')).toBeVisible();

  await page.reload();
  await expect(tid(page, 'camp-start')).toBeVisible({ timeout: 10_000 });
  await tid(page, 'camp-players').click();
  await expect(tid(page, 'setup-next')).toBeVisible();
  await expect(tid(page, 'setup-name-PAST')).toHaveValue(PAST_SIDE.name);
  await expect(tid(page, 'setup-name-FUTURE')).toHaveValue(FUTURE_SIDE.name);
  await expect(tid(page, 'setup-grade-PAST')).toHaveValue('2');
  await expect(tid(page, 'setup-grade-FUTURE')).toHaveValue('3');
  await expect(tid(page, 'setup-subject-PAST-math')).toHaveAttribute('aria-checked', 'true');
});

test('Setup has no Focus switch and no line about Both', async ({ page }) => {
  await toSetup(page);
  await expect(page.locator('[data-testid^="setup-topic-"]')).toHaveCount(0);
  await expect(page.getByText('Focus:')).toHaveCount(0);
  await expect(page.getByText('Both mixes reading and math.')).toHaveCount(0);
  // The summary line repeats the cards, so only a screen reader hears it.
  const box = await tid(page, 'setup-read-back').boundingBox();
  expect(box === null || box.width <= 1).toBe(true);
});

test('the grade is a big dropdown, and the grown-up note shows only for K and Grade 1', async ({
  page,
}) => {
  await toSetup(page);
  for (const team of ['PAST', 'FUTURE'] as const) {
    const sel = tid(page, `setup-grade-${team}`);
    const box = await sel.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(56);
    const font = await sel.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(font).toBeGreaterThanOrEqual(20);
    await expect(page.locator(`label[for="${await sel.getAttribute('id')}"]`)).toHaveText('Grade');
  }
  await tid(page, 'setup-grade-PAST').selectOption('0');
  await tid(page, 'setup-grade-FUTURE').selectOption('5');
  await expect(tid(page, 'setup-grade-note-PAST')).toBeVisible();
  await expect(tid(page, 'setup-grade-note-PAST')).toHaveText(
    'A grown-up can read the questions with you.',
  );
  await expect(tid(page, 'setup-grade-note-FUTURE')).toBeHidden();
  // The native picker owns the keys (macOS opens a list, others step), so pick through it.
  await tid(page, 'setup-grade-PAST').selectOption('1');
  await expect(tid(page, 'setup-grade-note-PAST')).toBeVisible();
  await tid(page, 'setup-grade-PAST').selectOption('2');
  await expect(tid(page, 'setup-grade-note-PAST')).toBeHidden();
  const fits = await page.evaluate(
    () => document.documentElement.scrollHeight <= window.innerHeight,
  );
  expect(fits).toBe(true);
});

test('Loading shows for at least 1.5 seconds before Setup',async ({ page }) => {
  await page.goto('/');
  await tid(page, 'tap-to-play').click();
  // Stamp the two moments inside the page, so a slow test runner cannot shorten the gap.
  await page.evaluate(() => {
    const w = window as unknown as { __loadingAt?: number; __setupAt?: number };
    new MutationObserver(() => {
      if (w.__loadingAt === undefined && document.querySelector('[data-screen="loading"]'))
        w.__loadingAt = performance.now();
      if (w.__setupAt === undefined && document.querySelector('[data-testid="setup-next"]'))
        w.__setupAt = performance.now();
    }).observe(document.body, { childList: true, subtree: true, attributes: true });
  });
  await tid(page, 'intro-skip').click();
  await expect(tid(page, 'setup-next')).toBeVisible({ timeout: 10_000 });
  const gap = await page.evaluate(() => {
    const w = window as unknown as { __loadingAt?: number; __setupAt?: number };
    return (w.__setupAt ?? 0) - (w.__loadingAt ?? 0);
  });
  expect(gap).toBeGreaterThanOrEqual(1_500);
  await expect(page.locator('[data-screen="loading"]')).toBeHidden();
});

test('the clear-data confirm buttons stay hidden until Clear my data is tapped', async ({
  page,
}) => {
  await toSetup(page);
  await expect(tid(page, 'clear-data')).toBeVisible();
  // A quiet underlined link, still a 56px tap and 20px text.
  const link = tid(page, 'clear-data');
  const look = await link.evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      underline: cs.textDecorationLine.includes('underline'),
      font: parseFloat(cs.fontSize),
      border: parseFloat(cs.borderTopWidth),
    };
  });
  expect(look).toEqual({ underline: true, font: 20, border: 0 });
  expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(56);
  await expect(tid(page, 'clear-data-yes')).toBeHidden();
  await expect(tid(page, 'clear-data-no')).toBeHidden();
  await tid(page, 'clear-data').click();
  await expect(tid(page, 'clear-data-yes')).toBeVisible();
  await tid(page, 'clear-data-no').click();
  await expect(tid(page, 'clear-data-yes')).toBeHidden();
});

test('Match length: Normal at first, big enough to tap, and it stays on screen', async ({
  page,
}) => {
  await toSetup(page);
  const normal = tid(page, 'setup-length-normal');
  await expect(normal).toHaveAttribute('aria-checked', 'true');
  for (const id of ['short', 'normal', 'long']) {
    const chip = tid(page, `setup-length-${id}`);
    const box = await chip.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(56);
    expect(box!.width).toBeGreaterThanOrEqual(56);
    const font = await chip.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(font).toBeGreaterThanOrEqual(20);
  }
  await tid(page, 'setup-length-short').click();
  await expect(tid(page, 'setup-length-short')).toHaveAttribute('aria-checked', 'true');
  await tid(page, 'setup-length-short').press('ArrowRight');
  await expect(normal).toHaveAttribute('aria-checked', 'true');
  const fits = await page.evaluate(() => {
    const row = document.querySelector('[data-testid="setup-length-row"]')!.getBoundingClientRect();
    return row.bottom <= window.innerHeight && row.right <= window.innerWidth && row.left >= 0;
  });
  expect(fits).toBe(true);
});

// Owner, 2026-10-25: "selectors stay same size when toggled. no check needed when selected."
// A pick only changes colors. No option grows, and the strip never shifts (Regression 24).
test('picking a selector option never changes the size or place of any option', async ({
  page,
}) => {
  await toSetup(page);
  await page.evaluate(() => document.fonts.ready);
  const groups: Record<string, string[]> = {
    'Play with': ['play-with-person', 'play-with-computer'],
    'Team Past subject': ['reading', 'math', 'both'].map((s) => `setup-subject-PAST-${s}`),
    'Team Future subject': ['reading', 'math', 'both'].map((s) => `setup-subject-FUTURE-${s}`),
    'Match length': ['short', 'normal', 'long'].map((l) => `setup-length-${l}`),
    // On the Computer player card (owner, second screenshot: "fix chips here too. no checks").
    'How hard': ['easy', 'medium', 'hard'].map((l) => `computer-level-${l}`),
  };
  const boxes = (ids: string[]) =>
    page.evaluate(
      (list) =>
        list.map((id) => {
          const el = document.querySelector<HTMLElement>(`[data-testid="${id}"]`)!;
          const r = el.getBoundingClientRect();
          // The words sit in the same place too.
          const range = document.createRange();
          range.selectNodeContents(el);
          const t = range.getBoundingClientRect();
          return { id, x: r.x, y: r.y, w: r.width, h: r.height, tx: t.x, tw: t.width };
        }),
      ids,
    );
  for (const [name, ids] of Object.entries(groups)) {
    if (name === 'How hard') await tid(page, 'play-with-computer').click();
    const before = await boxes(ids);
    // Each option in turn, then back to the first, so every option is seen picked and not.
    // (Play with "Computer player" swaps a card, so only the strip itself is compared.)
    for (const id of [...ids.slice(1), ...ids.slice(0, 1)]) {
      await tid(page, id).click();
      await expect(tid(page, id)).toHaveAttribute('aria-checked', 'true');
      const after = await boxes(ids);
      for (const [i, b] of before.entries()) {
        const a = after[i]!;
        for (const k of ['x', 'y', 'w', 'h', 'tx', 'tw'] as const) {
          expect
            .soft(Math.abs(a[k] - b[k]), `${name}: ${b.id} ${k} after picking ${id}`)
            .toBeLessThanOrEqual(0.5);
        }
      }
    }
    // Options in one strip share one width (neighbours overlap their 3px edge).
    const widths = before.map((b) => b.w);
    expect
      .soft(Math.max(...widths) - Math.min(...widths), `${name}: equal widths`)
      .toBeLessThanOrEqual(3.5);
    // No check mark is drawn on any option, picked or not.
    const marks = await page.evaluate(
      (list) =>
        list.filter((id) => {
          const el = document.querySelector<HTMLElement>(`[data-testid="${id}"]`)!;
          const mark = getComputedStyle(el, '::before').content;
          return /[✓✔]/.test(`${el.textContent} ${mark}`);
        }),
      ids,
    );
    expect.soft(marks, `${name}: options with a check mark`).toEqual([]);
  }
});

/** Boxes of the Setup parts that must keep clear of each other, read in the page. */
async function setupGeometry(page: Parameters<typeof tid>[0]) {
  return page.evaluate(() => {
    const box = (el: Element) => {
      const r = el.getBoundingClientRect();
      return { l: r.left, t: r.top, r: r.right, b: r.bottom };
    };
    const shown = (el: Element) => (el as HTMLElement).offsetParent !== null;
    const vs = document.querySelector('.tc-vs')!;
    const vsBox = box(vs);
    // The badge's drawn ring reaches 4px past its box.
    const ring = { l: vsBox.l - 4, t: vsBox.t - 4, r: vsBox.r + 4, b: vsBox.b + 4 };
    const cards = [...document.querySelectorAll('.tc-team-card')].filter(shown);
    const cardInfo = cards.map((c) => {
      const cb = box(c);
      const cs = getComputedStyle(c);
      const edge = parseFloat(cs.borderLeftWidth);
      const kids = [
        ...c.querySelectorAll(
          '.tc-label, .tc-team-head, input, select, .tc-chips, .tc-muted, .tc-computer-name, .tc-computer-note',
        ),
      ]
        .filter(shown)
        .map((k) => ({ cls: k.className, ...box(k) }));
      // How far each part sits inside the card's border.
      const inset = Math.min(
        ...kids.flatMap((k) => [
          k.l - cb.l - edge,
          cb.r - k.r - edge,
          k.t - cb.t - edge,
          cb.b - k.b - edge,
        ]),
      );
      // Space between one part and the next, top to bottom.
      const sorted = [...kids].sort((a, b) => a.t - b.t);
      const gaps = sorted
        .slice(1)
        .map((k, i) => ({ what: `${sorted[i]!.cls} -> ${k.cls}`, gap: k.t - sorted[i]!.b }));
      return { team: c.getAttribute('data-team'), box: cb, inset, gaps };
    });
    const hits = (a: { l: number; t: number; r: number; b: number }, b: typeof a) =>
      a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
    // Chips whose words spill past their own box.
    const spills = [...document.querySelectorAll<HTMLElement>('[data-screen="setup"] .tc-chip')]
      .filter(shown)
      .filter((c) => {
        // The words keep at least 8px of room inside the chip's edge on each side.
        const range = document.createRange();
        range.selectNodeContents(c);
        const t = range.getBoundingClientRect();
        const r = c.getBoundingClientRect();
        const edge = parseFloat(getComputedStyle(c).borderLeftWidth);
        return (
          c.scrollWidth > c.clientWidth + 1 ||
          c.scrollHeight > c.clientHeight + 1 ||
          t.left - r.left - edge < 8 ||
          r.right - t.right - edge < 8
        );
      })
      .map((c) => c.dataset.testid);
    const rows = ['.tc-play-with', '.tc-team-cards', '.tc-row-start', '.tc-privacy']
      .map((sel) => document.querySelector(sel))
      .filter((el): el is Element => !!el && shown(el))
      .map(box);
    const rowGaps = rows.slice(1).map((r, i) => r.t - rows[i]!.b);
    return {
      vsHitsCard: cardInfo.filter((c) => hits(ring, c.box)).map((c) => c.team),
      cardInfo,
      spills,
      rowGaps,
    };
  });
}

// Owner, 2026-10-25: "more padding". The cards breathe, the VS badge sits in the gap between
// the cards and touches neither, and the rows have clear space between them. Both ways to play.
test('Setup has room to breathe: padded cards, VS clear of both cards, gaps between rows', async ({
  page,
}) => {
  await toSetup(page);
  for (const who of ['person', 'computer'] as const) {
    await tid(page, `play-with-${who}`).click();
    for (const grade of ['0', '5']) {
      await tid(page, 'setup-grade-PAST').selectOption(grade);
      if (who === 'person') await tid(page, 'setup-grade-FUTURE').selectOption(grade);
      for (const [w, h] of [
        [1280, 800],
        [1024, 768],
        [1133, 744],
      ] as const) {
        await page.setViewportSize({ width: w, height: h });
        await page.evaluate(() => document.fonts.ready);
        const g = await setupGeometry(page);
        const where = `${who}, grade ${grade}, ${w}x${h}`;
        // A short window (iPad mini, 744 tall) steps the row gaps down to 20px. Card padding stays.
        const room = h <= 760 ? 20 : 24;
        expect.soft(g.vsHitsCard, `${where}: VS badge over a card`).toEqual([]);
        expect.soft(g.spills, `${where}: chip words spill out`).toEqual([]);
        for (const c of g.cardInfo) {
          expect.soft(c.inset, `${where}: ${c.team} card inner padding`).toBeGreaterThanOrEqual(24);
          for (const gap of c.gaps)
            expect.soft(gap.gap, `${where}: ${c.team} ${gap.what}`).toBeGreaterThanOrEqual(8);
        }
        for (const gap of g.rowGaps)
          expect.soft(gap, `${where}: gap between Setup rows`).toBeGreaterThanOrEqual(room);
      }
    }
  }
});

// From the Camp, Setup has Back. It rides the top row beside the ? and gear, so the bottom row
// keeps one line and Setup still fits with no scroll (Regression 13).
test('Setup opened from the Camp: Back sits up top, clear of the title, and Setup still fits', async ({
  page,
}) => {
  await toSetup(page);
  await fillTeam(page, 'PAST', PAST_SIDE);
  await fillTeam(page, 'FUTURE', FUTURE_SIDE);
  await tid(page, 'setup-next').click();
  await tid(page, 'camp-players').click();
  await expect(tid(page, 'setup-back')).toBeVisible();
  for (const [w, h] of [
    [1280, 800],
    [1024, 768],
    [1133, 744],
  ] as const) {
    await page.setViewportSize({ width: w, height: h });
    await page.evaluate(() => document.fonts.ready);
    const r = await page.evaluate(() => {
      const box = (sel: string) => document.querySelector(sel)!.getBoundingClientRect();
      const back = box('[data-testid="setup-back"]');
      const title = box('.tc-setup-title');
      const gear = box('[data-testid="settings-button"]');
      const screen = document.querySelector<HTMLElement>('[data-screen="setup"]')!;
      // One row: every part's middle is on one line (they are centered on the row).
      const tops = [...document.querySelectorAll('.tc-row-start > *')].map((e) => {
        const b = e.getBoundingClientRect();
        return Math.round((b.top + b.bottom) / 20);
      });
      return {
        backHitsTitle:
          back.right > title.left && back.left < title.right && back.bottom > title.top,
        backHitsGear: back.left < gear.right && back.top < gear.bottom,
        scrolls: screen.scrollHeight - screen.clientHeight,
        clearBottom: box('[data-testid="clear-data"]').bottom,
        rows: new Set(tops).size,
      };
    });
    const where = `${w}x${h}`;
    expect.soft(r.backHitsTitle, `${where}: Back over the title`).toBe(false);
    expect.soft(r.backHitsGear, `${where}: Back over the gear`).toBe(false);
    expect.soft(r.scrolls, `${where}: Setup scrolls`).toBeLessThanOrEqual(1);
    expect
      .soft(r.clearBottom, `${where}: Clear my data clear of the bottom`)
      .toBeLessThanOrEqual(h - 8);
    expect.soft(r.rows, `${where}: Match length and Let's clash! share one row`).toBe(1);
  }
});
