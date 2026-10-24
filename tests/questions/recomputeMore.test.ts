import { describe, expect, it } from 'vitest';
import { recomputeMathAnswer, validateQuestion } from '../../src/questions/validate';
import type { Question } from '../../src/questions/types';
import { mq } from './helpers';

const CASES: ReadonlyArray<readonly [string, string]> = [
  ['What is the mean of 4, 8, 9, and 15?', '9'],
  ['What is the mean of 12, 15, 18, 21, 24, and 30?', '20'],
  ['What is the median of 3, 14, 7, 9, and 21?', '9'],
  ['What is the median of 2, 4, 6, and 10?', '5'],
  ['What is the range of 3, 8, 15, 22, and 9?', '19'],
  ['What is the slope of the line through (-2, 1) and (2, 6)?', '5/4'],
  ['What is the slope of the line through (0, 5) and (4, -3)?', '-2'],
  ['A line goes through the points (1, 2) and (3, 8). What is its slope?', '3'],
  ['A right triangle has legs 6 and 8. How long is the longest side?', '10'],
  ['A right triangle has short sides of 9 and 12. How long is the long side?', '15'],
  ['A right triangle has a hypotenuse of 13 and one leg of 5. How long is the other leg?', '12'],
  ['How far is the point (9, 12) from the point (0, 0)?', '15'],
  ['What is the distance between the points (1, 2) and (7, 10)?', '10'],
  ['Round 47 to the nearest ten.', '50'],
  ['Round 463 to the nearest hundred.', '500'],
  ['What is 4,672 rounded to the nearest hundred?', '4700'],
  ['What is 2,846,310 rounded to the nearest hundred thousand?', '2800000'],
  ['What is the square root of 169?', '13'],
  ['What is the square root of 144 plus the square root of 25?', '17'],
  ['What is the cube root of 27 plus the square root of 16?', '7'],
  ['Solve for x: 3x + 5 = 2x + 12', '7'],
  ['Solve for x: 4(x + 2) = 2x + 18', '5'],
  ['A knight solves 5x - 4 = 3x + 10. What is x?', '7'],
  ['What is 2x^2 - 3x when x = 4?', '20'],
  ['If f(x) = x^2 - 4x + 1, what is f(3)?', '-2'],
  ['For the line y = 2x + 3, what is y when x = 4?', '11'],
  ['A cylinder drum has radius 3 and height 10. Use 3.14. What is its volume?', '1413/5'],
  ['A cone has radius 6 and height 5. Use 3.14. What is its volume?', '942/5'],
  ['A sphere has radius 6. Use 3.14. What is its volume?', '22608/25'],
  ['A circle has a radius of 3 inches. What is its circumference? Use 3.14.', '471/25'],
  [
    'A round pizza has a diameter of 12 inches. What is its area in square inches? Use 3.14.',
    '2826/25',
  ],
  ['A box is 4 long, 5 wide, and 6 high. What is its volume?', '120'],
  ['A moat is 10 m long, 2 m wide, and 1.5 m deep. What is its volume in cubic m?', '30'],
  ['What is the volume of a cube with side length 4?', '64'],
  ['A rectangle is 5 units long and 3 units wide. What is its perimeter?', '16'],
  ['A square has a perimeter of 36. What is its area?', '81'],
  ['What is the area of a triangle with base 10 and height 6, in square units?', '30'],
  [
    'A triangle has two angles. One is 50 degrees. One is 60 degrees. How big is the third angle?',
    '70',
  ],
  ['The angles in a triangle add up to 180. Two angles are 70 and 60. What is the third?', '50'],
  ['The ratio of cats to dogs is 3 to 5. There are 15 dogs. How many cats are there?', '9'],
  ['5 jam tarts cost $40. At the same rate, how much do 8 jam tarts cost, in dollars?', '64'],
  ['Count by 5s: 5, 10, 15, 20, ___', '25'],
  ['Count by tens: 10, 20, 30. What number comes next?', '40'],
  ['What number comes next? 3, 6, 12, 24, ...', '48'],
  ['What number comes next: 2, 6, 18, 54, ...?', '162'],
  ['Which number comes right after 17?', '18'],
  ['What is 100 less than 530?', '430'],
  ['Which number is one less than 40?', '39'],
  ['What is the remainder of 123 / 8?', '3'],
  ['What is 85 / 4, rounded down to a whole number?', '21'],
  ['96 knights sit at tables of 7. How many tables are completely full?', '13'],
  ['What is the greatest common factor of 18 and 24?', '6'],
  ['What is the least common multiple of 4 and 6?', '12'],
  ['What is the next multiple of 7 after 49?', '56'],
  ['How many factors does 12 have? (1, 2, 3, 4, 6, 12 ...)', '6'],
  ['What is 5! (five factorial)?', '120'],
  ['What is the absolute value of -13?', '13'],
  ['What is the diameter of a circle with a radius of 9?', '18'],
  ['What is log base 2 of 1024?', '10'],
  ['What is the log of 1000 in base 10?', '3'],
  ['What is log base 10 of 0.01?', '-2'],
];

describe('recomputeMathAnswer: extra shapes', () => {
  it.each(CASES)('%s', (prompt, want) => {
    expect(recomputeMathAnswer(prompt)).toBe(want);
  });

  it('gives up on a reworded prompt instead of guessing', () => {
    expect(recomputeMathAnswer('Find the middle of 3, 14, 7, 9, and 21.')).toBeNull();
    expect(recomputeMathAnswer('What is the mean of the first five odd numbers?')).toBeNull();
    expect(recomputeMathAnswer('What number comes next? 2, 5, 10, 17, 26, ...')).toBeNull();
  });

  it('gives up when the answer is not a whole number root or log', () => {
    expect(recomputeMathAnswer('What is the square root of 150?')).toBeNull();
    expect(recomputeMathAnswer('What is log base 2 of 100?')).toBeNull();
    expect(
      recomputeMathAnswer('A right triangle has legs 2 and 3. How long is the longest side?'),
    ).toBeNull();
  });

  it('gives up on a ratio that asks about the wrong side', () => {
    expect(
      recomputeMathAnswer(
        'The ratio of cats to dogs is 3 to 5. There are 15 cats. How many cats are there?',
      ),
    ).toBeNull();
  });
});

describe('validateQuestion: extra shapes catch a wrong key', () => {
  const problems = (q: unknown): string[] => validateQuestion(q as Question);
  const base = {
    prompt: 'What is the mean of 4, 8, 9, and 15?',
    hint: 'Add them up. Then share equally.',
  };

  it('accepts the right key', () => {
    expect(problems(mq({ ...base, choices: ['36', '9', '8.5', '10'], answer: '9' }))).toEqual([]);
  });
  it('flags a wrong mean', () => {
    const p = problems(mq({ ...base, choices: ['36', '9', '8.5', '10'], answer: '8.5' }));
    expect(p.join()).toContain('does not match recomputed answer 9');
  });
  it('flags a wrong slope', () => {
    const p = problems(
      mq({
        prompt: 'What is the slope of the line through (1, 2) and (3, 8)?',
        hint: 'Rise over run.',
        choices: ['6', '1/3', '3', '2'],
        answer: '2',
      }),
    );
    expect(p.join()).toContain('does not match recomputed answer 3');
  });
  it('flags a wrong equation answer', () => {
    const p = problems(
      mq({
        prompt: 'Solve for x: 3x + 5 = 2x + 12',
        hint: 'Get the x terms on one side.',
        choices: ['7', '17', '5', '-7'],
        answer: '17',
      }),
    );
    expect(p.join()).toContain('does not match recomputed answer 7');
  });
  it('flags a second right choice', () => {
    const p = problems(
      mq({
        prompt: 'What is the square root of 169?',
        hint: 'What times itself is 169?',
        choices: ['13', '13.0', '14', '17'],
        answer: '13',
      }),
    );
    expect(p.join()).toContain('same value as the answer');
  });
});
