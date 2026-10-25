// Values shared by the UI modules. Z and TEST_IDS live in types.ts (contract).
export { Z, TEST_IDS } from './types';

/**
 * Solid fallback for the cover background, used inline so a cover is opaque even if the
 * stylesheet is late or missing. A test checks it equals --tc-cover-bg in tokens.css.
 */
export const COVER_BG_FALLBACK = '#0e1a33';

/** Local test ids that are not in the contract list. */
export const LOCAL_IDS = {
  hudMute: 'hud-mute',
  introMute: 'intro-mute',
  introNext: 'intro-next',
  introDots: 'intro-dots',
  loadingBar: 'loading-bar',
  loadingMessage: 'loading-message',
  loadingError: 'loading-error',
  hudScrap: (team: string) => `hud-scrap-${team}`,
  clearData: 'clear-data',
  clearDataYes: 'clear-data-yes',
  clearDataNo: 'clear-data-no',
  reloadFeedback: 'reload-feedback',
  coverMute: 'cover-mute',
  reloadTimer: 'reload-timer',
  reloadPrompt: 'reload-prompt',
  setupReadBack: 'setup-read-back',
  setupGradeNote: (team: string) => `setup-grade-note-${team}`,
  setupError: (team: string) => `setup-error-${team}`,
} as const;
