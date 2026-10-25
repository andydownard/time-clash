// Whole-bank checks for `npm run check:questions`. Pure: callers pass in parsed file contents.
import { QUESTION_TOPICS, TOPIC_IDS } from '../game/config';
import { areHomophones } from './homophones';
import { validateQuestion } from './validate';

export type BankFile = { file: string; data: unknown };
export type BankCheck = { problems: string[]; counts: Record<string, number> };

const FILE_NAME = /^(math|reading)-(0|[1-9]|1[0-2])\.json$/;

export function parseBankFileName(
  file: string,
): { subject: 'math' | 'reading'; grade: number } | null {
  const m = FILE_NAME.exec(file);
  return m ? { subject: m[1] as 'math' | 'reading', grade: Number(m[2]) } : null;
}

export type CheckOptions = {
  /** Also require every math grade to hold enough questions for each topic. */
  requireTopics?: boolean;
};

export function checkBankFiles(files: readonly BankFile[], options: CheckOptions = {}): BankCheck {
  const problems: string[] = [];
  const counts: Record<string, number> = {};
  const ids = new Map<string, string>(); // id -> file
  if (files.length === 0) problems.push('no question files found');

  for (const { file, data } of files) {
    const cell = parseBankFileName(file);
    if (!cell) {
      problems.push(
        `${file}: file name must be <subject>-<grade>.json, like math-5.json or reading-0.json (K is 0)`,
      );
      continue;
    }
    if (!Array.isArray(data)) {
      problems.push(`${file}: must hold a JSON array of questions`);
      continue;
    }
    if (data.length === 0) {
      problems.push(`${file}: file is empty`);
      continue;
    }
    const key = `${cell.subject}-${cell.grade}`;
    counts[key] = (counts[key] ?? 0) + data.length;
    const prompts = new Map<string, string>(); // prompt+passage -> id

    data.forEach((entry: unknown, index) => {
      const rec = (typeof entry === 'object' && entry !== null ? entry : {}) as Record<
        string,
        unknown
      >;
      const id = typeof rec.id === 'string' ? rec.id : `#${index}`;
      const where = `${file} ${id}`;

      for (const p of validateQuestion(entry as never)) problems.push(`${where}: ${p}`);

      if (rec.subject !== cell.subject || rec.grade !== cell.grade) {
        problems.push(
          `${where}: question is subject ${String(rec.subject)} grade ${String(rec.grade)} but file ${file} holds ${cell.subject} grade ${cell.grade}`,
        );
      }

      if (
        rec.subject === 'reading' &&
        rec.kind === 'choice' &&
        typeof rec.prompt === 'string' &&
        !rec.prompt.includes('___') && // a fill-in has a sentence to settle it
        Array.isArray(rec.choices) &&
        typeof rec.answer === 'string'
      ) {
        for (const c of rec.choices) {
          if (typeof c === 'string' && areHomophones(c, rec.answer)) {
            problems.push(
              `${where}: choice "${c}" is a homophone of the answer "${rec.answer}". Two words that sound alike can look like a second right answer`,
            );
          }
        }
      }

      if (typeof rec.id === 'string') {
        const seen = ids.get(rec.id);
        if (seen !== undefined) problems.push(`${where}: duplicate id (also in ${seen})`);
        else ids.set(rec.id, file);
      }

      if (typeof rec.prompt === 'string') {
        const extra = [rec.passage]
          .map((v) => (typeof v === 'string' ? v.trim().toLowerCase() : ''))
          .join('||');
        const promptKey = `${rec.prompt.trim().toLowerCase()}||${extra}`;
        const first = prompts.get(promptKey);
        if (first !== undefined) problems.push(`${where}: duplicate prompt (same as ${first})`);
        else prompts.set(promptKey, id);
      }
    });
  }

  if (options.requireTopics) {
    for (const topic of TOPIC_IDS) {
      const tag = QUESTION_TOPICS.tags[topic];
      for (const { file, data } of files) {
        const cell = parseBankFileName(file);
        if (!cell || cell.subject !== 'math' || !Array.isArray(data)) continue;
        const n = data.filter(
          (e: unknown) =>
            typeof e === 'object' &&
            e !== null &&
            ((e as { tags?: unknown }).tags as unknown[] | undefined)?.includes?.(tag),
        ).length;
        if (n < QUESTION_TOPICS.minPerGrade) {
          problems.push(
            `${file}: only ${n} ${topic} questions (tag "${tag}"). Each grade needs at least ${QUESTION_TOPICS.minPerGrade}`,
          );
        }
      }
    }
  }
  return { problems, counts };
}
