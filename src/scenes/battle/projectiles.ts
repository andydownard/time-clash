// Draws each shot. Every drawing points RIGHT (+x) with its middle at the origin, about 36 to 56
// world px long. The scene turns the container to match the path. Colors come from visual.ts.
import type Phaser from 'phaser';
import type { Team } from '../../game/types';
import { kindFlies, type ProjectileKind } from './projectileKinds';
import { ART, PALETTE } from './visual';

export interface Projectile {
  container: Phaser.GameObjects.Container;
  /** Turn to the heading (degrees) and animate for the time since launch. */
  update(heading: number, tMs: number): void;
  destroy(): void;
}

export interface ProjectileOptions {
  /** Reduced motion: no flame flicker and no spin. */
  reduced?: boolean;
}

interface Drawn {
  /** Shapes that flicker (a flame). */
  flicker?: Phaser.GameObjects.Graphics;
  /** Spins slowly when not reduced (stone, bomb). */
  spins?: boolean;
}

type Draw = (g: Phaser.GameObjects.Graphics, team: Team, add: () => Phaser.GameObjects.Graphics) => Drawn;

const INK = PALETTE.shared.ink;
const LINE = 2;

function dark(g: Phaser.GameObjects.Graphics): void {
  g.lineStyle(LINE, INK, 1);
}

const drawArrow: Draw = (g) => {
  const cream = PALETTE.past.parchment;
  dark(g);
  g.fillStyle(cream, 1);
  g.fillRect(-24, -2, 40, 4);
  g.strokeRect(-24, -2, 40, 4);
  // Fletching: two feathers at the tail.
  g.fillStyle(PALETTE.past.banner, 1);
  g.fillTriangle(-26, 0, -16, -9, -14, 0);
  g.fillTriangle(-26, 0, -16, 9, -14, 0);
  g.fillStyle(PALETTE.past.light, 1);
  g.fillTriangle(-20, 0, -11, -8, -9, 0);
  g.fillTriangle(-20, 0, -11, 8, -9, 0);
  // Steel head.
  g.fillStyle(PALETTE.future.steel, 1);
  g.fillTriangle(14, -6, 14, 6, 26, 0);
  g.strokeTriangle(14, -6, 14, 6, 26, 0);
  return {};
};

const drawSpear: Draw = (g) => {
  dark(g);
  g.fillStyle(PALETTE.past.wood, 1);
  g.fillRect(-28, -2.5, 44, 5);
  g.strokeRect(-28, -2.5, 44, 5);
  g.fillStyle(PALETTE.future.steel, 1);
  g.fillTriangle(14, -7, 14, 7, 28, 0);
  g.strokeTriangle(14, -7, 14, 7, 28, 0);
  g.fillStyle(PALETTE.past.banner, 1);
  g.fillRect(8, -4, 4, 8);
  return {};
};

const drawCannonball: Draw = (g) => {
  dark(g);
  g.fillStyle(INK, 1);
  g.fillCircle(0, 0, 14);
  g.lineStyle(LINE, PALETTE.past.stone, 1);
  g.strokeCircle(0, 0, 14);
  g.fillStyle(PALETTE.past.stone, 1);
  g.fillCircle(-5, -5, 4);
  return {};
};

const drawStone: Draw = (g) => {
  dark(g);
  g.fillStyle(PALETTE.past.stone, 1);
  g.beginPath();
  g.moveTo(-14, -4);
  g.lineTo(-6, -15);
  g.lineTo(8, -13);
  g.lineTo(15, -1);
  g.lineTo(9, 12);
  g.lineTo(-7, 13);
  g.lineTo(-15, 6);
  g.closePath();
  g.fillPath();
  g.strokePath();
  g.fillStyle(PALETTE.past.stoneLine, 1);
  g.fillCircle(2, 3, 3);
  g.fillCircle(-6, -3, 2);
  return { spins: true };
};

const drawBomb: Draw = (g) => {
  dark(g);
  g.fillStyle(PALETTE.past.wood, 1);
  g.fillCircle(0, 3, 15);
  g.strokeCircle(0, 3, 15);
  g.fillStyle(PALETTE.past.parchment, 1);
  g.fillRect(-5, -14, 10, 6);
  g.strokeRect(-5, -14, 10, 6);
  g.lineStyle(3, INK, 1);
  g.lineBetween(0, -14, 5, -21);
  g.fillStyle(PALETTE.shared.ember, 1);
  g.fillCircle(6, -22, 3);
  return { spins: true };
};

const drawShell: Draw = (g) => {
  dark(g);
  g.fillStyle(PALETTE.future.steel, 1);
  g.fillRoundedRect(-20, -8, 28, 16, 3);
  g.strokeRoundedRect(-20, -8, 28, 16, 3);
  g.beginPath();
  g.moveTo(8, -8);
  g.arc(8, 0, 8, -Math.PI / 2, Math.PI / 2, false);
  g.closePath();
  g.fillPath();
  g.strokePath();
  g.fillStyle(PALETTE.future.hullDark, 1);
  g.fillRect(-8, -8, 5, 16);
  g.fillStyle(PALETTE.future.visor, 1);
  g.fillRect(-17, -6, 6, 3);
  return {};
};

const drawMissile: Draw = (g, _team, add) => {
  const flame = add();
  flame.fillStyle(ART.flame, 1);
  flame.fillTriangle(-26, -5, -26, 5, -46, 0);
  flame.fillStyle(ART.flameYellow, 1);
  flame.fillTriangle(-26, -2.5, -26, 2.5, -38, 0);
  dark(g);
  // Tail fins, then the body, blue band and blue nose.
  g.fillStyle(ART.missileGreenDark, 1);
  g.fillTriangle(-20, -8, -30, -17, -26, 0);
  g.fillTriangle(-20, 8, -30, 17, -26, 0);
  g.strokeTriangle(-20, -8, -30, -17, -26, 0);
  g.strokeTriangle(-20, 8, -30, 17, -26, 0);
  g.fillStyle(ART.missileGreen, 1);
  g.fillRoundedRect(-26, -8, 28, 16, 3);
  g.strokeRoundedRect(-26, -8, 28, 16, 3);
  g.fillStyle(PALETTE.future.neon, 1);
  g.fillRect(-14, -8, 7, 16);
  g.beginPath();
  g.moveTo(2, -8);
  g.arc(2, 0, 8, -Math.PI / 2, Math.PI / 2, false);
  g.closePath();
  g.fillPath();
  g.strokePath();
  return { flicker: flame };
};

const drawTracer: Draw = (g) => {
  g.fillStyle(PALETTE.shared.ember, 1);
  g.fillRoundedRect(4, -3, 18, 6, 3);
  g.fillStyle(PALETTE.shared.white, 1);
  g.fillRoundedRect(10, -2, 10, 4, 2);
  g.fillStyle(PALETTE.shared.ember, 0.8);
  g.fillRoundedRect(-14, -2.5, 12, 5, 2.5);
  g.fillStyle(PALETTE.shared.ember, 0.5);
  g.fillRoundedRect(-30, -2, 10, 4, 2);
  return {};
};

const drawLaser: Draw = (g) => {
  g.fillStyle(PALETTE.future.pink, 0.3);
  g.fillRoundedRect(-24, -9, 48, 18, 9);
  g.fillStyle(PALETTE.future.pink, 1);
  g.fillRoundedRect(-20, -5, 40, 10, 5);
  g.fillStyle(PALETTE.shared.white, 1);
  g.fillRoundedRect(-16, -2, 32, 4, 2);
  return {};
};

const drawWave: Draw = (g) => {
  // A crescent bulging toward travel: outer arc minus an inner arc.
  g.fillStyle(PALETTE.shared.pulse, 0.35);
  g.beginPath();
  g.arc(-8, 0, 24, -1.1, 1.1, false);
  g.arc(-20, 0, 24, 1.0, -1.0, true);
  g.closePath();
  g.fillPath();
  g.fillStyle(PALETTE.shared.pulse, 1);
  g.beginPath();
  g.arc(-8, 0, 20, -1.1, 1.1, false);
  g.arc(-16, 0, 20, 1.0, -1.0, true);
  g.closePath();
  g.fillPath();
  g.fillStyle(PALETTE.shared.white, 1);
  g.fillCircle(11, 0, 3);
  return {};
};

/** One drawing per kind. A test keeps this table complete. */
export const DRAWINGS: Record<ProjectileKind, Draw> = {
  cannonball: drawCannonball,
  arrow: drawArrow,
  stone: drawStone,
  spear: drawSpear,
  shell: drawShell,
  missile: drawMissile,
  tracer: drawTracer,
  laser: drawLaser,
  bomb: drawBomb,
  wave: drawWave,
};

export function createProjectile(
  scene: Phaser.Scene,
  kind: ProjectileKind,
  team: Team,
  options: ProjectileOptions = {},
): Projectile {
  const reduced = options.reduced === true;
  const container = scene.add.container(0, 0).setDepth(30);
  const parts: Phaser.GameObjects.Graphics[] = [];
  const add = (): Phaser.GameObjects.Graphics => {
    const g = scene.add.graphics();
    parts.push(g);
    container.add(g);
    return g;
  };
  const body = add();
  const drawn = DRAWINGS[kind](body, team, add);
  // The body is drawn last in the list so a flame sits behind it.
  container.bringToTop(body);
  const flies = kindFlies(kind);
  return {
    container,
    update(heading, tMs) {
      if (flies) {
        const h = Number.isFinite(heading) ? heading : 0;
        container.setRotation((h * Math.PI) / 180);
        // Flying left: flip so the drawing is not upside down.
        container.setScale(1, Math.abs(h) > 90 ? -1 : 1);
      } else if (drawn.spins && !reduced) {
        container.setRotation((tMs / 1000) * 4);
      }
      if (drawn.flicker && !reduced) {
        drawn.flicker.setScale(0.8 + 0.4 * Math.abs(Math.sin(tMs / 45)), 1);
      }
    },
    destroy() {
      container.destroy(true);
    },
  };
}
