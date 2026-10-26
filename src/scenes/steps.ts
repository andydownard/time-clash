// One async step per screen. Each shows its DOM screen, waits for a tap, saves what needs
// saving, and returns where to go next. Phaser scenes just run a step and follow the route.
import { LOADING } from '../data/copy';
import { TIMING } from '../game/config';
import { creditMatch } from '../game/economy';
import { TEAMS, type Players, type Team } from '../game/types';
import { buildLayout } from '../game/battlefield';
import { battleBasesFor } from '../game/builtBase';
import { matchAmmoFor, matchEffectsFor, type CampState } from '../game/loadout';
import { loadBases, loadCamp, loadPlan } from '../storage/storage';
import type { QuestionBank } from '../questions/types';
import { loadingMinFor, runLoading } from '../ui/loadingLogic';
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

export async function runTapStep(s: AppServices): Promise<SceneRoute> {
  await s.overlay.showTapToStart();
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
    // A family with no saved players is new. The intro already marks introSeen before Loading.
    minMs: s.flags?.quickLoad
      ? TIMING.loadingQuickMs
      : loadingMinFor(s.storage.get('timeclash.players') == null),
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

/** The two players' names by side. Index 0 is always Team Past. */
const namesOf = (players: Players): Record<Team, string> => ({
  PAST: players[0].name,
  FUTURE: players[1].name,
});

export async function runSetupStep(s: AppServices): Promise<SceneRoute> {
  const saved = s.storage.get('timeclash.players');
  // A family that has played before can go Back to the Camp. A new family has nowhere to go back to.
  // The Computer player choice only exists when the flag is on. Off is exactly today's Setup.
  const computer = s.computerPlayer === true;
  const players = saved
    ? await s.overlay.showSetup(saved, computer ? { back: true, computer } : { back: true })
    : computer
      ? await s.overlay.showSetup(null, { computer })
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
  const names = namesOf(players);
  const choice = await s.overlay.showCamp();
  if (choice === 'build') {
    // The builder has its own Past and Future picker, so it opens again for the side picked.
    let team: Team | null = 'PAST';
    while (team) {
      team = await s.overlay.showBaseBuilder({
        team,
        camp: loadCamp(s.storage),
        names,
        bases: loadBases(s.storage),
        saveCamp: (next: CampState) => void s.storage.set('timeclash.camp', next),
        saveBases: (next) => void s.storage.set('timeclash.bases', next),
      });
    }
    return { key: SCENE_KEYS.camp };
  }
  if (choice === 'players') return { key: SCENE_KEYS.setup };
  if (choice === 'forge') {
    await s.overlay.showForge({
      camp: loadCamp(s.storage),
      names,
      save: (next: CampState) => void s.storage.set('timeclash.camp', next),
    });
    // Back from the Forge: the Camp again, which shows what the family now has.
    return { key: SCENE_KEYS.camp };
  }
  // The Battle Plan: where to fight, where Team Future hides its base, and special ammo.
  const plan = await s.overlay.showPlan({
    plan: loadPlan(s.storage),
    camp: loadCamp(s.storage),
    names,
    save: (next: CampState) => void s.storage.set('timeclash.camp', next),
  });
  if (plan === null) return { key: SCENE_KEYS.camp };
  s.storage.set('timeclash.plan', plan);
  // The weapons, upgrades and ammo the family chose at the Camp go into the match.
  const camp = loadCamp(s.storage);
  const setup = buildMatchSetup(players, s.newSeed(), matchEffectsFor(camp, names), {
    layout: buildLayout(plan),
    ammo: matchAmmoFor(camp, names),
    // Each player's chosen base from Build Base goes into battle (BASE_IN_BATTLE).
    bases: battleBasesFor(loadBases(s.storage), names),
    ...(s.flags?.squads === undefined ? {} : { squads: s.flags.squads }),
    ...(s.flags?.disturbances === undefined ? {} : { disturbances: s.flags.disturbances }),
  });
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
  // It goes to each player's own total, found by name.
  const earned = TEAMS.map((team) => ({
    name: plan.options.names[team],
    scrap: plan.options.stats[team].scrapEarned,
  }));
  s.storage.set('timeclash.camp', creditMatch(loadCamp(s.storage), plan.rematch.seed - 1, earned));
  const choice = await s.overlay.showVictory(plan.options);
  return routeAfterVictory(choice, plan.rematch);
}
