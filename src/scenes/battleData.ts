// Builds what BattleScene needs to start: a fresh match plus the services it talks to.
import { practiceRun } from '../game/practice';
import { walletOf } from '../game/loadout';
import { createMatch } from '../game/match';
import { loadCamp, loadMatchLength, loadPractice } from '../storage/storage';
import { EMPTY_HISTORY, type QuestionBank } from '../questions/types';
import type { BattleSceneData } from './battle/types';
import type { AppServices, MatchSetup } from './registry';
import { loadLevels } from '../storage/storage';
import { toggleMute } from './settingsActions';

export function buildBattleData(
  s: AppServices,
  setup: MatchSetup,
  bank: QuestionBank,
): BattleSceneData {
  // The length a parent picked at Setup. A setup that names its own length wins.
  const match = createMatch({
    ...setup,
    matchLength: setup.matchLength ?? loadMatchLength(s.storage),
  });
  s.session.match = match;
  // Each player's Scrap in hand, found by name. The HUD adds what they earn in this match.
  const camp = loadCamp(s.storage);
  const [past, future] = setup.players;
  // Off unless the flag is on, the family picked the Computer player, and one side is it.
  const run = practiceRun(loadPractice(s.storage), setup.players, s.computerPlayer === true);
  return {
    ...(run ? { practice: { ...run, ...(setup.effects ? { effects: setup.effects } : {}) } } : {}),
    match,
    overlay: s.overlay,
    audio: s.audio,
    bank,
    scrapBase: { PAST: walletOf(camp, past.name).scrap, FUTURE: walletOf(camp, future.name).scrap },
    history: s.storage.get('timeclash.history') ?? EMPTY_HISTORY,
    levels: loadLevels(s.storage),
    onLevels: (levels) => void s.storage.set('timeclash.levels', levels),
    onHistory: (history) => void s.storage.set('timeclash.history', history),
    onMuteToggle: () => void toggleMute(s.audio, s.storage),
    onLeave: () => {
      s.session.match = null;
    },
  };
}
