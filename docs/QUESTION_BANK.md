# Question bank rules

For anyone who writes or checks questions. The checker is `npm run check:questions`. It runs in CI.

## Files
One JSON array per subject and grade, in `src/questions/bank/`. The name is `<subject>-<grade>.json`. Kindergarten is grade 0.

Examples: `math-0.json`, `math-5.json`, `reading-12.json`.

## Fields
Each question follows `src/questions/types.ts`.

- `id`: `<subject>-<grade>-<nnnn>`, for example `math-5-0042`. Four digits. Unique in the whole bank. The subject and grade must match the file.
- `subject`, `grade`, `kind`: kind is `numeric`, `choice`, `vocab`, `mainidea`, or `grammar`. `numeric` is math only. The other reading kinds are reading only.
- `prompt`: plain text a child reads. No two prompts in one file may match (same prompt, same passage).
- `choices`: 3 or 4 different non-blank strings. Use 4 unless there is a good reason.
- `answer`: must equal one choice exactly.
- `hint`: required. Short and kind. It must not contain the answer as a whole word or number (the checker looks).
- `tags`: array of strings. Add `"manual"` to a math question whose prompt is not one of the patterns below.
- Every question must be answerable by reading. No question may depend on hearing a word (no "Tap the word you hear"), and the game does not read questions aloud. The owner removed the `sightword` kind, `audioWord`, and read-aloud on 2026-10-23 (`tests/questions/readOnly.test.ts`).
- `passage`: required for `mainidea`.

## Math prompts the checker recomputes
The checker works the prompt out for itself and compares it with `answer`. A mismatch fails the build. It uses a small parser (no `eval`) and exact fractions.

Prompts must match exactly: capital letters, spaces, and the final `?`.

1. `What is A + B?`, `What is A - B?`, `What is A x B?`, `What is A / B?`. Example: `What is 7 x 8?`. A and B are numbers (decimals allowed). Longer chains such as `What is 2 + 3 x 4?` also work and follow the usual order of operations.
2. `Solve for x: ax + b = c` and `Solve for x: ax - b = c`. Examples: `Solve for x: 3x + 5 = 20`, `Solve for x: x - 4 = 10`, `Solve for x: -2x + 6 = 0`. `a` may be left out (meaning 1). `b` is not negative; `c` may be.
3. `What is N% of M?`. Example: `What is 25% of 80?`. Write the answer as a number with no `%`.
4. `What is the area of a rectangle with length L and width W?`. Example: `... length 6 and width 4?`. Write the answer as a number with no units.
5. `What is X/Y + P/Q?`. Example: `What is 1/2 + 1/3?`. Also works with `-`, `x`, and `/`. Write fraction answers in simplest form as `a/b` (like `5/6`). A whole-number result is just the number (`1`, not `4/4`).
6. `What is the value of E?` where E uses numbers, `+ - x / ^`, and parentheses. Example: `What is the value of (3 + 4) x 2?`. Exponents must be whole numbers. `^` binds tighter than `x`, and `-2^2` is `-4`.

How answers are compared:
- Any form with the same value passes: `0.5` equals `1/2`. A fraction answer with a slash must be in lowest terms (`2/4` fails).
- Thousands commas are fine (`1,000`).
- Division that does not come out even is a fraction: `What is 7 / 2?` has answer `7/2` or `3.5`.
- Dividing by zero, huge numbers, and anything the parser cannot read count as "not a pattern".

## Math prompts the checker cannot recompute
Anything else (word problems, geometry, "Which is bigger?", and so on) must carry the tag `"manual"`. Those cells are covered by the blind-solve check below.

## Blind-solve check
A solver who has not seen the answers works every question in a cell. Then we compare.

```
npm run blind:export -- math-5 > /tmp/math-5.questions.json
# the solver writes picks.json: [{ "id": "math-5-0001", "choice": "56" }, ...]
npm run blind:compare -- math-5 picks.json
```

`blind:export` prints each question without `answer`, `hint`, or `tags`. `blind:compare` prints JSON with `mismatches` (each shows `id`, `choice`, `expected`), `missing`, `unknown`, and `duplicates`. It exits 1 if anything is off. A mismatch means the key or the question is wrong. Fix it and run again.

## Other checks
- Banned words in any visible text: kill, die, dead, blood, gore, defeat, buy, price (and endings like "killed").
- The file must be valid JSON and a non-empty array.
- `npm run check:questions` prints `check:questions: OK` and a count per file when everything passes.

## How the game picks a question
`src/questions/pick.ts`. Seeded and pure.
- Subject `both` alternates reading, then math, for each team.
- If a grade has no questions, the nearest grade is used. A tie goes to the easier grade.
- No question repeats until the pool is used up. Then the pool reshuffles, and the question just asked is not asked again right away.
- Used ids are saved in `localStorage` under `timeclash.history` (on this device only).
