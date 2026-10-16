import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import { resolveVersion } from './scripts/version.ts';

/** Writes dist/version.txt so a deploy can be checked against the commit (VERIFY). */
function versionFile(): Plugin {
  return {
    name: 'time-clash-version-file',
    apply: 'build',
    closeBundle() {
      const dir = resolve(import.meta.dirname, 'dist');
      mkdirSync(dir, { recursive: true });
      writeFileSync(resolve(dir, 'version.txt'), `${resolveVersion(process.env)}\n`);
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [versionFile()],
  build: { target: 'es2022', chunkSizeWarningLimit: 1500 },
});
