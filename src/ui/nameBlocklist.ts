// A small list of words that cannot be a player name. It is stored scrambled (ROT13) so the
// repo does not hold the words in plain sight, and it is decoded when the module loads.
// Names show on the big turn banner, so a clean list matters.

const rot13 = (s: string): string =>
  s.replace(/[a-z]/g, (c) => String.fromCharCode(((c.charCodeAt(0) - 97 + 13) % 26) + 97));

/** Blocked anywhere inside a name (long enough that real names do not contain them). */
const SUBSTRING = [
  'fuvg',
  'shpx',
  'ovgpu',
  'onfgneq',
  'juber',
  'fyhg',
  'cravf',
  'intvan',
  'cbea',
  'ergneq',
];
/** Blocked only as a whole word (these letters appear inside many real names). */
const WHOLE_WORD = ['nff', 'qnza', 'uryy', 'penc', 'cvff', 'qvpx', 'pbpx', 'frk', 'anmv', 'snt'];
/** Tone words from the project vocabulary. Never a name, because the banner would shout them. */
const TONE_WORDS = ['kill', 'die', 'dead', 'blood', 'gore', 'defeat'];

const substring = SUBSTRING.map(rot13);
const whole = new Set([...WHOLE_WORD.map(rot13), ...TONE_WORDS]);

const LEET: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '@': 'a',
  $: 's',
  '!': 'i',
};

const fold = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[013457@$!]/g, (c) => LEET[c] ?? c)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '');

/** True if the name holds a blocked word. */
export function isBlockedName(name: string): boolean {
  const folded = fold(name);
  const squashed = folded.replace(/[^a-z]/g, '');
  if (substring.some((w) => squashed.includes(w))) return true;
  const tokens = folded.split(/[^a-z]+/).filter(Boolean);
  if (tokens.some((t) => whole.has(t))) return true;
  // Letters spaced out one by one ("d i e") collapse to a single blocked word.
  return whole.has(squashed);
}
