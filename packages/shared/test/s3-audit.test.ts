import { S3Client } from '@aws-sdk/client-s3';
import { beforeEach, describe, expect, it } from 'vitest';
import type { AuditEvent } from '../src';
import { S3AuditClient } from '../src/s3-audit';

interface Request {
  method: string;
  path: string;
  headers: Record<string, string>;
  body: string;
}

const event: AuditEvent = {
  id: 'E1',
  type: 'tool_call',
  caseId: 'C1',
  traceId: 'T1',
  occurredAt: '2026-11-25T10:00:00.000Z',
  actor: { type: 'service', id: 'workflow' },
  tool: 'GetCustomer',
  redactedInput: { customer: '[PERSON_1]' },
  redactedOutput: null,
  status: 'success',
  costUsd: 0,
  latencyMs: 12,
};

let requests: Request[];
/** Every object version, as in a versioned bucket: a second write to a key adds one. */
let stored: { path: string; body: string }[];
let failWith: { status: number; code: string } | null;
beforeEach(() => {
  requests = [];
  stored = [];
  failWith = null;
});

const errorResponse = (status: number, code: string) => ({
  response: {
    statusCode: status,
    headers: { 'content-type': 'application/xml' },
    body: Buffer.from(`<Error><Code>${code}</Code><Message>no</Message></Error>`),
  },
});

/** A real S3 client over an in-memory bucket that honours If-None-Match. */
const s3 = new S3Client({
  region: 'eu-west-2',
  credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
  maxAttempts: 1,
  requestHandler: {
    handle: (request: Request) => {
      requests.push(request);
      if (failWith) return Promise.resolve(errorResponse(failWith.status, failWith.code));
      if (request.headers['if-none-match'] === '*' && stored.some((o) => o.path === request.path)) {
        return Promise.resolve(errorResponse(412, 'PreconditionFailed'));
      }
      stored.push({ path: request.path, body: String(request.body) });
      return Promise.resolve({
        response: { statusCode: 200, headers: {}, body: Buffer.alloc(0) },
      });
    },
  },
});
const client = new S3AuditClient(s3, 'audit-bucket');

describe('S3 audit client', () => {
  it('stores the event under its case', async () => {
    await client.record(event);
    const { path, body } = stored[0] ?? { path: '', body: '' };
    expect(decodeURIComponent(path)).toMatch(
      /^\/cases\/C1\/2026-11-25T10:00:00\.000Z-E1-[0-9a-f]{32}\.json$/,
    );
    expect(JSON.parse(body)).toEqual(event);
  });

  it('sends a SHA-256 checksum', async () => {
    await client.record(event);
    expect(requests[0]?.headers['x-amz-checksum-sha256']).toEqual(expect.any(String));
  });

  it('stores an identical event once', async () => {
    await client.record(event);
    await client.record(event);
    expect(requests).toHaveLength(2);
    expect(stored.length).toBe(1);
  });

  it('keeps both events when the same id is reused with different content', async () => {
    await client.record(event);
    await client.record({ ...event, status: 'error' });
    expect(stored.length).toBe(2);
  });

  it('keeps a case id with slashes inside its own prefix', async () => {
    await client.record({ ...event, caseId: '../C2/x' });
    const { path } = stored[0] ?? { path: '' };
    expect(path.split('/')).toHaveLength(4);
  });

  it('rejects an invalid event without sending it', async () => {
    await expect(client.record({ ...event, caseId: '' })).rejects.toMatchObject({
      code: 'AUDIT_EVENT_INVALID',
      retryable: false,
    });
    expect(requests).toEqual([]);
  });

  it.each([
    [503, 'SlowDown', true],
    [409, 'ConditionalRequestConflict', true],
    [403, 'AccessDenied', false],
    [404, 'NoSuchBucket', false],
  ])('reports %i %s with retryable %s', async (status, code, retryable) => {
    failWith = { status, code };
    await expect(client.record(event)).rejects.toMatchObject({
      code: 'AUDIT_WRITE_FAILED',
      retryable,
    });
  });
});
