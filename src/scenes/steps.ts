// One async step per screen. Each shows its DOM screen, waits for a tap, saves what needs
// saving, and returns where to go next. Phaser scenes just run a step and follow the route.
import { LOADING } from '../data/copy';
import type { QuestionBank } from '../questions/types';
import { runLoading } from '../ui/loadingLogic';
import { buildBattleData } from './battleData';
import {
  buildMatchSetup,
  loadAssets,
  routeAfterIntro,
  routeAfterLoading,
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
  return routeAfterIntro();
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
  const players = await s.overlay.showSetup(s.storage.get('timeclash.players'));
  s.storage.set('timeclash.players', players);
  const setup = buildMatchSetup(players, s.newSeed());
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
  const choice = await s.overlay.showVictory(plan.options);
  return routeAfterVictory(choice, plan.rematch);
}
