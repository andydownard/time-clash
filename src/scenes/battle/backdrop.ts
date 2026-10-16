// Placeholder backdrop: warm day on the Past side, night on the Future side, layered hills,
// and the ground and hill from the layout. Original shapes only.
import Phaser from 'phaser';
import type { BattleLayout, Polygon } from '../../game/types';
import { PALETTE } from './visual';

const CLOUDS = [
  { x: 150, y: 110, s: 1 },
  { x: 380, y: 190, s: 0.7 },
  { x: 560, y: 90, s: 0.9 },
];
const STARS = [
  { x: 760, y: 70 },
  { x: 850, y: 150 },
  { x: 940, y: 60 },
  { x: 1010, y: 190 },
  { x: 1100, y: 100 },
  { x: 1190, y: 170 },
  { x: 1240, y: 60 },
  { x: 700, y: 200 },
];

const toPoints = (poly: Polygon): Phaser.Types.Math.Vector2Like[] =>
  poly.map((p) => ({ x: p.x, y: p.y }));

export function drawBackdrop(
  scene: Phaser.Scene,
  layout: BattleLayout,
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics().setDepth(0);
  const { width, height } = layout;

  // Sky: warm parchment on the left fading to night blue on the right.
  g.fillGradientStyle(
    PALETTE.past.parchment,
    PALETTE.future.night,
    PALETTE.past.parchment,
    PALETTE.future.night,
    1,
  );
  g.fillRect(0, 0, width, height);

  // Far hills: two soft layers that give a sense of depth.
  g.fillStyle(PALETTE.shared.twilight, 0.35);
  g.fillPoints(
    [
      { x: 0, y: 560 },
      { x: 220, y: 440 },
      { x: 480, y: 540 },
      { x: 760, y: 420 },
      { x: 1040, y: 530 },
      { x: width, y: 450 },
      { x: width, y: height },
      { x: 0, y: height },
    ],
    true,
  );
  g.fillStyle(PALETTE.shared.twilight, 0.55);
  g.fillPoints(
    [
      { x: 0, y: 600 },
      { x: 300, y: 520 },
      { x: 620, y: 590 },
      { x: 900, y: 500 },
      { x: width, y: 580 },
      { x: width, y: height },
      { x: 0, y: height },
    ],
    true,
  );

  // Clouds (Past side) and stars (Future side).
  g.fillStyle(PALETTE.shared.white, 0.85);
  for (const c of CLOUDS) {
    g.fillEllipse(c.x, c.y, 120 * c.s, 40 * c.s);
    g.fillEllipse(c.x + 30 * c.s, c.y - 16 * c.s, 70 * c.s, 36 * c.s);
  }
  g.fillStyle(PALETTE.shared.white, 1);
  for (const s of STARS) g.fillCircle(s.x, s.y, 3);

  // Ground and hill from the layout.
  g.fillStyle(PALETTE.past.wood, 1);
  g.fillPoints(toPoints(layout.terrain.ground), true);
  g.fillStyle(PALETTE.past.stone, 1);
  for (const o of layout.terrain.obstacles) {
    g.fillPoints(toPoints(o), true);
    g.lineStyle(4, PALETTE.shared.ink, 1);
    g.strokePoints(toPoints(o), true);
  }
  const top = layout.terrain.ground[0];
  const topRight = layout.terrain.ground[1];
  if (top && topRight) {
    g.lineStyle(6, PALETTE.shared.ink, 1);
    g.lineBetween(top.x, top.y, topRight.x, topRight.y);
  }
  return g;
}
