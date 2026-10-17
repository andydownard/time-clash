// Battle scene. Phaser draws, animates and plays sound. All rules go through MatchController,
// and BattleFlow (battle/flow.ts) runs the loop. This class is the BattleView the flow draws on.
//
// Start it with scene.start(BATTLE_SCENE_KEY, data) where data is BattleSceneData.
import Phaser from 'phaser';
import { BALLISTICS, TIMING, WORLD } from '../game/config';
import type { AimInput, BattleLayout, Rect, ShotResult, Team, Vec2 } from '../game/types';
import { drawBackdrop, type Backdrop } from './battle/backdrop';
import { createAimArt, type AimArt } from './battle/aimArt';
import {
  effectColor,
  floatLabel,
  playBlocks,
  playConfetti,
  playFade,
  playPlasmaRing,
  playPuff,
} from './battle/effects';
import { BattleFlow } from './battle/flow';
import { characterSpot, sideAlpha } from './battle/geometry';
import { sceneReducedMotion } from './battle/reducedMotion';
import { createPauseControl, type PauseControl } from './battle/pauseUi';
import {
  createCharacter,
  drawBase,
  drawCastle,
  type BaseArt,
  type Character,
} from './battle/sprites';
import { createStatusArt, type StatusArt } from './battle/statusArt';
import { createLabelScaler, worldFontPx, type LabelScaler } from './battle/textScale';
import { preloadCanvasFonts } from './battle/textStyle';
import { flightDurationMs, pointAtTime } from './battle/trajectory';
import { tumblePose } from './battle/tumble';
import {
  BATTLE_SCENE_KEY,
  CAMP_SCENE_KEY,
  VICTORY_SCENE_KEY,
  type BattleSceneData,
  type BattleView,
  type ImpactInfo,
  type PreviewDot,
  type ViewStatus,
} from './battle/types';
import { PALETTE, REDUCED_FADE_MS, TEAM_COLOR } from './battle/visual';

const TEAMS: readonly Team[] = ['PAST', 'FUTURE'];

export class BattleScene extends Phaser.Scene implements BattleView {
  private data0!: BattleSceneData;
  private layout!: BattleLayout;
  private flow: BattleFlow | null = null;
  private pause: PauseControl | null = null;
  private aimArt!: AimArt;
  private statusArt!: StatusArt;
  private sides = {} as Record<Team, Phaser.GameObjects.Container>;
  private glows = {} as Record<Team, Phaser.GameObjects.Ellipse>;
  private characters = {} as Record<Team, Character>;
  private dragHandler: ((aim: AimInput) => void) | null = null;
  private lastAim: AimInput = { angleDeg: 45, power: 60 };
  private resumeWaiters: Array<() => void> = [];
  private paused = false;
  private glowTween: Phaser.Tweens.Tween | null = null;
  private lastStatus: ViewStatus | null = null;

  constructor() {
    super(BATTLE_SCENE_KEY);
  }

  init(data: BattleSceneData): void {
    this.data0 = data;
    this.layout = data.match.layout;
  }

  create(): void {
    const { layout } = this;
    const backdrop = drawBackdrop(this, layout);
    // Labels grow as the canvas shrinks, so they stay at the 20px floor on a small iPad.
    this.labels = createLabelScaler(() => this.scale.displaySize.width, WORLD.width);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.refreshLabels, this);
    this.statusArt = createStatusArt(this, layout, this.labels);
    this.aimArt = createAimArt(this, layout, this.labels);

    for (const team of TEAMS) {
      const base: Rect = layout.bases[team];
      const spot = characterSpot(team, layout);
      const glow = this.add
        .ellipse(base.x + base.w / 2, base.y + base.h, base.w + 90, 46, TEAM_COLOR[team], 0.6)
        .setVisible(false);
      const art: BaseArt = team === 'PAST' ? drawCastle(this, base) : drawBase(this, base);
      this.sway.push(...art.sway);
      this.pulse.push(...art.pulse);
      const character = createCharacter(this, team, spot.x, spot.y);
      const side = this.add
        .container(0, 0, [glow, art.container, character.container])
        .setDepth(10);
      this.sides[team] = side;
      this.glows[team] = glow;
      this.characters[team] = character;
    }

    this.startAmbient(backdrop);
    // Canvas text draws in the fallback font until MedievalSharp and Orbitron arrive. Redraw then.
    void preloadCanvasFonts(document.fonts, () => this.refreshLabels());

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.dragHandler) this.aimArt.pointerDown({ x: p.worldX, y: p.worldY });
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      const aim = this.aimArt.pointerMove({ x: p.worldX, y: p.worldY });
      if (aim) this.dragHandler?.(aim);
    });
    this.input.on('pointerup', () => this.aimArt.pointerUp());
    this.input.on('pointerupoutside', () => this.aimArt.pointerUp());

    this.pause = createPauseControl(document, {
      onPause: () => {
        this.paused = true;
        this.scene.pause();
      },
      onResume: () => {
        this.paused = false;
        this.scene.resume();
        const waiters = this.resumeWaiters;
        this.resumeWaiters = [];
        waiters.forEach((fn) => fn());
      },
      // Leave game: the family goes back to the Camp. Shutting this scene down stops the flow.
      onLeave: () => {
        this.data0.onLeave?.();
        this.scene.start(CAMP_SCENE_KEY);
      },
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.cleanup());

    this.flow = new BattleFlow({
      match: this.data0.match,
      overlay: this.data0.overlay,
      view: this,
      audio: this.data0.audio,
      bank: this.data0.bank,
      history: this.data0.history,
      onHistory: this.data0.onHistory,
      onMuteToggle: this.data0.onMuteToggle,
      onFinished: (result) => {
        if (this.data0.onFinished) this.data0.onFinished(result);
        else this.scene.start(VICTORY_SCENE_KEY, result);
      },
      wait: (ms) => new Promise<void>((resolve) => this.time.delayedCall(ms, resolve)),
      waitIfPaused: () =>
        this.paused
          ? new Promise<void>((resolve) => this.resumeWaiters.push(resolve))
          : Promise.resolve(),
    });
    this.flow.run().catch((e: unknown) => {
      // A bug here must be loud in development, and must not freeze the page silently.
      console.error('Battle flow stopped', e);
    });
  }

  // ---------- BattleView ----------

  syncStatus(status: ViewStatus): void {
    this.statusArt.sync(status);
    this.lastStatus = status;
    this.lastAim = status.aim;
    this.aimArt.show(this.dragHandler ? status.activeTeam : null, status.aim);
  }

  setActiveTeam(team: Team | null): void {
    for (const t of TEAMS) {
      this.sides[t].setAlpha(sideAlpha(t, team));
      this.glows[t].setVisible(team === t);
      for (const o of this.statusArt.groupFor(t)) {
        o.setAlpha(sideAlpha(t, team));
      }
    }
    this.glowTween?.stop();
    this.glowTween = null;
    if (team && !this.reduced()) {
      const glow = this.glows[team];
      glow.setAlpha(0.6);
      this.glowTween = this.tweens.add({
        targets: glow,
        alpha: 0.2,
        duration: 700,
        yoyo: true,
        repeat: -1,
      });
    } else if (team) {
      this.glows[team].setAlpha(0.5);
    }
  }

  showPreview(team: Team, dots: readonly PreviewDot[] | null): void {
    this.aimArt.showPreview(team, dots);
  }

  setAimDragHandler(handler: ((aim: AimInput) => void) | null): void {
    this.dragHandler = handler;
    if (!handler) {
      this.aimArt.pointerUp();
      this.aimArt.show(null, this.lastAim);
    }
  }

  animateShot(shooter: Team, result: ShotResult): Promise<void> {
    const duration = flightDurationMs(result);
    const ball = this.add
      .circle(
        result.path[0]?.x ?? 0,
        result.path[0]?.y ?? 0,
        BALLISTICS.projectileRadius,
        TEAM_COLOR[shooter],
      )
      .setStrokeStyle(3, PALETTE.shared.ink)
      .setDepth(30);
    if (duration <= 0) {
      ball.destroy();
      return Promise.resolve();
    }
    const reduced = this.reduced();
    let lastTrail = 0;
    return new Promise<void>((resolve) => {
      this.tweens.addCounter({
        from: 0,
        to: duration,
        duration,
        onUpdate: (tween) => {
          const t = tween.getValue() ?? 0;
          const p = pointAtTime(result.path, t);
          ball.setPosition(p.x, p.y);
          if (!reduced && t - lastTrail > 50) {
            lastTrail = t;
            const dot = this.add.circle(p.x, p.y, 4, TEAM_COLOR[shooter], 0.7).setDepth(29);
            this.tweens.add({
              targets: dot,
              alpha: 0,
              duration: 400,
              onComplete: () => dot.destroy(),
            });
          }
        },
        onComplete: () => {
          ball.destroy();
          resolve();
        },
      });
    });
  }

  async playImpact(info: ImpactInfo): Promise<void> {
    const { position, scale } = info;
    floatLabel(
      this,
      { x: position.x, y: Math.max(60, position.y - 50) },
      info.label,
      'hit',
      this.fontPx,
    );
    if (this.reduced()) {
      await playFade(this, position, effectColor(info.kind), scale);
      return;
    }
    switch (info.kind) {
      case 'blocks': {
        const groundY = this.layout.terrain.ground[0]?.y ?? WORLD.height;
        await playBlocks(this, this.layout.bases[info.target], groundY);
        break;
      }
      case 'confetti':
        await playConfetti(this, position, scale);
        break;
      case 'plasma':
        await playPlasmaRing(this, position, scale);
        break;
      default:
        await playPuff(this, position, scale);
    }
  }

  playTumble(team: Team): Promise<void> {
    const character = this.characters[team];
    if (this.reduced()) {
      // Reduced motion: a gentle fade down and back up, no spinning or flying.
      return new Promise<void>((resolve) => {
        this.tweens.add({
          targets: character.container,
          alpha: 0.35,
          duration: REDUCED_FADE_MS,
          yoyo: true,
          onComplete: () => {
            character.container.setAlpha(1);
            resolve();
          },
        });
      });
    }
    return new Promise<void>((resolve) => {
      this.tweens.addCounter({
        from: 0,
        to: TIMING.tumbleMs,
        duration: TIMING.tumbleMs,
        onUpdate: (tween) => character.setPose(tumblePose(tween.getValue() ?? 0)),
        onComplete: () => {
          character.setPose(null);
          resolve();
        },
      });
    });
  }

  showScrapPopup(team: Team, amount: number): void {
    const spot: Vec2 = characterSpot(team, this.layout);
    floatLabel(this, { x: spot.x, y: spot.y - 150 }, `+${amount}`, 'scrap', this.fontPx);
  }

  // ---------- internals ----------

  private reduced(): boolean {
    if (this.data0.reducedMotion) return this.data0.reducedMotion();
    return sceneReducedMotion(this.registry, window);
  }

  /** Read by the e2e hook (never in production). */
  labels: LabelScaler | null = null;

  private refreshLabels = (): void => {
    this.labels?.refresh();
    this.statusArt?.relayout();
    const s = this.lastStatus;
    if (s) this.aimArt?.show(this.dragHandler ? s.activeTeam : null, this.lastAim);
  };

  /** A world font size that still draws at the 20px floor on this screen. */
  private fontPx = (basePx: number): number =>
    worldFontPx(basePx, this.scale.displaySize.width, WORLD.width);

  /** Parts that sway or twinkle. Skipped when motion is reduced. */
  private sway: Phaser.GameObjects.Graphics[] = [];
  private pulse: Phaser.GameObjects.Graphics[] = [];

  private startAmbient(backdrop: Backdrop): void {
    if (this.reduced()) return;
    this.tweens.add({
      targets: backdrop.clouds,
      x: 40,
      duration: 16000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    this.tweens.add({
      targets: backdrop.stars,
      alpha: 0.45,
      duration: 2400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    for (const flag of this.sway) {
      this.tweens.add({
        targets: flag,
        scaleX: 0.8,
        duration: 1100,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
    for (const o of this.pulse) {
      this.tweens.add({
        targets: o,
        alpha: 0.65,
        duration: 900,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  }

  private cleanup(): void {
    this.scale.off(Phaser.Scale.Events.RESIZE, this.refreshLabels, this);
    this.labels?.clear();
    this.flow?.destroy();
    this.flow = null;
    this.data0.overlay.hideHud();
    this.pause?.destroy();
    this.pause = null;
    this.glowTween?.stop();
    this.dragHandler = null;
    this.input.off('pointerdown');
    this.input.off('pointermove');
    this.input.off('pointerup');
    this.input.off('pointerupoutside');
    this.resumeWaiters.forEach((fn) => fn());
    this.resumeWaiters = [];
    // Leaving a game while paused must not leave the next match paused (Phaser reuses this scene).
    this.paused = false;
  }
}
