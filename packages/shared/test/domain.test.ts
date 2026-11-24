import { expect, it } from 'vitest';
import { approvalEventSchema, auditEventSchema, draftSchema } from '../src';

const approval = {
  id: 'A1',
  caseId: 'C1',
  draftId: 'D1',
  draftRevision: 1,
  decision: 'approved',
  approver: { id: 'U1', displayName: 'Test Lead', role: 'team_lead' },
  decidedAt: '2026-11-24T10:00:00Z',
};

it('requires a named approver', () => {
  expect(approvalEventSchema.safeParse(approval).success).toBe(true);
  for (const approver of [
    undefined,
    { ...approval.approver, id: ' ' },
    { ...approval.approver, displayName: '' },
  ]) {
    expect(approvalEventSchema.safeParse({ ...approval, approver }).success).toBe(false);
  }
});

it('rejects fractional pence', () => {
  const draft = {
    id: 'D1',
    caseId: 'C1',
    revision: 1,
    body: 'text',
    citations: [],
    proposedOutcome: 'upheld',
    proposedRedressPence: 1250,
    createdAt: '2026-11-24T10:00:00Z',
  };
  expect(draftSchema.safeParse(draft).success).toBe(true);
  expect(draftSchema.safeParse({ ...draft, proposedRedressPence: 12.5 }).success).toBe(false);
});

it('requires cost and latency on model calls', () => {
  const call = {
    id: 'E1',
    type: 'model_call',
    caseId: 'C1',
    traceId: 'T1',
    occurredAt: '2026-11-24T10:00:00Z',
    actor: { type: 'service', id: 'pii-proxy' },
    redactedInput: 'in',
    redactedOutput: 'out',
    status: 'success',
    modelId: 'm',
    tokensIn: 1,
    tokensOut: 1,
    costUsd: 0.01,
    latencyMs: 5,
  };
  expect(auditEventSchema.safeParse(call).success).toBe(true);
  expect(auditEventSchema.safeParse({ ...call, costUsd: undefined }).success).toBe(false);
  expect(auditEventSchema.safeParse({ ...call, latencyMs: undefined }).success).toBe(false);
});
