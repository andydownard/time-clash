// Shared setup for the jsdom overlay tests.
import { createAudioManager } from '../../src/audio/audioManager';
import type { AudioManager, SfxName } from '../../src/audio/types';
import { DEFAULT_SETTINGS } from '../../src/game/config';
import type { Question } from '../../src/questions/types';
import { createStorage } from '../../src/storage/storage';
import type { Settings } from '../../src/storage/types';
import { createOverlay } from '../../src/ui/overlay';
import { createHarness } from '../audio/fakes';

export const flush = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};

export const q = <T extends HTMLElement = HTMLElement>(id: string): T | null =>
  document.querySelector<T>(`[data-testid="${id}"]`);

export const qa = (selector: string): HTMLElement[] => [
  ...document.querySelectorAll<HTMLElement>(selector),
];

export function click(el: Element | null): void {
  if (!el) throw new Error('click: element not found');
  (el as HTMLElement).click();
}

export function key(target: EventTarget, k: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const e = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(e);
  return e;
}

export function setup(
  options: { settings?: Partial<Settings>; matchMediaReduced?: boolean; withAudio?: boolean } = {},
) {
  document.body.innerHTML = '';
  delete document.body.dataset.cover;
  const root = document.createElement('div');
  root.id = 'game';
  const canvas = document.createElement('canvas');
  root.append(canvas);
  document.body.append(root);

  const harness = createHarness();
  // One clock for the overlay and the audio manager, so advancing it moves both.
  const clock = harness.clock;
  const audio: AudioManager = createAudioManager(harness.env, { muted: false, volume: 0.7 });
  const sfx: SfxName[] = [];
  const realPlay = audio.playSfx.bind(audio);
  audio.playSfx = (n) => {
    sfx.push(n);
    realPlay(n);
  };
  const storage = createStorage(null);
  const win = {
    matchMedia: (query: string) => ({
      matches: Boolean(options.matchMediaReduced) && query.includes('reduce'),
    }),
  } as unknown as Window;
  const overlay = createOverlay(document, {
    audio: options.withAudio === false ? undefined : audio,
    storage,
    env: clock,
    win,
  });
  overlay.mount(root, canvas);
  const settings: Settings = { ...DEFAULT_SETTINGS, ...options.settings };
  overlay.applySettings(settings);
  return { overlay, root, canvas, clock, harness, audio, storage, sfx, settings };
}

export const mathQ: Question = {
  id: 'math-8-0042',
  subject: 'math',
  grade: 8,
  kind: 'numeric',
  prompt: '3x + 5 = 20, x = ?',
  choices: ['3', '5', '7', '15'],
  answer: '5',
  hint: 'Take 5 away from both sides first.',
  tags: [],
};

export const fractionQ: Question = {
  ...mathQ,
  id: 'math-6-0001',
  grade: 6,
  prompt: 'What is 1/2 + 1/4? And x^2 when x = 3?',
  choices: ['3/4', '2/6', '9', '1/8'],
  answer: '3/4',
  hint: undefined,
};

export const wordQ: Question = {
  id: 'reading-1-0007',
  subject: 'reading',
  grade: 1,
  kind: 'choice',
  prompt: 'Which word is "because"?',
  choices: ['because', 'became', 'beside', 'before'],
  answer: 'because',
  hint: 'It starts with b-e-c.',
  tags: [],
};

export const vocabQ: Question = {
  id: 'reading-7-0003',
  subject: 'reading',
  grade: 7,
  kind: 'vocab',
  prompt: 'The knight was RELUCTANT to jump. What does reluctant mean?',
  choices: ['unwilling', 'eager', 'loud', 'small'],
  answer: 'unwilling',
  tags: [],
};

export const mainIdeaQ: Question = {
  id: 'reading-5-0009',
  subject: 'reading',
  grade: 5,
  kind: 'mainidea',
  prompt: 'What is the main idea?',
  passage: 'The catapult was old. It still worked. Everyone cheered.',
  choices: ['Old things can still work', 'Catapults are new', 'Nobody cheered', 'It rained'],
  answer: 'Old things can still work',
  tags: [],
};
