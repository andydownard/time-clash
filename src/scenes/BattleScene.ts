// Battle scene. Phaser draws, animates and plays sound. All rules go through MatchController,
// and BattleFlow (battle/flow.ts) runs the loop. This class is the BattleView the flow draws on.
//
// Start it with scene.start(BATTLE_SCENE_KEY, data) where data is BattleSceneData.
import Phaser from 'phaser';
import { BALLISTICS, WORLD } from '../game/config';
import type { AimInput, BattleLayout, Rect, ShotResult, Team, Vec2 } from '../game/types';
import { drawBackdrop, type Backdrop } from './battle/backdrop';
import { createAimArt, type AimArt } from './battle/aimArt';
import { effectColor, floatLabel, playFade } from './battle/effects';
import { createDamageArt, damageStage, type DamageArt } from './battle/damageArt';
import {
  playBaseBlast,
  playBlastFade,
  playCharge,
  playDizzyStars,
  playExplosion,
  playVanish,
} from './battle/fightEffects';
import { BattleFlow } from './battle/flow';
import { characterSpot, sideAlpha } from './battle/geometry';
import { CHRONO_SCALE } from './battle/unitSpots';
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
import { DEFAULT_KIND, headingDegrees, type ProjectileKind } from './battle/projectileKinds';
import { createProjectile } from './battle/projectiles';
import { fallFrame, fallPose, fallVariant } from './battle/tumble';
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
import { FALL_MS, REDUCED_FADE_MS, TEAM_COLOR } from './battle/visual';
import { drawUnits, type UnitArt } from './battle/unitArt';
import { UNITS, type UnitId } from '../game/units';

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
  private fighters: Record<UnitId, UnitArt> | null = null;
  private baseArts = {} as Record<Team, BaseArt>;
  private damage = {} as Record<Team, DamageArt>;
  private blownUp: Record<Team, boolean> = { PAST: false, FUTURE: false };
  /** A hit fighter lies 'down' after the tumble, is 'gone' in a puff, and returns next turn. */
  private tumbleState: Record<Team, 'up' | 'down' | 'gone'> = { PAST: 'up', FUTURE: 'up' };
  private tumbleCount = 0;

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
      this.baseArts[team] = art;
      this.damage[team] = createDamageArt(this, art.container, base, () => this.reduced());
      this.sway.push(...art.sway);
      this.pulse.push(...art.pulse);
      const character = createCharacter(this, team, spot.x, spot.y, CHRONO_SCALE);
      const side = this.add
        .container(0, 0, [glow, art.container, character.container])
        .setDepth(10);
      this.sides[team] = side;
      this.glows[team] = glow;
      this.characters[team] = character;
    }

    this.fighters = drawUnits(this, this.labels, () => this.reduced());
    for (const u of UNITS) this.fighters[u.id].container.setDepth(11);
    const chosen = this.data0.match.snapshot().selected;
    for (const t of TEAMS) this.setSelectedUnit(t, chosen[t]);

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
      ...(this.data0.scrapBase ? { scrapBase: this.data0.scrapBase } : {}),
      ...(this.data0.levels ? { levels: this.data0.levels } : {}),
      ...(this.data0.onLevels ? { onLevels: this.data0.onLevels } : {}),
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
    for (const t of TEAMS) {
      const stage = damageStage(status.baseHp[t], status.maxBaseHp?.[t] ?? 100);
      // Marks only go down here (a new match). Playing a hit adds them after its explosion.
      if (stage < this.damage[t].stage()) this.damage[t].setStage(stage);
      if (status.baseHp[t] > 0 && this.blownUp[t]) this.restoreBase(t);
    }
    this.lastAim = status.aim;
    this.aimArt.show(this.dragHandler ? status.activeTeam : null, status.aim);
  }

  /** Point the marker at this team's chosen fighter. */
  setSelectedUnit(team: Team, id: UnitId): void {
    if (!this.fighters) return;
    for (const u of UNITS) {
      if (u.team === team) this.fighters[u.id].setSelected(u.id === id);
    }
  }

  setActiveTeam(team: Team | null): void {
    this.stepTumbleState(team);
    for (const t of TEAMS) {
      this.sides[t].setAlpha(sideAlpha(t, team));
      for (const u of UNITS) {
        if (u.team === t) this.fighters?.[u.id].container.setAlpha(sideAlpha(t, team));
      }
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

  playCharge(team: Team, from: Vec2): Promise<void> {
    return playCharge(this, from, TEAM_COLOR[team], this.reduced());
  }

  animateShot(
    shooter: Team,
    result: ShotResult,
    kind: ProjectileKind = DEFAULT_KIND[shooter],
  ): Promise<void> {
    const duration = flightDurationMs(result);
    const shot = createProjectile(this, kind, shooter, { reduced: this.reduced() });
    const start = result.path[0];
    shot.container.setPosition(start?.x ?? 0, start?.y ?? 0);
    shot.update(headingDegrees(result.path, 0), 0);
    if (duration <= 0) {
      shot.destroy();
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
          shot.container.setPosition(p.x, p.y);
          shot.update(headingDegrees(result.path, t / (BALLISTICS.stepSeconds * 1000)), t);
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
          shot.destroy();
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
    const target = info.target;
    const status = this.lastStatus;
    const hp = status?.baseHp[target] ?? 1;
    const wipedOut = info.result === 'direct' && hp <= 0;
    const base = this.layout.bases[target];
    if (this.reduced()) {
      await playFade(this, position, effectColor(info.kind), scale);
      if (wipedOut) await playBlastFade(this, base);
    } else {
      await playExplosion(this, position, info.kind, scale);
      if (wipedOut) await playBaseBlast(this, base, target);
    }
    if (wipedOut) {
      this.blowUpBase(target);
    } else if (status && info.result === 'direct') {
      const stage = damageStage(hp, status.maxBaseHp?.[target] ?? 100);
      if (stage > this.damage[target].stage()) this.damage[target].setStage(stage);
    }
  }

  /** The base is gone in the blast. Nobody was inside. */
  private blowUpBase(team: Team): void {
    this.blownUp[team] = true;
    this.baseArts[team].container.setVisible(false);
    this.damage[team].setStage(0);
  }

  private restoreBase(team: Team): void {
    this.blownUp[team] = false;
    this.baseArts[team].container.setVisible(true);
  }

  playTumble(team: Team): Promise<void> {
    const character = this.characters[team];
    this.resetCharacter(team);
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
    const variant = fallVariant(this.tumbleCount++);
    const homeX = characterSpot(team, this.layout).x;
    const dir = team === 'PAST' ? 1 : -1;
    let starsShown = false;
    return new Promise<void>((resolve) => {
      this.tweens.addCounter({
        from: 0,
        to: FALL_MS,
        duration: FALL_MS,
        onUpdate: (tween) => {
          const frame = fallFrame(tween.getValue() ?? 0, variant);
          character.setPose(fallPose(frame));
          character.container.setX(homeX + frame.dx * dir);
          // The payoff: once the bounce is over, stars circle the dizzy fighter's head.
          if (!starsShown && (frame.phase === 'wobble' || frame.phase === 'topple')) {
            starsShown = true;
            const c = character.container;
            void playDizzyStars(this, { x: c.x, y: c.y }, false);
          }
        },
        onComplete: () => {
          // It stays lying down until the speech bubble has shown and the turn passes.
          this.tumbleState[team] = 'down';
          resolve();
        },
      });
    });
  }

  private resetCharacter(team: Team): void {
    const character = this.characters[team];
    character.setPose(null);
    character.container.setX(characterSpot(team, this.layout).x).setAlpha(1);
    this.tumbleState[team] = 'up';
  }

  /** A fallen fighter puffs away on the next turn change, and is back on its own turn. */
  private stepTumbleState(active: Team | null): void {
    if (active === null) return;
    for (const t of TEAMS) {
      const state = this.tumbleState[t];
      if (state !== 'up' && active === t) {
        this.resetCharacter(t);
      } else if (state === 'down') {
        this.tumbleState[t] = 'gone';
        const c = this.characters[t].container;
        void playVanish(this, { x: c.x, y: c.y }, this.reduced(), (a) => c.setAlpha(a));
      }
    }
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
    if (this.fighters) for (const u of UNITS) this.fighters[u.id].destroy();
    this.fighters = null;
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
