// Phaser side of the walking dashers: the ground spot markers, Sir Bonk and Robo Bonk, their
// health pips, and their walks, bonks, wobbles and tumbles. The rules decide everything; this
// only draws what BattleFlow tells it. Shapes and timelines come from dasherArt.ts (pure).
// Reduced motion: walks become a fade at the new spot, and nothing spins or lunges.
import type Phaser from 'phaser';
import type { Team, Vec2 } from '../../game/types';
import { paintArt } from './backdrop';
import {
  BONK_CONTACT,
  BONK_MS,
  PIPS_RISE,
  STANDING,
  bonkFrame,
  dasherShapes,
  healthPips,
  ring,
  walkDurationMs,
  walkFrame,
  type DasherPose,
} from './dasherArt';
import { floatLabel } from './effects';
import { startStars } from './fightEffects';
import type { ArtShape } from './obstacleArt';
import type { SquadField } from './types';
import { PALETTE, REDUCED_FADE_MS } from './visual';

const TEAMS: readonly Team[] = ['PAST', 'FUTURE'];
const DEPTH = 13;
const MARKER_DEPTH = 3;
/** A resting dasher waits at home, faded, until he is ready again. */
const RESTING_ALPHA = 0.5;

type Busy = 'stand' | 'walk' | 'bonk' | 'wobble' | 'tumble';

type Body = {
  container: Phaser.GameObjects.Container;
  gfx: Phaser.GameObjects.Graphics;
  pips: Phaser.GameObjects.Graphics;
  pose: DasherPose;
  facing: 1 | -1;
  state: 'home' | 'out' | 'resting';
  hp: number;
  maxHp: number;
  doing: Busy;
  busy: number;
  stopStars: (() => void) | null;
};

/** What the e2e hook reads about one dasher. Never secret. */
export type DasherDebug = {
  team: Team;
  x: number;
  y: number;
  visible: boolean;
  alpha: number;
  state: 'home' | 'out' | 'resting';
  doing: Busy;
  hp: number;
};

const homeFacing = (team: Team): 1 | -1 => (team === 'PAST' ? 1 : -1);

export class DasherLayer {
  private readonly bodies: Record<Team, Body>;
  private readonly markers: Phaser.GameObjects.Graphics;
  private markerKey = '';

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly fontPx: (basePx: number) => number,
    private readonly reduced: () => boolean,
  ) {
    this.markers = scene.add.graphics().setDepth(MARKER_DEPTH);
    const make = (team: Team): Body => {
      const gfx = scene.add.graphics();
      const container = scene.add.container(0, 0, [gfx]).setDepth(DEPTH).setVisible(false);
      const pips = scene.add
        .graphics()
        .setDepth(DEPTH + 1)
        .setVisible(false);
      return {
        container,
        gfx,
        pips,
        pose: STANDING,
        facing: homeFacing(team),
        state: 'home',
        hp: 0,
        maxHp: 0,
        doing: 'stand',
        busy: 0,
        stopStars: null,
      };
    };
    this.bodies = { PAST: make('PAST'), FUTURE: make('FUTURE') };
  }

  /** Put both dashers and the spot markers where the rules say. A dasher mid-animation is left alone. */
  sync(field: SquadField | null): void {
    if (!field) {
      this.markers.clear();
      this.markerKey = '';
      for (const t of TEAMS) {
        this.bodies[t].container.setVisible(false);
        this.bodies[t].pips.setVisible(false);
      }
      return;
    }
    this.drawMarkers(field);
    for (const d of field.dashers) {
      const b = this.bodies[d.team];
      b.state = d.state;
      b.hp = d.hp;
      b.maxHp = d.maxHp;
      if (b.busy > 0) continue;
      b.facing = homeFacing(d.team);
      b.pose = STANDING;
      b.container
        .setPosition(d.at.x, d.at.y)
        .setAngle(0)
        .setScale(b.facing, 1)
        .setAlpha(d.state === 'resting' ? RESTING_ALPHA : 1)
        .setVisible(true);
      this.paint(d.team);
      this.placePips(d.team);
    }
  }

  /** Walk along the ground line from `from` to `to`, over anything in the way. */
  async walk(team: Team, from: Vec2, to: Vec2, dizzy: boolean): Promise<void> {
    const b = this.bodies[team];
    b.busy++;
    b.doing = 'walk';
    b.container.setVisible(true).setAlpha(1).setAngle(0);
    b.pips.setVisible(false);
    try {
      if (this.reduced()) {
        await this.fade(b, 0);
        b.container.setPosition(to.x, to.y);
        b.facing = homeFacing(team);
        b.container.setScale(b.facing, 1);
        await this.fade(b, 1);
        return;
      }
      if (dizzy) b.stopStars = startStars(this.scene, () => this.headOf(b), false);
      const total = walkDurationMs(from, to, dizzy);
      await this.counter(total, (ms) => {
        const f = walkFrame(ms, from, to, dizzy);
        b.pose = f.pose;
        b.facing = f.facing;
        b.container.setPosition(f.x, f.y).setScale(f.facing, 1).setAngle(f.pose.lean);
        this.paint(team);
      });
    } finally {
      b.stopStars?.();
      b.stopStars = null;
      b.container.setAngle(0);
      b.doing = 'stand';
      b.busy--;
    }
  }

  /** One bonk at `toward`: wind up, swing, a puff and the word. */
  async bonk(team: Team, toward: Vec2, word: string): Promise<void> {
    const b = this.bodies[team];
    b.busy++;
    b.doing = 'bonk';
    const home = { x: b.container.x, y: b.container.y };
    const dir: 1 | -1 = toward.x >= home.x ? 1 : -1;
    b.facing = dir;
    b.container.setScale(dir, 1).setVisible(true);
    const contact = { x: (home.x + toward.x) / 2, y: home.y - 46 };
    try {
      if (this.reduced()) {
        b.pose = { ...STANDING, swing: 1 };
        this.paint(team);
        floatLabel(this.scene, { x: contact.x, y: contact.y - 30 }, word, 'hit', this.fontPx);
        await this.puff(contact, true);
        return;
      }
      let shown = false;
      await this.counter(BONK_MS, (ms) => {
        const t = ms / BONK_MS;
        const f = bonkFrame(t);
        b.pose = f.pose;
        b.container.setX(home.x + f.lunge * dir);
        this.paint(team);
        if (!shown && t >= BONK_CONTACT) {
          shown = true;
          floatLabel(this.scene, { x: contact.x, y: contact.y - 30 }, word, 'hit', this.fontPx);
          void this.puff(contact, false);
        }
      });
    } finally {
      b.container.setX(home.x);
      b.pose = STANDING;
      this.paint(team);
      b.doing = 'stand';
      b.busy--;
    }
  }

  /** A shell landed close: a wobble (near miss or a lost heart), or a silly tumble at 0. */
  async hit(team: Team, how: 'wobble' | 'tumble', label: string | null): Promise<void> {
    const b = this.bodies[team];
    b.busy++;
    b.doing = how;
    const at = { x: b.container.x, y: b.container.y };
    try {
      if (label)
        floatLabel(this.scene, { x: at.x, y: at.y - PIPS_RISE - 24 }, label, 'hit', this.fontPx);
      if (this.reduced()) {
        await this.fade(b, 0.4);
        if (how === 'tumble') b.container.setAngle(-90 * b.facing);
        await this.fade(b, 1);
        if (how === 'tumble') await this.puff({ x: at.x, y: at.y - 20 }, true);
        return;
      }
      if (how === 'wobble') {
        await this.tween({ targets: b.container, angle: 10, duration: 90, yoyo: true, repeat: 2 });
        b.container.setAngle(0);
        return;
      }
      b.pips.setVisible(false);
      await this.tween({
        targets: b.container,
        angle: -90 * b.facing,
        y: at.y - 6,
        duration: 420,
        ease: 'Back.easeIn',
      });
      b.container.setY(at.y);
      await this.puff({ x: at.x, y: at.y - 16 }, false);
    } finally {
      b.doing = 'stand';
      b.busy--;
    }
  }

  /** Read by the e2e hook (never in production). */
  state(): DasherDebug[] {
    return TEAMS.map((team) => {
      const b = this.bodies[team];
      return {
        team,
        x: b.container.x,
        y: b.container.y,
        visible: b.container.visible,
        alpha: b.container.alpha,
        state: b.state,
        doing: b.doing,
        hp: b.hp,
      };
    });
  }

  destroy(): void {
    for (const t of TEAMS) {
      const b = this.bodies[t];
      b.stopStars?.();
      b.container.destroy();
      b.pips.destroy();
    }
    this.markers.destroy();
  }

  // ---------- drawing ----------

  private paint(team: Team): void {
    const b = this.bodies[team];
    b.gfx.clear();
    paintArt(b.gfx, dasherShapes(team, b.pose));
  }

  private placePips(team: Team): void {
    const b = this.bodies[team];
    const show = b.state === 'out' && b.maxHp > 0;
    b.pips.clear().setVisible(show);
    if (!show) return;
    paintArt(b.pips, healthPips(b.hp, b.maxHp));
    b.pips.setPosition(b.container.x, b.container.y - PIPS_RISE);
  }

  private drawMarkers(field: SquadField): void {
    const key = JSON.stringify([field.spots, field.target]);
    if (key === this.markerKey) return;
    this.markerKey = key;
    const g = this.markers.clear();
    const shapes: ArtShape[] = [];
    for (const s of field.spots) {
      const flat = ring(0, 0, 1, 16).map((p) => ({
        x: s.at.x + p.x * 24,
        y: s.at.y + 3 + p.y * 6,
      }));
      const color = s.doorstepOf
        ? s.doorstepOf === 'PAST'
          ? PALETTE.past.gold
          : PALETTE.future.glow
        : PALETTE.shared.white;
      shapes.push({ op: 'poly', pts: flat, color: PALETTE.shared.ink, alpha: 0.35 });
      shapes.push({ op: 'outline', pts: flat, width: 2, color });
    }
    const t = field.target;
    if (t) {
      // The spot he will walk to: a thick ring and a pointing arrow, so it is not color alone.
      const flat = ring(0, 0, 1, 16).map((p) => ({ x: t.x + p.x * 30, y: t.y + 3 + p.y * 8 }));
      shapes.push({ op: 'outline', pts: flat, width: 5, color: PALETTE.shared.ember });
      const tip = { x: t.x, y: t.y - 14 };
      shapes.push({
        op: 'poly',
        pts: [tip, { x: tip.x - 12, y: tip.y - 18 }, { x: tip.x + 12, y: tip.y - 18 }],
        color: PALETTE.shared.ember,
        alpha: 1,
      });
    }
    paintArt(g, shapes);
  }

  private headOf(b: Body): Vec2 {
    return { x: b.container.x, y: b.container.y - 66 };
  }

  // ---------- small helpers ----------

  private fade(b: Body, alpha: number): Promise<void> {
    return this.tween({ targets: b.container, alpha, duration: REDUCED_FADE_MS });
  }

  private puff(at: Vec2, reduced: boolean): Promise<void> {
    const dots = (reduced ? [0] : [0, 1, 2, 3, 4]).map((i) => {
      const a = (i / 5) * Math.PI * 2;
      const r = reduced ? 0 : 10;
      return this.scene.add
        .circle(at.x + Math.cos(a) * r, at.y + Math.sin(a) * r, 10, PALETTE.shared.white, 0.85)
        .setDepth(DEPTH + 2);
    });
    return this.tween({
      targets: dots,
      alpha: 0,
      scale: reduced ? 1 : 2.2,
      duration: reduced ? REDUCED_FADE_MS : 380,
      onComplete: () => dots.forEach((d) => d.destroy()),
    });
  }

  private counter(ms: number, onUpdate: (ms: number) => void): Promise<void> {
    if (ms <= 0) {
      onUpdate(0);
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this.scene.tweens.addCounter({
        from: 0,
        to: ms,
        duration: ms,
        onUpdate: (tw) => onUpdate(tw.getValue() ?? 0),
        onComplete: () => {
          onUpdate(ms);
          resolve();
        },
      });
    });
  }

  private tween(config: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
    return new Promise((resolve) => {
      const done = config.onComplete;
      this.scene.tweens.add({
        ...config,
        onComplete: (...args: unknown[]) => {
          (done as ((...a: unknown[]) => void) | undefined)?.(...args);
          resolve();
        },
      });
    });
  }
}
