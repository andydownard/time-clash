// What the "Hear it" button reads aloud. Pure text, no DOM. A sight word item reads only the
// word (the choices would give the answer away). Everything else reads the passage, the
// question, and the choices. Math symbols become words a child would say.
import type { Question } from './types';

const sayMath = (text: string): string =>
  text
    .replace(/(\d+)\/(\d+)/g, '$1 over $2')
    .replace(/\^2\b/g, ' squared')
    .replace(/\^3\b/g, ' cubed')
    .replace(/\^\(?(-?\d+)\)?/g, ' to the power of $1')
    .replace(/\s{2,}/g, ' ')
    .trim();

/** One entry per sentence, so each can be a caption. */
export function spokenSentences(q: Question): string[] {
  if (q.kind === 'sightword' && q.audioWord) return [q.audioWord];
  const parts: string[] = [];
  const add = (text: string | undefined): void => {
    if (!text) return;
    const clean = sayMath(text);
    const sentences = clean.match(/[^.!?]+[.!?]*/g) ?? [clean];
    for (const s of sentences) if (s.trim()) parts.push(s.trim());
  };
  add(q.passage);
  add(q.prompt);
  parts.push('The choices are.');
  for (const c of q.choices) parts.push(`${sayMath(c).replace(/[.!?]+$/, '')}.`);
  return parts;
}

export function spokenText(q: Question): string {
  return spokenSentences(q).join(' ');
}
