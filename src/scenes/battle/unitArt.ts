// The ten fighters, drawn with Phaser Graphics. Knights are purple, robots are blue.
// Each drawing faces right with its muzzle at 0,0; the container flips it for Team Future.
// Friendly shapes only. Nothing scary, nothing that looks hurt.
import type Phaser from 'phaser';
import { UNITS, type UnitId, type UnitRole } from '../../game/units';
import { unitSpot, type UnitSpot } from './unitSpots';
import { FONT_FAMILY } from './textStyle';
import type { LabelScaler } from './textScale';
import { ART, PALETTE } from './visual';
import { PALETTE as TOKENS, css } from '../palette';

const INK = PALETTE.shared.ink;
const P = PALETTE.past;
const F = PALETTE.future;

type G = Phaser.GameObjects.Graphics;

/** A filled rounded box with an ink outline. */
function rr(g: G, x: number, y: number, w: number, h: number, fill: number, r = 3): void {
  g.fillStyle(fill, 1);
  g.fillRoundedRect(x, y, w, h, r);
  g.lineStyle(2, INK, 1);
  g.strokeRoundedRect(x, y, w, h, r);
}

function disc(g: G, x: number, y: number, r: number, fill: number): void {
  g.fillStyle(fill, 1);
  g.fillCircle(x, y, r);
  g.lineStyle(2, INK, 1);
  g.strokeCircle(x, y, r);
}

/** A knight standing with feet at feetY: purple tunic, round helmet, friendly face. */
function knight(g: G, cx: number, feetY: number): void {
  rr(g, cx - 9, feetY - 12, 7, 12, P.deep, 2);
  rr(g, cx + 2, feetY - 12, 7, 12, P.deep, 2);
  rr(g, cx - 11, feetY - 38, 22, 28, P.banner, 5);
  g.fillStyle(P.gold, 1);
  g.fillRect(cx - 11, feetY - 20, 22, 4);
  disc(g, cx, feetY - 46, 10, ART.skin);
  g.fillStyle(P.bannerDark, 1);
  g.fillRoundedRect(cx - 11, feetY - 58, 22, 12, { tl: 10, tr: 10, bl: 0, br: 0 });
  g.lineStyle(2, INK, 1);
  g.strokeRoundedRect(cx - 11, feetY - 58, 22, 12, { tl: 10, tr: 10, bl: 0, br: 0 });
  g.fillStyle(INK, 1);
  g.fillCircle(cx + 4, feetY - 45, 1.6);
}

/** A robot: blue body with a division sign on the shirt, square head, visor. */
function robot(g: G, cx: number, feetY: number): void {
  rr(g, cx - 10, feetY - 12, 8, 12, F.hullDark, 2);
  rr(g, cx + 2, feetY - 12, 8, 12, F.hullDark, 2);
  rr(g, cx - 12, feetY - 38, 24, 28, F.neon, 4);
  // The division sign: a bar with a dot above and a dot below.
  g.fillStyle(F.pale, 1);
  g.fillRect(cx - 7, feetY - 25, 14, 3);
  g.fillCircle(cx, feetY - 31, 2.4);
  g.fillCircle(cx, feetY - 17, 2.4);
  rr(g, cx - 10, feetY - 58, 20, 18, F.steel, 4);
  g.fillStyle(F.glow, 1);
  g.fillRoundedRect(cx - 6, feetY - 52, 12, 6, 2);
  g.lineStyle(2, INK, 1);
  g.lineBetween(cx, feetY - 58, cx, feetY - 64);
  g.fillStyle(F.pink, 1);
  g.fillCircle(cx, feetY - 65, 3);
}

/** A purple shield with an open book on it. */
function bookShield(g: G, x: number, y: number): void {
  g.fillStyle(P.banner, 1);
  g.fillRoundedRect(x - 10, y - 16, 20, 30, { tl: 4, tr: 4, bl: 10, br: 10 });
  g.lineStyle(2.5, P.deep, 1);
  g.strokeRoundedRect(x - 10, y - 16, 20, 30, { tl: 4, tr: 4, bl: 10, br: 10 });
  g.fillStyle(ART.cream, 1);
  g.fillTriangle(x - 8, y - 6, x, y - 4, x, y + 6);
  g.fillTriangle(x - 8, y - 6, x - 8, y + 4, x, y + 6);
  g.fillTriangle(x + 8, y - 6, x, y - 4, x, y + 6);
  g.fillTriangle(x + 8, y - 6, x + 8, y + 4, x, y + 6);
  g.lineStyle(1.5, INK, 1);
  g.lineBetween(x, y - 4, x, y + 6);
  g.lineBetween(x - 8, y - 6, x - 8, y + 4);
  g.lineBetween(x + 8, y - 6, x + 8, y + 4);
}

function wheel(g: G, x: number, y: number, r: number): void {
  disc(g, x, y, r, P.wood);
  g.lineStyle(2, INK, 1);
  g.lineBetween(x - r, y, x + r, y);
  g.lineBetween(x, y - r, x, y + r);
}

const steelTube = (g: G, x: number, y: number, w: number, h: number): void =>
  rr(g, x, y, w, h, ART.metal, 3);

const DRAW: Record<UnitRole, (g: G) => void> = {
  balloon(g) {
    // Ropes, basket, a small cannon on the front, then the striped envelope on top.
    g.lineStyle(2, INK, 1);
    g.lineBetween(-36, -30, -34, -8);
    g.lineBetween(-2, -30, -6, -8);
    rr(g, -38, -8, 34, 22, P.wood, 4);
    steelTube(g, -8, -5, 14, 9);
    disc(g, -19, -62, 40, P.banner);
    g.fillStyle(ART.cream, 1);
    g.fillEllipse(-19, -62, 26, 76);
    g.fillStyle(P.banner, 1);
    g.fillEllipse(-19, -62, 8, 76);
    g.lineStyle(2, INK, 1);
    g.strokeCircle(-19, -62, 40);
    g.strokeEllipse(-19, -62, 26, 76);
  },
  archer(g) {
    knight(g, -22, 46);
    g.lineStyle(3, P.wood, 1);
    g.beginPath();
    g.arc(-14, 4, 20, -1.1, 1.1, false);
    g.strokePath();
    g.lineStyle(1.5, INK, 1);
    g.lineBetween(
      -14 + 20 * Math.cos(-1.1),
      4 + 20 * Math.sin(-1.1),
      -14 + 20 * Math.cos(1.1),
      4 + 20 * Math.sin(1.1),
    );
    g.lineStyle(2, P.wood, 1);
    g.lineBetween(-14, 4, 0, 4);
    g.fillStyle(ART.metal, 1);
    g.fillTriangle(-3, 0, 3, 4, -3, 8);
  },
  cannon(g) {
    knight(g, -50, 34);
    wheel(g, -20, 24, 10);
    rr(g, -42, 3, 18, 12, P.wood, 3);
    steelTube(g, -36, -6, 42, 12);
    g.fillStyle(INK, 1);
    g.fillCircle(6, 0, 3);
    bookShield(g, -64, 8);
  },
  catapult(g) {
    wheel(g, -36, 14, 8);
    wheel(g, -12, 14, 8);
    rr(g, -48, 4, 44, 8, P.wood, 2);
    g.fillStyle(P.wood, 1);
    g.fillTriangle(-30, 6, -20, 6, -25, -26);
    g.lineStyle(2, INK, 1);
    g.strokeTriangle(-30, 6, -20, 6, -25, -26);
    // The arm swings forward and down; the cup sits at the launch point.
    g.lineStyle(6, P.wood, 1);
    g.lineBetween(-44, -34, -25, -24);
    g.lineBetween(-25, -24, -4, -6);
    disc(g, 0, 0, 7, P.wood);
    g.fillStyle(ART.stone, 1);
    g.fillCircle(0, -3, 4);
  },
  spear(g) {
    knight(g, -34, 20);
    g.lineStyle(4, P.wood, 1);
    g.lineBetween(-52, -8, -4, -8);
    g.fillStyle(ART.metal, 1);
    g.fillTriangle(-6, -14, 8, -8, -6, -2);
    g.lineStyle(2, INK, 1);
    g.strokeTriangle(-6, -14, 8, -8, -6, -2);
    bookShield(g, -12, 2);
  },
  tank(g) {
    rr(g, -56, 6, 62, 16, F.hullDark, 8);
    for (const x of [-46, -30, -14, 0]) disc(g, x, 15, 4, F.steel);
    rr(g, -54, -6, 56, 14, F.hull, 4);
    rr(g, -44, -22, 32, 18, F.steel, 6);
    g.fillStyle(F.glow, 1);
    g.fillRoundedRect(-36, -18, 14, 6, 2);
    rr(g, -14, -6, 26, 12, F.hullDark, 3);
    g.fillStyle(F.glow, 1);
    g.fillCircle(8, 0, 3);
  },
  helicopter(g) {
    // Rotor on top, blue body, tail boom, skids.
    g.lineStyle(4, INK, 1);
    g.lineBetween(-60, -34, 0, -34);
    g.lineBetween(-30, -34, -30, -26);
    rr(g, -52, -26, 46, 32, F.neon, 14);
    g.fillStyle(F.visor, 1);
    g.fillRoundedRect(-18, -20, 18, 14, { tl: 6, tr: 8, bl: 2, br: 8 });
    rr(g, -62, -16, 16, 8, F.edge, 3);
    g.lineStyle(3, INK, 1);
    g.lineBetween(-56, -26, -56, -10);
    g.lineBetween(-46, 14, 4, 14);
    g.lineBetween(-36, 6, -38, 14);
    g.lineBetween(-12, 6, -10, 14);
    steelTube(g, -8, -2, 14, 6);
  },
  bunker(g) {
    // Low dome with a missile standing up. The launch point is the base of the missile.
    g.fillStyle(F.hull, 1);
    g.beginPath();
    g.arc(0, 20, 40, Math.PI, 0, false);
    g.closePath();
    g.fillPath();
    g.lineStyle(2, INK, 1);
    g.strokePath();
    rr(g, -42, 16, 84, 6, F.hullDark, 3);
    g.fillStyle(F.glow, 1);
    g.fillRoundedRect(-30, 10, 10, 5, 2);
    g.fillRoundedRect(20, 10, 10, 5, 2);
    rr(g, -6, -30, 12, 32, ART.cream, 5);
    g.fillStyle(F.pink, 1);
    g.fillTriangle(-6, -28, 6, -28, 0, -46);
    g.lineStyle(2, INK, 1);
    g.strokeTriangle(-6, -28, 6, -28, 0, -46);
    g.fillStyle(F.neon, 1);
    g.fillTriangle(-6, 2, -14, 2, -6, -10);
    g.fillTriangle(6, 2, 14, 2, 6, -10);
  },
  saber(g) {
    robot(g, -34, 20);
    // Glowing saber held forward, tip at the launch point.
    g.lineStyle(10, F.glow, 0.35);
    g.lineBetween(-26, -6, 6, -6);
    g.lineStyle(5, F.glow, 1);
    g.lineBetween(-26, -6, 6, -6);
    g.lineStyle(2, F.pale, 1);
    g.lineBetween(-26, -6, 4, -6);
    rr(g, -34, -10, 10, 8, ART.metalDark, 2);
    // Round shield on the back arm.
    disc(g, -50, -6, 11, F.edge);
    g.fillStyle(F.glow, 1);
    g.fillCircle(-50, -6, 4);
  },
  laserGun(g) {
    robot(g, -22, 50);
    // Pink laser gun held forward, muzzle at the launch point.
    rr(g, -20, 6, 20, 10, ART.metalDark, 3);
    rr(g, -6, 3, 12, 6, F.pink, 2);
    g.fillStyle(F.pink, 1);
    g.fillCircle(6, 6, 3);
  },
};

export type UnitArt = {
  id: UnitId;
  container: Phaser.GameObjects.Container;
  /** Show or hide the pointing arrow. It bobs unless motion is reduced. */
  setSelected(selected: boolean): void;
  destroy(): void;
};

/** One fighter: its drawing, round token and (hidden until selected) pointing arrow. */
function drawOne(
  scene: Phaser.Scene,
  spot: UnitSpot,
  labels: LabelScaler | null,
  reduced: () => boolean,
): UnitArt {
  const body = scene.add.graphics();
  // A soft shadow so ground fighters sit on the grass.
  body.fillStyle(ART.shadow, 0.28);
  body.fillEllipse(-20, spot.box.y + spot.box.h - spot.y, 70, 8);
  DRAW[spot.role](body);
  const bodyBox = scene.add.container(spot.x, spot.y, [body]);
  bodyBox.setScale(spot.facing, 1);

  const { token } = spot;
  const disk = scene.add.graphics();
  disk.fillStyle(spot.team === 'PAST' ? P.deep : F.night, 1);
  disk.fillCircle(token.x, token.y, token.r);
  disk.lineStyle(3, spot.team === 'PAST' ? P.gold : F.glow, 1);
  disk.strokeCircle(token.x, token.y, token.r);
  const label = scene.add
    .text(token.x, token.y, spot.id, {
      fontFamily: FONT_FAMILY.new,
      fontStyle: '800',
      color: css(TOKENS.parchment),
    })
    .setOrigin(0.5);
  if (labels) labels.register(label, 20);
  else label.setFontSize('20px');

  const arrow = scene.add.graphics();
  const tip = spot.arrowTip;
  arrow.fillStyle(spot.team === 'PAST' ? P.gold : F.glow, 1);
  arrow.fillTriangle(tip.x - 11, tip.y - 14, tip.x + 11, tip.y - 14, tip.x, tip.y);
  arrow.fillRect(tip.x - 4, tip.y - 28, 8, 15);
  arrow.lineStyle(2, INK, 1);
  arrow.strokeTriangle(tip.x - 11, tip.y - 14, tip.x + 11, tip.y - 14, tip.x, tip.y);
  arrow.strokeRect(tip.x - 4, tip.y - 28, 8, 15);
  arrow.setVisible(false);

  const container = scene.add.container(0, 0, [bodyBox, disk, label, arrow]);
  let bob: Phaser.Tweens.Tween | null = null;
  return {
    id: spot.id,
    container,
    setSelected(selected) {
      arrow.setVisible(selected);
      bob?.stop();
      bob = null;
      arrow.y = 0;
      if (selected && !reduced()) {
        bob = scene.tweens.add({
          targets: arrow,
          y: 6,
          duration: 600,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      }
    },
    destroy() {
      bob?.stop();
      container.destroy();
    },
  };
}

/** Draws all ten fighters. `reduced` is asked each time the arrow is set, so no bobbing when on. */
export function drawUnits(
  scene: Phaser.Scene,
  labels: LabelScaler | null,
  reduced: () => boolean,
): Record<UnitId, UnitArt> {
  const out = {} as Record<UnitId, UnitArt>;
  for (const def of UNITS) out[def.id] = drawOne(scene, unitSpot(def), labels, reduced);
  return out;
}
