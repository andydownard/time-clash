// Fakes and helpers for driving BattleFlow in plain Vitest. No Phaser, no DOM.
import { simulateShot } from '../../../src/game/ballistics';
import { DAMAGE, LAUNCH_ORIGINS, PHASE1_LAYOUT, TEAM_FACING } from '../../../src/game/config';
import { classifyBlast } from '../../../src/game/damage';
import { DEFAULT_EFFECTS } from '../../../src/game/loadout';
import { createMatch } from '../../../src/game/match';
import type {
  AimInput,
  BlastResult,
  MatchController,
  MatchOptions,
  MountId,
  Players,
  ShooterId,
  Team,
} from '../../../src/game/types';
import { windForTurn } from '../../../src/game/wind';
import type { Levels } from '../../../src/questions/calibration';
import { BANK } from '../../../src/questions/bank';
import { EMPTY_HISTORY, type PickHistory, type Question } from '../../../src/questions/types';
import { BattleFlow, type FlowDeps } from '../../../src/scenes/battle/flow';
import type {
  BattleResult,
  BattleView,
  ImpactInfo,
  PreviewDot,
  SquadField,
  ViewStatus,
} from '../../../src/scenes/battle/types';
import type { UnitId } from '../../../src/game/units';
import type { RiderFall } from '../../../src/scenes/battle/riderFalls';
import type { SfxName, VoiceLine } from '../../../src/audio/types';
import type { HudHandlers, HudState, ReloadAnswer } from '../../../src/ui/types';

export const PLAYERS: Players = [
  { name: 'Alex', team: 'PAST', grade: 2, subject: 'math' },
  { name: 'Sam', team: 'FUTURE', grade: 5, subject: 'reading' },
];

/** Direct hits that end a quick test match (the old full health of 100 was four hits). */
export const QUICK_END_HITS = 4;

/**
 * Match options for a flow test that must reach the end in a few scripted shots. Full health
 * is QUICK_END_HITS direct hits on each side. Everything else is a fresh game. The real pace
 * (DAMAGE.startingBaseHp) is played in tests/game/pace.test.ts.
 */
export const QUICK_END: Partial<MatchOptions> = {
  effects: {
    PAST: { ...DEFAULT_EFFECTS.PAST, maxHp: QUICK_END_HITS * DAMAGE.direct },
    FUTURE: { ...DEFAULT_EFFECTS.FUTURE, maxHp: QUICK_END_HITS * DAMAGE.direct },
  },
};

export type Log = string[];

export function makeWorld(
  opts: {
    seed?: number;
    /** Aims fired one by one. `pick` (a fighter or a weapon on a pad) is picked first. */
    script?: Array<AimInput & { pick?: ShooterId }>;
    answers?: Array<'right' | 'wrong'>;
    waitIfPaused?: () => Promise<void>;
    bank?: FlowDeps['bank'];
    matchOptions?: Partial<MatchOptions>;
    levels?: Levels;
    players?: Players;
    /** Runs inside the wind-up, before the shot is fired. */
    onCharge?: () => void;
    /** The voice service is set up, so funny lines are spoken. */
    clips?: boolean;
    /** Reduced motion on. */
    reduced?: boolean;
  } = {},
) {
  const log: Log = [];
  const sfx: SfxName[] = [];
  const impacts: ImpactInfo[] = [];
  const tumbles: Team[] = [];
  const bubbles: Array<{ text: string; team: Team }> = [];
  const scrapPopups: Array<{ team: Team; amount: number }> = [];
  const modalQuestions: Question[] = [];
  const impactLabels: string[] = [];
  const modalOptions: Array<Record<string, unknown>> = [];
  const captions: Array<string | null> = [];
  /** The caption bar's words each time a cover came up (pass screen or reload card). */
  const captionAtCover: Array<string | null> = [];
  const hudStates: HudState[] = [];
  const statuses: ViewStatus[] = [];
  const selections: Array<{ team: Team; id: UnitId }> = [];
  const shots: Array<{ team: Team; kind: string | undefined; start: { x: number; y: number } }> =
    [];
  const charges: Array<{
    team: Team;
    from: { x: number; y: number };
    sfxSoFar: number;
    canFireShown: boolean | undefined;
    shotsFired: number;
  }> = [];
  const previews: Array<{ team: Team; dots: readonly PreviewDot[] | null }> = [];
  const traces: Array<{ team: Team; points: readonly { x: number; y: number }[] | null }> = [];
  const histories: PickHistory[] = [];
  const levelsSaved: Levels[] = [];
  const results: BattleResult[] = [];
  /** Squads: every field the flow asked the view to draw. */
  const fields: Array<SquadField | null> = [];
  /** Built bases: every time the flow asked the view to redraw a side's bricks. */
  const brickPlays: Array<{ team: Team; fell: string[]; standing: number }> = [];
  /** Built bases: every fighter fall the flow asked the view to play. */
  const riderFalls: Array<{ team: Team; falls: RiderFall[] }> = [];
  /** Built bases: the weapon each side shows as picked, and every pad that flashed when it fired. */
  const mountSelections: Array<{ team: Team; id: MountId | null }> = [];
  const padFlashes: Array<{ team: Team; spot: number }> = [];
  let cover: 'pass' | 'reload' | null = null;
  const coverViolations: string[] = [];
  let handlers: HudHandlers | null = null;
  let dragHandler: ((aim: AimInput) => void) | null = null;
  let pickHandler: ((id: UnitId) => void) | null = null;
  const script = [...(opts.script ?? [])];
  const answers = [...(opts.answers ?? [])];

  const match: MatchController = createMatch({
    players: opts.players ?? PLAYERS,
    seed: opts.seed ?? 7,
    // The flow tests script exact hits, so birds, gusts and recoil stay off unless a test asks.
    disturbances: false,
    ...opts.matchOptions,
  });

  const guard = (what: string): void => {
    if (cover) coverViolations.push(`${what} while ${cover} cover up`);
  };

  const view: BattleView = {
    syncStatus: (s) => {
      guard('syncStatus');
      statuses.push(s);
    },
    setActiveTeam: (t) => log.push(`active:${t}`),
    showPreview: (team, dots) => previews.push({ team, dots }),
    showTrace: (team, points) => {
      if (points) guard('showTrace');
      traces.push({ team, points });
    },
    setAimDragHandler: (h) => {
      dragHandler = h;
    },
    setUnitPickHandler: (h) => {
      pickHandler = h;
    },
    setSelectedUnit: (team, id) => void selections.push({ team, id }),
    setSelectedMount: (team, id) => void mountSelections.push({ team, id }),
    flashPad: (team, spot) => {
      guard('flashPad');
      padFlashes.push({ team, spot });
      log.push(`pad:${team}:${spot}`);
    },
    animateShot: async (shooter, result, kind) => {
      guard('animateShot');
      shots.push({ team: shooter, kind, start: { ...result.path[0]! } });
      log.push(`fly:${shooter}`);
    },
    playCharge: async (team, from) => {
      guard('playCharge');
      charges.push({
        team,
        from: { ...from },
        sfxSoFar: sfx.length,
        canFireShown: hudStates[hudStates.length - 1]?.canFire,
        shotsFired: match.snapshot().stats[team].shotsFired,
      });
      log.push(`charge:${team}`);
      opts.onCharge?.();
    },
    playImpact: async (info) => {
      guard('playImpact');
      impacts.push(info);
      if (info.result === 'near') impactLabels.push(info.label);
      log.push(`impact:${info.result}`);
    },
    playTumble: async (team) => {
      guard('playTumble');
      tumbles.push(team);
      log.push(`tumble:${team}`);
    },
    showScrapPopup: (team, amount) => {
      scrapPopups.push({ team, amount });
      log.push(`scrap:${team}:${amount}`);
    },
    syncSquads: (f) => void fields.push(f),
    walkDasher: async (team, from, to, dizzy) => {
      guard('walkDasher');
      log.push(`walk:${team}:${Math.round(from.x)}>${Math.round(to.x)}${dizzy ? ':dizzy' : ''}`);
    },
    playDasherBonk: async (team, toward, word) => {
      guard('playDasherBonk');
      log.push(`bonk:${team}:${Math.round(toward.x)}:${word}`);
    },
    playDasherHit: async (team, how) => {
      guard('playDasherHit');
      log.push(`dasherHit:${team}:${how}`);
    },
    playBricks: async (team, fell, bricks) => {
      guard('playBricks');
      brickPlays.push({
        team,
        fell: [...fell],
        standing: Object.values(bricks).filter((b) => b.team === team && b.alive).length,
      });
      log.push(`bricks:${team}:${fell.length}`);
    },
    playRiderFalls: async (team, falls) => {
      guard('playRiderFalls');
      riderFalls.push({ team, falls: falls.map((f) => ({ ...f })) });
      log.push(`riderFall:${team}:${falls.map((f) => f.id).join(',')}`);
    },
  };

  let lastAutoKey = '';
  const autoplay = (key: string): void => {
    if (key === lastAutoKey) return;
    lastAutoKey = key;
    const h = handlers;
    const aim = script.shift();
    if (!h || !aim) return;
    queueMicrotask(() => {
      if (aim.pick) h.onSelect(aim.pick);
      h.onAim(aim);
      h.onFire();
    });
  };

  const overlay = {
    cover: null as 'pass' | 'reload' | null,
    showHud: (h: HudHandlers) => {
      handlers = h;
      log.push('hud:show');
    },
    updateHud: (s: HudState) => {
      hudStates.push(s);
      if (s.canFire)
        autoplay(
          `${s.activeTeam}:${s.shotsLeft}:${s.baseHp.PAST}:${s.baseHp.FUTURE}:${s.scrap.PAST}:${s.scrap.FUTURE}:${s.wind}`,
        );
    },
    hideHud: () => {},
    showTurnBanner: async (o: { name: string; shot: 1 | 2 | 'POWER' }) => {
      log.push(`banner:${o.name}:${o.shot}`);
    },
    showPassScreen: async (o: { nextName: string; nextTeam: Team }) => {
      captionAtCover.push(captions.at(-1) ?? null);
      cover = 'pass';
      log.push(`pass:${o.nextTeam}`);
      await Promise.resolve();
      cover = null;
    },
    showReloadModal: async (o: { question: Question; team: Team }): Promise<ReloadAnswer> => {
      captionAtCover.push(captions.at(-1) ?? null);
      cover = 'reload';
      modalQuestions.push(o.question);
      modalOptions.push(o as unknown as Record<string, unknown>);
      log.push(`reload:${o.team}`);
      await Promise.resolve();
      cover = null;
      const kind = answers.shift() ?? 'wrong';
      return kind === 'right'
        ? { correct: true, elapsedMs: 1000, choice: o.question.answer }
        : { correct: false, elapsedMs: 9000, choice: 'nope' };
    },
    showSpeechBubble: (o: { text: string; team: Team }) => {
      bubbles.push({ text: o.text, team: o.team });
      log.push(`bubble:${o.team}`);
    },
    setCaption: (t: string | null) => void captions.push(t),
  };

  const spoken: VoiceLine[] = [];
  const audio = {
    playSfx: (n: SfxName) => void sfx.push(n),
    clipsEnabled: opts.clips ?? false,
    speak: (line: VoiceLine) => {
      spoken.push(line);
      log.push('speak');
      return { done: Promise.resolve('ended'), source: 'silent', stop: () => {} };
    },
  };

  const deps: FlowDeps = {
    match,
    overlay: overlay as unknown as FlowDeps['overlay'],
    view,
    audio: audio as unknown as FlowDeps['audio'],
    bank: opts.bank ?? BANK,
    history: EMPTY_HISTORY,
    onHistory: (h) => histories.push(h),
    levels: opts.levels,
    onLevels: (l) => levelsSaved.push(l),
    onFinished: (r) => {
      log.push('finished');
      results.push(r);
    },
    wait: async () => {},
    waitIfPaused: opts.waitIfPaused,
    ...(opts.reduced ? { reducedMotion: () => true } : {}),
  };

  const flow = new BattleFlow(deps);
  return {
    flow,
    match,
    log,
    sfx,
    impacts,
    tumbles,
    bubbles,
    spoken,
    scrapPopups,
    modalQuestions,
    modalOptions,
    impactLabels,
    captions,
    captionAtCover,
    hudStates,
    statuses,
    previews,
    traces,
    selections,
    shots,
    charges,
    histories,
    levelsSaved,
    results,
    fields,
    brickPlays,
    riderFalls,
    mountSelections,
    padFlashes,
    coverViolations,
    handlers: () => handlers,
    drag: (aim: AimInput) => dragHandler?.(aim),
    hasDragHandler: () => dragHandler !== null,
    tapFighter: (id: UnitId) => pickHandler?.(id),
    hasPickHandler: () => pickHandler !== null,
    deps,
  };
}

/** Find an aim whose shot lands as `wanted` for that team on that turn. Brute force, deterministic. */
export function findAim(
  seed: number,
  turnNumber: number,
  team: Team,
  wanted: BlastResult,
): AimInput {
  const wind = windForTurn(seed, turnNumber);
  const enemy: Team = team === 'PAST' ? 'FUTURE' : 'PAST';
  for (let power = 100; power >= 10; power -= 2) {
    for (let angleDeg = 5; angleDeg <= 85; angleDeg += 2) {
      const r = simulateShot({
        angleDeg,
        power,
        origin: LAUNCH_ORIGINS[team],
        facing: TEAM_FACING[team],
        wind,
        layout: PHASE1_LAYOUT,
      });
      if (r.hit.kind === 'out_of_bounds' || r.hit.kind === 'timeout') continue;
      if (classifyBlast(r.landing, PHASE1_LAYOUT.bases[enemy]) === wanted) {
        return { angleDeg, power };
      }
    }
  }
  throw new Error(`no ${wanted} aim for ${team} on turn ${turnNumber}`);
}

/** Let queued promises and microtasks settle. */
export const settle = async (): Promise<void> => {
  for (let i = 0; i < 60; i++) await new Promise<void>((r) => setTimeout(r, 0));
};
