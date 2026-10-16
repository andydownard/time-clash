// Mounts the DOM layer over the canvas and the always-there buttons. Safe to run twice.
import { loadSettings } from '../storage/storage';
import { mountChrome } from './chrome';
import type { AppServices } from './registry';

const mounted = new WeakSet<object>();

export function bootApp(
  services: AppServices,
  doc: Document,
  canvas: HTMLCanvasElement | null,
): void {
  if (mounted.has(services)) return;
  mounted.add(services);
  const root = canvas?.parentElement ?? doc.body;
  services.overlay.mount(root, canvas);
  services.overlay.applySettings(loadSettings(services.storage));
  mountChrome(doc, services);

  // The browser can pause sound without telling us (a lock screen, a call, a hidden tab).
  doc.addEventListener('visibilitychange', () => services.audio.setPageHidden(doc.hidden));
  // Wake it on the next tap or key press. Never before the first tap: sound starts only then.
  const wake = (): void => {
    if (services.audio.unlocked) void services.audio.unlock();
  };
  doc.addEventListener('pointerdown', wake, true);
  doc.addEventListener('keydown', wake, true);
}
