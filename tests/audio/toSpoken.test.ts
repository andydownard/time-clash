import { describe, expect, it } from 'vitest';
import { toSpoken } from '../../src/audio/toSpoken';

const cases: [string, string][] = [
  ['What is 7 x 8?', 'What is 7 times 8?'],
  ['What is 1 over 2 + 1 over 3?', 'What is 1 over 2 plus 1 over 3?'],
  ['What is 16 - 4?', 'What is 16 minus 4?'],
  ['What is 40 / 5?', 'What is 40 divided by 5?'],
  ['What is 5 x 3 + 6?', 'What is 5 times 3 plus 6?'],
  ['Solve for x: 3x + 5 = 20', 'Solve for x: 3 x plus 5 equals 20'],
  ['Solve for x: x - 6 = 9', 'Solve for x: x minus 6 equals 9'],
  ['Solve for x: -2x + 6 = 0', 'Solve for x: negative 2 x plus 6 equals 0'],
  ['What is 50% of 36?', 'What is 50 percent of 36?'],
  ['What is 2^5 x 2^3?', 'What is 2 to the power of 5 times 2 cubed?'],
  ['What is the value of (3 + 4) x 2?', 'What is the value of (3 plus 4) times 2?'],
  ['What is (8 - 3) x (2 + 1)?', 'What is (8 minus 3) times (2 plus 1)?'],
  ['What is 3^2?', 'What is 3 squared?'],
  ['What is 5 - 8?', 'What is 5 minus 8?'],
  ['What is 3 over 4 = ?/12', 'What is 3 over 4 equals blank over 12'],
  ['Count by 5s: 5, 10, 15, ___', 'Count by 5s: 5, 10, 15, blank'],
  ['2 over 3 < 3 over 5', '2 over 3 is less than 3 over 5'],
  ['The prefix un- means not.', 'The prefix un means not.'],
  ['How many dots? ● ● ●', 'How many dots? dot, dot, dot,'],
  ['What is 0.5 + 1.25?', 'What is 0.5 plus 1.25?'],
];

describe('toSpoken', () => {
  it.each(cases)('%s', (input, expected) => {
    expect(toSpoken(input)).toBe(expected);
  });
  it('leaves plain words alone', () => {
    expect(toSpoken('The cat sat on the mat.')).toBe('The cat sat on the mat.');
    expect(toSpoken('A well-known four-leaf clover')).toBe('A well-known four-leaf clover');
  });
});
