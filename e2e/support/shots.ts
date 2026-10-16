// Screenshots for docs/screenshots/<name>-<WxH>.png. Only Chromium writes them, so two
// browsers never fight over one file.
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';

const DIR = join(import.meta.dirname, '../../docs/screenshots');

export async function saveShot(page: Page, browserName: string, name: string): Promise<void> {
  if (browserName !== 'chromium') return;
  const size = page.viewportSize();
  if (!size) return;
  mkdirSync(DIR, { recursive: true });
  await page.screenshot({ path: join(DIR, `${name}-${size.width}x${size.height}.png`) });
}
