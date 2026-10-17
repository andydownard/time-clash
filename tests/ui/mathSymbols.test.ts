// @vitest-environment jsdom
// Math shows real symbols (minus, times, divide), never a hyphen or letter x as an operator.
// The answer key keeps ASCII, so only what is drawn changes.
import { describe, expect, it } from 'vitest';
import { BANK } from '../../src/questions/bank';
import { renderMath, toMathSymbols } from '../../src/ui/dom';

const text = (s: string): string =>
  renderMath(document, s)
    .map((n) => n.textContent)
    .join('');

describe('toMathSymbols', () => {
  it('turns a spaced hyphen between numbers into a real minus', () => {
    expect(toMathSymbols('What is 17 - 9?')).toBe('What is 17 − 9?');
    expect(toMathSymbols('What is (3 + 4) - (2)?')).toBe('What is (3 + 4) − (2)?');
  });
  it('turns a spaced x into a times sign and a spaced slash into a divide sign', () => {
    expect(toMathSymbols('6 x 7')).toBe('6 × 7');
    expect(toMathSymbols('144 / 12')).toBe('144 ÷ 12');
  });
  it('leaves fractions, negatives, variables and plain words alone', () => {
    expect(toMathSymbols('3/4')).toBe('3/4');
    expect(toMathSymbols('-3 + 2')).toBe('-3 + 2');
    expect(toMathSymbols('Solve 2x + 1 = 7')).toBe('Solve 2x + 1 = 7');
    expect(toMathSymbols('A well-known fox')).toBe('A well-known fox');
    expect(toMathSymbols('The x marks the spot')).toBe('The x marks the spot');
  });
  it('is applied when math is rendered, fractions still stack', () => {
    expect(text('What is 1/2 - 3/8?')).toBe('What is 12 − 38?');
    const nodes = renderMath(document, 'What is 1/2 - 3/8?');
    expect(nodes.some((n) => (n as HTMLElement).className === 'tc-frac')).toBe(true);
  });
});

describe('every bank question', () => {
  const all = BANK.questions;
  it('draws no ASCII hyphen or spaced x as an operator', () => {
    expect(all.length).toBeGreaterThan(500);
    const bad: string[] = [];
    for (const qn of all) {
      for (const s of [qn.prompt, ...qn.choices]) {
        const shown = renderMath(document, s)
          .map((n) => n.textContent)
          .join('');
        if (/[\d)]\s-\s[\d(]/.test(shown) || /[\d)]\s[xX]\s[\d(]/.test(shown)) bad.push(s);
      }
    }
    expect(bad).toEqual([]);
  });
});
