// Battle damage on a base. A normal hit scars the base but never destroys it.
// The pure part (damageStage, damageMarks) is unit tested. The Phaser part only draws it.
import type Phaser from 'phaser';
import { createRng } from '../../game/rng';
import type { Rect } from '../../game/types';
import { PALETTE } from './visual';

export type DamageStage = 0 | 1 | 2 | 3;

/** 0 = fresh, 3 = badly scarred. Never above 3, never below 0, never goes down as health falls. */
export function damageStage(hp: number, maxHp: number): DamageStage {
  if (!Number.isFinite(hp) || !Number.isFinite(maxHp) || maxHp <= 0) return 0;
  const lost = Math.min(1, Math.max(0, 1 - hp / maxHp));
  if (lost <= 0) return 0;
  if (lost < 1 / 3) return 1;
  if (lost < 2 / 3) return 2;
  return 3;
}

export type Scorch = { x: number; y: number; rx: number; ry: number; alpha: number };
export type Breach = { points: number[] };
export type SmokeSpot = { x: number; y: number; r: number };
export type DamageMarks = { scorches: Scorch[]; breaches: Breach[]; smoke: SmokeSpot[] };

/** Only part of the base is marked. Marks stay inside the rectangle and never grow past stage 3. */
export function damageMarks(stage: DamageStage, base: Rect): DamageMarks {
  const rng = createRng(Math.round(base.x * 13 + base.y * 7 + base.w) >>> 0);
  const scorchCount = [0, 1, 3, 5][stage] as number;
  const scorches: Scorch[] = [];
  for (let i = 0; i < scorchCount; i++) {
    scorches.push({
      x: base.x + base.w * (0.15 + 0.7 * rng.next()),
      y: base.y + base.h * (0.2 + 0.6 * rng.next()),
      rx: 14 + rng.next() * 14,
      ry: 10 + rng.next() * 10,
      alpha: 0.45 + 0.1 * stage,
    });
  }
  const breaches: Breach[] = [];
  if (stage >= 2) {
    // A ragged hole near the top of one wall or tower: zigzag edge, flat bottom.
    const size = stage === 3 ? 1.4 : 1;
    const cx = base.x + base.w * (0.3 + 0.4 * rng.next());
    const top = base.y + base.h * 0.12;
    const w = base.w * 0.14 * size;
    const h = base.h * 0.2 * size;
    breaches.push({
      points: [
        cx - w,
        top + h,
        cx - w * 0.8,
        top + h * 0.45,
        cx - w * 0.35,
        top + h * 0.6,
        cx - w * 0.1,
        top,
        cx + w * 0.3,
        top + h * 0.5,
        cx + w * 0.7,
        top + h * 0.3,
        cx + w,
        top + h,
      ],
    });
  }
  const smokeCount = [0, 0, 1, 2][stage] as number;
  const smoke: SmokeSpot[] = [];
  for (let i = 0; i < smokeCount; i++) {
    smoke.push({
      x: base.x + base.w * (0.35 + 0.3 * i),
      y: base.y + base.h * 0.15,
      r: 12 + 4 * i,
    });
  }
  return { scorches, breaches, smoke };
}

export type DamageArt = {
  /** Show the marks for this stage. Smaller stages clear marks (a new match). */
  setStage(stage: DamageStage): void;
  stage(): DamageStage;
  destroy(): void;
};

/** Marks are extra Graphics added to the base container, on top of the existing art. */
export function createDamageArt(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  base: Rect,
  reduced: () => boolean,
): DamageArt {
  let current: DamageStage = 0;
  let layer: Phaser.GameObjects.Graphics | null = null;
  let smokeLayer: Phaser.GameObjects.Graphics[] = [];
  const clearAll = (): void => {
    layer?.destroy();
    layer = null;
    for (const g of smokeLayer) {
      scene.tweens.killTweensOf(g);
      g.destroy();
    }
    smokeLayer = [];
  };
  return {
    stage: () => current,
    setStage(stage) {
      if (stage === current) return;
      current = stage;
      clearAll();
      if (stage === 0) return;
      const marks = damageMarks(stage, base);
      const g = scene.add.graphics();
      for (const s of marks.scorches) {
        g.fillStyle(PALETTE.shared.shadow, s.alpha);
        g.fillEllipse(s.x, s.y, s.rx * 2, s.ry * 2);
      }
      for (const b of marks.breaches) {
        g.fillStyle(PALETTE.shared.shadow, 0.85);
        g.lineStyle(3, PALETTE.shared.ink, 1);
        g.fillPoints(pairs(b.points), true);
        g.strokePoints(pairs(b.points), true);
      }
      container.add(g);
      layer = g;
      for (const sp of marks.smoke) {
        const puff = scene.add.graphics({ x: sp.x, y: sp.y });
        puff.fillStyle(PALETTE.shared.white, 0.5);
        puff.fillCircle(0, 0, sp.r);
        container.add(puff);
        smokeLayer.push(puff);
        if (!reduced()) {
          scene.tweens.add({
            targets: puff,
            y: sp.y - 26,
            alpha: 0.1,
            duration: 1400,
            repeat: -1,
            ease: 'Sine.easeOut',
          });
        }
      }
    },
    destroy: clearAll,
  };
}

const pairs = (flat: number[]): Phaser.Types.Math.Vector2Like[] => {
  const out: Phaser.Types.Math.Vector2Like[] = [];
  for (let i = 0; i + 1 < flat.length; i += 2)
    out.push({ x: flat[i] as number, y: flat[i + 1] as number });
  return out;
};
