import { expect, it } from 'vitest';
import { createLogger, type LogContext, type LoggerOptions } from '../src';

function capture(options: Partial<LoggerOptions> = {}) {
  const lines: Record<string, unknown>[] = [];
  const logger = createLogger({
    service: 'test',
    context: { caseId: 'C1', traceId: 'T1' },
    write: (line) => lines.push(JSON.parse(line) as Record<string, unknown>),
    ...options,
  });
  return { logger, lines };
}

it('puts caseId and traceId on every line, including children', () => {
  const { logger, lines } = capture();
  logger.info('one', { attempt: 1 });
  logger.child({ step: 'triage' }).error('two');
  expect(lines).toHaveLength(2);
  for (const line of lines) expect(line).toMatchObject({ caseId: 'C1', traceId: 'T1' });
  expect(lines[1]).toMatchObject({ step: 'triage', level: 'error', message: 'two' });
});

it('does not let fields overwrite the context', () => {
  const { logger, lines } = capture();
  logger.info('x', { caseId: 'other', traceId: 'other', level: 'none' });
  expect(lines[0]).toMatchObject({ caseId: 'C1', traceId: 'T1', level: 'info' });
});

it('rejects an empty caseId', () => {
  expect(() => capture({ context: { caseId: '', traceId: 'T1' } })).toThrow(
    expect.objectContaining({ code: 'LOG_CONTEXT_INVALID' }),
  );
});

it('rejects an empty traceId', () => {
  expect(() => capture({ context: { caseId: 'C1', traceId: '' } })).toThrow(
    expect.objectContaining({ code: 'LOG_CONTEXT_INVALID' }),
  );
});

it('rejects a missing traceId at compile time and at runtime', () => {
  // @ts-expect-error traceId is required at compile time too
  const incomplete: LogContext = { caseId: 'C1' };
  expect(() => capture({ context: incomplete })).toThrow();
});

it('masks fields named after PII', () => {
  const { logger, lines } = capture();
  logger.info('x', {
    email: 'a@b.com',
    sort_code: '01-02-03',
    accountNumber: '12345678',
    docId: 'D1',
  });
  expect(lines[0]).toMatchObject({
    email: '[MASKED]',
    sort_code: '[MASKED]',
    accountNumber: '[MASKED]',
    docId: 'D1',
  });
});

it('respects the level', () => {
  const { logger, lines } = capture({ level: 'warn' });
  logger.info('no');
  logger.warn('yes');
  expect(lines.map((l) => l['message'])).toEqual(['yes']);
});
