// Decides whether motion should be reduced. The setting wins; 'system' asks the browser.
import type { Settings } from '../storage/types';

export function isReducedMotion(
  setting: Settings['reducedMotion'],
  win: Pick<Window, 'matchMedia'> | null | undefined,
): boolean {
  if (setting === 'on') return true;
  if (setting === 'off') return false;
  try {
    return Boolean(win?.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  } catch {
    return false;
  }
}
