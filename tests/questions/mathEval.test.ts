import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { recomputeMathAnswer } from '../../src/questions/validate';

const cases: [string, string | null][] = [
  // A + B, A - B, A x B, A / B
  ['What is 9 + 6?', '15'],
  ['What is 15 - 9?', '6'],
  ['What is 7 x 8?', '56'],
  ['What is 56 / 7?', '8'],
  ['What is 7 / 2?', '7/2'],
  ['What is 0 / 5?', '0'],
  ['What is 3 - 8?', '-5'],
  ['What is 0.5 x 4?', '2'],
  ['What is 1.5 + 1.25?', '11/4'],
  // fractions
  ['What is 3/4 + 1/4?', '1'],
  ['What is 1/2 + 1/3?', '5/6'],
  ['What is 1/4 + 1/4?', '1/2'],
  ['What is 2/3 - 5/6?', '-1/6'],
  // solve for x
  ['Solve for x: 3x + 5 = 20', '5'],
  ['Solve for x: 2x - 4 = 10', '7'],
  ['Solve for x: x + 3 = 10', '7'],
  ['Solve for x: 4x + 1 = 10', '9/4'],
  ['Solve for x: -2x + 6 = 0', '3'],
  ['Solve for x: 3x + 5 = -4', '-3'],
  // percent
  ['What is 25% of 80?', '20'],
  ['What is 12.5% of 40?', '5'],
  ['What is 15% of 50?', '15/2'],
  // area
  ['What is the area of a rectangle with length 6 and width 4?', '24'],
  ['What is the area of a rectangle with length 2.5 and width 4?', '10'],
  // value of expression
  ['What is the value of 2^3 + 4?', '12'],
  ['What is the value of (3 + 4) x 2?', '14'],
  ['What is the value of 2 + 3 x 4?', '14'],
  ['What is the value of 2^3^2?', '512'],
  ['What is the value of -2^2?', '-4'],
  ['What is the value of (-2)^2?', '4'],
  ['What is the value of 2^-1?', '1/2'],
  ['What is the value of 10 - 2 - 3?', '5'],
  ['What is the value of 100 / 10 / 5?', '2'],
  ['What is the value of ((1 + 2) x (3 + 4))?', '21'],
  ['What is the value of 3 * 4?', '12'],
  ['What is 2 + 3 x 4?', '14'],
];

describe('recomputeMathAnswer: supported patterns', () => {
  it.each(cases)('%s -> %s', (prompt, expected) => {
    expect(recomputeMathAnswer(prompt)).toBe(expected);
  });
});

describe('recomputeMathAnswer: unsupported or unsafe prompts return null', () => {
  const nulls = [
    'What is a triangle?',
    'How many sides does a triangle have?',
    'What is 3 + ?',
    'What is 5 / 0?',
    'Solve for x: 0x + 1 = 2',
    'What is the area of a circle with radius 3?',
    'What is 7 x 8',
    'what is 7 x 8?',
    'What is 2/3 of 12?',
    'What is x?',
    'What is the value of (1 + 2?',
    'What is the value of 1 + 2)?',
    'What is the value of 0^-1?',
    'What is 9^999?',
    'What is the value of 2^99999999?',
    'What is the value of process.exit()?',
    'What is the value of alert(1)?',
    'What is the value of 1 + 1; 2?',
    '',
  ];
  it.each(nulls)('%s', (prompt) => {
    expect(recomputeMathAnswer(prompt)).toBeNull();
  });

  it('survives a very long prompt without hanging', () => {
    const long = `What is the value of ${'(1 + '.repeat(5000)}1${')'.repeat(5000)}?`;
    expect(recomputeMathAnswer(long)).toBeNull();
  });
});

describe('safe evaluator', () => {
  it('has no eval or Function constructor', () => {
    const src = readFileSync(new URL('../../src/questions/mathEval.ts', import.meta.url), 'utf8');
    expect(src).not.toMatch(/\beval\s*\(/);
    expect(src).not.toMatch(/new\s+Function/);
  });
});
