// Placeholder sprites drawn with Phaser Graphics: castle, secret base, and the two characters.
// Friendly rounded shapes. Nothing scary, nothing that looks hurt.
import Phaser from 'phaser';
import type { Rect, Team } from '../../game/types';
import type { TumblePose } from './tumble';
import { PALETTE } from './visual';

const INK = PALETTE.shared.ink;

export function drawCastle(scene: Phaser.Scene, r: Rect): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  g.fillStyle(PALETTE.past.stone, 1);
  g.fillRoundedRect(r.x, r.y + 20, r.w, r.h - 20, 6);
  // Battlements
  const teeth = 5;
  const tw = r.w / (teeth * 2 - 1);
  for (let i = 0; i < teeth; i++) g.fillRect(r.x + i * tw * 2, r.y, tw, 28);
  // Gate and windows
  g.fillStyle(PALETTE.past.wood, 1);
  g.fillRoundedRect(r.x + r.w / 2 - 22, r.y + r.h - 70, 44, 70, { tl: 22, tr: 22, bl: 0, br: 0 });
  g.fillStyle(PALETTE.shared.ink, 1);
  g.fillRect(r.x + 24, r.y + 52, 14, 26);
  g.fillRect(r.x + r.w - 38, r.y + 52, 14, 26);
  // Flag
  g.lineStyle(4, INK, 1);
  g.lineBetween(r.x + 20, r.y, r.x + 20, r.y - 44);
  g.fillStyle(PALETTE.past.banner, 1);
  g.fillTriangle(r.x + 20, r.y - 44, r.x + 20, r.y - 20, r.x + 54, r.y - 32);
  g.lineStyle(4, INK, 1);
  g.strokeRoundedRect(r.x, r.y + 20, r.w, r.h - 20, 6);
  return g;
}

export function drawBase(scene: Phaser.Scene, r: Rect): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  g.fillStyle(PALETTE.future.steel, 1);
  g.fillRoundedRect(r.x, r.y + 18, r.w, r.h - 18, 14);
  g.fillStyle(PALETTE.future.night, 1);
  g.fillRoundedRect(r.x + 12, r.y + 40, r.w - 24, 34, 8);
  // Glowing windows
  g.fillStyle(PALETTE.future.cyan, 1);
  for (let i = 0; i < 4; i++) g.fillRoundedRect(r.x + 20 + i * 34, r.y + 48, 22, 18, 4);
  // Door
  g.fillStyle(PALETTE.future.mint, 1);
  g.fillRoundedRect(r.x + r.w / 2 - 18, r.y + r.h - 44, 36, 44, { tl: 8, tr: 8, bl: 0, br: 0 });
  // Antenna and dish
  g.lineStyle(4, INK, 1);
  g.lineBetween(r.x + r.w - 30, r.y + 18, r.x + r.w - 30, r.y - 34);
  g.fillStyle(PALETTE.future.magenta, 1);
  g.fillCircle(r.x + r.w - 30, r.y - 38, 10);
  g.fillStyle(PALETTE.future.steel, 1);
  g.fillEllipse(r.x + 40, r.y + 14, 60, 22);
  g.lineStyle(4, INK, 1);
  g.strokeEllipse(r.x + 40, r.y + 14, 60, 22);
  g.strokeRoundedRect(r.x, r.y + 18, r.w, r.h - 18, 14);
  return g;
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
  const bodyColor = team === 'PAST' ? PALETTE.past.banner : PALETTE.future.night;
  body.fillStyle(bodyColor, 1);
  body.fillRoundedRect(-18, -50, 36, 46, 12);
  body.fillStyle(INK, 1);
  body.fillRoundedRect(-16, -8, 12, 8, 3);
  body.fillRoundedRect(4, -8, 12, 8, 3);
  body.lineStyle(3, INK, 1);
  body.strokeRoundedRect(-18, -50, 36, 46, 12);

  const head = scene.add.graphics();
  head.fillStyle(0xffd9b0, 1);
  head.fillCircle(0, -66, 17);
  head.lineStyle(3, INK, 1);
  head.strokeCircle(0, -66, 17);
  if (team === 'PAST') {
    head.fillStyle(PALETTE.past.stone, 1);
    head.fillRoundedRect(-18, -86, 36, 16, { tl: 16, tr: 16, bl: 0, br: 0 });
    head.fillStyle(PALETTE.past.banner, 1);
    head.fillTriangle(-4, -86, 4, -86, 0, -104);
  } else {
    head.fillStyle(PALETTE.future.cyan, 0.55);
    head.fillCircle(0, -66, 20);
    head.lineStyle(3, PALETTE.future.steel, 1);
    head.strokeCircle(0, -66, 20);
    head.lineStyle(3, INK, 1);
    head.lineBetween(0, -86, 0, -98);
    head.fillStyle(PALETTE.future.magenta, 1);
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
