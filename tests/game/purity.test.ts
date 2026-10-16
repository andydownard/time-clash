import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const DIR = join(__dirname, '../../src/game');
const files = readdirSync(DIR).filter((f) => f.endsWith('.ts'));
const code = (f: string): string => readFileSync(join(DIR, f), 'utf8');

describe('src/game stays pure', () => {
  it('has the expected rule modules', () => {
    for (const f of [
      'rng',
      'wind',
      'ballistics',
      'damage',
      'reload',
      'turn',
      'match',
      'names',
      'config',
      'types',
    ]) {
      expect(files).toContain(`${f}.ts`);
    }
  });
  it.each(files)('%s imports nothing from Phaser, the DOM, or the network', (f) => {
    const src = code(f);
    expect(src).not.toMatch(/from\s+['"]phaser/i);
    expect(src).not.toMatch(/require\(\s*['"]phaser/i);
    expect(src).not.toMatch(/\b(window|document|localStorage|fetch|XMLHttpRequest|WebSocket)\b/);
  });
  it.each(files)('%s uses no unseeded randomness or wall clock', (f) => {
    const src = code(f);
    expect(src).not.toMatch(/Math\.random/);
    expect(src).not.toMatch(/Date\.now|new Date\(|performance\.now/);
  });
  it.each(files)('%s contains no banned words from the kid-safe list', (f) => {
    // names.ts holds the block list itself, so it is exempt from this check.
    if (f === 'names.ts') return;
    expect(code(f)).not.toMatch(/\b(kill|die|dead|blood|gore|defeat|buy|price)\b/i);
  });
});
