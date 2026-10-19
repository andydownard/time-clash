// BattleFlow: the whole battle loop with no Phaser in it.
// It talks to MatchController (rules), the Overlay (DOM), the BattleView (drawing) and audio.
// The loop follows docs/CONTRACTS.md:
//   pass screen -> ready() -> banner -> setAim/fire() -> animate path -> shotLanded()
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
import { PRACTICE_BOT, RNG_SALT, TEAM_FACING, TURN } from '../../game/config';
import { simulateShot } from '../../game/ballistics';
import { createShuffleBag } from '../../game/bag';
import { createRng } from '../../game/rng';
import type { AimInput, MatchController, Rng, Team } from '../../game/types';
import { HIT_LINES, RELOAD as RELOAD_COPY, RELOAD_QUIPS } from '../../data/copy';
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
import { previewDots } from './trajectory';
import { bubbleText, tumblingTeam } from './tumble';
import type { BattleResult, BattleView, ViewStatus } from './types';
import { IMPACT_BEAT_MS, SCRAP_POPUP_MS, WIN_BEAT_MS } from './visual';

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
    Partial<Pick<AudioManager, 'setMusicTeam' | 'stopMusic'>>;
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
    await this.gate();
    // One child alone has nobody to hide the screen from, so there is no cover in this mode.
    if (needsPassScreen(this.deps.practice ?? null)) {
      await overlay.showPassScreen({ nextName: names[team], nextTeam: team });
      this.live();
    }
    this.thinkingSpentMs = 0;
    match.ready();
    view.setActiveTeam(team);
    this.deps.audio?.setMusicTeam?.(team);

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
      await fired;
      this.live();
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

  /** Fire the shot already aimed in the rules layer, fly it, and apply it. */
  private async launch(team: Team): Promise<void> {
    const { match, view, audio } = this.deps;
    view.setAimDragHandler(null);
    view.showPreview(team, null);
    this.pushStatus(false);
    await this.gate();
    const result = match.fire();
    audio?.playSfx(team === 'PAST' ? 'cannonBoom' : 'laserPew');
    this.pushStatus(false);
    const unit = unitById(match.snapshot().selected[team]);
    await view.animateShot(team, result, unit ? kindForRole(unit.role) : undefined);
    this.live();

    const outcome = match.shotLanded();
    audio?.playSfx('thud');
    this.pushStatus(false);
    const label = HIT_LINES[outcome.result][this.hitBags[outcome.result].next()];
    await view.playImpact(describeImpact(team, result, outcome, label));
    this.live();
    await this.deps.wait(IMPACT_BEAT_MS);
    this.live();

    const tumbler = tumblingTeam(outcome);
    if (tumbler) {
      audio?.playSfx('boing');
      await view.playTumble(tumbler);
      this.live();
      const text = bubbleText(outcome);
      if (text) {
        this.deps.overlay.showSpeechBubble({
          text,
          team: tumbler,
          anchor: bubbleAnchor(tumbler, match.layout),
          tailTarget: bubbleTailTarget(tumbler, match.layout, true),
        });
      }
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
        speak: (text, sentences) => {
          const durationMs = Math.max(1500, text.split(/\s+/).length * 450);
          audio?.speak(
            {
              id: 'read-question',
              text,
              captions: timeCaptions(sentences.length > 0 ? sentences : [text], durationMs),
              durationMs,
            },
            { onCaption: (t) => overlay.setCaption(t) },
          );
        },
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
    };
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

  private pushStatus(canFire: boolean): void {
    const { match, overlay, view } = this.deps;
    const s = match.snapshot();
    const team = s.turn.team;
    const shotsLeft = Math.max(0, TURN.shotsPerTurn - s.turn.shotsFired) as 0 | 1 | 2;
    const aim = s.aim[team];
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
    };
    overlay.updateHud(hud);
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
    const s = match.snapshot();
    const aim = s.aim[team];
    const sim = simulateShot({
      ...aim,
      origin: this.originFor(team),
      facing: TEAM_FACING[team],
      wind: s.wind,
      layout: match.layout,
    });
    view.showPreview(team, previewDots(sim.path));
  }

  /** Same function match.fire() uses, so the preview and the guide start at the real muzzle. */
  private originFor(team: Team) {
    const { match } = this.deps;
    return firingOrigin(team, match.snapshot().selected[team], match.layout);
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
