// Phaser drawing for explosions, base blasts and the vanish puff. Plans come from impact.ts and
// tumble.ts (pure). Every animation is a scene tween, so leaving the scene stops them all.
// Nobody is hurt: pieces are stone and metal, and bursts are bright and silly.
import Phaser from 'phaser';
import { HIT_FX } from '../../game/config';
import type { Rect, Team, Vec2 } from '../../game/types';
import { createFlashLimiter, hitBurstPlan } from './hitFx';
import { baseBlastPlan, explosionPlan, type Debris } from './impact';
import type { EffectKind } from './types';
import { chargeFrame, chargeMs } from './charge';
import { starOffsets, vanishFrame } from './tumble';
import { PALETTE, VANISH_MS } from './visual';

const DEPTH = 40;

const tweenDone = (
  scene: Phaser.Scene,
  config: Phaser.Types.Tweens.TweenBuilderConfig,
): Promise<void> =>
  new Promise((resolve) => {
    scene.tweens.add({ ...config, onComplete: () => resolve() });
  });

// One limiter per scene, so flashes from every effect together stay under 3 a second.
const limiters = new WeakMap<Phaser.Scene, ReturnType<typeof createFlashLimiter>>();
/** True when one more screen flash is allowed right now (photosensitivity). */
export function flashAllowed(scene: Phaser.Scene): boolean {
  let lim = limiters.get(scene);
  if (!lim) limiters.set(scene, (lim = createFlashLimiter()));
  return lim.allow(scene.time.now);
}

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
  if (flashAllowed(scene)) {
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
  }
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
 * The hit burst on top of the explosion: a short flash, an expanding ring, flying bits and a puff
 * of smoke. Fire for Team Past, cyan and white for Team Future. Done in under 0.9 s.
 */
export function playHitBurst(
  scene: Phaser.Scene,
  pos: Vec2,
  shooter: Team,
  scale: number,
): Promise<void> {
  const plan = hitBurstPlan(shooter, scale, seedOf(pos));
  const jobs: Array<Promise<void>> = [];
  if (flashAllowed(scene)) {
    const flash = scene.add.circle(pos.x, pos.y, plan.flash.radius, plan.flash.color, 0.85);
    flash.setDepth(DEPTH + 2);
    jobs.push(
      tweenDone(scene, {
        targets: flash,
        alpha: 0,
        scale: 1.4,
        duration: plan.flash.durationMs,
        onComplete: () => flash.destroy(),
      }),
    );
  }
  const ring = scene.add
    .circle(pos.x, pos.y, plan.ring.radius)
    .setStrokeStyle(6, plan.ring.color, 1)
    .setDepth(DEPTH + 1);
  const smoke = scene.add
    .circle(pos.x, pos.y, plan.smoke.radius, plan.smoke.color, 0.6)
    .setDepth(DEPTH - 1);
  const bits = plan.particles.map((q) =>
    scene.add
      .circle(pos.x, pos.y, q.size, q.color, 1)
      .setStrokeStyle(2, PALETTE.shared.ink, 0.9)
      .setDepth(DEPTH + 1),
  );
  const local = (t: number, delay: number, dur: number): number =>
    Math.min(1, Math.max(0, (t - delay) / dur));
  const easeOut = (u: number): number => 1 - (1 - u) * (1 - u) * (1 - u);
  // One clock drives the ring, the smoke and every flying bit, so they all end together.
  jobs.push(
    tweenDone(scene, {
      targets: { t: 0 },
      t: HIT_FX.burstMaxMs,
      duration: HIT_FX.burstMaxMs,
      onUpdate: (_tw, target: { t: number }) => {
        const t = target.t;
        const r = local(t, plan.ring.delayMs, plan.ring.durationMs);
        ring.setScale(1 + (plan.ring.endScale - 1) * easeOut(r)).setAlpha(1 - r * r);
        const m = local(t, plan.smoke.delayMs, plan.smoke.durationMs);
        smoke
          .setPosition(pos.x, pos.y - plan.smoke.rise * easeOut(m))
          .setScale(1 + easeOut(m))
          .setAlpha(0.6 * (1 - m));
        plan.particles.forEach((q, i) => {
          const u = local(t, q.delayMs, q.durationMs);
          bits[i]!.setPosition(
            pos.x + Math.cos(q.angle) * q.dist * easeOut(u),
            pos.y + Math.sin(q.angle) * q.dist * easeOut(u) + 24 * u * u,
          )
            .setScale(1 - 0.7 * u)
            .setAlpha(u >= 1 ? 0 : 1 - u * u * u);
        });
      },
    }).then(() => {
      ring.destroy();
      smoke.destroy();
      for (const b of bits) b.destroy();
    }),
  );
  return Promise.all(jobs).then(() => undefined);
}

/** Little stars circling over a fallen fighter. Returns a stop function. Still when motion is reduced. */
export function startStars(scene: Phaser.Scene, headAt: () => Vec2, reduced: boolean): () => void {
  const stars = Array.from({ length: HIT_FX.starCount }, () =>
    scene.add
      .star(0, 0, 5, HIT_FX.starSizePx * 0.45, HIT_FX.starSizePx, PALETTE.past.gold)
      .setStrokeStyle(2, PALETTE.shared.ink)
      .setDepth(DEPTH),
  );
  const place = (t: number): void => {
    const head = headAt();
    starOffsets(t).forEach((o, i) => {
      stars[i]!.setPosition(head.x + o.dx, head.y - HIT_FX.starLiftPx + o.dy)
        .setDepth(o.front ? DEPTH + 1 : DEPTH - 1)
        .setAngle(t / 6);
    });
  };
  place(0);
  const counter = reduced
    ? null
    : scene.tweens.addCounter({
        from: 0,
        to: HIT_FX.starPeriodMs,
        duration: HIT_FX.starPeriodMs,
        repeat: -1,
        onUpdate: (tween) => place(tween.getValue() ?? 0),
      });
  return () => {
    counter?.stop();
    for (const s of stars) s.destroy();
  };
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
