// One answer to "should motion be reduced?" for the Battle and Victory scenes. The saved
// setting (on, off, system) wins. With no setting, ask the browser. Never throws.
import { loadSettings } from '../../storage/storage';
import { isReducedMotion } from '../../ui/motion';
import { servicesOf } from '../registry';

type WinLike = Pick<Window, 'matchMedia'> | null | undefined;

export function sceneReducedMotion(registry: { get(key: string): unknown }, win: WinLike): boolean {
  let setting: 'system' | 'on' | 'off' = 'system';
  try {
    setting = loadSettings(servicesOf(registry).storage).reducedMotion;
  } catch {
    // No services yet (or storage blocked): fall back to the browser's preference.
  }
  return isReducedMotion(setting, win);
}
