// Battle backdrop: a dusk sky that runs from deep blue to a warm glow, twinkling stars, drifting
// clouds, three layers of parallax hills, and the ground and hill from the layout.
// Original shapes only. Nothing here is scary.
import Phaser from 'phaser';
import type { BattleLayout, Polygon } from '../../game/types';
import { aspenLayers, type AspenLayer } from './aspens';
import { biomeLook } from './biomeArt';
import { BATTLE_BAND } from '../../game/config';
import { ART, PALETTE } from './visual';

const CLOUDS = [
  { x: 190, y: 120, s: 1 },
  { x: 470, y: 200, s: 0.7 },
  { x: 760, y: 100, s: 0.9 },
  { x: 1080, y: 170, s: 0.8 },
];
const STARS = [
  { x: 120, y: 60 },
  { x: 330, y: 150 },
  { x: 560, y: 54 },
  { x: 760, y: 70 },
  { x: 850, y: 150 },
  { x: 940, y: 60 },
  { x: 1010, y: 190 },
  { x: 1100, y: 100 },
  { x: 1190, y: 170 },
  { x: 1240, y: 60 },
  { x: 700, y: 200 },
];
/** Sky bands, top to bottom. Four vertical gradients stack into one dusk. */
const SKY = [ART.skyTop, ART.skyMid, ART.skyLow, ART.skyHorizon, ART.skyGlow] as const;

const toPoints = (poly: Polygon): Phaser.Types.Math.Vector2Like[] =>
  poly.map((p) => ({ x: p.x, y: p.y }));

export type Backdrop = {
  /** Drift these slowly (unless motion is reduced). */
  clouds: Phaser.GameObjects.Graphics;
  /** Twinkle these (unless motion is reduced). */
  stars: Phaser.GameObjects.Graphics;
};

export function drawBackdrop(scene: Phaser.Scene, layout: BattleLayout): Backdrop {
  const g = scene.add.graphics().setDepth(0);
  const { width, height } = layout;
  const horizon = layout.terrain.ground[0]?.y ?? height;

  // Sky.
  const band = horizon / (SKY.length - 1);
  for (let i = 0; i < SKY.length - 1; i++) {
    const top = SKY[i] as number;
    const bottom = SKY[i + 1] as number;
    g.fillGradientStyle(top, top, bottom, bottom, 1);
    g.fillRect(0, i * band, width, band + 1);
  }
  // Moon.
  g.fillStyle(PALETTE.past.parchment, 0.95);
  g.fillCircle(width - 150, 120, 46);
  g.fillStyle(ART.skyMid, 0.35);
  g.fillCircle(width - 164, 110, 12);
  g.fillCircle(width - 134, 134, 8);

  // Parallax hills, far to near. Each layer is darker and lower than the one behind it.
  const hill = (
    color: number,
    alpha: number,
    base: number,
    peaks: number[],
    step: number,
  ): void => {
    g.fillStyle(color, alpha);
    const pts: Phaser.Types.Math.Vector2Like[] = [{ x: 0, y: height }];
    peaks.forEach((dy, i) => pts.push({ x: i * step, y: base - dy }));
    pts.push({ x: width, y: base - (peaks[peaks.length - 1] ?? 0) }, { x: width, y: height });
    g.fillPoints(pts, true);
  };
  // The biome's forest sits between the hills: faint trees behind, stronger trees in front.
  // Aspen is the Phase 1 look. Cherry Blossoms recolors the trees. Ruined Temple draws columns.
  const look = biomeLook(layout.biome);
  const [farAspens, nearAspens] = aspenLayers(width, horizon);
  const aspens = (layer: AspenLayer, leafColor: number): void => {
    for (const t of layer.trees) {
      if (look.kind === 'columns') {
        // A broken column: a wide shaft, a cap, and a few vines where the leaves would be.
        const w = t.w * 2.4;
        const top = t.top + (t.bottom - t.top) * 0.35;
        g.fillStyle(look.trunk, layer.alpha);
        g.fillRect(t.x - w / 2, top, w, t.bottom - top);
        g.fillRect(t.x - w * 0.7, top - 6, w * 1.4, 8);
        g.fillStyle(look.bark, layer.alpha + 0.2);
        g.fillRect(t.x - w / 6, top + 4, 2, t.bottom - top - 8);
        g.fillStyle(leafColor, layer.alpha);
        for (const l of t.leaves.slice(0, 2)) g.fillCircle(l.x, top, l.r * 0.5);
        continue;
      }
      g.fillStyle(look.trunk, layer.alpha);
      g.fillRect(t.x - t.w / 2, t.top, t.w, t.bottom - t.top);
      g.fillStyle(look.bark, layer.alpha + 0.2);
      for (const y of t.marks) g.fillRect(t.x - t.w / 2, y, t.w * 0.7, 3);
      g.fillStyle(leafColor, layer.alpha);
      for (const l of t.leaves) g.fillCircle(l.x, l.y, l.r);
    }
  };
  hill(PALETTE.past.deep, 0.55, horizon - 40, [150, 60, 130, 40, 150, 70, 140, 50, 110, 60], 140);
  aspens(farAspens, look.leafFar);
  hill(PALETTE.past.bannerDark, 0.6, horizon - 20, [90, 30, 100, 20, 90, 50, 110, 30, 80, 40], 140);
  aspens(nearAspens, look.leafNear);
  hill(ART.grassLow, 1, horizon - 6, [40, 10, 46, 8, 40, 16, 48, 10, 36, 14], 140);

  // Ground and hill from the layout. Grass on the left, blue soil on the right.
  g.fillStyle(ART.grassMid, 1);
  g.fillPoints(toPoints(layout.terrain.ground), true);
  // Gradients only work on rectangles, so lay them over the flat ground.
  g.fillGradientStyle(ART.grassTop, ART.grassTop, ART.grassLow, ART.grassLow, 1);
  g.fillRect(0, horizon, width / 2, height - horizon);
  g.fillGradientStyle(ART.soilTop, ART.soilTop, ART.hullDark, ART.hullDark, 1);
  g.fillRect(width / 2, horizon, width / 2, height - horizon);
  // The band under the battlefield holds the controls. It carries on as ground, never black.
  g.fillStyle(ART.grassLow, 1);
  g.fillRect(0, height, width / 2, BATTLE_BAND);
  g.fillStyle(ART.hullDark, 1);
  g.fillRect(width / 2, height, width / 2, BATTLE_BAND);
  // Obstacle 0 is the biome's middle shape (stone). Any more come from Team Future's base spot:
  // the tower, the bridge deck or the food truck wall, drawn in city steel.
  layout.terrain.obstacles.forEach((o, i) => {
    g.fillStyle(i === 0 ? ART.stone : ART.hull, 1);
    g.fillPoints(toPoints(o), true);
    g.lineStyle(4, i === 0 ? ART.stoneLine : ART.hullDark, 1);
    g.strokePoints(toPoints(o), true);
  });
  const top = layout.terrain.ground[0];
  const topRight = layout.terrain.ground[1];
  if (top && topRight) {
    g.lineStyle(6, PALETTE.shared.ink, 1);
    g.lineBetween(top.x, top.y, topRight.x, topRight.y);
  }

  const stars = scene.add.graphics().setDepth(1);
  stars.fillStyle(PALETTE.future.pale, 1);
  for (const s of STARS) stars.fillCircle(s.x, s.y, 3);

  const clouds = scene.add.graphics().setDepth(2);
  clouds.fillStyle(PALETTE.shared.white, 0.85);
  for (const c of CLOUDS) {
    clouds.fillEllipse(c.x, c.y, 120 * c.s, 40 * c.s);
    clouds.fillEllipse(c.x + 30 * c.s, c.y - 16 * c.s, 70 * c.s, 36 * c.s);
  }
  return { clouds, stars };
}
