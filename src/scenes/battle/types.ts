// Contracts for the Battle scene. The scene draws; BattleFlow (flow.ts) decides what happens.
// Nothing here imports Phaser, so the flow and helpers run in plain Vitest.
import type { AudioManager } from '../../audio/types';
import type {
  AimInput,
  BlastOutcome,
  MatchController,
  MatchOptions,
  ShotResult,
  Team,
  TeamStats,
  Vec2,
} from '../../game/types';
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
  /** Each base's full health. Missing means 100. An upgrade can raise it. */
  maxBaseHp?: Record<Team, number>;
  scrap: Record<Team, number>;
  wind: number;
  shotsLeft: 0 | 1 | 2;
  aim: AimInput;
  /** Where the active fighter's shot starts. The angle guide is drawn here. */
  firingOrigin?: Vec2;
};

/** The drawing side of the scene. BattleScene implements it with Phaser; tests use a fake. */
export interface BattleView {
  /** Redraw health bars, shots icons, wind, dial and meter. */
  syncStatus(status: ViewStatus): void;
  /** Glow the active side and dim the waiting side. */
  setActiveTeam(team: Team | null): void;
  /** Dotted preview of the next shot. null clears it. */
  showPreview(team: Team, dots: readonly PreviewDot[] | null): void;
  /** The player dragged the dial handle. Pass null to turn dragging off. */
  setAimDragHandler(handler: ((aim: AimInput) => void) | null): void;
  /** Fly the projectile along result.path. Resolves when it lands. */
  animateShot(shooter: Team, result: ShotResult, kind?: ProjectileKind): Promise<void>;
  playImpact(info: ImpactInfo): Promise<void>;
  /** Awkward Tumble for that team's character. Resolves when it springs back up. */
  playTumble(team: Team): Promise<void>;
  /** Show which fighter is up for that team. */
  setSelectedUnit(team: Team, id: UnitId): void;
  showScrapPopup(team: Team, amount: number): void;
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
