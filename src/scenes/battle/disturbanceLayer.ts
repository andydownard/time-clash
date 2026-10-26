// Phaser drawing for the birds, the feather puff and the gust cue. The rules
// (src/game/disturbance.ts) say where every bird is at a time on the bird clock; this layer keeps
// that clock (it only runs while the scene runs, so Pause stops it) and draws the birds there.
// Nobody is hurt: a bumped bird spins, loses a few feathers and flies on.
import Phaser from 'phaser';
import { DISTURBANCE_COPY } from '../../data/copy';
import { birdAt, type BirdPath } from '../../game/disturbance';
import type { BirdBump, GustHit, Vec2 } from '../../game/types';
import { paintArt } from './backdrop';
import { BONK, BIRD_COLORS, bonkTilt, birdShapes, featherBurst, flapAt } from './birdArt';
import { floatLabel } from './effects';
import { GUST_CUE_MS, GUST_SLIDE_PX, gustCue } from './gustArt';
import { PALETTE, REDUCED_FADE_MS } from './visual';

const BIRD_DEPTH = 16;
const CUE_DEPTH = 31;

/** What the e2e hook can read: the birds drawn right now and the bird clock. */
export type BirdLayerState = { clockMs: number; birds: Vec2[] };

export type DisturbanceLayer = {
  /** Start this turn's birds (the clock goes back to 0). null clears them. */
  showBirds(birds: readonly BirdPath[] | null): void;
  /** ms since this turn's birds took off. fire() is told this so the flight meets them there. */
  clockMs(): number;
  /** A shell bumped a bird: feathers, a spin and the "Squawk!" word. */
  bump(b: BirdBump): void;
  /** The gust blew: streaks, an arrow and the "Whoosh!" word. */
  gust(g: GustHit): void;
  state(): BirdLayerState;
  destroy(): void;
};

export function createDisturbanceLayer(
  scene: Phaser.Scene,
  opts: { reduced: () => boolean; fontPx: (basePx: number) => number },
): DisturbanceLayer {
  let birds: BirdPath[] = [];
  let graphics: Phaser.GameObjects.Graphics[] = [];
  let clock = 0;
  /** Bird id -> the clock time it was bumped, for its spin. */
  const bonkedAt = new Map<number, number>();

  const draw = (): void => {
    const reduced = opts.reduced();
    birds.forEach((b, i) => {
      const g = graphics[i];
      if (!g) return;
      const at = birdAt(b, clock);
      const since = bonkedAt.has(b.id) ? clock - (bonkedAt.get(b.id) as number) : null;
      g.clear();
      paintArt(
        g,
        birdShapes(
          { x: 0, y: 0 },
          b.vx >= 0 ? 1 : -1,
          flapAt(clock, reduced),
          bonkTilt(since, reduced),
        ),
      );
      g.setPosition(at.x, at.y);
    });
  };

  const onUpdate = (_time: number, delta: number): void => {
    if (birds.length === 0) return;
    // Phaser only sends update while the scene runs, so a paused game stops the birds too.
    clock += Number.isFinite(delta) && delta > 0 ? delta : 0;
    draw();
  };
  scene.events.on(Phaser.Scenes.Events.UPDATE, onUpdate);

  const clear = (): void => {
    graphics.forEach((g) => g.destroy());
    graphics = [];
    birds = [];
    bonkedAt.clear();
  };

  const featherPuff = (b: BirdBump): void => {
    const reduced = opts.reduced();
    if (reduced) {
      // Reduced motion: a soft puff that fades in place.
      const puff = scene.add
        .circle(b.birdAt.x, b.birdAt.y, 26, BIRD_COLORS.wing, 0.6)
        .setDepth(CUE_DEPTH);
      scene.tweens.add({
        targets: puff,
        alpha: 0,
        duration: REDUCED_FADE_MS * 2,
        onComplete: () => puff.destroy(),
      });
      return;
    }
    for (const f of featherBurst(b.bird, b.step)) {
      const feather = scene.add
        .ellipse(b.birdAt.x, b.birdAt.y, 14, 6, BIRD_COLORS.wing, 1)
        .setStrokeStyle(1.5, BIRD_COLORS.outline)
        .setDepth(CUE_DEPTH);
      scene.tweens.add({
        targets: feather,
        x: b.birdAt.x + f.dx,
        y: b.birdAt.y + f.dy,
        angle: f.spinDeg,
        alpha: 0,
        duration: 900,
        ease: 'Sine.easeOut',
        onComplete: () => feather.destroy(),
      });
    }
  };

  return {
    showBirds(next) {
      clear();
      clock = 0;
      if (!next || next.length === 0) return;
      birds = next.map((b) => ({ ...b }));
      graphics = birds.map(() => scene.add.graphics().setDepth(BIRD_DEPTH));
      draw();
    },

    clockMs: () => clock,

    bump(b) {
      bonkedAt.set(b.bird, clock);
      featherPuff(b);
      floatLabel(
        scene,
        { x: b.birdAt.x, y: Math.max(60, b.birdAt.y - 40) },
        DISTURBANCE_COPY.squawk,
        'hit',
        opts.fontPx,
      );
      // The spin is drawn by draw() from bonkedAt; forget it once it is done.
      scene.time.delayedCall(BONK.ms, () => bonkedAt.delete(b.bird));
    },

    gust(hit) {
      const dir: 1 | -1 = hit.push >= 0 ? 1 : -1;
      // A stronger turn level draws a bigger cue with more streaks (no words added).
      const cue = gustCue(hit.at, dir, undefined, hit.level);
      const g = scene.add.graphics().setDepth(CUE_DEPTH);
      g.lineStyle(cue.width, PALETTE.shared.white, 1);
      for (const s of cue.streaks) g.lineBetween(s.x1, s.y, s.x2, s.y);
      g.fillStyle(PALETTE.shared.white, 1);
      g.fillPoints(cue.arrow, true);
      g.lineStyle(2.5, PALETTE.shared.ink, 1);
      g.strokePoints(cue.arrow, true);
      floatLabel(scene, cue.label, DISTURBANCE_COPY.whoosh, 'hit', opts.fontPx);
      const reduced = opts.reduced();
      // The streaks and arrow slide the gust's way, stay bright while it blows, then fade.
      // Reduced motion: they stay put and only fade.
      if (!reduced) scene.tweens.add({ targets: g, x: dir * GUST_SLIDE_PX, duration: GUST_CUE_MS });
      scene.tweens.add({
        targets: g,
        alpha: 0,
        delay: reduced ? REDUCED_FADE_MS : GUST_CUE_MS * 0.6,
        duration: reduced ? REDUCED_FADE_MS * 2 : GUST_CUE_MS,
        onComplete: () => g.destroy(),
      });
    },

    state: () => ({ clockMs: clock, birds: birds.map((b) => birdAt(b, clock)) }),

    destroy() {
      scene.events.off(Phaser.Scenes.Events.UPDATE, onUpdate);
      clear();
    },
  };
}
