import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { writeDataset } from './adapters/write-dataset.ts';
import { DEFAULT_SEED, generateDataset, generateSample } from './domain/dataset.ts';

const GENERATED = join(import.meta.dirname, '../../generated');

const { values } = parseArgs({
  options: {
    seed: { type: 'string', default: String(DEFAULT_SEED) },
    out: { type: 'string' },
    sample: { type: 'boolean', default: false },
  },
});
if (!/^\d{1,9}$/.test(values.seed)) throw new RangeError('--seed must be a whole number');
const seed = Number(values.seed);
const out = values.out ?? (values.sample ? join(GENERATED, 'sample') : GENERATED);
const count = await writeDataset(values.sample ? generateSample(seed) : generateDataset(seed), out);
process.stdout.write(`Wrote ${count} files to ${out} (seed ${seed})\n`);
