// Room codes: 6 symbols from 32, 30 bits. Each symbol is an animal picture and a letter or digit.
import { randomInt } from 'node:crypto';

export type SymbolDef = { char: string; animal: string };

/** The client draws the picture named `animal` and shows `char` under it. */
export const SYMBOLS: readonly SymbolDef[] = [
  { char: '2', animal: 'cat' },
  { char: '3', animal: 'dog' },
  { char: '4', animal: 'fox' },
  { char: '5', animal: 'owl' },
  { char: '6', animal: 'pig' },
  { char: '7', animal: 'cow' },
  { char: '8', animal: 'hen' },
  { char: '9', animal: 'bee' },
  { char: 'A', animal: 'ant' },
  { char: 'B', animal: 'bear' },
  { char: 'C', animal: 'crab' },
  { char: 'D', animal: 'duck' },
  { char: 'E', animal: 'eel' },
  { char: 'F', animal: 'frog' },
  { char: 'G', animal: 'goat' },
  { char: 'H', animal: 'horse' },
  { char: 'J', animal: 'jellyfish' },
  { char: 'K', animal: 'koala' },
  { char: 'L', animal: 'lion' },
  { char: 'M', animal: 'mouse' },
  { char: 'N', animal: 'newt' },
  { char: 'P', animal: 'panda' },
  { char: 'Q', animal: 'quail' },
  { char: 'R', animal: 'rabbit' },
  { char: 'S', animal: 'seal' },
  { char: 'T', animal: 'turtle' },
  { char: 'U', animal: 'urchin' },
  { char: 'V', animal: 'vulture' },
  { char: 'W', animal: 'whale' },
  { char: 'X', animal: 'xerus' },
  { char: 'Y', animal: 'yak' },
  { char: 'Z', animal: 'zebra' },
];

export const ALPHABET: string = SYMBOLS.map((s) => s.char).join('');
export const CODE_LENGTH = 6;
export const CODE_BITS = Math.log2(SYMBOLS.length ** CODE_LENGTH);

const CODE_PATTERN = new RegExp(`^[${ALPHABET}]{${CODE_LENGTH}}$`);
export const isValidCode = (s: unknown): s is string => typeof s === 'string' && CODE_PATTERN.test(s);

const LEET: Record<string, string> = { '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b' };

/** Substrings that must not appear in a code, after digits are read as letters. */
const RUDE: readonly string[] = [
  'butt', 'poop', 'fart', 'damn', 'hell', 'crap', 'shit', 'fuck', 'bitch', 'ass', 'kill', 'dead',
  'die', 'blood', 'gore', 'stupid', 'idiot', 'dumb', 'sex', 'tit', 'cum', 'pee', 'dick', 'cock',
  'rape', 'nazi', 'hate', 'bum',
];

export function isRude(code: string): boolean {
  const letters = [...code.toLowerCase()].map((c) => LEET[c] ?? c).join('').replace(/[^a-z]/g, '');
  return RUDE.some((w) => letters.includes(w));
}

/**
 * A fresh code that is not taken and not rude. `randomIndex(n)` returns an int in [0, n);
 * tests inject it. Default is crypto.randomInt.
 */
export function generateRoomCode(
  isTaken: (code: string) => boolean,
  randomIndex: (n: number) => number = (n) => randomInt(n),
): string {
  for (let tries = 0; tries < 100; tries++) {
    let code = '';
    for (let i = 0; i < CODE_LENGTH; i++) code += ALPHABET[randomIndex(ALPHABET.length)];
    if (!isRude(code) && !isTaken(code)) return code;
  }
  throw new Error('Could not find a free room code.');
}
