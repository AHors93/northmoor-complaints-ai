// Bundles each Lambda and zips it with fixed timestamps, so the same code gives the same hash.
import { execFileSync } from 'node:child_process';
import { mkdir, rm, utimes } from 'node:fs/promises';
import { join } from 'node:path';
import { build } from 'esbuild';

const root = join(import.meta.dirname, '..');
const dist = join(root, 'dist');
await rm(dist, { recursive: true, force: true });

for (const name of ['me', 'pre-token']) {
  const dir = join(dist, name);
  await mkdir(dir, { recursive: true });
  const outfile = join(dir, 'index.mjs');
  await build({
    entryPoints: [join(root, 'src/handlers', `${name}.ts`)],
    outfile,
    bundle: true,
    minify: true,
    platform: 'node',
    target: 'node22',
    format: 'esm',
  });
  const fixed = new Date('2020-01-01T00:00:00Z');
  await utimes(outfile, fixed, fixed);
  execFileSync('zip', ['-X', '-q', join(dist, `${name}.zip`), 'index.mjs'], {
    cwd: dir,
    env: { ...process.env, TZ: 'UTC' },
  });
}
