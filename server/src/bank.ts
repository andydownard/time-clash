// Loads the question bank for the server. The web build uses import.meta.glob; plain Node cannot,
// so this reads the same JSON files and hands them to the same buildBank.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildBank } from '../../src/questions/bankLoader';
import type { QuestionBank } from '../../src/questions/types';

export function loadBank(
  dir = join(import.meta.dirname, '../../src/questions/bank'),
): QuestionBank {
  const files: Record<string, unknown> = {};
  for (const name of readdirSync(dir)) {
    if (name.endsWith('.json'))
      files[`./${name}`] = JSON.parse(readFileSync(join(dir, name), 'utf8'));
  }
  return buildBank(files);
}
