// In-page checks for the accessibility floors (AGENTS.md): 56px targets, 20px text, focus ring.
import type { Page } from '@playwright/test';

/**
 * Covers pop in with a scale animation, so a size read mid-pop is too small. Wait until every
 * finite animation has finished before measuring.
 */
export async function settle(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const finite = document
      .getAnimations()
      .filter((a) => Number.isFinite(a.effect?.getComputedTiming().endTime ?? Infinity));
    await Promise.all(finite.map((a) => a.finished.catch(() => undefined)));
  });
}

export type Offender = { what: string; detail: string };

/** Interactive things that are visible and smaller than `min` in either direction. */
export async function smallTargets(page: Page, min = 56): Promise<Offender[]> {
  await settle(page);
  return page.evaluate((limit) => {
    const sel =
      'button, input, select, textarea, a[href], [role="radio"], [role="button"], [tabindex]:not([tabindex="-1"])';
    const out: { what: string; detail: string }[] = [];
    for (const el of document.querySelectorAll<HTMLElement>(sel)) {
      const st = getComputedStyle(el);
      if (st.visibility === 'hidden' || st.display === 'none') continue;
      if (el.closest('[inert], [hidden], [aria-hidden="true"]')) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      if (r.width < limit - 0.5 || r.height < limit - 0.5) {
        const id = el.getAttribute('data-testid') ?? el.className ?? el.tagName;
        out.push({ what: String(id), detail: `${Math.round(r.width)}x${Math.round(r.height)}` });
      }
    }
    return out;
  }, min);
}

/** Visible text smaller than `min` px. */
export async function smallText(page: Page, min = 20): Promise<Offender[]> {
  await settle(page);
  return page.evaluate((limit) => {
    const out: { what: string; detail: string }[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const text = (n.textContent ?? '').trim();
      const el = n.parentElement;
      if (!text || !el) continue;
      if (el.closest('script, style, noscript, [hidden], [inert], [aria-hidden="true"]')) continue;
      const st = getComputedStyle(el);
      if (st.visibility === 'hidden' || st.display === 'none') continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const px = parseFloat(st.fontSize);
      if (px < limit - 0.01) out.push({ what: text.slice(0, 40), detail: `${px}px` });
    }
    return out;
  }, min);
}

/** The focused element's outline, as the browser computes it. */
export async function focusRing(page: Page) {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return null;
    const st = getComputedStyle(el);
    return {
      id: el.getAttribute('data-testid') ?? el.tagName,
      style: st.outlineStyle,
      width: parseFloat(st.outlineWidth),
      color: st.outlineColor,
      shadow: st.boxShadow,
    };
  });
}

/** Elements under the DOM layer that still run an animation or transition. */
export async function bigMotion(page: Page): Promise<Offender[]> {
  return page.evaluate(() => {
    const out: { what: string; detail: string }[] = [];
    const secs = (v: string) =>
      Math.max(...v.split(',').map((x) => parseFloat(x) * (x.includes('ms') ? 0.001 : 1)));
    for (const el of document.querySelectorAll<HTMLElement>('[data-tc-root], [data-tc-root] *')) {
      const st = getComputedStyle(el);
      const anim = st.animationName !== 'none' ? secs(st.animationDuration) : 0;
      const trans = secs(st.transitionDuration);
      if (anim > 0.05 || trans > 0.05) {
        out.push({
          what: el.getAttribute('data-testid') ?? el.className ?? el.tagName,
          detail: `animation ${anim}s, transition ${trans}s`,
        });
      }
    }
    return out;
  });
}
