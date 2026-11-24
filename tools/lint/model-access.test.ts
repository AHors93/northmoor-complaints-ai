import { globSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import tseslint from 'typescript-eslint';
import { Linter } from 'eslint';
import { describe, expect, it } from 'vitest';
import { MODEL_PACKAGES, modelAccessRules } from './model-access.js';

const root = resolve(import.meta.dirname, '../..');
const RULES = ['no-restricted-imports', 'no-restricted-syntax'];

function violations(code: string, filename: string): string[] {
  const linter = new Linter({ cwd: root });
  const messages = linter.verify(
    code,
    [
      { files: ['**/*.ts'], languageOptions: { parser: tseslint.parser } },
      { linterOptions: { noInlineConfig: true } },
      ...modelAccessRules,
    ],
    { filename: resolve(root, filename) },
  );
  expect(messages.filter((m) => m.fatal)).toEqual([]);
  return messages.map((m) => m.ruleId ?? '').filter((id) => RULES.includes(id));
}

const PKG = '@aws-sdk/client-bedrock-runtime';

describe('model access rule', () => {
  it.each(MODEL_PACKAGES)('rejects importing %s outside pii-proxy', (name) => {
    expect(violations(`import * as x from '${name}';`, 'services/rag/src/a.ts')).not.toEqual([]);
  });

  it.each([
    ['type import', `import type { A } from '${PKG}';`],
    ['re-export', `export * from '${PKG}';`],
    ['subpath', `import x from '${PKG}/dist-es/index.js';`],
    ['dynamic import', `await import('${PKG}');`],
    ['template dynamic import', `await import(\`${PKG}\`);`],
    ['require', `const x = require('${PKG}');`],
    ['raw endpoint', "fetch('https://bedrock-runtime.eu-west-2.amazonaws.com/model/x/converse');"],
    ['inline disable', `/* eslint-disable */\nimport * as x from '${PKG}';`],
  ])('rejects a %s', (_name, code) => {
    expect(violations(code, 'services/workflow/src/a.ts')).not.toEqual([]);
  });

  it.each(['packages/shared/src/a.ts', 'evals/a.ts', 'data/generator/src/a.ts'])(
    'applies in %s',
    (file) => {
      expect(violations(`import '${PKG}';`, file)).not.toEqual([]);
    },
  );

  it('allows pii-proxy', () => {
    expect(violations(`import * as x from '${PKG}';`, 'services/pii-proxy/src/a.ts')).toEqual([]);
  });

  it('allows unrelated AWS clients', () => {
    expect(violations(`import '@aws-sdk/client-s3';`, 'services/api/src/a.ts')).toEqual([]);
  });

  it('no package other than pii-proxy depends on a model SDK', () => {
    const manifests = globSync(
      [
        'package.json',
        '{packages,services}/*/package.json',
        'data/generator/package.json',
        'evals/package.json',
      ],
      { cwd: root },
    );
    expect(manifests.length).toBeGreaterThan(10);
    for (const file of manifests) {
      if (file.startsWith('services/pii-proxy')) continue;
      const text = readFileSync(resolve(root, file), 'utf8');
      for (const name of MODEL_PACKAGES) expect(text, file).not.toContain(`"${name}"`);
    }
  });
});
