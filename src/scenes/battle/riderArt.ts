// Phaser side of the fighters on a built base. Each one stands on the top brick under it
// (riders.ts decides where), and when that brick falls it drops, flops over, puffs dust and stands
// up again on the lower spot (riderFall.ts has the frames). Nobody is hurt.
import type Phaser from 'phaser';
import { RIDER_IDS, riderDrops } from '../../game/riders';
import type { BattleLayout, Match, Team, Vec2 } from '../../game/types';
import { unitById, type UnitId } from '../../game/units';
import { dustPuffs } from './basePlan';
import { riderFallFrame, riderFallPlan, riderPivot, riderPose, type RiderFrame } from './riderFall';
import type { RiderFall } from './riderFalls';
import type { UnitArt } from './unitArt';

/** What the e2e hook reads about one fighter on a built base. Never secret. */
export type RiderDebug = {
  id: UnitId;
  team: Team;
  /** How far below its castle spot it stands, world px. */
  dy: number;
  /** Falls it has played this match. */
  falls: number;
  /** Its feet on the field, world px. */
  feet: Vec2;
};

export class RiderLayer {
  private dy: Partial<Record<UnitId, number>>;
  private readonly fallCount = new Map<UnitId, number>();
  private dead = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly fighters: Record<UnitId, UnitArt>,
    private readonly layout: BattleLayout,
    start: Pick<Match, 'characterHealth' | 'builtBase' | 'bricks'>,
    private readonly reduced: () => boolean,
  ) {
    this.dy = riderDrops(start, layout);
    for (const id of RIDER_IDS) this.pose(id, this.frame(this.dy[id] ?? 0));
  }

  /** How far each rider stands below its castle spot right now (the angle number stays off them). */
  drops = (): Partial<Record<UnitId, number>> => ({ ...this.dy });

  private frame(dy: number): RiderFrame {
    return { dy, angle: 0, scaleX: 1, scaleY: 1, alpha: 1 };
  }

  private shift(id: UnitId): Vec2 {
    const team = (unitById(id) as NonNullable<ReturnType<typeof unitById>>).team;
    return this.layout.baseShift?.[team] ?? { x: 0, y: 0 };
  }

  private pose(id: UnitId, f: RiderFrame): void {
    const art = this.fighters[id];
    const def = unitById(id);
    if (!art || !def || this.dead) return;
    const p = riderPose(f, riderPivot(def), this.shift(id));
    art.container.setPosition(p.x, p.y);
    art.container.setAngle(p.angle);
    art.container.setScale(p.scaleX, p.scaleY);
    art.container.setAlpha(f.alpha);
  }

  /** The fall of each fighter in `falls`, all at once. Resolves when they stand again. */
  fall(team: Team, falls: readonly RiderFall[]): Promise<void> {
    const reduced = this.reduced();
    const plan = riderFallPlan(team, reduced);
    return Promise.all(
      falls.map(
        (f) =>
          new Promise<void>((resolve) => {
            this.fallCount.set(f.id, (this.fallCount.get(f.id) ?? 0) + 1);
            this.dy[f.id] = f.toDy;
            let puffed = false;
            const finish = (): void => {
              this.pose(f.id, this.frame(f.toDy));
              resolve();
            };
            if (this.dead) {
              resolve();
              return;
            }
            this.scene.tweens.addCounter({
              from: 0,
              to: plan.totalMs,
              duration: plan.totalMs,
              onUpdate: (tw) => {
                const t = tw.getValue() ?? 0;
                this.pose(f.id, riderFallFrame(plan, t, f.fromDy, f.toDy));
                if (!puffed && !reduced && t >= plan.dropMs) {
                  puffed = true;
                  this.puff(f.id, f.toDy);
                }
              },
              onComplete: finish,
              onStop: finish,
            });
          }),
      ),
    ).then(() => undefined);
  }

  /** A dust puff at the feet where the fighter lands. Fixed, never random. */
  private puff(id: UnitId, dy: number): void {
    const def = unitById(id);
    if (!def || this.dead) return;
    const pivot = riderPivot(def);
    const s = this.shift(id);
    const box = { x: pivot.x + s.x - 18, y: pivot.y + s.y + dy - 12, w: 36, h: 16 };
    for (const p of dustPuffs(box, 0)) {
      const c = this.scene.add.circle(p.x, p.y, p.r, p.color, 0.85).setDepth(14);
      this.scene.tweens.add({
        targets: c,
        alpha: 0,
        scale: 1.8,
        y: p.y - p.r,
        duration: 420,
        onComplete: () => c.destroy(),
      });
    }
  }

  state(): RiderDebug[] {
    return RIDER_IDS.map((id) => {
      const def = unitById(id) as NonNullable<ReturnType<typeof unitById>>;
      const pivot = riderPivot(def);
      const s = this.shift(id);
      const dy = this.dy[id] ?? 0;
      return {
        id,
        team: def.team,
        dy,
        falls: this.fallCount.get(id) ?? 0,
        feet: { x: pivot.x + s.x, y: pivot.y + s.y + dy },
      };
    });
  }

  destroy(): void {
    this.dead = true;
  }
}
