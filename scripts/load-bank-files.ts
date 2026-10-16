// Shared by the question scripts: reads src/questions/bank/*.json from disk (no Vite needed).
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { BankFile } from '../src/questions/checkBank';

export const BANK_DIR = fileURLToPath(new URL('../src/questions/bank', import.meta.url));

export function loadBankFiles(dir: string = BANK_DIR): BankFile[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((file) => {
      try {
        return { file, data: JSON.parse(readFileSync(join(dir, file), 'utf8')) as unknown };
      } catch (e) {
        return { file, data: `invalid JSON: ${(e as Error).message}` };
      }
    });
}
