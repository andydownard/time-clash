// The ten fighters, drawn with Phaser Graphics. Knights are purple, robots are blue.
// Each drawing faces right with its muzzle at 0,0; the container flips it for Team Future.
// Friendly shapes only. Nothing scary, nothing that looks hurt.
import type Phaser from 'phaser';
import { UNITS, type UnitId, type UnitRole } from '../../game/units';
import { UNIT_BOXES, unitSpot, type UnitSpot } from './unitSpots';
import { FONT_FAMILY } from './textStyle';
import type { LabelScaler } from './textScale';
import { ART, PALETTE } from './visual';
import { PALETTE as TOKENS, css } from '../palette';

const INK = PALETTE.shared.ink;
const P = PALETTE.past;
const F = PALETTE.future;

type G = Phaser.GameObjects.Graphics;

/** Fliers float, so only fighters standing on something get a shadow. */
const role_has_shadow = (role: UnitRole): boolean => role !== 'balloon' && role !== 'helicopter';

type Pt = { x: number; y: number };

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

/** A filled polygon with an ink outline. */
function poly(g: G, pts: Pt[], fill: number): void {
  g.fillStyle(fill, 1);
  g.fillPoints(pts, true);
  g.lineStyle(2, INK, 1);
  g.strokePoints(pts, true);
}

/** A straight bar with an ink edge: a thick ink line with a thinner colored line on top. */
function bar(g: G, a: Pt, b: Pt, width: number, fill: number): void {
  g.lineStyle(width + 3, INK, 1);
  g.lineBetween(a.x, a.y, b.x, b.y);
  g.lineStyle(width, fill, 1);
  g.lineBetween(a.x, a.y, b.x, b.y);
}

/** Draws `fn` in its own space, moved to (x, y) and scaled by s. */
function at(g: G, x: number, y: number, s: number, fn: () => void): void {
  g.save();
  g.translateCanvas(x, y);
  g.scaleCanvas(s, s);
  fn();
  g.restore();
}

/**
 * One standing fighter, feet at 0,0, facing right, about 114 tall with the plume. Knights have a
 * silver round helmet, a friendly face, an orange plume and a purple tunic. Robots have a silver
 * helmet with a glowing visor, a blue plume and a blue body with a division sign on the shirt.
 */
function figure(g: G, kind: 'knight' | 'robot'): void {
  const knight = kind === 'knight';
  const limb = knight ? ART.knightSteel : ART.visor;
  const legs = knight ? ART.knightSteel : F.edge;
  rr(g, -11, -26, 9, 26, legs, 4);
  rr(g, 2, -26, 9, 26, legs, 4);
  rr(g, -27, -62, 9, 30, limb, 4);
  rr(g, 18, -62, 9, 30, limb, 4);
  poly(
    g,
    [
      { x: -17, y: -64 },
      { x: 17, y: -64 },
      { x: 20, y: -24 },
      { x: -20, y: -24 },
    ],
    knight ? P.banner : F.neon,
  );
  // The plume goes behind the helmet.
  poly(
    g,
    [
      { x: -7, y: -96 },
      { x: 5, y: -99 },
      { x: 22, y: -106 },
      { x: 32, y: -118 },
      { x: 14, y: -116 },
      { x: 0, y: -108 },
    ],
    knight ? P.gold : F.glow,
  );
  disc(g, 0, -82, 17, knight ? ART.knightSteel : ART.visor);
  if (knight) {
    g.fillStyle(ART.skin, 1);
    g.fillCircle(0, -81, 10.5);
    g.fillStyle(INK, 1);
    g.fillCircle(-4, -82, 1.8);
    g.fillCircle(4, -82, 1.8);
  } else {
    g.fillStyle(F.night, 1);
    g.fillEllipse(0, -81, 25, 20);
    g.fillStyle(F.glow, 1);
    g.fillEllipse(0, -81, 17, 12);
    // The division sign: a bar with a dot above and a dot below.
    g.fillStyle(F.pale, 1);
    g.fillRect(-8, -45.5, 16, 3);
    g.fillCircle(0, -52, 2.8);
    g.fillCircle(0, -37, 2.8);
  }
}

/** A purple shield with an open book on it, centered on x, y. About 26 wide and 34 tall. */
function bookShield(g: G, x: number, y: number, s = 1): void {
  at(g, x, y, s, () => {
    g.fillStyle(P.banner, 1);
    g.fillRoundedRect(-13, -17, 26, 34, { tl: 4, tr: 4, bl: 13, br: 13 });
    g.lineStyle(3, P.deep, 1);
    g.strokeRoundedRect(-13, -17, 26, 34, { tl: 4, tr: 4, bl: 13, br: 13 });
    // Inside is the cream page of an open book.
    g.fillStyle(ART.cream, 1);
    g.fillRoundedRect(-9, -9, 18, 15, 2);
    g.lineStyle(1.5, P.deep, 1);
    g.strokeRoundedRect(-9, -9, 18, 15, 2);
    g.lineBetween(0, -9, 0, 6);
    g.lineBetween(-6, -4, -2, -4);
    g.lineBetween(-6, 0, -2, 0);
    g.lineBetween(2, -4, 6, -4);
    g.lineBetween(2, 0, 6, 0);
  });
}

function wheel(g: G, x: number, y: number, r: number): void {
  disc(g, x, y, r, P.wood);
  g.lineStyle(2, INK, 1);
  g.lineBetween(x - r, y, x + r, y);
  g.lineBetween(x, y - r, x, y + r);
  g.fillStyle(INK, 1);
  g.fillCircle(x, y, 2);
}

const steelTube = (g: G, x: number, y: number, w: number, h: number): void =>
  rr(g, x, y, w, h, ART.metalDark, 3);

const DRAW: Record<UnitRole, (g: G) => void> = {
  balloon(g) {
    // Striped envelope on top, ropes, a wooden basket with a small knight and a cannon.
    g.lineStyle(2, INK, 1);
    g.lineBetween(-44, -48, -44, -8);
    g.lineBetween(-12, -48, -12, -8);
    rr(g, -48, -8, 40, 22, P.wood, 4);
    g.lineStyle(2, INK, 1);
    g.lineBetween(-48, 0, -8, 0);
    at(g, -28, -8, 0.32, () => figure(g, 'knight'));
    steelTube(g, -22, -5, 22, 10);
    g.fillStyle(INK, 1);
    g.fillCircle(-1, 0, 3);
    g.fillStyle(P.banner, 1);
    g.fillEllipse(-28, -94, 84, 100);
    g.lineStyle(8, ART.cream, 1);
    g.strokeEllipse(-28, -94, 46, 98);
    g.lineStyle(2.5, INK, 1);
    g.strokeEllipse(-28, -94, 84, 100);
  },
  archer(g) {
    at(g, -50, 46, 0.78, () => figure(g, 'knight'));
    bar(g, { x: -34, y: 4 }, { x: -18, y: 0 }, 5, ART.knightSteel);
    g.lineStyle(4, P.wood, 1);
    g.beginPath();
    g.arc(-20, 0, 22, -1.1, 1.1, false);
    g.strokePath();
    g.lineStyle(1.5, INK, 1);
    g.lineBetween(-20 + 22 * Math.cos(-1.1), -19.6, -20 + 22 * Math.cos(1.1), 19.6);
    // The arrow is nocked on the string. Its tip is the launch point.
    g.lineStyle(3, P.wood, 1);
    g.lineBetween(-34, 0, -6, 0);
    g.lineStyle(2, ART.pink, 1);
    g.lineBetween(-36, -4, -31, 0);
    g.lineBetween(-36, 4, -31, 0);
    poly(
      g,
      [
        { x: 0, y: 0 },
        { x: -9, y: -4.5 },
        { x: -9, y: 4.5 },
      ],
      ART.knightSteel,
    );
  },
  cannon(g) {
    // The knight stands on the castle wall behind a cannon aimed up and out.
    at(g, -56, 38, 0.8, () => figure(g, 'knight'));
    poly(
      g,
      [
        { x: -43, y: 12 },
        { x: -39, y: 22 },
        { x: -2, y: 7 },
        { x: -3, y: -6 },
      ],
      ART.metalDark,
    );
    g.fillStyle(INK, 1);
    g.fillEllipse(-2, 0.5, 6, 13);
    rr(g, -42, 22, 30, 7, P.wood, 2);
    wheel(g, -24, 28, 10);
    bookShield(g, -34, 12, 0.85);
  },
  catapult(g) {
    wheel(g, -44, 9, 11);
    wheel(g, -14, 9, 11);
    rr(g, -58, -4, 60, 10, P.wood, 2);
    poly(
      g,
      [
        { x: -46, y: -4 },
        { x: -20, y: -4 },
        { x: -33, y: -46 },
      ],
      P.wood,
    );
    // The arm swings forward and down. The stone weight rides on the back end.
    bar(g, { x: -44, y: -64 }, { x: -33, y: -40 }, 6, P.wood);
    bar(g, { x: -33, y: -40 }, { x: -8, y: -6 }, 6, P.wood);
    rr(g, -52, -74, 14, 12, ART.metal, 3);
    disc(g, 0, 0, 8, P.wood);
    g.fillStyle(ART.stone, 1);
    g.fillCircle(0, -3, 4.5);
  },
  spear(g) {
    at(g, -52, 20, 0.9, () => figure(g, 'knight'));
    // The spear goes behind the shield. Its tip is the launch point.
    bar(g, { x: -70, y: -38 }, { x: -10, y: -7 }, 4, P.wood);
    poly(
      g,
      [
        { x: 4, y: 0.5 },
        { x: -12.9, y: -1.5 },
        { x: -7.5, y: -12.1 },
      ],
      ART.knightSteel,
    );
    bookShield(g, -26, -4, 0.95);
  },
  tank(g) {
    rr(g, -72, 10, 76, 14, F.hullDark, 7);
    for (const x of [-62, -49, -36, -23, -10]) disc(g, x, 17, 4, F.steel);
    // The barrel sits behind the dome, then the hull and the dome with its cyan light.
    rr(g, -30, -8, 32, 12, F.steel, 3);
    g.fillStyle(F.steel, 1);
    g.fillEllipse(-36, -2, 34, 40);
    g.lineStyle(2, INK, 1);
    g.strokeEllipse(-36, -2, 34, 40);
    poly(
      g,
      [
        { x: -66, y: 10 },
        { x: -6, y: 10 },
        { x: -14, y: -2 },
        { x: -58, y: -2 },
      ],
      F.hull,
    );
    g.fillStyle(F.glow, 1);
    g.fillRoundedRect(-52, 2, 32, 4, 2);
    g.fillCircle(-36, -10, 4);
  },
  helicopter(g) {
    // A thin tail boom, a round body with a cyan windshield, skids, and a rotor on top.
    poly(
      g,
      [
        { x: -50, y: -10 },
        { x: -88, y: -18 },
        { x: -90, y: -8 },
        { x: -50, y: 2 },
      ],
      F.edge,
    );
    bar(g, { x: -88, y: -24 }, { x: -88, y: -4 }, 3, ART.visor);
    g.lineStyle(3, INK, 1);
    g.lineBetween(-60, 16, 0, 16);
    g.lineBetween(-44, 8, -46, 16);
    g.lineBetween(-16, 8, -14, 16);
    g.fillStyle(F.hullDark, 1);
    g.fillEllipse(-30, -6, 62, 38);
    g.lineStyle(2, INK, 1);
    g.strokeEllipse(-30, -6, 62, 38);
    g.fillStyle(F.glow, 1);
    g.fillEllipse(-12, -10, 24, 20);
    g.lineStyle(2, INK, 1);
    g.strokeEllipse(-12, -10, 24, 20);
    g.fillStyle(F.pale, 0.6);
    g.fillEllipse(-16, -14, 8, 6);
    bar(g, { x: -30, y: -26 }, { x: -30, y: -32 }, 4, ART.metalDark);
    bar(g, { x: -68, y: -34 }, { x: 8, y: -34 }, 3, ART.visor);
    steelTube(g, -10, -3, 14, 6);
  },
  bunker(g) {
    // A missile stands in the hatch on top of a low steel dome. Its base is the launch point.
    rr(g, -6, -36, 12, 36, ART.cream, 5);
    poly(
      g,
      [
        { x: -6, y: -34 },
        { x: 6, y: -34 },
        { x: 0, y: -54 },
      ],
      F.pink,
    );
    poly(
      g,
      [
        { x: -6, y: -6 },
        { x: -14, y: 0 },
        { x: -6, y: 0 },
      ],
      F.neon,
    );
    poly(
      g,
      [
        { x: 6, y: -6 },
        { x: 14, y: 0 },
        { x: 6, y: 0 },
      ],
      F.neon,
    );
    g.fillStyle(F.hull, 1);
    g.fillRoundedRect(-48, -4, 96, 26, { tl: 22, tr: 22, bl: 0, br: 0 });
    g.lineStyle(2, INK, 1);
    g.strokeRoundedRect(-48, -4, 96, 26, { tl: 22, tr: 22, bl: 0, br: 0 });
    g.fillStyle(F.glow, 1);
    g.fillRoundedRect(-30, 1, 60, 5, 2);
    g.fillStyle(F.hullDark, 1);
    g.fillRect(-47, 14, 94, 7);
  },
  saber(g) {
    at(g, -32, 20, 0.9, () => figure(g, 'robot'));
    // The glowing saber is held up and forward from the hand at the launch point.
    const tip = { x: 15, y: -50 };
    g.lineStyle(13, F.glow, 0.3);
    g.lineBetween(0, -2, tip.x, tip.y);
    g.lineStyle(7, F.glow, 1);
    g.lineBetween(0, -2, tip.x, tip.y);
    g.lineStyle(2.5, F.pale, 1);
    g.lineBetween(0, -4, tip.x - 1, tip.y + 3);
    bar(g, { x: -14, y: -16 }, { x: -4, y: 0 }, 5, ART.visor);
    rr(g, -6, -3, 10, 7, ART.metalDark, 2);
  },
  laserGun(g) {
    at(g, -26, 50, 0.85, () => figure(g, 'robot'));
    // The pink laser gun is held forward. Its muzzle is the launch point.
    rr(g, -26, -7, 26, 14, F.pink, 4);
    g.fillStyle(ART.metalDark, 1);
    g.fillRoundedRect(-22, -4, 16, 5, 2);
    g.fillStyle(F.glow, 1);
    g.fillCircle(-2, 0, 3);
    disc(g, -22, 6, 5, ART.visor);
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
  const local = UNIT_BOXES[spot.role];
  if (role_has_shadow(spot.role))
    body.fillEllipse((local.l + local.r) / 2, local.b - 1, (local.r - local.l) * 0.9, 8);
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
