// Builds what BattleScene needs to start: a fresh match plus the services it talks to.
import { createMatch } from '../game/match';
import { EMPTY_HISTORY, type QuestionBank } from '../questions/types';
import type { BattleSceneData } from './battle/types';
import type { AppServices, MatchSetup } from './registry';
import { toggleMute } from './settingsActions';

export function buildBattleData(
  s: AppServices,
  setup: MatchSetup,
  bank: QuestionBank,
): BattleSceneData {
  const match = createMatch(setup);
  s.session.match = match;
  return {
    match,
    overlay: s.overlay,
    audio: s.audio,
    bank,
    history: s.storage.get('timeclash.history') ?? EMPTY_HISTORY,
    onHistory: (history) => void s.storage.set('timeclash.history', history),
    onMuteToggle: () => void toggleMute(s.audio, s.storage),
    onLeave: () => {
      s.session.match = null;
    },
  };
}
