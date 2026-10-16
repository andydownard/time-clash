// npm run check:dist. Fails if the production build still holds the e2e test hook.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Names of the files that contain the test hook. */
export function findHookLeak(files: ReadonlyArray<{ name: string; text: string }>): string[] {
  return files.filter((f) => f.text.includes('__timeclash')).map((f) => f.name);
}

function main(): void {
  const dir = join(import.meta.dirname, '../dist/assets');
  let names: string[];
  try {
    names = readdirSync(dir).filter((n) => n.endsWith('.js'));
  } catch {
    console.error('check:dist: dist/assets not found. Run npm run build first.');
    process.exit(1);
  }
  const leaks = findHookLeak(
    names.map((name) => ({ name, text: readFileSync(join(dir, name), 'utf8') })),
  );
  if (leaks.length > 0) {
    console.error(`check:dist: the test hook is in the production build: ${leaks.join(', ')}`);
    process.exit(1);
  }
  console.log(`check:dist: OK, the test hook is not in ${names.length} script file(s)`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
