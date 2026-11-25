import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { Dataset } from '../domain/dataset.ts';
import { datasetFiles } from '../domain/files.ts';
import { policyFileName } from '../domain/policies.ts';
import { renderPolicyPdf } from './pdf.ts';

const POLICY_SOURCE = join(import.meta.dirname, '../../policies');

export async function writeDataset(dataset: Dataset, outDir: string): Promise<number> {
  const files = new Map<string, string | Buffer>(datasetFiles(dataset));
  for (const policy of dataset.policies) {
    const name = policyFileName(policy);
    const markdown = await readFile(join(POLICY_SOURCE, `${name}.md`), 'utf8');
    files.set(`policies/${name}.md`, markdown);
    files.set(`policies/${name}.pdf`, await renderPolicyPdf(policy, markdown));
    files.set(`policies/${name}.json`, `${JSON.stringify(policy, null, 2)}\n`);
  }
  for (const [path, content] of files) {
    const target = join(outDir, path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content);
  }
  return files.size;
}
