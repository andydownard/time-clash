// One-shot visual effects. Every effect returns a promise that resolves when it is done.
// When motion is reduced, an effect becomes a soft fade (docs: Accessibility, reduced-motion support).
import Phaser from 'phaser';
import { HIT_FX } from '../../game/config';
import type { Vec2 } from '../../game/types';
import type { EffectKind } from './types';
import { TEXT_ROLES, textStyle, type TextRole } from './textStyle';
import { PALETTE, REDUCED_FADE_MS } from './visual';

const tweenDone = (
  scene: Phaser.Scene,
  config: Phaser.Types.Tweens.TweenBuilderConfig,
): Promise<void> =>
  new Promise((resolve) => {
    scene.tweens.add({ ...config, onComplete: () => resolve() });
  });

export function playFade(
  scene: Phaser.Scene,
  pos: Vec2,
  color: number,
  scale: number,
): Promise<void> {
  const dot = scene.add.circle(pos.x, pos.y, 40 * scale, color, 0.7).setDepth(40);
  return tweenDone(scene, {
    targets: dot,
    alpha: 0,
    duration: REDUCED_FADE_MS,
    onComplete: () => dot.destroy(),
  });
}

export function effectColor(kind: EffectKind): number {
  switch (kind) {
    case 'confetti':
      return PALETTE.past.gold;
    case 'plasma':
      return PALETTE.future.glow;
    case 'blocks':
      return PALETTE.past.banner;
    default:
      return PALETTE.shared.white;
  }
}

/**
 * Floating caption such as "Direct hit!" or "+2". Words use the old voice (MedievalSharp).
 * Numbers use the new voice (Orbitron), so pass role 'scrap' for those.
 */
export function floatLabel(
  scene: Phaser.Scene,
  pos: Vec2,
  text: string,
  role: TextRole = 'hit',
  /** Grows the size on a small screen so the label stays at the 20px floor (see textScale.ts). */
  scaleFont: (basePx: number) => number = (px) => px,
): void {
  const style = textStyle(role);
  const t = scene.add
    .text(pos.x, pos.y, text, {
      ...style,
      fontSize: `${scaleFont(TEXT_ROLES[role].basePx)}px`,
      padding: { x: 14, y: 6 },
    })
    .setOrigin(0.5)
    .setDepth(50);
  scene.tweens.add({
    targets: t,
    y: pos.y - 36,
    alpha: { from: 1, to: 0 },
    delay: 400,
    duration: 900,
    onComplete: () => t.destroy(),
  });
}

/** A "-N" pip that rises and fades over what was hit. Reduced motion: it stays put and fades. */
export function playDamagePip(
  scene: Phaser.Scene,
  pos: Vec2,
  text: string,
  reduced: boolean,
  scaleFont: (basePx: number) => number = (px) => px,
): Promise<void> {
  const style = textStyle('scrap');
  const t = scene.add
    .text(pos.x, pos.y, text, {
      ...style,
      fontSize: `${scaleFont(TEXT_ROLES.scrap.basePx)}px`,
      padding: { x: 14, y: 6 },
    })
    .setOrigin(0.5)
    .setDepth(51);
  return tweenDone(scene, {
    targets: t,
    y: reduced ? pos.y : pos.y - HIT_FX.pipRisePx,
    alpha: { from: 1, to: 0 },
    delay: HIT_FX.pipHoldMs,
    duration: HIT_FX.pipFadeMs,
    ease: 'Quad.easeOut',
    onComplete: () => t.destroy(),
  });
}
