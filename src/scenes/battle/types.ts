// Contracts for the Battle scene. The scene draws; BattleFlow (flow.ts) decides what happens.
// Nothing here imports Phaser, so the flow and helpers run in plain Vitest.
import type { AudioManager } from '../../audio/types';
import type { BirdPath } from '../../game/disturbance';
import type {
  AimInput,
  BirdBump,
  BlastOutcome,
  BrickId,
  BrickView,
  GustHit,
  MatchController,
  MatchOptions,
  MountId,
  Rect,
  ShotResult,
  Team,
  TeamStats,
  Vec2,
} from '../../game/types';
import type { RiderFall } from './riderFalls';
import type { UnitId } from '../../game/units';
import type { Levels } from '../../questions/calibration';
import type { PickHistory, QuestionBank } from '../../questions/types';
import type { MatchEffects } from '../../game/loadout';
import type { PracticeRun } from '../../game/practice';
import type { Overlay } from '../../ui/types';
import type { ProjectileKind } from './projectileKinds';

export const BATTLE_SCENE_KEY = 'BattleScene';
/** Where Battle hands off when a team wins. The Victory scene owner must register this key. */
export const VICTORY_SCENE_KEY = 'VictoryScene';
/** Where Leave game goes. Same value as SCENE_KEYS.camp. */
export const CAMP_SCENE_KEY = 'CampScene';

export type EffectKind = 'blocks' | 'confetti' | 'plasma' | 'puff';

/** What the view should draw when a shot lands. Built by describeImpact (impact.ts). */
export type ImpactInfo = {
  kind: EffectKind;
  position: Vec2;
  /** The base that was aimed at. */
  target: Team;
  shooter: Team;
  result: BlastOutcome['result'];
  damage: number;
  /** Bigger for direct hits, smaller for misses. */
  scale: number;
  /** Floating caption text from HITS in copy.ts. */
  label: string;
};

/** One dot of the fading dotted preview. */
export type PreviewDot = { x: number; y: number; alpha: number };

/** Everything the view shows besides one-shot animations. */
export type ViewStatus = {
  activeTeam: Team | null;
  names: Record<Team, string>;
  baseHp: Record<Team, number>;
  /** Each base's full health. Missing means DAMAGE.startingBaseHp. An upgrade can raise it. */
  maxBaseHp?: Record<Team, number>;
  scrap: Record<Team, number>;
  wind: number;
  shotsLeft: 0 | 1 | 2;
  aim: AimInput;
  /** Where the active fighter's shot starts. The angle guide is drawn here. */
  firingOrigin?: Vec2;
};

/** Squads: one dasher as the field shows him. `at` is where his feet are, on the ground. */
export type DasherSprite = {
  team: Team;
  at: Vec2;
  state: 'home' | 'out' | 'resting';
  hp: number;
  maxHp: number;
};

/** Squads: both dashers, the ground spot markers, and the spot the picked dasher would walk to. */
export type SquadField = {
  dashers: readonly DasherSprite[];
  spots: ReadonlyArray<{ id: string; at: Vec2; doorstepOf: Team | null }>;
  target: Vec2 | null;
};

/** The drawing side of the scene. BattleScene implements it with Phaser; tests use a fake. */
export interface BattleView {
  /** Redraw health bars, shots icons, wind, dial and meter. */
  syncStatus(status: ViewStatus): void;
  /** Glow the active side and dim the waiting side. */
  setActiveTeam(team: Team | null): void;
  /** Dotted preview of the next shot. null clears it. */
  showPreview(team: Team, dots: readonly PreviewDot[] | null): void;
  /** The full arc of the shot just taken, kept as a guide. null clears it. Never up under a cover. */
  showTrace(team: Team, points: readonly Vec2[] | null): void;
  /** The player dragged the dial handle. Pass null to turn dragging off. */
  setAimDragHandler(handler: ((aim: AimInput) => void) | null): void;
  /** The wind-up glow at the launch point before a shot. Resolves when the shot should go. */
  playCharge(team: Team, from: Vec2): Promise<void>;
  /** Fly the projectile along result.path. Resolves when it lands. */
  animateShot(shooter: Team, result: ShotResult, kind?: ProjectileKind): Promise<void>;
  playImpact(info: ImpactInfo): Promise<void>;
  /** Awkward Tumble for that team's character. Resolves when it springs back up. */
  playTumble(team: Team): Promise<void>;
  /** Show which fighter is up for that team. */
  setSelectedUnit(team: Team, id: UnitId): void;
  /**
   * Built bases: show the weapon on a pad that is picked for that team (a ring on its pad), or
   * null when a fighter is picked. Optional so older fakes still work.
   */
  setSelectedMount?(team: Team, id: MountId | null): void;
  /** Built bases: the pad on `spot` flashes as its weapon fires. */
  flashPad?(team: Team, spot: number): void;
  showScrapPopup(team: Team, amount: number): void;
  /** Phase 2: draw these stone walls (none clears them). Optional so older fakes still work. */
  setWalls?(walls: readonly Rect[]): void;
  /** Phase 2: the base zips aside and back (a Hoverboard Dodge). Resolves when it is back. */
  playDodge?(team: Team): Promise<void>;
  /** Squads: draw the dashers and spot markers where the rules say (null hides them). Optional for older fakes. */
  syncSquads?(field: SquadField | null): void;
  /** Squads: a dasher walks the ground line from `from` to `to`, over any obstacle. */
  walkDasher?(team: Team, from: Vec2, to: Vec2, dizzy: boolean): Promise<void>;
  /** Squads: a dasher swings his toy at `toward`, with a puff and the word. */
  playDasherBonk?(team: Team, toward: Vec2, word: string): Promise<void>;
  /** Squads: a shell landed close to a dasher. He wobbles, or tumbles at 0 health. */
  playDasherHit?(team: Team, how: 'wobble' | 'tumble', label: string | null): Promise<void>;
  /** Disturbances: draw this turn's birds and start the bird clock at 0. null clears them. */
  showBirds?(birds: readonly BirdPath[] | null): void;
  /** ms on the bird clock since showBirds. The shot is fired with it, so it meets the birds drawn. */
  birdClockMs?(): number;
  /** A shell bumped a bird: feathers, a spin and the "Squawk!" word. */
  playBirdBump?(bump: BirdBump): void;
  /** The turn's gust blew on the shell: streaks, an arrow and the "Whoosh!" word. */
  playGust?(gust: GustHit): void;
  /**
   * Built bases: redraw `team`'s bricks as the rules have them now. The bricks in `fell` (the
   * rules' order) puff dust, tumble to the ground and fade. Resolves when they are done.
   */
  playBricks?(
    team: Team,
    fell: readonly BrickId[],
    bricks: Readonly<Record<BrickId, BrickView>>,
  ): Promise<void>;
  /**
   * Built bases: fighters whose brick fell drop with it, flop over, puff dust and stand up on the
   * lower spot (riderFall.ts). Plays alongside the crumble. Resolves when they stand again.
   */
  playRiderFalls?(team: Team, falls: readonly RiderFall[]): Promise<void>;
}

/** What Victory needs. */
export type BattleResult = {
  winner: Team;
  names: Record<Team, string>;
  stats: Record<Team, TeamStats>;
  /** Same players, seed + 1, the other team starts. */
  rematch: MatchOptions;
};

/** Data handed to the scene when it starts. main.ts builds it. */
export type BattleSceneData = {
  match: MatchController;
  overlay: Overlay;
  audio?: AudioManager;
  bank: QuestionBank;
  history: PickHistory;
  /** Called with the new history after every question, so main.ts can save it. */
  onHistory?: (history: PickHistory) => void;
  /** Quiet level nudges per player name. Saved by main.ts. Never shown to a child. */
  levels?: Levels;
  onLevels?: (levels: Levels) => void;
  onMuteToggle?: () => void;
  /** True when big motion should become fades. Default: asks the browser. */
  reducedMotion?: () => boolean;
  /** Default: starts VICTORY_SCENE_KEY with the result. */
  onFinished?: (result: BattleResult) => void;
  /** Runs when the family leaves a game from the pause panel. */
  onLeave?: () => void;
  /** Each player's Scrap in hand when the match began. The HUD shows this plus what they earn. */
  scrapBase?: Record<Team, number>;
  /** Set when one child plays alone against the Computer player. */
  practice?: PracticeRun & { effects?: MatchEffects };
};
