// Phaser drawing for explosions, base blasts and the vanish puff. Plans come from impact.ts and
// tumble.ts (pure). Every animation is a scene tween, so leaving the scene stops them all.
// Nobody is hurt: pieces are stone and metal, and bursts are bright and silly.
import Phaser from 'phaser';
import type { Rect, Vec2 } from '../../game/types';
import { baseBlastPlan, explosionPlan, type Debris } from './impact';
import type { EffectKind } from './types';
import { chargeFrame, chargeMs } from './charge';
import { dizzyStarsFrame, vanishFrame } from './tumble';
import { DIZZY, PALETTE, VANISH_MS } from './visual';

const DEPTH = 40;

const tweenDone = (
  scene: Phaser.Scene,
  config: Phaser.Types.Tweens.TweenBuilderConfig,
): Promise<void> =>
  new Promise((resolve) => {
    scene.tweens.add({ ...config, onComplete: () => resolve() });
  });

const seedOf = (pos: Vec2): number => Math.round(pos.x * 31 + pos.y * 17) >>> 0;

/** Fireball, smoke and a few chunks, sized by scale. Resolves when the last piece is gone. */
export function playExplosion(
  scene: Phaser.Scene,
  pos: Vec2,
  kind: EffectKind,
  scale: number,
  debris?: Debris,
  chunkCount?: number,
): Promise<void> {
  const plan = explosionPlan(kind, scale, seedOf(pos), debris, chunkCount);
  const jobs: Array<Promise<void>> = [];
  const flash = scene.add.circle(pos.x, pos.y, plan.flashRadius, PALETTE.shared.white, 0.8);
  flash.setDepth(DEPTH + 1);
  jobs.push(
    tweenDone(scene, {
      targets: flash,
      alpha: 0,
      scale: 1.3,
      duration: 160,
      onComplete: () => flash.destroy(),
    }),
  );
  for (const f of plan.fireballs) {
    const ball = scene.add.circle(pos.x, pos.y, f.radius * 0.35, f.color, 0.95).setDepth(DEPTH);
    jobs.push(
      tweenDone(scene, {
        targets: ball,
        scale: 1 / 0.35,
        alpha: 0,
        delay: f.delayMs,
        duration: f.durationMs,
        ease: 'Quad.easeOut',
        onComplete: () => ball.destroy(),
      }),
    );
  }
  for (const s of plan.smoke) {
    const puff = scene.add
      .circle(pos.x, pos.y, s.radius * 0.5, PALETTE.shared.white, 0)
      .setDepth(DEPTH - 1);
    jobs.push(
      tweenDone(scene, {
        targets: puff,
        x: pos.x + s.dx,
        y: pos.y + s.dy - 30,
        scale: 2,
        alpha: { from: 0.55, to: 0 },
        delay: s.delayMs,
        duration: s.durationMs,
        onComplete: () => puff.destroy(),
      }),
    );
  }
  for (const c of plan.chunks) {
    const piece = scene.add
      .rectangle(pos.x, pos.y, c.size, c.size, c.color)
      .setStrokeStyle(2, PALETTE.shared.ink)
      .setDepth(DEPTH);
    const endX = pos.x + Math.cos(c.angle) * c.dist;
    const endY = pos.y + 30;
    jobs.push(
      tweenDone(scene, {
        targets: { u: 0 },
        u: 1,
        duration: c.durationMs,
        onUpdate: (_t, target: { u: number }) => {
          const u = target.u;
          piece.setPosition(
            pos.x + (endX - pos.x) * u,
            pos.y + (endY - pos.y) * u - 4 * c.hop * u * (1 - u),
          );
          piece.setAngle(360 * u);
        },
      }).then(() =>
        tweenDone(scene, {
          targets: piece,
          alpha: 0,
          duration: 200,
          onComplete: () => piece.destroy(),
        }),
      ),
    );
  }
  return Promise.all(jobs).then(() => undefined);
}

/** The base bursts in a chain of fireballs. Pieces fly. Nobody comes out. */
export async function playBaseBlast(
  scene: Phaser.Scene,
  base: Rect,
  team: 'PAST' | 'FUTURE',
): Promise<void> {
  const spots = baseBlastPlan(base, seedOf({ x: base.x, y: base.y }));
  const debris: Debris = team === 'PAST' ? 'stone' : 'metal';
  await Promise.all(
    spots.map(
      (s) =>
        new Promise<void>((resolve) => {
          scene.time.delayedCall(s.delayMs, () => {
            void playExplosion(
              scene,
              { x: s.x, y: s.y },
              team === 'PAST' ? 'confetti' : 'plasma',
              s.scale,
              debris,
              5,
            ).then(resolve);
          });
        }),
    ),
  );
}

/** Soft fade used instead of a blast when motion is reduced. */
export function playBlastFade(scene: Phaser.Scene, base: Rect): Promise<void> {
  const glow = scene.add
    .rectangle(base.x + base.w / 2, base.y + base.h / 2, base.w, base.h, PALETTE.shared.white, 0.6)
    .setDepth(DEPTH);
  return tweenDone(scene, {
    targets: glow,
    alpha: 0,
    duration: 250,
    onComplete: () => glow.destroy(),
  });
}

/**
 * The fighter fades out inside a puff of smoke. Reduced motion: a short fade, no puff growth.
 * `onFrame` lets the caller set the character's alpha.
 */
export function playVanish(
  scene: Phaser.Scene,
  at: Vec2,
  reduced: boolean,
  setCharacterAlpha: (a: number) => void,
): Promise<void> {
  if (reduced) {
    return tweenDone(scene, {
      targets: { a: 1 },
      a: 0,
      duration: 250,
      onUpdate: (_t, target: { a: number }) => setCharacterAlpha(target.a),
    });
  }
  const puff = scene.add.circle(at.x, at.y - 30, 40, PALETTE.shared.white, 0).setDepth(DEPTH);
  return tweenDone(scene, {
    targets: { u: 0 },
    u: 1,
    duration: VANISH_MS,
    onUpdate: (_t, target: { u: number }) => {
      const f = vanishFrame(target.u);
      setCharacterAlpha(f.characterAlpha);
      puff.setScale(f.puffScale).setAlpha(f.puffAlpha);
    },
  }).then(() => puff.destroy());
}

/**
 * The wind-up before a shot: a team-colored ring pulls in to the launcher and a bright core grows.
 * Reduced motion: nothing to draw, the shot goes at once.
 */
export function playCharge(
  scene: Phaser.Scene,
  at: Vec2,
  color: number,
  reduced: boolean,
): Promise<void> {
  const ms = chargeMs(reduced);
  if (ms <= 0) return Promise.resolve();
  const ring = scene.add.circle(at.x, at.y, 1, color, 0).setDepth(DEPTH);
  const core = scene.add.circle(at.x, at.y, 1, PALETTE.shared.white, 0).setDepth(DEPTH + 1);
  const paint = (u: number): void => {
    const f = chargeFrame(u);
    ring.setRadius(f.ringRadius).setStrokeStyle(5, color, f.ringAlpha);
    core.setRadius(f.coreRadius).setFillStyle(color, f.coreAlpha);
  };
  paint(0);
  return tweenDone(scene, {
    targets: { u: 0 },
    u: 1,
    duration: ms,
    onUpdate: (_t, target: { u: number }) => paint(target.u),
  }).then(() => {
    ring.destroy();
    core.destroy();
  });
}

/** Three Ember stars circle the head after the bounce, then fade. Skipped when motion is reduced. */
export function playDizzyStars(scene: Phaser.Scene, head: Vec2, reduced: boolean): Promise<void> {
  if (reduced) return Promise.resolve();
  const stars = [0, 1, 2].map(() =>
    scene.add
      .star(head.x, head.y, 5, 4, 9, PALETTE.shared.ember, 1)
      .setStrokeStyle(2, PALETTE.shared.ink, 1)
      .setAlpha(0)
      .setDepth(DEPTH),
  );
  return tweenDone(scene, {
    targets: { u: 0 },
    u: 1,
    duration: DIZZY.ms,
    onUpdate: (_t, target: { u: number }) => {
      dizzyStarsFrame(target.u).forEach((f, i) =>
        stars[i]!.setPosition(head.x + f.dx, head.y + f.dy).setAlpha(f.alpha),
      );
    },
  }).then(() => stars.forEach((st) => st.destroy()));
}
