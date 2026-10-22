import { describe, expect, it } from 'vitest';
import { spokenSentences, spokenText } from '../../src/questions/spoken';
import { mq, rq } from './helpers';

describe('spokenText', () => {
  it('a sight word item speaks only the word, so the answer is not given away by the choices', () => {
    expect(spokenText(rq({ audioWord: 'see' }))).toBe('see');
  });
  it('speaks the passage, then the prompt, then the choices', () => {
    const t = spokenText(
      rq({
        kind: 'mainidea',
        audioWord: undefined,
        passage: 'The catapult was old. It still worked.',
        prompt: 'What is the main idea?',
        choices: ['Old things work', 'It is new', 'Nobody came', 'It rained'],
        answer: 'Old things work',
      }),
    );
    expect(t.indexOf('The catapult')).toBeLessThan(t.indexOf('What is the main idea'));
    expect(t.indexOf('What is the main idea')).toBeLessThan(t.indexOf('Old things work'));
    expect(t).toContain('It rained');
  });
  it('says math the way a child would hear it', () => {
    const t = spokenText(
      mq({ prompt: 'What is x^2 when x = 3? Add 1/2 + 1/4.', choices: ['9', '6', '1/8', '3/4'] }),
    );
    expect(t).not.toContain('^');
    expect(t).not.toContain('/');
    expect(t).toContain('squared');
    expect(t).toContain('1 over 2');
  });
  it('says a spaced slash as "divided by", and leaves a fraction as "over"', () => {
    const t = spokenText(
      mq({ prompt: 'What is (3/4) / (1/4)?', choices: ['3', '1', '4', '2'], answer: '3' }),
    );
    expect(t).toContain('3 over 4) divided by (1 over 4');
    expect(spokenText(mq({ prompt: 'What is 56 / 7?' }))).toContain('56 divided by 7');
  });
  it('splits into sentences for captions, none empty', () => {
    const parts = spokenSentences(mq());
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.every((p) => p.trim().length > 0)).toBe(true);
  });
  it('never includes the answer marker or hint', () => {
    const t = spokenText(mq({ hint: 'SECRET HINT', answer: '56' }));
    expect(t).not.toContain('SECRET HINT');
  });
});
