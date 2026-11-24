import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { FileAuditClient, type AuditEvent } from '../src';

let dir: string;
let path: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'northmoor-audit-'));
  path = join(dir, 'nested', 'audit.jsonl');
});
afterEach(() => rm(dir, { recursive: true }));

const event = (id: string): AuditEvent => ({
  id,
  type: 'tool_call',
  caseId: 'C1',
  traceId: 'T1',
  occurredAt: '2026-11-24T10:00:00.000Z',
  actor: { type: 'service', id: 'workflow' },
  tool: 'GetCustomer',
  redactedInput: { customer: '[PERSON_1]' },
  redactedOutput: null,
  status: 'success',
  costUsd: 0,
  latencyMs: 12,
});

const readIds = async () =>
  (await readFile(path, 'utf8'))
    .trim()
    .split('\n')
    .map((line) => (JSON.parse(line) as AuditEvent).id);

it('appends concurrent events in order', async () => {
  const client = new FileAuditClient(path);
  const ids = Array.from({ length: 50 }, (_, i) => `E${i}`);
  await Promise.all(ids.map((id) => client.record(event(id))));
  expect(await readIds()).toEqual(ids);
});

it('keeps earlier events when reopened', async () => {
  await new FileAuditClient(path).record(event('E1'));
  await new FileAuditClient(path).record(event('E2'));
  expect(await readIds()).toEqual(['E1', 'E2']);
});

it('rejects an invalid event with a stable code', async () => {
  const invalid = { ...event('E1'), caseId: '' };
  await expect(new FileAuditClient(path).record(invalid)).rejects.toMatchObject({
    code: 'AUDIT_EVENT_INVALID',
    retryable: false,
  });
});

it('reports a failed write as retryable', async () => {
  await expect(new FileAuditClient(dir).record(event('E1'))).rejects.toMatchObject({
    code: 'AUDIT_WRITE_FAILED',
    retryable: true,
  });
});

it('keeps recording after a rejected event', async () => {
  const client = new FileAuditClient(path);
  await client.record({ ...event('E1'), caseId: '' }).catch(() => undefined);
  await client.record(event('E2'));
  expect(await readIds()).toEqual(['E2']);
});
