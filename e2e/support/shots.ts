// Screenshots for docs/screenshots/<name>-<WxH>.png. They are retaken only when
// UPDATE_SCREENSHOTS=1 is set, so a normal run never rewrites tracked files (and never spends
// time on them). Only Chromium writes them, so two browsers never fight over one file.
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';

const DIR = join(import.meta.dirname, '../../docs/screenshots');

export async function saveShot(page: Page, browserName: string, name: string): Promise<void> {
  if (process.env.UPDATE_SCREENSHOTS !== '1' || browserName !== 'chromium') return;
  const size = page.viewportSize();
  if (!size) return;
  mkdirSync(DIR, { recursive: true });
  await page.screenshot({ path: join(DIR, `${name}-${size.width}x${size.height}.png`) });
}
