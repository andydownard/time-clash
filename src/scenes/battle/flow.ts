// BattleFlow: the whole battle loop with no Phaser in it.
// It talks to MatchController (rules), the Overlay (DOM), the BattleView (drawing) and audio.
// The loop follows docs/CONTRACTS.md:
//   pass screen -> ready() -> banner -> setAim -> wind-up -> fire() -> animate path -> shotLanded()
//   -> (tumble, bubble) -> ... -> pickQuestion -> showReloadModal -> reloadDone() -> pass()
import type { AudioManager } from '../../audio/types';
import { firingOrigin, unitById, unitsOf, type UnitId } from '../../game/units';
import { answerReload, chooseShot } from '../../game/bot';
import { COMPUTER } from '../../data/computerCopy';
import {
  aimDurationMs,
  aimSteps,
  isComputerTurn,
  needsPassScreen,
  reloadWaitMs,
  type PracticeRun,
} from '../../game/practice';
import type { MatchEffects } from '../../game/loadout';
import { kindForRole } from './projectileKinds';
import { BALLISTICS, DISTURBANCE, EVASION, PRACTICE_BOT, RNG_SALT, TURN } from '../../game/config';
import type { AmmoId } from '../../game/ammo';
import { createShuffleBag } from '../../game/bag';
import { createRng } from '../../game/rng';
import type {
  AimInput,
  BlastOutcome,
  BuiltEvents,
  MatchController,
  Rng,
  ShotResult,
  StandBonk,
  Team,
  Vec2,
} from '../../game/types';
import {
  GEAR_COPY,
  HIT_LINES,
  RELOAD as RELOAD_COPY,
  RELOAD_QUIPS,
  SQUAD_COPY,
  tumblePool,
} from '../../data/copy';
import {
  dasherHomePoint,
  dasherOf,
  doorstepOf,
  groundSpotIds,
  groundSpotPoint,
  type HelperId,
} from '../../game/crew';
import { timeCaptions } from '../../data/introScript';
import {
  effectiveGrade,
  levelOffset,
  recordAnswer,
  recordFor,
  withRecord,
  type Levels,
} from '../../questions/calibration';
import { noteMissed, pickQuestion, pickSubject } from '../../questions/pick';
import type { PickHistory, QuestionBank } from '../../questions/types';
import type { HudHandlers, HudState, Overlay } from '../../ui/types';
import { bubbleAnchor, bubbleTailTarget } from './geometry';
import { describeImpact } from './impact';
import { previewDots, traceDots } from './trajectory';
import { bubbleText, tumblingTeam } from './tumble';
import type { BattleResult, BattleView, SquadField, ViewStatus } from './types';
import { IMPACT_BEAT_MS, SCRAP_POPUP_MS, WIN_BEAT_MS } from './visual';

/** One flight step in ms (the path has one point per step). */
const STEP_MS = BALLISTICS.stepSeconds * 1000;

export type FlowDeps = {
  match: MatchController;
  overlay: Pick<
    Overlay,
    | 'showHud'
    | 'updateHud'
    | 'hideHud'
    | 'showTurnBanner'
    | 'showPassScreen'
    | 'showReloadModal'
    | 'showSpeechBubble'
    | 'setCaption'
  > &
    Partial<Pick<Overlay, 'showThinking'>>;
  view: BattleView;
  /** One child alone against the Computer player. Absent means two people (today's game). */
  practice?: PracticeRun & { effects?: MatchEffects };
  /** True when big motion should become jumps. Only the computer's dial uses it. */
  reducedMotion?: () => boolean;
  audio?: Pick<AudioManager, 'playSfx' | 'speak'> &
    Partial<Pick<AudioManager, 'setMusicTeam' | 'stopMusic' | 'clipsEnabled'>>;
  bank: QuestionBank;
  history: PickHistory;
  onHistory?: (history: PickHistory) => void;
  /** Quiet level nudges per player name. Never shown to a child. */
  levels?: Levels;
  onLevels?: (levels: Levels) => void;
  onMuteToggle?: () => void;
  onFinished: (result: BattleResult) => void;
  /** Each player's Scrap in hand before this match. The HUD shows it plus what they earn. */
  scrapBase?: Record<Team, number>;
  /** Resolves after ms. The scene uses a real timer; tests resolve at once. */
  wait: (ms: number) => Promise<void>;
  /** Resolves right away unless the game is paused. */
  waitIfPaused?: () => Promise<void>;
};

/** Thrown inside the loop when destroy() runs, so every await can bail out. */
class Stopped extends Error {}

export class BattleFlow {
  private stopped = false;
  private history: PickHistory;
  private levels: Levels;
  private readonly questionRng: Rng;
  private readonly hitBags: Record<'direct' | 'near' | 'miss', { next(): number }>;
  private readonly quipBags: Record<'fast' | 'slow' | 'wrong', { next(): number }>;
  private awaitingFire: (() => void) | null = null;
  /** Squads S1: the spot a player chose for a dash. It ends the wait like Fire does. */
  private pendingDash: string | null = null;
  /** Squads S1: the player pressed Come back. It ends the wait like Fire does. */
  private pendingRecall = false;
  /** While above 0 a dasher animation is playing, so status pushes leave the dashers alone. */
  private fieldHeld = 0;
  /** Squads S1: sides that already took a go in this match, so the first-go hint shows once each. */
  private readonly hintDone = new Set<Team>();
  /** The Computer player's own random stream and the time it has spent thinking this turn. */
  private readonly botRng: Rng;
  private thinkingSpentMs = 0;

  constructor(private readonly deps: FlowDeps) {
    this.history = deps.history;
    this.levels = deps.levels ?? {};
    this.questionRng = createRng(deps.match.snapshot().seed ^ RNG_SALT.questions);
    this.botRng = createRng((deps.match.snapshot().seed ^ RNG_SALT.computer) >>> 0);
    // Jokes come from seeded shuffle bags, so a match repeats and no line shows twice in a row.
    const lineRng = createRng((deps.match.snapshot().seed ^ RNG_SALT.lines) >>> 0);
    this.hitBags = {
      direct: createShuffleBag(lineRng, HIT_LINES.direct.length),
      near: createShuffleBag(lineRng, HIT_LINES.near.length),
      miss: createShuffleBag(lineRng, HIT_LINES.miss.length),
    };
    this.quipBags = {
      fast: createShuffleBag(lineRng, RELOAD_QUIPS.fast.length),
      slow: createShuffleBag(lineRng, RELOAD_QUIPS.slow.length),
      wrong: createShuffleBag(lineRng, RELOAD_QUIPS.wrong.length),
    };
  }

  /** Runs until the match ends or destroy() is called. Resolves quietly in both cases. */
  async run(): Promise<void> {
    const { match, overlay } = this.deps;
    overlay.showHud(this.hudHandlers());
    try {
      while (match.snapshot().status === 'PLAYING') {
        const done = await this.playTurn();
        if (done) return;
      }
    } catch (e) {
      if (!(e instanceof Stopped)) throw e;
    } finally {
      this.deps.audio?.stopMusic?.();
      this.deps.view.setAimDragHandler(null);
    }
  }

  /** Stop the loop. Any pending wait for Fire is released. */
  destroy(): void {
    this.stopped = true;
    this.deps.view.setAimDragHandler(null);
    const release = this.awaitingFire;
    this.awaitingFire = null;
    release?.();
  }

  // ---------- one turn ----------

  /** Returns true when the match ended and Victory took over. */
  private async playTurn(): Promise<boolean> {
    const { match, overlay, view } = this.deps;
    const team = match.snapshot().turn.team;
    const names = this.names();

    this.pushStatus(false);
    view.setActiveTeam(null);
    view.showBirds?.(null);
    await this.gate();
    view.showTrace(team, null);
    // One child alone has nobody to hide the screen from, so there is no cover in this mode.
    if (needsPassScreen(this.deps.practice ?? null)) {
      await overlay.showPassScreen({ nextName: names[team], nextTeam: team });
      this.live();
    }
    this.thinkingSpentMs = 0;
    const beats = match.ready();
    // This turn's birds take off now, so the player can watch them while aiming.
    const birds = match.snapshot().birds ?? [];
    if (birds.length > 0) view.showBirds?.(birds);
    view.setActiveTeam(team);
    this.deps.audio?.setMusicTeam?.(team);
    // Squads: every dasher out on the field bonks at the start of the turn, on both sides' turns.
    await this.playStand(beats);
    if (match.snapshot().status === 'OVER') {
      await this.finish();
      return true;
    }

    for (const shot of [1, 2] as const) {
      await this.gate();
      void overlay.showTurnBanner({ name: names[team], team, shot });
      await this.aimAndFire(team);
      this.live();
      if (match.snapshot().status === 'OVER') {
        await this.finish();
        return true;
      }
    }

    const bonus = await this.reload(team);
    if (bonus) {
      // A right answer earns one Power Shot. It has no question and no bonus of its own.
      await this.gate();
      void overlay.showTurnBanner({ name: names[team], team, shot: 'POWER' });
      await this.aimAndFire(team);
      this.live();
      if (match.snapshot().status === 'OVER') {
        await this.finish();
        return true;
      }
    }
    match.pass();
    return false;
  }

  /** Wait for the player to aim and fire, then fly the shot and apply it. */
  private async aimAndFire(team: Team): Promise<void> {
    const { view } = this.deps;
    if (this.isComputer(team)) {
      await this.computerAims(team);
    } else {
      const fired = new Promise<void>((resolve) => {
        this.awaitingFire = resolve;
      });
      view.setAimDragHandler((aim) => this.setAim(aim));
      this.pushStatus(true);
      this.drawPreview(team);
      this.sayFirstGo(team);
      await fired;
      this.live();
      this.hintDone.add(team);
      const spot = this.pendingDash;
      const recall = this.pendingRecall;
      this.pendingDash = null;
      this.pendingRecall = false;
      if (spot) {
        await this.dashGo(team, spot);
        return;
      }
      if (recall) {
        await this.recallGo(team);
        return;
      }
    }
    await this.launch(team);
  }

  private isComputer(team: Team): boolean {
    return isComputerTurn(this.deps.practice ?? null, team);
  }

  /**
   * The Computer player picks a fighter and an aim, then the dial and power meter move there by
   * themselves while a short "thinking" note shows. The picture of the shot (the dotted preview)
   * stays off, and the keyboard and sliders stay locked because Fire is never turned on.
   */
  private async computerAims(team: Team): Promise<void> {
    const { match, view, overlay, practice } = this.deps;
    if (!practice) return;
    const snap = match.snapshot();
    const shot = chooseShot(snap, team, practice.level, this.botRng, {
      layout: match.layout,
      ...(practice.effects ? { effects: practice.effects } : {}),
    });
    try {
      match.selectUnit(shot.unit);
      view.setSelectedUnit(team, shot.unit);
    } catch {
      // The default fighter stays up. The aim below is still legal.
    }
    view.showPreview(team, null);
    this.pushStatus(false);
    overlay.showThinking?.({ text: COMPUTER.aiming, team });
    const total = aimDurationMs(practice.level);
    const reduced = this.deps.reducedMotion?.() === true;
    const steps = reduced
      ? [{ angleDeg: shot.angleDeg, power: shot.power }]
      : aimSteps(match.snapshot().aim[team], shot, PRACTICE_BOT.pace.aimSteps);
    const beat = reduced ? PRACTICE_BOT.pace.reducedBeatMs : Math.floor(total / steps.length);
    try {
      for (const step of steps) {
        await this.deps.wait(beat);
        await this.gate();
        match.setAim(step);
        this.pushStatus(false);
      }
      this.thinkingSpentMs += beat * steps.length;
    } finally {
      overlay.showThinking?.(null);
    }
  }

  /** Squads S1: one dash go. The rules apply it now; the dasher walks out over anything in the way. */
  private async dashGo(team: Team, spot: string): Promise<void> {
    const { match, view, overlay, audio } = this.deps;
    view.setAimDragHandler(null);
    view.showPreview(team, null);
    const out = match.dash(spot);
    const name = SQUAD_COPY.helperName[out.helper] ?? '';
    overlay.setCaption(SQUAD_COPY.walked(name));
    audio?.playSfx('step');
    await this.holdField(async () => {
      this.pushStatus(false);
      await view.walkDasher?.(team, this.home(team), this.spotAt(out.to), false);
    });
    this.live();
    this.pushStatus(false);
    await this.deps.wait(IMPACT_BEAT_MS);
    this.live();
    overlay.setCaption(null);
  }

  /** Squads S1: one Come back go. The dasher walks home and is ready again next turn. */
  private async recallGo(team: Team): Promise<void> {
    const { match, view, overlay, audio } = this.deps;
    view.setAimDragHandler(null);
    view.showPreview(team, null);
    const back = match.recall();
    const name = SQUAD_COPY.helperName[back.helper] ?? '';
    overlay.setCaption(SQUAD_COPY.cameBack(name));
    audio?.playSfx('step');
    await this.holdField(async () => {
      this.pushStatus(false);
      await view.walkDasher?.(team, this.spotAt(back.from), this.home(team), false);
    });
    this.live();
    this.pushStatus(false);
    await this.deps.wait(IMPACT_BEAT_MS);
    this.live();
    overlay.setCaption(null);
  }

  /** The bonks at the start of a turn, one after another, each with a caption. */
  private async playStand(beats: readonly StandBonk[]): Promise<void> {
    if (beats.length === 0) return;
    const { view, overlay, audio, match } = this.deps;
    // A duel lists both dashers. Each one's spot is where the other bonks.
    const spotOf = new Map(beats.map((b) => [b.team, b.to]));
    await this.holdField(async () => {
      for (const b of beats) {
        await this.gate();
        const name = SQUAD_COPY.helperName[b.helper] ?? '';
        if (b.from !== b.to) {
          audio?.playSfx('step');
          await view.walkDasher?.(b.team, this.spotAt(b.from), this.spotAt(b.to), false);
          this.live();
        }
        const t = b.target;
        const foe: Team = b.team === 'PAST' ? 'FUTURE' : 'PAST';
        const toward =
          t.kind === 'base' ? this.baseFront(t.team) : this.spotAt(spotOf.get(foe) ?? b.to);
        audio?.playSfx('bonk');
        overlay.setCaption(
          t.kind === 'helper'
            ? SQUAD_COPY.bonkHelper(name)
            : t.dodged
              ? SQUAD_COPY.bonkDodged
              : t.blocked
                ? SQUAD_COPY.bonkBlocked
                : SQUAD_COPY.bonkBase(name),
        );
        await view.playDasherBonk?.(b.team, toward, SQUAD_COPY.bonkWord);
        this.live();
        if (t.kind === 'base') {
          if (t.dodged) await view.playDodge?.(t.team);
          // The base health tag and the HUD show the new number.
          this.pushStatus(false);
          if (t.damage > 0) {
            await view.playImpact({
              kind: 'puff',
              position: toward,
              target: t.team,
              shooter: b.team,
              result: match.snapshot().baseHp[t.team] <= 0 ? 'direct' : 'near',
              damage: t.damage,
              scale: 0.5,
              label: '',
            });
          }
          this.live();
          await this.playBricks(t.team, t.built);
        } else if (t.tumbled) {
          await this.dasherTumbles(foe, spotOf.get(foe) ?? b.to, t.bubbleIndex);
        }
      }
    });
    this.live();
    this.pushStatus(false);
    await this.deps.wait(IMPACT_BEAT_MS);
    this.live();
    overlay.setCaption(null);
  }

  /** A shell landed near a dasher: he wobbles, loses a heart, or tumbles home dizzy. */
  private async dasherShellHit(hit: NonNullable<BlastOutcome['dasher']>): Promise<void> {
    const { view, overlay, audio } = this.deps;
    const name = SQUAD_COPY.helperName[hit.helper] ?? '';
    await this.holdField(async () => {
      if (hit.tumbled) {
        await this.dasherTumbles(hit.team, hit.at, hit.bubbleIndex);
        return;
      }
      audio?.playSfx('boing');
      overlay.setCaption(hit.damage > 0 ? SQUAD_COPY.loseHeart(name) : SQUAD_COPY.wobble(name));
      await view.playDasherHit?.(hit.team, 'wobble', null);
    });
    this.live();
    this.pushStatus(false);
  }

  /** A dasher at 0: a silly tumble, a funny line (spoken when clips are on, always captioned), then a dizzy walk home. */
  private async dasherTumbles(team: Team, spot: string, bubbleIndex: number | null): Promise<void> {
    const { view, overlay, audio } = this.deps;
    const name = SQUAD_COPY.helperName[`${team}-dasher`] ?? '';
    audio?.playSfx('boing');
    const line = bubbleIndex === null ? null : (tumblePool(team)[bubbleIndex] ?? null);
    const text = line ? `${SQUAD_COPY.tumbleHome(name)} ${line}` : SQUAD_COPY.tumbleHome(name);
    overlay.setCaption(text);
    if (line && audio?.clipsEnabled) {
      const durationMs = Math.max(1500, line.split(/\s+/).length * 450);
      audio.speak({
        id: 'tumble-line',
        text: line,
        captions: [{ text: line, startMs: 0 }],
        durationMs,
      });
    }
    await view.playDasherHit?.(team, 'tumble', null);
    this.live();
    await view.walkDasher?.(team, this.spotAt(spot), this.home(team), true);
    this.live();
  }

  /** Runs `fn` while status pushes leave the dashers where the animation put them. */
  private async holdField(fn: () => Promise<void>): Promise<void> {
    this.fieldHeld++;
    try {
      await fn();
    } finally {
      this.fieldHeld--;
    }
  }

  private spotAt(spot: string): Vec2 {
    return groundSpotPoint(spot, this.deps.match.layout);
  }

  private home(team: Team): Vec2 {
    return dasherHomePoint(team, this.deps.match.layout);
  }

  /** The ground in front of a base, where a bonk lands. */
  private baseFront(team: Team): Vec2 {
    const b = this.deps.match.layout.bases[team];
    const y = this.deps.match.layout.terrain.ground[0]?.y ?? b.y + b.h;
    return { x: team === 'PAST' ? b.x + b.w : b.x, y: y - 40 };
  }

  /** What the field shows for Squads: both dashers, the spot markers, and the target spot. */
  private squadField(canFire: boolean): SquadField | null {
    const { match } = this.deps;
    const s = match.snapshot();
    if (!s.squads) return null;
    const crew = s.squads.crew;
    const target = canFire ? match.helperTargets()[0] : undefined;
    return {
      dashers: (['PAST', 'FUTURE'] as const).map((team) => {
        const d = dasherOf(crew, team);
        return {
          team,
          at: d.state === 'out' && d.spot ? this.spotAt(d.spot) : this.home(team),
          state: d.state,
          hp: d.hp,
          maxHp: s.squads!.maxHp,
        };
      }),
      spots: groundSpotIds().map((id) => ({ id, at: this.spotAt(id), doorstepOf: doorstepOf(id) })),
      target: target ? this.spotAt(target) : null,
    };
  }

  /** Fire the shot already aimed in the rules layer, fly it, and apply it. */
  private async launch(team: Team): Promise<void> {
    const { match, view, audio } = this.deps;
    view.setAimDragHandler(null);
    view.showPreview(team, null);
    this.pushStatus(false);
    await this.gate();
    // The wind-up: Fire is already off, and the shot is not taken until the glow is done.
    await view.playCharge(team, this.originFor(team));
    await this.gate();
    // The shot meets the birds where they are drawn now (the bird clock), then recoil kicks the aim.
    const kickedFrom = { ...match.snapshot().aim[team] };
    const result = match.fire({ birdMs: view.birdClockMs?.() ?? 0 });
    const kickedTo = { ...match.snapshot().aim[team] };
    audio?.playSfx(team === 'PAST' ? 'cannonBoom' : 'laserPew');
    this.pushStatus(false, kickedFrom);
    const unit = unitById(match.snapshot().selected[team]);
    await Promise.all([
      view.animateShot(team, result, unit ? kindForRole(unit.role) : undefined),
      this.flightCues(result),
      this.slideRecoil(kickedFrom, kickedTo),
    ]);
    this.live();
    // The whole arc stays up as a guide for the next shot. A cover clears it first.
    view.showTrace(team, traceDots(result.path));

    const ammo = match.snapshot().lastShot?.ammo;
    const outcome = match.shotLanded();
    audio?.playSfx('thud');
    this.pushStatus(false);
    const label = outcome.dodged
      ? GEAR_COPY.dodgedLine
      : HIT_LINES[outcome.result][this.hitBags[outcome.result].next()];
    if (outcome.dodged) await view.playDodge?.(outcome.target);
    const impact = describeImpact(team, result, outcome, label);
    // Confetti and plasma ammo burst in their own colors when they land near a base.
    if ((ammo === 'confetti' || ammo === 'plasma') && outcome.result !== 'miss') impact.kind = ammo;
    await view.playImpact(impact);
    this.live();
    await this.playBricks(outcome.target, outcome.built);
    await this.deps.wait(IMPACT_BEAT_MS);
    this.live();

    if (outcome.dasher) await this.dasherShellHit(outcome.dasher);

    const tumbler = tumblingTeam(outcome);
    if (tumbler) {
      audio?.playSfx('boing');
      await view.playTumble(tumbler);
      this.live();
      const text = bubbleText(outcome);
      if (text) {
        // The funny line is also spoken when the voice service is set up. The bubble is its
        // caption. A new fall stops the old line (one voice at a time). Muted stays silent.
        if (audio?.clipsEnabled) {
          const durationMs = Math.max(1500, text.split(/\s+/).length * 450);
          audio.speak({ id: 'tumble-line', text, captions: [{ text, startMs: 0 }], durationMs });
        }
        this.deps.overlay.showSpeechBubble({
          text,
          team: tumbler,
          anchor: bubbleAnchor(tumbler, match.layout),
          tailTarget: bubbleTailTarget(tumbler, match.layout, true),
        });
      }
    }
  }

  /**
   * The bird bumps and the gust, each at its moment in the flight: a picture, a word and a sound
   * (the word shows even when sound is off). Never throws, so it cannot stop the shot.
   */
  private async flightCues(result: ShotResult): Promise<void> {
    const { view, audio } = this.deps;
    const cues: Array<{ step: number; play: () => void }> = [];
    for (const b of result.bumps ?? []) {
      cues.push({
        step: b.step,
        play: () => {
          view.playBirdBump?.(b);
          audio?.playSfx('squawk');
        },
      });
    }
    const gust = result.gust;
    if (gust) {
      cues.push({
        step: gust.fromStep,
        play: () => {
          view.playGust?.(gust);
          audio?.playSfx('whoosh');
        },
      });
    }
    cues.sort((a, b) => a.step - b.step);
    let doneMs = 0;
    for (const cue of cues) {
      const at = cue.step * STEP_MS;
      await this.deps.wait(Math.max(0, at - doneMs));
      doneMs = Math.max(doneMs, at);
      if (this.stopped) return;
      cue.play();
    }
  }

  /** Recoil: the Angle and Power dials slide to the kicked aim. Reduced motion: they jump. */
  private async slideRecoil(from: AimInput, to: AimInput): Promise<void> {
    if (from.angleDeg === to.angleDeg && from.power === to.power) return;
    const reduced = this.deps.reducedMotion?.() === true;
    const steps = reduced ? 1 : DISTURBANCE.recoilSlideSteps;
    for (let i = 1; i <= steps; i++) {
      if (!reduced) await this.deps.wait(DISTURBANCE.recoilSlideMs / steps);
      if (this.stopped) return;
      const k = i / steps;
      this.pushStatus(false, {
        angleDeg: Math.round(from.angleDeg + (to.angleDeg - from.angleDeg) * k),
        power: Math.round(from.power + (to.power - from.power) * k),
      });
    }
  }

  private async finish(): Promise<void> {
    const { match, overlay, audio } = this.deps;
    const snap = match.snapshot();
    audio?.playSfx('cheer');
    await this.deps.wait(WIN_BEAT_MS);
    this.live();
    overlay.hideHud();
    if (snap.winner) {
      this.deps.onFinished({
        winner: snap.winner,
        names: this.names(),
        stats: snap.stats,
        rematch: match.rematchOptions(),
      });
    }
  }

  /** The learning moment. A wrong answer still reloads (Gate 2). */
  /** Returns true when a right answer earned the Power Shot. */
  private async reload(team: Team): Promise<boolean> {
    // The question cover goes up next: nothing about the last shot stays on the board.
    this.deps.view.showTrace(team, null);
    if (this.isComputer(team)) return this.computerReload(team);
    const { match, overlay, view, audio, bank } = this.deps;
    const player = match.snapshot().players[team === 'PAST' ? 0 : 1];
    let answer: { correct: boolean; elapsedMs: number } = { correct: false, elapsedMs: Infinity };
    let asked: { kind: string; grade: number } | null = null;
    try {
      // Ask at this player's own level nudge for the subject actually asked.
      const subject = pickSubject(
        bank,
        { subject: player.subject, grade: player.grade, who: team },
        this.history,
      );
      const grade = effectiveGrade(
        player.grade,
        levelOffset(recordFor(this.levels, player.name, subject)),
      );
      const pick = pickQuestion(
        bank,
        { subject, grade, who: team },
        this.history,
        this.questionRng,
      );
      this.history = pick.history;
      this.deps.onHistory?.(pick.history);
      asked = { kind: pick.question.kind, grade: pick.question.grade };
      await this.gate();
      answer = await overlay.showReloadModal({
        question: pick.question,
        team,
        playerName: player.name,
        waiting: {
          team: team === 'PAST' ? 'FUTURE' : 'PAST',
          name: match.snapshot().players[team === 'PAST' ? 1 : 0].name,
        },
        quip: (kind) => RELOAD_QUIPS[kind][this.quipBags[kind].next()] ?? null,
      });
      this.live();
      this.levels = withRecord(
        this.levels,
        player.name,
        pick.subjectUsed,
        recordAnswer(recordFor(this.levels, player.name, pick.subjectUsed), answer.correct),
      );
      this.deps.onLevels?.(this.levels);
      if (!answer.correct) {
        this.history = noteMissed(this.history, pick.question.id);
        this.deps.onHistory?.(this.history);
      }
    } catch (e) {
      if (e instanceof Stopped) throw e;
      // No question must never stop play: reload with no scrap, and say so out loud.
      overlay.setCaption(RELOAD_COPY.lostQuestion);
    }
    const score = match.reloadDone({
      correct: answer.correct,
      elapsedMs: answer.elapsedMs,
      ...(asked ?? {}),
    });
    if (!answer.correct) audio?.playSfx('clunk');
    this.pushStatus(false);
    if (score.scrap > 0) {
      view.showScrapPopup(team, score.scrap);
      await this.deps.wait(SCRAP_POPUP_MS);
      this.live();
    }
    return score.bonus;
  }

  /**
   * The Computer player answers its own question. The child sees only a "thinking" note: no
   * question, no choices, no answer. A wrong answer still reloads (Gate 2). It leaves the
   * child's question history and level nudges alone.
   */
  private async computerReload(team: Team): Promise<boolean> {
    const { match, overlay, view, audio, bank, practice } = this.deps;
    if (!practice) return false;
    const player = match.snapshot().players[team === 'PAST' ? 0 : 1];
    let outcome: { correct: boolean; elapsedMs: number } = { correct: false, elapsedMs: Infinity };
    let asked: { kind: string; grade: number } | null = null;
    try {
      const subject = pickSubject(
        bank,
        { subject: player.subject, grade: player.grade, who: team },
        this.history,
      );
      const pick = pickQuestion(
        bank,
        { subject, grade: player.grade, who: team },
        this.history,
        this.botRng,
      );
      const q = pick.question;
      asked = { kind: q.kind, grade: q.grade };
      const reply = answerReload(
        { grade: q.grade, kind: q.kind, choices: q.choices, answer: q.answer },
        practice.level,
        this.botRng,
      );
      const wait = reloadWaitMs(reply.delayMs, this.thinkingSpentMs, aimDurationMs(practice.level));
      overlay.showThinking?.({ text: COMPUTER.thinking, team });
      try {
        await this.deps.wait(
          this.deps.reducedMotion?.() === true
            ? Math.min(wait, PRACTICE_BOT.pace.reducedBeatMs)
            : wait,
        );
        await this.gate();
      } finally {
        overlay.showThinking?.(null);
      }
      this.thinkingSpentMs += wait;
      outcome = { correct: reply.correct, elapsedMs: reply.delayMs };
    } catch (e) {
      if (e instanceof Stopped) throw e;
      // No question must never stop play: reload with no scrap.
    }
    const score = match.reloadDone({
      correct: outcome.correct,
      elapsedMs: outcome.elapsedMs,
      ...(asked ?? {}),
    });
    if (!outcome.correct) audio?.playSfx('clunk');
    this.pushStatus(false);
    if (score.scrap > 0) {
      view.showScrapPopup(team, score.scrap);
      await this.deps.wait(SCRAP_POPUP_MS);
      this.live();
    }
    return score.bonus;
  }

  // ---------- player input ----------

  private hudHandlers(): HudHandlers {
    return {
      onAim: (aim) => this.setAim(aim),
      onFire: () => {
        const go = this.awaitingFire;
        if (!go) return;
        this.awaitingFire = null;
        go();
      },
      onSelect: (id) => this.selectUnit(id),
      onMuteToggle: () => this.deps.onMuteToggle?.(),
      onAmmo: (id) => this.selectAmmo(id),
      onEvasion: () => this.toggleEvasion(),
      onHelper: (id) => this.pickHelper(id),
      onHearHelper: () => this.hearHelper(),
      onDash: (spot) => {
        const go = this.awaitingFire;
        if (!go || this.stopped) return;
        this.pendingDash = spot;
        this.awaitingFire = null;
        go();
      },
      onRecall: () => {
        const go = this.awaitingFire;
        if (!go || this.stopped) return;
        this.pendingRecall = true;
        this.awaitingFire = null;
        go();
      },
    };
  }

  private selectAmmo(id: AmmoId): void {
    if (!this.awaitingFire || this.stopped) return;
    try {
      this.deps.match.selectAmmo(id);
    } catch {
      return; // not owned, none left, or the wrong phase; ignore
    }
    this.drawPreview(this.deps.match.snapshot().turn.team);
    this.pushStatus(true);
  }

  /** Arms the evasion ability, or takes it back if it was armed this turn. */
  private toggleEvasion(): void {
    if (!this.awaitingFire || this.stopped) return;
    const { match, overlay, audio } = this.deps;
    const s = match.snapshot();
    const mine = s.evasion[s.turn.team];
    try {
      if (mine.phase === 'armed') {
        match.disarmEvasion();
      } else {
        match.armEvasion();
        // Chrono says what it does, with a caption, so a pre-reader knows it worked.
        const text = GEAR_COPY.armedLine[mine.id];
        overlay.setCaption(text);
        audio?.speak?.(
          {
            id: `evasion-${mine.id}`,
            text,
            captions: timeCaptions([text], 2500),
            durationMs: 2500,
          },
          { onCaption: (t) => overlay.setCaption(t) },
        );
      }
    } catch {
      return; // not ready yet, used up, or the wrong phase; ignore
    }
    this.pushStatus(true);
  }

  /** The first-go hint shows on a side's first go of the match, for people only. */
  private showsHint(team: Team, goesDone: number): boolean {
    return goesDone === 0 && !this.hintDone.has(team) && !this.isComputer(team);
  }

  /** Chrono says the hint once, with a caption. Sound still waits for the first tap (the pass screen is one). */
  private sayFirstGo(team: Team): void {
    const s = this.deps.match.snapshot();
    if (!s.squads || !this.showsHint(team, s.turn.shotsFired)) return;
    this.speakCaptioned('squad-first-go', SQUAD_COPY.firstGo);
  }

  /** Hear it: Chrono says the picked helper's name and what it does, with a caption. Free, no go. */
  private hearHelper(): void {
    if (!this.awaitingFire || this.stopped) return;
    const { match } = this.deps;
    const s = match.snapshot();
    if (!s.squads) return;
    const picked = s.squads.crew.helpers.find((x) => x.id === s.squads!.picked[s.turn.team]);
    if (!picked) return;
    const name = SQUAD_COPY.helperName[picked.id] ?? picked.id;
    this.speakCaptioned(`squad-hear-${picked.id}`, SQUAD_COPY.hearLine(picked.kind, name));
  }

  private speakCaptioned(id: string, text: string): void {
    const { overlay, audio } = this.deps;
    overlay.setCaption(text);
    try {
      audio?.speak?.(
        { id, text, captions: timeCaptions([text], 2500), durationMs: 2500, noClip: true },
        { onCaption: (t) => overlay.setCaption(t) },
      );
    } catch {
      /* no voice: the caption still shows */
    }
  }

  private pickHelper(id: string): void {
    if (!this.awaitingFire || this.stopped) return;
    try {
      this.deps.match.selectHelper(id as HelperId);
    } catch {
      return; // wrong phase, other side's helper, or squads off; ignore
    }
    this.pushStatus(true);
  }

  private selectUnit(id: UnitId): void {
    if (!this.awaitingFire || this.stopped) return;
    const { match, view } = this.deps;
    try {
      match.selectUnit(id);
    } catch {
      return; // wrong phase, wrong team or unknown fighter; ignore
    }
    const team = match.snapshot().turn.team;
    this.drawPreview(team);
    view.setSelectedUnit(team, id);
    this.pushStatus(true);
  }

  private setAim(aim: AimInput): void {
    if (!this.awaitingFire || this.stopped) return;
    const { match } = this.deps;
    try {
      match.setAim(aim);
    } catch {
      return; // not the aiming phase any more; ignore
    }
    this.pushStatus(true);
    this.drawPreview(match.snapshot().turn.team);
  }

  // ---------- drawing ----------

  private names(): Record<Team, string> {
    const [past, future] = this.deps.match.snapshot().players;
    return { PAST: past.name, FUTURE: future.name };
  }

  /** `shownAim` draws the dials somewhere other than the real aim (only while recoil slides them). */
  private pushStatus(canFire: boolean, shownAim?: AimInput): void {
    const { match, overlay, view } = this.deps;
    const s = match.snapshot();
    const team = s.turn.team;
    const shotsLeft = Math.max(0, TURN.shotsPerTurn - s.turn.shotsFired) as 0 | 1 | 2;
    const aim = shownAim ?? s.aim[team];
    // The Scrap a player has in total: what they had before, plus what they earned in this match.
    const base = this.deps.scrapBase ?? { PAST: 0, FUTURE: 0 };
    const scrap = { PAST: base.PAST + s.scrap.PAST, FUTURE: base.FUTURE + s.scrap.FUTURE };
    const hud: HudState = {
      activeTeam: team,
      names: this.names(),
      baseHp: s.baseHp,
      maxBaseHp: s.maxBaseHp,
      scrap,
      wind: s.wind,
      angleDeg: aim.angleDeg,
      power: aim.power,
      shotsLeft,
      bonus: s.turn.phase === 'BONUS_AIMING' || s.turn.phase === 'BONUS_SHOT',
      canFire,
      selected: s.selected[team],
      units: unitsOf(team).map((u) => ({ id: u.id, name: u.name })),
      ...(this.deps.practice ? { computerTeam: this.deps.practice.team } : {}),
      gear: { ammo: s.ammo[team], ammoLeft: s.ammoLeft[team], evasion: s.evasion[team] },
      ...(s.squads
        ? {
            squads: {
              goesDone: s.turn.shotsFired,
              helpers: s.squads.crew.helpers
                .filter((x) => x.team === team)
                .map((x) => ({
                  id: x.id,
                  kind: x.kind,
                  name: SQUAD_COPY.helperName[x.id] ?? x.id,
                })),
              picked: s.squads.picked[team],
              targets: canFire ? match.helperTargets() : [],
              dasher: {
                state: dasherOf(s.squads.crew, team).state,
                hp: dasherOf(s.squads.crew, team).hp,
                maxHp: s.squads.maxHp,
              },
              hint: canFire && this.showsHint(team, s.turn.shotsFired),
            },
          }
        : {}),
    };
    overlay.updateHud(hud);
    if (this.fieldHeld === 0) view.syncSquads?.(this.squadField(canFire));
    // A stone wall stands only while a barricade guards its base.
    view.setWalls?.(
      (['PAST', 'FUTURE'] as const)
        .filter((t) => s.evasion[t].id === 'barricade' && s.evasion[t].phase === 'active')
        .map(() => ({ ...EVASION.barricade.wall })),
    );
    const status: ViewStatus = {
      activeTeam: team,
      names: hud.names,
      baseHp: s.baseHp,
      maxBaseHp: s.maxBaseHp,
      scrap,
      wind: s.wind,
      shotsLeft,
      aim,
      firingOrigin: this.originFor(team),
    };
    view.syncStatus(status);
  }

  private drawPreview(team: Team): void {
    const { match, view } = this.deps;
    // The rules layer flies it, so the guide matches the real shot: fighter range, ammo, walls.
    const sim = match.previewShot();
    view.showPreview(team, previewDots(sim.path));
  }

  /** Same function match.fire() uses, so the preview and the guide start at the real muzzle. */
  private originFor(team: Team) {
    const { match } = this.deps;
    return firingOrigin(team, match.snapshot().selected[team], match.layout);
  }

  /** Built bases: the hit bricks show their wear, and fallen ones crumble. Nothing if no bricks changed. */
  private async playBricks(team: Team, built: BuiltEvents | undefined): Promise<void> {
    if (!built || (built.brickHits.length === 0 && built.bricksFell.length === 0)) return;
    const bricks = this.deps.match.snapshot().bricks;
    if (!bricks) return;
    await this.deps.view.playBricks?.(team, built.bricksFell, bricks);
    this.live();
  }

  // ---------- helpers ----------

  private live(): void {
    if (this.stopped) throw new Stopped();
  }

  private async gate(): Promise<void> {
    await this.deps.waitIfPaused?.();
    this.live();
  }
}
