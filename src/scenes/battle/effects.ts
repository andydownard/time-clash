// One-shot visual effects. Every effect returns a promise that resolves when it is done.
// Confetti, plasma rings and toy blocks are all silly and harmless. When motion is reduced,
// each one becomes a soft fade (docs: Accessibility, reduced-motion support).
import Phaser from 'phaser';
import { HIT_FX } from '../../game/config';
import { createRng } from '../../game/rng';
import type { Rect, Vec2 } from '../../game/types';
import type { EffectKind } from './types';
import { TEXT_ROLES, textStyle, type TextRole } from './textStyle';
import { PALETTE, REDUCED_FADE_MS } from './visual';

/** Confetti and toy blocks use both teams' colors, so a hit looks like a party, not a loss. */
export const CONFETTI = [
  PALETTE.past.gold,
  PALETTE.past.banner,
  PALETTE.future.glow,
  PALETTE.future.neon,
  PALETTE.future.pink,
  PALETTE.past.parchment,
] as const;
export const BLOCK_COLORS = [
  PALETTE.past.banner,
  PALETTE.past.gold,
  PALETTE.future.glow,
  PALETTE.future.neon,
] as const;

const tweenDone = (
  scene: Phaser.Scene,
  config: Phaser.Types.Tweens.TweenBuilderConfig,
): Promise<void> =>
  new Promise((resolve) => {
    scene.tweens.add({ ...config, onComplete: () => resolve() });
  });

/** The effects are deterministic: the same landing spot gives the same burst. */
const seeded = (pos: Vec2) => createRng(Math.round(pos.x * 31 + pos.y * 17) >>> 0);

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

export function playConfetti(scene: Phaser.Scene, pos: Vec2, scale: number): Promise<void> {
  const rng = seeded(pos);
  const count = Math.round(24 * scale);
  const pieces: Array<Promise<void>> = [];
  for (let i = 0; i < count; i++) {
    const color = CONFETTI[i % CONFETTI.length] as number;
    const piece = scene.add.rectangle(pos.x, pos.y, 10, 6, color).setDepth(40);
    const angle = rng.next() * Math.PI * 2;
    const dist = (50 + rng.next() * 90) * scale;
    pieces.push(
      tweenDone(scene, {
        targets: piece,
        x: pos.x + Math.cos(angle) * dist,
        y: pos.y + Math.sin(angle) * dist + 30,
        angle: rng.next() * 540,
        alpha: 0,
        duration: 700 + rng.next() * 300,
        ease: 'Cubic.easeOut',
        onComplete: () => piece.destroy(),
      }),
    );
  }
  return Promise.all(pieces).then(() => undefined);
}

export function playPlasmaRing(scene: Phaser.Scene, pos: Vec2, scale: number): Promise<void> {
  const rings = [PALETTE.future.glow, PALETTE.future.neon].map((color, i) => {
    const ring = scene.add.circle(pos.x, pos.y, 12).setStrokeStyle(6, color, 1).setDepth(40);
    return tweenDone(scene, {
      targets: ring,
      scale: (4 + i * 1.5) * scale,
      alpha: 0,
      duration: 650 + i * 150,
      ease: 'Quad.easeOut',
      onComplete: () => ring.destroy(),
    });
  });
  return Promise.all(rings).then(() => undefined);
}

export function playPuff(scene: Phaser.Scene, pos: Vec2, scale: number): Promise<void> {
  const puffs = [-1, 0, 1].map((n) => {
    const p = scene.add
      .circle(pos.x + n * 14 * scale, pos.y, 10 * scale, PALETTE.shared.white, 0.9)
      .setDepth(40);
    return tweenDone(scene, {
      targets: p,
      y: pos.y - 24 * scale,
      scale: 2.2,
      alpha: 0,
      duration: 500,
      onComplete: () => p.destroy(),
    });
  });
  return Promise.all(puffs).then(() => undefined);
}

/** The base walls pop into bouncy toy blocks, bounce, and settle. */
export function playBlocks(scene: Phaser.Scene, base: Rect, groundY: number): Promise<void> {
  const rng = seeded({ x: base.x, y: base.y });
  const blocks: Array<Promise<void>> = [];
  const count = 10;
  for (let i = 0; i < count; i++) {
    const size = 22 + rng.int(0, 10);
    const startX = base.x + 10 + rng.next() * (base.w - 20);
    const startY = base.y + 10 + rng.next() * (base.h - 40);
    const color = BLOCK_COLORS[i % BLOCK_COLORS.length] as number;
    const block = scene.add
      .rectangle(startX, startY, size, size, color)
      .setStrokeStyle(3, PALETTE.shared.ink)
      .setDepth(40);
    const restX = startX + (rng.next() - 0.5) * 120;
    blocks.push(
      tweenDone(scene, {
        targets: block,
        x: restX,
        y: groundY - size / 2,
        angle: (rng.next() - 0.5) * 360,
        duration: 800 + rng.next() * 300,
        ease: 'Bounce.easeOut',
      }).then(() =>
        tweenDone(scene, {
          targets: block,
          alpha: 0,
          duration: 400,
          delay: 300,
          onComplete: () => block.destroy(),
        }),
      ),
    );
  }
  return Promise.all(blocks).then(() => undefined);
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
