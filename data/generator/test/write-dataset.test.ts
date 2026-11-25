import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { policyDocSchema } from '@northmoor/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { writeDataset } from '../src/adapters/write-dataset.ts';
import { DEFAULT_SEED, generateDataset, generateSample } from '../src/domain/dataset.ts';
import { POLICIES, policyFileName } from '../src/domain/policies.ts';

const GENERATOR = join(import.meta.dirname, '..');
const SAMPLE = join(GENERATOR, '../generated/sample');

async function readTree(dir: string): Promise<Map<string, string>> {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  const paths = entries.filter((e) => e.isFile()).map((e) => join(e.parentPath, e.name));
  return new Map(
    await Promise.all(
      paths
        .sort()
        .map(async (p) => [relative(dir, p), (await readFile(p)).toString('base64')] as const),
    ),
  );
}

describe('written files', () => {
  let root: string;
  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'northmoor-gen-'));
  });
  afterAll(() => rm(root, { recursive: true }));

  it('are byte-identical across runs, including PDFs', async () => {
    await writeDataset(generateDataset(DEFAULT_SEED), join(root, 'a'));
    await new Promise((resolve) => setTimeout(resolve, 1100)); // PDF dates have 1s resolution
    await writeDataset(generateDataset(DEFAULT_SEED), join(root, 'b'));
    expect(await readTree(join(root, 'a'))).toEqual(await readTree(join(root, 'b')));
  });

  it('match the committed sample', async () => {
    await writeDataset(generateSample(DEFAULT_SEED), join(root, 'sample'));
    expect(await readTree(SAMPLE)).toEqual(await readTree(join(root, 'sample')));
  });
});

describe('sample', () => {
  const sample = generateSample(DEFAULT_SEED);

  it('has 20 cases including a duplicate, and 3 documents', () => {
    expect(sample.complaints.truth.csvQuality.uniqueComplaints).toBe(20);
    expect(sample.complaints.truth.csvQuality.duplicates.length).toBeGreaterThan(0);
    expect(sample.policies).toHaveLength(3);
  });

  it('includes every customer it links to', () => {
    const ids = sample.customers.map((c) => c.customer.id).sort();
    expect([...new Set(Object.values(sample.complaints.truth.customerLinks))].sort()).toEqual(ids);
  });
});

describe('policies', () => {
  it('has 12 to 15 documents that match the shared schema', () => {
    expect(POLICIES.length).toBeGreaterThanOrEqual(12);
    expect(POLICIES.length).toBeLessThanOrEqual(15);
    for (const p of POLICIES) expect(policyDocSchema.parse(p)).toEqual(p);
  });

  it('restricts exactly the three sensitive documents to team leads', () => {
    expect(POLICIES.filter((p) => p.accessLevel === 'team_lead').map((p) => p.id)).toEqual([
      'fraud-indicators',
      'vulnerable-customers',
      'redress-authority',
    ]);
  });

  it('has an older version of exactly two documents', () => {
    const older = POLICIES.filter((p) =>
      POLICIES.some((q) => q.id === p.id && q.effectiveDate > p.effectiveDate),
    );
    expect(older.map((p) => policyFileName(p))).toEqual([
      'fee-waiver-v1.0',
      'arrears-handling-v1.0',
    ]);
  });

  it.each(POLICIES.map((p) => [policyFileName(p), p] as const))(
    '%s states the title and version in its metadata',
    async (name, policy) => {
      const markdown = await readFile(join(GENERATOR, 'policies', `${name}.md`), 'utf8');
      expect(markdown.startsWith(`# ${policy.title}\n\nVersion ${policy.version}. `)).toBe(true);
    },
  );
});
