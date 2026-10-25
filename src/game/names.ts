import { NAME } from './config';
import type { ValidateName } from './types';

/** Small local list. Whole words only, so names like Cassie or Dieter pass. */
const BLOCKED_WORDS: ReadonlySet<string> = new Set([
  'butt',
  'poop',
  'pee',
  'fart',
  'damn',
  'hell',
  'crap',
  'shit',
  'fuck',
  'bitch',
  'ass',
  'kill',
  'killer',
  'die',
  'dead',
  'death',
  'blood',
  'gore',
  'stupid',
  'idiot',
  'dumb',
]);

/** Words so bad they are blocked even inside a longer string. */
const BLOCKED_ANYWHERE: readonly string[] = ['shit', 'fuck', 'bitch'];

const LEET: Readonly<Record<string, string>> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '@': 'a',
  $: 's',
};

const normalize = (s: string): string =>
  s.toLowerCase().replace(/[013457@$]/g, (c) => LEET[c] ?? c);

/** True when the text holds a word from the list above (any length; also used for weapon names). */
export function hasBlockedWord(text: string): boolean {
  const clean = normalize(text);
  const words = clean.split(/[^a-z]+/).filter(Boolean);
  const squashed = clean.replace(/[^a-z]/g, '');
  return (
    words.some((w) => BLOCKED_WORDS.has(w)) || BLOCKED_ANYWHERE.some((b) => squashed.includes(b))
  );
}

export const validateName: ValidateName = (raw) => {
  const name = typeof raw === 'string' ? raw.trim() : '';
  if (name.length < NAME.minLength) return { ok: false, reason: 'empty' };
  if ([...name].length > NAME.maxLength) return { ok: false, reason: 'too_long' };
  if (hasBlockedWord(name)) return { ok: false, reason: 'blocked' };
  return { ok: true, name };
};
