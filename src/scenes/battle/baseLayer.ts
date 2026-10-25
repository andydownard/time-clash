// Phaser side of a built base: draws each brick with the builder's own picture, the weapons on
// their pads, wear and cracks on hurt bricks, and the silly crumble of fallen bricks. The rules
// decide everything (match.ts); the plans come from basePlan.ts (pure). Nobody is hurt.
import type Phaser from 'phaser';
import type { BrickId, BrickView, Match, Rect, SpotView, Team } from '../../game/types';
import {
  brickSprites,
  brickWear,
  crackLines,
  crumblePlan,
  dustPuffs,
  padSprites,
  stepPxOf,
  type BrickSprite,
  type PadSprite,
} from './basePlan';
import { PALETTE } from './visual';

/** What the e2e hook reads about one built base. Never secret. */
export type BaseLayerDebug = {
  team: Team;
  /** Bricks with a picture on the field right now. */
  drawn: number;
  /** Bricks still standing by the rules. */
  standing: number;
  /** Bricks that have played their crumble. */
  crumbled: number;
  /** The drawn bricks' boxes, world px. */
  boxes: Rect[];
};

/** Turns an SVG text into a texture once. Resolves when it is ready, or when it fails. */
function ensureTexture(scene: Phaser.Scene, key: string, svg: string): Promise<boolean> {
  if (scene.textures.exists(key)) return Promise.resolve(true);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        if (!scene.textures.exists(key)) scene.textures.addImage(key, img);
        resolve(true);
      } catch {
        resolve(false);
      }
    };
    img.onerror = () => resolve(false);
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}

/** The layer for `team`'s built base, or null when it brought none (the castle is drawn). */
export function builtLayerFor(
  scene: Phaser.Scene,
  team: Team,
  match: Pick<Match, 'builtBase' | 'bricks' | 'spots'>,
  footprint: Rect,
  reduced: () => boolean,
): BaseLayer | null {
  if (!match.builtBase?.[team] || !match.bricks) return null;
  return new BaseLayer(
    scene,
    team,
    match.bricks,
    match.spots?.[team] ?? [],
    footprint.y + footprint.h,
    reduced,
  );
}

type Drawn = { sprite: BrickSprite; image: Phaser.GameObjects.Image | null; box: Rect };

export class BaseLayer {
  readonly container: Phaser.GameObjects.Container;
  private readonly bricks = new Map<BrickId, Drawn>();
  private readonly pads: Array<{ pad: PadSprite; image: Phaser.GameObjects.Image | null }> = [];
  private readonly cracks: Phaser.GameObjects.Graphics;
  private readonly crumbled = new Set<BrickId>();
  private views: Record<BrickId, BrickView>;
  private dead = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly team: Team,
    bricks: Record<BrickId, BrickView>,
    spots: readonly SpotView[],
    /** The base's bottom edge: where fallen bricks land. */
    private readonly groundY: number,
    private readonly reduced: () => boolean,
  ) {
    this.views = bricks;
    this.container = scene.add.container(0, 0);
    this.cracks = scene.add.graphics();
    for (const sprite of brickSprites(team, bricks)) {
      const view = bricks[sprite.id] as BrickView;
      const drawn: Drawn = { sprite, image: null, box: { ...view.box } };
      this.bricks.set(sprite.id, drawn);
      void ensureTexture(scene, sprite.key, sprite.svg).then((ok) => {
        if (!ok || this.dead || !this.views[sprite.id]?.alive) return;
        const image = scene.add
          .image(sprite.x, sprite.y, sprite.key)
          .setDisplaySize(sprite.w, sprite.h)
          .setFlipX(sprite.flip);
        drawn.image = image;
        // Keep the build order, so a brick on top is drawn over the one under it.
        this.container.addAt(image, Math.min(this.container.length, this.order(sprite.id)));
        this.paintWear();
      });
    }
    this.container.add(this.cracks);
    for (const pad of padSprites(spots, stepPxOf(team, bricks))) {
      const slot = { pad, image: null as Phaser.GameObjects.Image | null };
      this.pads.push(slot);
      void ensureTexture(scene, pad.key, pad.svg).then((ok) => {
        if (!ok || this.dead) return;
        if (pad.brick && !this.views[pad.brick]?.alive) return;
        slot.image = scene.add
          .image(pad.x, pad.y, pad.key)
          .setDisplaySize(pad.size, pad.size)
          .setFlipX(team === 'FUTURE');
        this.container.add(slot.image);
      });
    }
  }

  private order(id: BrickId): number {
    let i = 0;
    for (const [k, d] of this.bricks) {
      if (k === id) return i;
      if (d.image) i++;
    }
    return i;
  }

  /** Darker shades and cracks on hurt bricks, so wear never rests on color alone. */
  private paintWear(): void {
    this.cracks.clear();
    this.cracks.lineStyle(2, PALETTE.shared.ink, 0.8);
    for (const [id, d] of this.bricks) {
      const v = this.views[id];
      if (!v || !v.alive || !d.image) continue;
      const wear = brickWear(v.hp, v.maxHp);
      d.image.setTint(wear.tint);
      for (const [x1, y1, x2, y2] of crackLines(d.box, wear.cracks)) {
        this.cracks.lineBetween(x1, y1, x2, y2);
      }
    }
  }

  /**
   * Shows the bricks as the rules have them now. Bricks that fell play their crumble (in the
   * order the rules list them, `fellOrder`), and weapons on them tumble too. Resolves when done.
   */
  async update(
    bricks: Record<BrickId, BrickView>,
    fellOrder: readonly BrickId[] = [],
  ): Promise<void> {
    this.views = bricks;
    const falling: BrickId[] = [...fellOrder.filter((id) => this.bricks.has(id))];
    for (const [id] of this.bricks) {
      if (!bricks[id]?.alive && !falling.includes(id)) falling.push(id);
    }
    const fresh = falling.filter((id) => !this.crumbled.has(id));
    const jobs: Array<Promise<void>> = [];
    fresh.forEach((id, order) => {
      this.crumbled.add(id);
      const d = this.bricks.get(id) as Drawn;
      jobs.push(this.crumble(d.image, d.box, order));
      d.image = null;
      for (const slot of this.pads) {
        if (slot.pad.brick === id && slot.image) {
          const box = {
            x: slot.pad.x - slot.pad.size / 2,
            y: slot.pad.y - slot.pad.size / 2,
            w: slot.pad.size,
            h: slot.pad.size,
          };
          jobs.push(this.crumble(slot.image, box, order));
          slot.image = null;
        }
      }
    });
    this.paintWear();
    await Promise.all(jobs);
  }

  private crumble(image: Phaser.GameObjects.Image | null, box: Rect, order: number): Promise<void> {
    const scene = this.scene;
    const plan = crumblePlan(this.team, box, this.groundY, order, this.reduced());
    if (!this.reduced()) {
      for (const p of dustPuffs(box, order)) {
        const puff = scene.add.circle(p.x, p.y, p.r, p.color, 0.85).setDepth(14);
        scene.tweens.add({
          targets: puff,
          alpha: 0,
          scale: 1.8,
          y: p.y - p.r,
          delay: plan.delayMs,
          duration: 520,
          onComplete: () => puff.destroy(),
        });
      }
    }
    if (!image) return new Promise((r) => scene.time.delayedCall(plan.delayMs + plan.fadeMs, r));
    return new Promise((resolve) => {
      const fade = (): void => {
        scene.tweens.add({
          targets: image,
          alpha: 0,
          duration: plan.fadeMs,
          onComplete: () => {
            image.destroy();
            resolve();
          },
        });
      };
      if (plan.durationMs <= 0) {
        fade();
        return;
      }
      scene.tweens.add({
        targets: image,
        x: image.x + plan.dx,
        y: image.y + plan.dy,
        angle: plan.angle,
        delay: plan.delayMs,
        duration: plan.durationMs,
        ease: 'Bounce.easeOut',
        onComplete: fade,
      });
    });
  }

  state(): BaseLayerDebug {
    const boxes: Rect[] = [];
    for (const d of this.bricks.values()) if (d.image) boxes.push({ ...d.box });
    return {
      team: this.team,
      drawn: boxes.length,
      standing: Object.values(this.views).filter((v) => v.team === this.team && v.alive).length,
      crumbled: this.crumbled.size,
      boxes,
    };
  }

  destroy(): void {
    this.dead = true;
    this.container.destroy();
    this.bricks.clear();
  }
}
