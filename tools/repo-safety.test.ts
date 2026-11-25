import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { findForbiddenFiles } from './repo-safety.js';

describe('repo safety', () => {
  it('has no forbidden files tracked or staged', () => {
    const tracked = execFileSync('git', ['ls-files', '-z'], {
      cwd: resolve(import.meta.dirname, '..'),
      encoding: 'utf8',
    })
      .split('\0')
      .filter(Boolean);
    expect(tracked).toContain('package.json');
    expect(findForbiddenFiles(tracked)).toEqual([]);
  });

  it.each([
    'data/generated/customers.json',
    'data/generated/truth/planted_pii.json',
    'data/generated/sample-full/customers.json',
    'data/raw/fca/disp.pdf',
    '.env',
    '.env.local',
    'services/api/.env.production',
    'infra/terraform.tfstate',
    'infra/terraform.tfstate.backup',
    'infra/dev.tfplan',
  ])('rejects %s', (path) => {
    expect(findForbiddenFiles([path])).toHaveLength(1);
  });

  it.each([
    'data/generated/sample/customers.json',
    'data/raw/README.md',
    '.env.example',
    'services/api/src/env.ts',
    'infra/envs/dev.tfvars',
  ])('allows %s', (path) => {
    expect(findForbiddenFiles([path])).toEqual([]);
  });
});
