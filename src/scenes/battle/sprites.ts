// Placeholder sprites drawn with Phaser Graphics: castle, secret base, and the two characters.
// Friendly rounded shapes. Nothing scary, nothing that looks hurt.
import Phaser from 'phaser';
import type { Rect, Team } from '../../game/types';
import type { TumblePose } from './tumble';
import { ART, PALETTE } from './visual';

const INK = PALETTE.shared.ink;

/** A castle or base, plus the parts that may move a little (flags, beacon) unless motion is reduced. */
export type BaseArt = {
  container: Phaser.GameObjects.Container;
  /** Flags and the like: sway side to side. */
  sway: Phaser.GameObjects.Graphics[];
  /** Torches, beacon: pulse softly. */
  pulse: Phaser.GameObjects.Graphics[];
};

/** Team Past: a stone keep with two towers, purple roofs and banners, an oak gate, and torches. */
export function drawCastle(scene: Phaser.Scene, r: Rect): BaseArt {
  const g = scene.add.graphics();
  const edge = ART.stoneEdge;
  const keepTop = r.y + 30;
  const tower = 44;

  // Keep.
  g.fillStyle(PALETTE.past.stone, 1);
  g.fillRoundedRect(r.x + 18, keepTop, r.w - 36, r.h - 30, 6);
  g.lineStyle(2, PALETTE.past.stoneLine, 1);
  for (let row = 1; row < 4; row++) {
    const y = keepTop + row * ((r.h - 30) / 4);
    g.lineBetween(r.x + 18, y, r.x + r.w - 18, y);
  }
  g.lineStyle(4, edge, 1);
  g.strokeRoundedRect(r.x + 18, keepTop, r.w - 36, r.h - 30, 6);
  // Battlements along the keep.
  const teeth = 4;
  const tw = (r.w - 36 - 40) / (teeth * 2 - 1);
  g.fillStyle(PALETTE.past.stone, 1);
  for (let i = 0; i < teeth; i++) {
    g.fillRect(r.x + 38 + i * tw * 2, keepTop - 14, tw, 14);
    g.strokeRect(r.x + 38 + i * tw * 2, keepTop - 14, tw, 14);
  }

  // Two towers with purple cone roofs.
  for (const left of [true, false]) {
    const tx = left ? r.x : r.x + r.w - tower;
    g.fillStyle(PALETTE.past.stone, 1);
    g.fillRoundedRect(tx, r.y + 12, tower, r.h - 12, 4);
    g.lineStyle(4, edge, 1);
    g.strokeRoundedRect(tx, r.y + 12, tower, r.h - 12, 4);
    g.fillStyle(PALETTE.past.bannerDark, 1);
    g.fillTriangle(tx - 6, r.y + 14, tx + tower / 2, r.y - 30, tx + tower + 6, r.y + 14);
    g.lineStyle(4, PALETTE.past.deep, 1);
    g.strokeTriangle(tx - 6, r.y + 14, tx + tower / 2, r.y - 30, tx + tower + 6, r.y + 14);
    // A slit window.
    g.fillStyle(PALETTE.shared.ink, 1);
    g.fillRoundedRect(tx + tower / 2 - 5, r.y + 40, 10, 24, 4);
  }

  // Oak gate with an arch, and a torch on each side.
  g.fillStyle(PALETTE.past.wood, 1);
  g.fillRoundedRect(r.x + r.w / 2 - 24, r.y + r.h - 66, 48, 66, { tl: 24, tr: 24, bl: 0, br: 0 });
  g.lineStyle(4, PALETTE.shared.ink, 1);
  g.strokeRoundedRect(r.x + r.w / 2 - 24, r.y + r.h - 66, 48, 66, { tl: 24, tr: 24, bl: 0, br: 0 });
  g.lineBetween(r.x + r.w / 2, r.y + r.h - 66, r.x + r.w / 2, r.y + r.h);

  // Banners on poles above each roof. They sway when motion is allowed.
  const sway: Phaser.GameObjects.Graphics[] = [];
  for (const left of [true, false]) {
    const px = left ? r.x + tower / 2 : r.x + r.w - tower / 2;
    g.lineStyle(4, PALETTE.shared.ink, 1);
    g.lineBetween(px, r.y - 30, px, r.y - 64);
    const flag = scene.add.graphics();
    flag.fillStyle(PALETTE.past.banner, 1);
    flag.fillTriangle(0, 0, 0, 24, 36, 12);
    flag.fillStyle(PALETTE.past.gold, 1);
    flag.fillCircle(8, 12, 4);
    flag.lineStyle(3, PALETTE.past.deep, 1);
    flag.strokeTriangle(0, 0, 0, 24, 36, 12);
    flag.setPosition(px, r.y - 64);
    sway.push(flag);
  }

  // Torches flank the gate.
  const torches = scene.add.graphics();
  for (const dx of [-38, 38]) {
    const tx = r.x + r.w / 2 + dx;
    const ty = r.y + r.h - 50;
    torches.lineStyle(4, PALETTE.past.wood, 1);
    torches.lineBetween(tx, ty, tx, ty + 18);
    torches.fillStyle(PALETTE.shared.campfire, 1);
    torches.fillEllipse(tx, ty - 6, 14, 22);
    torches.fillStyle(PALETTE.past.gold, 1);
    torches.fillEllipse(tx, ty - 3, 8, 12);
  }

  const container = scene.add.container(0, 0, [g, torches, ...sway]);
  return { container, sway, pulse: [torches] };
}

/** Team Future: a steel hull with a glass dome, blue neon edges, glowing windows, and a beacon. */
export function drawBase(scene: Phaser.Scene, r: Rect): BaseArt {
  const g = scene.add.graphics();
  const hullTop = r.y + 36;

  // Dome behind the hull.
  g.fillStyle(PALETTE.future.visor, 1);
  g.fillEllipse(r.x + r.w / 2, hullTop, r.w - 40, 84);
  g.fillStyle(PALETTE.future.neon, 0.35);
  g.fillEllipse(r.x + r.w / 2 + 10, hullTop - 8, r.w - 80, 44);
  g.lineStyle(4, PALETTE.future.edge, 1);
  g.strokeEllipse(r.x + r.w / 2, hullTop, r.w - 40, 84);

  // Hull.
  g.fillStyle(PALETTE.future.steel, 1);
  g.fillRoundedRect(r.x, hullTop, r.w, r.h - 36, 14);
  g.fillStyle(PALETTE.future.hullDark, 1);
  g.fillRoundedRect(r.x + 12, hullTop + 14, r.w - 24, 38, 8);
  // Neon windows, each outlined so the shape reads without color.
  g.fillStyle(PALETTE.future.glow, 1);
  for (let i = 0; i < 4; i++) g.fillRoundedRect(r.x + 20 + i * 34, hullTop + 22, 22, 22, 4);
  g.lineStyle(2, PALETTE.future.night, 1);
  for (let i = 0; i < 4; i++) g.strokeRoundedRect(r.x + 20 + i * 34, hullTop + 22, 22, 22, 4);
  // Door.
  g.fillStyle(PALETTE.future.neon, 1);
  g.fillRoundedRect(r.x + r.w / 2 - 20, r.y + r.h - 44, 40, 44, { tl: 10, tr: 10, bl: 0, br: 0 });
  g.lineStyle(3, PALETTE.future.glow, 1);
  g.strokeRoundedRect(r.x + r.w / 2 - 20, r.y + r.h - 44, 40, 44, { tl: 10, tr: 10, bl: 0, br: 0 });
  // Outline, with a soft neon halo behind it.
  g.lineStyle(10, PALETTE.future.glow, 0.25);
  g.strokeRoundedRect(r.x, hullTop, r.w, r.h - 36, 14);
  g.lineStyle(4, PALETTE.future.edge, 1);
  g.strokeRoundedRect(r.x, hullTop, r.w, r.h - 36, 14);

  // Antenna with a beacon that pulses when motion is allowed.
  g.lineStyle(4, PALETTE.shared.ink, 1);
  g.lineBetween(r.x + r.w - 26, hullTop, r.x + r.w - 26, r.y - 26);
  const beacon = scene.add.graphics();
  beacon.fillStyle(PALETTE.future.glow, 1);
  beacon.fillCircle(0, 0, 10);
  beacon.lineStyle(3, PALETTE.future.night, 1);
  beacon.strokeCircle(0, 0, 10);
  beacon.setPosition(r.x + r.w - 26, r.y - 30);
  // A dish on the left.
  g.fillStyle(PALETTE.future.steel, 1);
  g.fillEllipse(r.x + 30, r.y + 14, 56, 20);
  g.lineStyle(3, PALETTE.future.edge, 1);
  g.strokeEllipse(r.x + 30, r.y + 14, 56, 20);

  const container = scene.add.container(0, 0, [g, beacon]);
  return { container, sway: [], pulse: [beacon] };
}

export type Character = {
  container: Phaser.GameObjects.Container;
  /** Apply a tumble pose, or null to stand upright. */
  setPose(pose: TumblePose | null): void;
};

/** A small round hero with a knight helmet (Past) or a space visor (Future). Origin is the feet. */
export function createCharacter(
  scene: Phaser.Scene,
  team: Team,
  x: number,
  groundY: number,
): Character {
  const facing = team === 'PAST' ? 1 : -1;
  const container = scene.add.container(x, groundY);
  const inner = scene.add.container(0, 0);
  inner.setScale(facing, 1);

  const body = scene.add.graphics();
  const bodyColor = team === 'PAST' ? PALETTE.past.banner : PALETTE.future.edge;
  body.fillStyle(bodyColor, 1);
  body.fillRoundedRect(-18, -50, 36, 46, 12);
  body.fillStyle(INK, 1);
  body.fillRoundedRect(-16, -8, 12, 8, 3);
  body.fillRoundedRect(4, -8, 12, 8, 3);
  body.lineStyle(3, INK, 1);
  body.strokeRoundedRect(-18, -50, 36, 46, 12);

  const head = scene.add.graphics();
  head.fillStyle(ART.skin, 1);
  head.fillCircle(0, -66, 17);
  head.lineStyle(3, INK, 1);
  head.strokeCircle(0, -66, 17);
  if (team === 'PAST') {
    head.fillStyle(PALETTE.past.stone, 1);
    head.fillRoundedRect(-18, -86, 36, 16, { tl: 16, tr: 16, bl: 0, br: 0 });
    head.fillStyle(PALETTE.past.gold, 1);
    head.fillTriangle(-4, -86, 4, -86, 0, -92);
    head.fillStyle(PALETTE.past.banner, 1);
    head.fillTriangle(-4, -86, 4, -86, 0, -104);
  } else {
    head.fillStyle(PALETTE.future.glow, 0.4);
    head.fillCircle(0, -66, 20);
    head.lineStyle(3, PALETTE.future.steel, 1);
    head.strokeCircle(0, -66, 20);
    head.lineStyle(3, INK, 1);
    head.lineBetween(0, -86, 0, -98);
    head.fillStyle(PALETTE.future.glow, 1);
    head.fillCircle(0, -100, 4);
  }

  const eyes = scene.add.graphics();
  const drawEyes = (look: number): void => {
    eyes.clear();
    eyes.fillStyle(PALETTE.shared.white, 1);
    eyes.fillCircle(-6, -66, 5);
    eyes.fillCircle(7, -66, 5);
    eyes.fillStyle(INK, 1);
    eyes.fillCircle(-6 + look * 2, -66, 2.4);
    eyes.fillCircle(7 + look * 2, -66, 2.4);
  };
  drawEyes(0);

  const armColor = team === 'PAST' ? PALETTE.past.stone : PALETTE.future.steel;
  const makeArm = (side: -1 | 1): Phaser.GameObjects.Container => {
    const arm = scene.add.container(side * 20, -40);
    const g = scene.add.graphics();
    g.fillStyle(armColor, 1);
    g.fillRoundedRect(-5, 0, 10, 30, 5);
    g.lineStyle(2, INK, 1);
    g.strokeRoundedRect(-5, 0, 10, 30, 5);
    arm.add(g);
    return arm;
  };
  const armL = makeArm(-1);
  const armR = makeArm(1);

  inner.add([armL, armR, body, head, eyes]);
  container.add(inner);

  return {
    container,
    setPose(pose) {
      if (!pose) {
        container.setScale(1, 1);
        container.setAngle(0);
        container.setY(groundY);
        armL.setAngle(0);
        armR.setAngle(0);
        drawEyes(0);
        return;
      }
      container.setScale(pose.squashX, pose.squashY);
      container.setAngle(pose.rotationDeg * facing);
      container.setY(groundY - pose.lift);
      armL.setAngle(pose.armSwingDeg);
      armR.setAngle(-pose.armSwingDeg);
      drawEyes(pose.lookDir);
    },
  };
}
