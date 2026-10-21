// Shared contract for the DOM layer that sits on top of the Phaser canvas.
// All buttons, text inputs, modals, banners, and captions are plain DOM.
// Phaser draws only the world (backdrop, bases, shots, tumbles).
import type { AmmoId } from '../game/ammo';
import type { BattlePlan } from '../game/battlefield';
import type { EvasionView } from '../game/types';
import type { CampState } from '../game/loadout';
import type { Grade, Players, Team, TeamStats, Vec2 } from '../game/types';
import type { UnitId } from '../game/units';
import type { Question } from '../questions/types';
import type { Settings } from '../storage/types';
import type { IntroScript } from '../data/types';

/**
 * Layer order (z-index). The two COVER layers are opaque, full viewport,
 * position: fixed; inset: 0; solid background color, no transparency, no blur.
 */
export const Z = {
  canvas: 0,
  hud: 10,
  bubble: 15,
  banner: 20,
  caption: 30,
  screen: 50, // tap-to-start, intro, loading, setup, victory
  cover: 100, // pass screen and reload modal
} as const;

/**
 * How the board stays hidden (risk 3):
 * 1. Pass screen and reload modal are opaque full-viewport layers at Z.cover.
 * 2. While a cover is up, the game root (canvas + HUD) gets `inert`,
 *    `aria-hidden="true"`, and `visibility: hidden`.
 * 3. Question DOM is built when the modal opens and removed when it closes.
 *    It is never pre-rendered or kept hidden in the page.
 * 4. document.body gets data-cover="pass" | "reload" while a cover is up and
 *    loses it after. E2E tests read this attribute.
 */
export type CoverKind = 'pass' | 'reload';

/** Stable hooks for Playwright. Use as data-testid values. */
export const TEST_IDS = {
  tapToPlay: 'tap-to-play',
  muteToggle: 'mute-toggle',
  captionsToggle: 'captions-toggle',
  howToPlay: 'how-to-play',
  introSkip: 'intro-skip',
  introReplay: 'intro-replay',
  introCard: 'intro-card',
  captionBar: 'caption-bar',
  loadingRetry: 'loading-retry',
  setupName: (team: Team) => `setup-name-${team}`,
  setupGrade: (team: Team, grade: Grade) => `setup-grade-${team}-${grade}`,
  setupSubject: (team: Team, subject: string) => `setup-subject-${team}-${subject}`,
  setupNext: 'setup-next',
  setupBack: 'setup-back',
  campForge: 'camp-forge',
  campUpgrade: 'camp-upgrade',
  campStart: 'camp-start',
  upgradeBack: 'upgrade-back',
  upgradeScrap: 'upgrade-scrap',
  upgradeStatus: 'upgrade-status',
  upgradeTeam: (team: Team) => `upgrade-team-${team}`,
  upgradeRow: (id: string) => `upgrade-row-${id}`,
  forgeBack: 'forge-back',
  forgeScrap: 'forge-scrap',
  forgeUpgrade: 'forge-upgrade',
  forgeStatus: 'forge-status',
  forgeTeam: (team: Team) => `forge-team-${team}`,
  forgeWeapon: (id: string) => `forge-weapon-${id}`,
  campPlayers: 'camp-players',
  planBack: 'plan-back',
  planGo: 'plan-go',
  planStatus: 'plan-status',
  planBiome: (id: string) => `plan-biome-${id}`,
  planSpot: (id: string) => `plan-spot-${id}`,
  planScrap: (team: Team) => `plan-scrap-${team}`,
  planAmmo: (team: Team, id: string) => `plan-ammo-${team}-${id}`,
  gearAmmo: 'gear-ammo',
  gearEvasion: 'gear-evasion',
  turnBanner: 'turn-banner',
  passScreen: 'pass-screen',
  passReady: 'pass-ready',
  reloadModal: 'reload-modal',
  reloadChoice: (index: number) => `reload-choice-${index}`,
  reloadHint: 'reload-hint',
  reloadSpeak: 'reload-speak',
  reloadNext: 'reload-next',
  angleControl: 'aim-angle',
  powerControl: 'aim-power',
  fireButton: 'fire',
  unit: (id: string) => `unit-${id}`,
  wind: 'wind',
  baseHp: (team: Team) => `base-hp-${team}`,
  shotsLeft: 'shots-left',
  speechBubble: 'speech-bubble',
  victory: 'victory',
  rematch: 'rematch',
  backToCamp: 'back-to-camp',
} as const;

// ---------- Per-call options ----------

export type BannerOptions = { name: string; team: Team; shot: 1 | 2 | 'POWER' };

export type PassScreenOptions = { nextName: string; nextTeam: Team };

export type ReloadModalOptions = {
  question: Question;
  team: Team;
  playerName: string;
  /** The other side, shown as a "Waiting" tag. Optional. Their name is not secret. */
  waiting?: { team: Team; name: string };
  /** Reads the question aloud (the Hear it button). Gets the whole text and its sentences. */
  speak?: (text: string, sentences: string[]) => void;
  /** Chrono's quick joke for the answer. Optional. */
  quip?: (outcome: 'fast' | 'slow' | 'wrong') => string | null;
  /** Injected clock for tests. Default performance.now. */
  now?: () => number;
};

export type ReloadAnswer = {
  correct: boolean;
  /** From modal open to the first answer tap. */
  elapsedMs: number;
  /** The choice text the child tapped. */
  choice: string;
};

export type BubbleOptions = {
  text: string;
  team: Team;
  /** World coords (1280x720). The overlay maps them onto the canvas rect. */
  anchor: Vec2;
  /** World point the tail aims at (the speaker). Without it the tail sits at the center. */
  tailTarget?: Vec2;
  durationMs?: number;
};

export type HudState = {
  activeTeam: Team | null;
  names: Record<Team, string>;
  baseHp: Record<Team, number>;
  /** Each base's full health. Missing means 100. An upgrade can raise it. */
  maxBaseHp?: Record<Team, number>;
  scrap: Record<Team, number>;
  wind: number;
  angleDeg: number;
  power: number;
  shotsLeft: 0 | 1 | 2;
  /** True while the Power Shot (the bonus for a right answer) is up. */
  bonus: boolean;
  /** False while a shot flies or a cover is up. */
  canFire: boolean;
  /** The fighter chosen by the active team. */
  selected: UnitId;
  /** The active team's five fighters. Empty when no team is up. */
  units: ReadonlyArray<{ id: UnitId; name: string }>;
  /** Phase 2 gear for the active team: ammo and the evasion ability. Missing hides the gear. */
  gear?: HudGear;
};

/** The active team's ammo and evasion ability, for the two gear buttons. */
export type HudGear = {
  /** The kind loaded now. */
  ammo: AmmoId;
  /** Shots left of each special kind the team owns (Standard is never listed). */
  ammoLeft: Partial<Record<AmmoId, number>>;
  evasion: EvasionView;
};

export type HudHandlers = {
  onAim: (aim: { angleDeg: number; power: number }) => void;
  onFire: () => void;
  onSelect: (id: UnitId) => void;
  onMuteToggle: () => void;
  /** Load this ammo next (Phase 2). */
  onAmmo?: (id: AmmoId) => void;
  /** Arm or take back the evasion ability (Phase 2). */
  onEvasion?: () => void;
};

export type VictoryOptions = {
  winner: Team;
  names: Record<Team, string>;
  stats: Record<Team, TeamStats>;
};

/** The Camp starts the match, or sends the family back to Setup to change the players. */
export type CampChoice = 'battle' | 'players' | 'forge' | 'upgrade';

export type ForgeOptions = {
  /** What everyone owns now, by name. */
  camp: CampState;
  /** Who plays each side. The screen shows and spends that player's Scrap. */
  names: Record<Team, string>;
  /** Called with the new camp after every change, so it is saved at once. */
  save: (camp: CampState) => void;
};

/** The Battle Plan screen: the last plan, and the Camp for unlocking special ammo. */
export type PlanOptions = ForgeOptions & { plan: BattlePlan };

export type VictoryChoice = 'rematch' | 'back-to-camp';

export type LoadingHandle = {
  /** 0 to 1. */
  setProgress(p: number): void;
  /** Shows the friendly error. Resolves when Retry is tapped. */
  showError(): Promise<void>;
  close(): void;
};

export type IntroResult = 'finished' | 'skipped';

// ---------- The overlay API ----------

/**
 * One instance, mounted once over the Phaser parent element.
 * Every Promise resolves on a user action; none rejects in normal play.
 * Every button is a real <button>, at least UI.tapTargetMinPx tall, reachable by Tab,
 * and works with Enter and Space.
 */
export interface Overlay {
  /** root: the element that holds the canvas. canvas: used to map world coords. */
  mount(root: HTMLElement, canvas: HTMLCanvasElement | null): void;
  applySettings(settings: Settings): void;

  // Screens (full viewport at Z.screen)
  /** Resolves inside the tap handler, so the caller can call AudioManager.unlock() synchronously. */
  showTapToStart(handlers: {
    onMuteToggle: () => void;
    onCaptionsToggle: () => void;
  }): Promise<void>;
  showIntro(script: IntroScript, play: (cardIndex: number) => Promise<void>): Promise<IntroResult>;
  showLoading(messages: readonly string[]): LoadingHandle;
  /** Resolves with validated players (index 0 PAST, 1 FUTURE). */
  showSetup(initial: Players | null): Promise<Players>;
  /** With a Back button. Resolves null when Back is tapped, and saves nothing. */
  showSetup(initial: Players | null, options: { back: true }): Promise<Players | null>;
  /** The Camp hub. Resolves when the big "Time to Clash!" button is tapped. */
  showCamp(): Promise<CampChoice>;
  /** Forge Weapon. Changes go through `save`. Resolves when Back is tapped. */
  showForge(options: ForgeOptions): Promise<void>;
  /** Upgrade Base. Same options as the Forge. Resolves when Back is tapped. */
  showUpgrade(options: ForgeOptions): Promise<void>;
  /** Battle Plan: place, base spot and ammo. Resolves with the plan, or null on Back. */
  showPlan(options: PlanOptions): Promise<BattlePlan | null>;
  showVictory(options: VictoryOptions): Promise<VictoryChoice>;

  // Battle HUD (Z.hud)
  showHud(handlers: HudHandlers): void;
  updateHud(state: HudState): void;
  hideHud(): void;

  // Battle moments
  /** Drops in, holds TIMING.bannerHoldMs, then resolves. Does not block input. */
  showTurnBanner(options: BannerOptions): Promise<void>;
  /** COVER. Resolves on "I'm ready!". */
  showPassScreen(options: PassScreenOptions): Promise<void>;
  /**
   * COVER. Resolves after the child answers and the feedback beat ends.
   * A wrong answer shows the right answer kindly, then resolves anyway.
   */
  showReloadModal(options: ReloadModalOptions): Promise<ReloadAnswer>;
  showSpeechBubble(options: BubbleOptions): void;

  // Captions (Z.caption). Hidden when captions are off.
  setCaption(text: string | null): void;

  /** Which cover is up, if any. */
  readonly cover: CoverKind | null;
}

export type CreateOverlay = (doc: Document) => Overlay;
