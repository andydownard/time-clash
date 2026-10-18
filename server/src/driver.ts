// The authoritative match. Wraps the shared pure rules (src/game, src/questions) and decides
// what each seat may see. It holds the only copy of the open reload question and its answer.
import { DEFAULT_NAMES } from '../../src/game/config';
import { createMatch } from '../../src/game/match';
import { createRng } from '../../src/game/rng';
import { unitById } from '../../src/game/units';
import { IllegalTransitionError, MatchOverError } from '../../src/game/types';
import type {
  Grade,
  Match,
  MatchController,
  MatchOptions,
  Players,
  Rng,
} from '../../src/game/types';
import { isCorrect, noteMissed, pickQuestion } from '../../src/questions/pick';
import { EMPTY_HISTORY } from '../../src/questions/types';
import type { PickHistory, Question, QuestionBank } from '../../src/questions/types';
import type { ErrorCode, Subject, Team } from './protocol';

export type Seat = 0 | 1;
export type ServerMessage = { v: 1; t: string; [key: string]: unknown };
export type Outbound = { to: Seat | 'both'; msg: ServerMessage };
export type DriverResult = { ok: true; out: Outbound[] } | { ok: false; code: ErrorCode };

export type SeatProfile = { team: Team; grade: number; subject: Subject; name?: string };

export type DriverOptions = {
  bank: QuestionBank;
  profiles: readonly [SeatProfile, SeatProfile];
  /** Picks the match seed and question seed. Never sent to a client. */
  seeds: () => number;
  now: () => number;
  /** For a rematch: options from the finished match, plus kept question history. */
  previous?: { options: MatchOptions; history: readonly [PickHistory, PickHistory] };
};

type Pending = {
  seat: Seat;
  question: Question;
  choices: string[];
  grade: Grade;
  issuedAt: number;
};

const msg = (t: string, fields: Record<string, unknown>): ServerMessage => ({ v: 1, t, ...fields });
const round1 = (n: number): number => Math.round(n * 10) / 10;

export class MatchDriver {
  private readonly match: MatchController;
  private readonly teams: readonly [Team, Team];
  private readonly rng: Rng;
  private history: [PickHistory, PickHistory];
  private pending: Pending | null = null;
  private rev = 0;
  private readonly profiles: readonly [SeatProfile, SeatProfile];

  constructor(private readonly opts: DriverOptions) {
    this.profiles = opts.profiles;
    this.teams = [opts.profiles[0].team, opts.profiles[1].team];
    const asPlayer = (p: SeatProfile) => ({
      name: p.name ?? DEFAULT_NAMES[p.team],
      team: p.team,
      grade: p.grade as Grade,
      subject: p.subject,
    });
    // MatchOptions.players is always [Past, Future].
    const bySeat = opts.profiles.map(asPlayer);
    const past = bySeat.find((p) => p.team === 'PAST')!;
    const future = bySeat.find((p) => p.team === 'FUTURE')!;
    const players: Players = [past, future];
    this.match = createMatch(opts.previous?.options ?? { players, seed: opts.seeds() });
    this.match.ready(); // two iPads need no pass screen
    this.rng = createRng(opts.seeds());
    this.history = opts.previous
      ? [opts.previous.history[0], opts.previous.history[1]]
      : [EMPTY_HISTORY, EMPTY_HISTORY];
  }

  /** What a rematch needs: the options and the question history so far. */
  rematch(): NonNullable<DriverOptions['previous']> {
    return { options: this.match.rematchOptions(), history: [this.history[0], this.history[1]] };
  }

  get snapshot(): Match {
    return this.match.snapshot();
  }

  get turnNumber(): number {
    return this.match.snapshot().turn.turnNumber;
  }

  get over(): boolean {
    return this.match.snapshot().status === 'OVER';
  }

  seatOf(team: Team): Seat {
    return this.teams[0] === team ? 0 : 1;
  }

  /** The public state for one seat. No seed, no question. */
  state(seat: Seat): ServerMessage {
    const m = this.match.snapshot();
    return msg('state', {
      rev: this.rev,
      phase: m.turn.phase,
      activeSeat: this.seatOf(m.turn.team),
      status: m.status,
      winner: m.winner,
      turnNumber: m.turn.turnNumber,
      shotsFired: m.turn.shotsFired,
      bonus: m.turn.bonus,
      wind: m.wind,
      baseHp: m.baseHp,
      maxBaseHp: m.maxBaseHp,
      scrap: m.scrap,
      stats: m.stats,
      names: { PAST: m.players[0].name, FUTURE: m.players[1].name },
      you: { seat, team: this.teams[seat] },
    });
  }

  /** The open question, for the seat whose turn it is. Null for anyone else. */
  questionFor(seat: Seat): ServerMessage | null {
    const p = this.pending;
    if (!p || p.seat !== seat) return null;
    const q = p.question;
    return msg('question', {
      turn: this.turnNumber,
      kind: q.kind,
      prompt: q.prompt,
      choices: p.choices,
      ...(q.passage !== undefined ? { passage: q.passage } : {}),
      ...(q.audioWord !== undefined ? { audioWord: q.audioWord } : {}),
      grade: p.grade,
    });
  }

  /** Everything a seat needs to catch up after a reconnect. */
  sync(seat: Seat): ServerMessage[] {
    const out = [this.state(seat)];
    const q = this.questionFor(seat);
    if (q) out.push(q);
    return out;
  }

  private bump(): void {
    this.rev += 1;
  }

  private checkTurn(seat: Seat, turn: number): ErrorCode | null {
    const m = this.match.snapshot();
    if (m.status === 'OVER') return 'wrong_phase';
    if (turn !== m.turn.turnNumber) return 'stale_turn';
    if (this.teams[seat] !== m.turn.team) return 'not_your_turn';
    return null;
  }

  fire(
    seat: Seat,
    turn: number,
    input: { angleDeg: number; power: number; unit?: string },
  ): DriverResult {
    const bad = this.checkTurn(seat, turn);
    if (bad) return { ok: false, code: bad };
    const phase = this.match.snapshot().turn.phase;
    if (phase !== 'AIMING' && phase !== 'BONUS_AIMING') return { ok: false, code: 'wrong_phase' };
    const team = this.teams[seat];
    if (input.unit !== undefined) {
      const unit = unitById(input.unit);
      if (!unit || unit.team !== team) return { ok: false, code: 'bad_message' };
    }
    try {
      if (input.unit !== undefined) this.match.selectUnit(input.unit as never);
      const aim = this.match.setAim({ angleDeg: input.angleDeg, power: input.power });
      const shot = this.match.fire();
      const last = this.match.snapshot().lastShot!;
      const blast = this.match.shotLanded();
      this.bump();
      const out: Outbound[] = [
        {
          to: 'both',
          msg: msg('shot', {
            rev: this.rev,
            team,
            angleDeg: aim.angleDeg,
            power: aim.power,
            unit: last.unit,
            path: shot.path.map((p) => [round1(p.x), round1(p.y)]),
            landing: { x: round1(shot.landing.x), y: round1(shot.landing.y) },
            hit: shot.hit,
            result: blast.result,
            damage: blast.damage,
            blocked: blast.blocked === true,
            tumble: blast.tumble,
            bubbleIndex: blast.bubbleIndex,
          }),
        },
      ];
      this.afterLanding(out);
      return { ok: true, out };
    } catch (e) {
      if (e instanceof IllegalTransitionError || e instanceof MatchOverError) {
        return { ok: false, code: 'wrong_phase' };
      }
      throw e;
    }
  }

  private afterLanding(out: Outbound[]): void {
    const m = this.match.snapshot();
    if (m.status !== 'OVER' && m.turn.phase === 'NEXT_PLAYER') {
      this.match.pass();
      this.match.ready();
    }
    this.bump();
    out.push({ to: 0, msg: this.state(0) }, { to: 1, msg: this.state(1) });
    const after = this.match.snapshot();
    if (after.status !== 'OVER' && after.turn.phase === 'RELOAD') {
      const seat = this.seatOf(after.turn.team);
      this.openQuestion(seat);
      out.push({ to: seat, msg: this.questionFor(seat)! });
    }
  }

  private openQuestion(seat: Seat): void {
    const profile = this.profiles[seat];
    const picked = pickQuestion(
      this.opts.bank,
      { subject: profile.subject, grade: profile.grade as Grade, who: profile.team },
      this.history[seat],
      this.rng,
    );
    this.history[seat] = picked.history;
    this.pending = {
      seat,
      question: picked.question,
      choices: this.rng.shuffle(picked.question.choices),
      grade: picked.gradeUsed,
      issuedAt: this.opts.now(),
    };
  }

  answer(seat: Seat, turn: number, choice: number): DriverResult {
    const bad = this.checkTurn(seat, turn);
    if (bad) return { ok: false, code: bad };
    const p = this.pending;
    if (!p || p.seat !== seat || this.match.snapshot().turn.phase !== 'RELOAD') {
      return { ok: false, code: 'wrong_phase' };
    }
    const picked = p.choices[choice];
    if (picked === undefined) return { ok: false, code: 'bad_message' };
    const correct = isCorrect(p.question, picked);
    // The server times the answer. The client's clock is never read.
    const elapsedMs = Math.max(0, this.opts.now() - p.issuedAt);
    const result = this.match.reloadDone({
      correct,
      elapsedMs,
      kind: p.question.kind,
      grade: p.grade,
    });
    this.pending = null;
    if (!correct) this.history[seat] = noteMissed(this.history[seat], p.question.id);
    this.bump();
    const out: Outbound[] = [];
    const publicReload = {
      rev: this.rev,
      team: this.teams[seat],
      correct,
      scrap: result.scrap,
      fast: result.fast,
      bonus: result.bonus,
    };
    // Only the player who answered gets the hint, and only after a wrong answer.
    out.push({
      to: seat,
      msg: msg('reload', {
        ...publicReload,
        ...(!correct && p.question.hint !== undefined ? { hint: p.question.hint } : {}),
      }),
    });
    out.push({ to: (seat === 0 ? 1 : 0) as Seat, msg: msg('reload', publicReload) });
    this.afterLanding(out);
    return { ok: true, out };
  }
}
