import { expect, it } from 'vitest';
import { z } from 'zod';
import { baseConfigSchema, loadConfig } from '../src';

const schema = baseConfigSchema.extend({
  PORT: z.coerce.number().int(),
  TOKEN: z.string().min(10),
});

it('parses values and applies defaults', () => {
  const config = loadConfig(schema, { PORT: '8080', TOKEN: 'abcdefghijk', LOG_LEVEL: '' });
  expect(config).toEqual({
    PORT: 8080,
    TOKEN: 'abcdefghijk',
    NODE_ENV: 'development',
    LOG_LEVEL: 'info',
  });
});

const loadInvalid = () => loadConfig(schema, { TOKEN: 'hunter2', LOG_LEVEL: 'verysecret' });

it('fails with a stable, non-retryable code', () => {
  expect(loadInvalid).toThrow(
    expect.objectContaining({ code: 'CONFIG_INVALID', name: 'CONFIG_INVALID', retryable: false }),
  );
});

it('names a missing variable', () => {
  expect(loadInvalid).toThrow(/PORT: missing/);
});

it('names an invalid variable', () => {
  expect(loadInvalid).toThrow(/TOKEN: invalid/);
});

it('never puts values in the error message', () => {
  expect(loadInvalid).toThrow(
    expect.objectContaining({ message: expect.not.stringMatching(/hunter2|verysecret/) as string }),
  );
});
