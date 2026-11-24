/**
 * Enforces the "no PII reaches the model" rule: only services/pii-proxy may talk to a model.
 * Imports are checked by package; the string selectors also catch dynamic import(), require()
 * and hand-built calls to the Bedrock runtime endpoint.
 */
export const MODEL_PACKAGES = [
  '@aws-sdk/client-bedrock-runtime',
  '@aws-sdk/client-bedrock-agent-runtime',
  '@anthropic-ai/bedrock-sdk',
  '@anthropic-ai/sdk',
  '@ai-sdk/amazon-bedrock',
  '@langchain/aws',
];

const message =
  'Only services/pii-proxy may call a model. Go through the PII proxy so the input is redacted and audited.';

const stringPattern =
  '/bedrock-(agent-)?runtime|@anthropic-ai\\u002f|@ai-sdk\\u002famazon-bedrock|@langchain\\u002faws/';

/** @type {import('eslint').Linter.Config[]} */
export const modelAccessRules = [
  {
    files: ['**/*.{ts,tsx,mts,cts,js,mjs,cjs}'],
    ignores: ['services/pii-proxy/**', 'tools/lint/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: MODEL_PACKAGES.map((name) => ({ group: [name, `${name}/*`], message })),
        },
      ],
      'no-restricted-syntax': [
        'error',
        { selector: `Literal[value=${stringPattern}]`, message },
        { selector: `TemplateElement[value.raw=${stringPattern}]`, message },
      ],
    },
  },
];
