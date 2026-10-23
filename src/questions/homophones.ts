// Words that sound the same. A reading word-choice item must not offer two words from one group,
// because the pair can look like a second right answer to an early reader.
export const HOMOPHONE_GROUPS: readonly (readonly string[])[] = [
  ['see', 'sea'],
  ['to', 'two', 'too'],
  ['for', 'four', 'fore'],
  ['no', 'know'],
  ['be', 'bee'],
  ['i', 'eye', 'aye'],
  ['here', 'hear'],
  ['there', 'their', "they're"],
  ['one', 'won'],
  ['by', 'buy', 'bye'],
  ['red', 'read'],
  ['blue', 'blew'],
  ['right', 'write', 'rite'],
  ['ate', 'eight'],
  ['hi', 'high'],
  ['new', 'knew', 'gnu'],
  ['son', 'sun'],
  ['would', 'wood'],
  ['your', "you're", 'yore'],
  ['our', 'hour'],
  ['in', 'inn'],
  ['not', 'knot'],
  ['wait', 'weight'],
  ['made', 'maid'],
  ['tale', 'tail'],
  ['meet', 'meat'],
  ['week', 'weak'],
  ['bear', 'bare'],
  ['pair', 'pear', 'pare'],
  ['flour', 'flower'],
  ['way', 'weigh'],
  ['main', 'mane'],
  ['mail', 'male'],
  ['sale', 'sail'],
  ['plain', 'plane'],
  ['piece', 'peace'],
  ['hole', 'whole'],
  ['night', 'knight'],
  ['allowed', 'aloud'],
  ['died', 'dyed'],
  ['dear', 'deer'],
  ['fair', 'fare'],
  ['hair', 'hare'],
  ['road', 'rode', 'rowed'],
  ['sew', 'so', 'sow'],
  ['toe', 'tow'],
  ['threw', 'through'],
  ['steal', 'steel'],
  ['stair', 'stare'],
  ['some', 'sum'],
  ['rain', 'reign', 'rein'],
  ['pail', 'pale'],
  ['nose', 'knows'],
  ['mist', 'missed'],
  ['lead', 'led'],
  ['berry', 'bury'],
  ['board', 'bored'],
  ['cell', 'sell'],
  ['cent', 'scent', 'sent'],
  ['close', 'clothes'],
  ['creek', 'creak'],
  ['days', 'daze'],
  ['ewe', 'you', 'yew'],
  ['wear', 'where', 'ware'],
  ['which', 'witch'],
  ['weather', 'whether'],
];

const WORD_TO_GROUPS = new Map<string, number[]>();
HOMOPHONE_GROUPS.forEach((g, i) => {
  for (const w of g) WORD_TO_GROUPS.set(w, [...(WORD_TO_GROUPS.get(w) ?? []), i]);
});

export function areHomophones(a: string, b: string): boolean {
  const x = a.trim().toLowerCase();
  const y = b.trim().toLowerCase();
  if (x === y) return false;
  const gx = WORD_TO_GROUPS.get(x);
  const gy = WORD_TO_GROUPS.get(y);
  return !!gx && !!gy && gx.some((g) => gy.includes(g));
}
