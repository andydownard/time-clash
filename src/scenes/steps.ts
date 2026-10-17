// One async step per screen. Each shows its DOM screen, waits for a tap, saves what needs
// saving, and returns where to go next. Phaser scenes just run a step and follow the route.
import { LOADING } from '../data/copy';
import { creditMatch } from '../game/economy';
import { matchEffectsFor } from '../game/loadout';
import { loadCamp } from '../storage/storage';
import type { QuestionBank } from '../questions/types';
import { runLoading } from '../ui/loadingLogic';
import { buildBattleData } from './battleData';
import {
  buildMatchSetup,
  loadAssets,
  routeAfterIntro,
  routeAfterLoading,
  routeAfterSetup,
  routeAfterTap,
  routeAfterVictory,
  victoryFrom,
} from './flow';
import {
  SCENE_KEYS,
  type AppServices,
  type LoadingData,
  type MatchSetup,
  type SceneRoute,
} from './registry';
import { toggleCaptions, toggleMute } from './settingsActions';

export async function runTapStep(s: AppServices): Promise<SceneRoute> {
  await s.overlay.showTapToStart({
    onMuteToggle: () => void toggleMute(s.audio, s.storage),
    onCaptionsToggle: () => void toggleCaptions(s.storage),
  });
  return routeAfterTap(s.storage);
}

export async function runIntroStep(s: AppServices): Promise<SceneRoute> {
  await s.howTo.open();
  return routeAfterIntro(s.storage);
}

/**
 * Loads, then routes. A route to Battle carries BattleSceneData: a fresh match built from the
 * setup, plus the loaded question bank and the services Battle talks to.
 */
export async function runLoadingStep(s: AppServices, data: unknown): Promise<SceneRoute> {
  const handle = s.overlay.showLoading(LOADING.messages);
  const loaded: { bank: QuestionBank | null } = { bank: null };
  await runLoading({
    handle,
    env: s.env,
    load: async (report) => {
      loaded.bank = await loadAssets(s.loadBank, report);
    },
  });
  s.session.bank = loaded.bank;
  const route = routeAfterLoading(data);
  if (route.key === SCENE_KEYS.battle && loaded.bank) {
    return { key: route.key, data: buildBattleData(s, route.data as MatchSetup, loaded.bank) };
  }
  return route;
}

export async function runSetupStep(s: AppServices): Promise<SceneRoute> {
  const saved = s.storage.get('timeclash.players');
  // A family that has played before can go Back to the Camp. A new family has nowhere to go back to.
  const players = saved
    ? await s.overlay.showSetup(saved, { back: true })
    : await s.overlay.showSetup(null);
  if (players === null) return { key: SCENE_KEYS.camp };
  s.storage.set('timeclash.players', players);
  return routeAfterSetup();
}

/** Camp: the big button starts a fresh match for the players Setup saved. */
export async function runCampStep(s: AppServices): Promise<SceneRoute> {
  const players = s.storage.get('timeclash.players');
  // No saved players (it should not happen) goes back to Setup, never a dead end.
  if (!players) return { key: SCENE_KEYS.setup };
  const choice = await s.overlay.showCamp();
  if (choice === 'players') return { key: SCENE_KEYS.setup };
  if (choice === 'forge') {
    await s.overlay.showForge({
      camp: loadCamp(s.storage),
      save: (next) => void s.storage.set('timeclash.camp', next),
    });
    // Back from the Forge: the Camp again, which shows what the family now has.
    return { key: SCENE_KEYS.camp };
  }
  // The weapons and upgrades the family chose at the Camp go into the match.
  const effects = matchEffectsFor(loadCamp(s.storage));
  const setup = buildMatchSetup(players, s.newSeed(), effects);
  // The bank is loaded once, before Setup. If it is somehow missing, load it first.
  if (!s.session.bank) {
    const data: LoadingData = { next: SCENE_KEYS.battle, setup };
    return { key: SCENE_KEYS.loading, data };
  }
  return { key: SCENE_KEYS.battle, data: buildBattleData(s, setup, s.session.bank) };
}

export async function runVictoryStep(s: AppServices, data: unknown): Promise<SceneRoute> {
  const plan = victoryFrom(data);
  if (!plan) return { key: SCENE_KEYS.setup };
  s.overlay.hideHud();
  s.session.match = null;
  // Scrap earned in this match goes to the Camp once. A rematch has the next seed, so it counts again.
  const earned = {
    PAST: plan.options.stats.PAST.scrapEarned,
    FUTURE: plan.options.stats.FUTURE.scrapEarned,
  };
  s.storage.set('timeclash.camp', creditMatch(loadCamp(s.storage), plan.rematch.seed - 1, earned));
  const choice = await s.overlay.showVictory(plan.options);
  return routeAfterVictory(choice, plan.rematch);
}
