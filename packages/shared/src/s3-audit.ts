import { createHash } from 'node:crypto';
import { PutObjectCommand, type S3Client } from '@aws-sdk/client-s3';
import type { AuditClient } from './audit';
import { auditEventSchema, type AuditEvent } from './domain';
import { AppError } from './errors';

const TIMEOUT_MS = 5000;
const NOT_RETRYABLE = new Set(['AccessDenied', 'NoSuchBucket', 'InvalidRequest']);

/**
 * Writes one object per event. The bucket's Object Lock default retention makes it immutable.
 * The key includes a hash of the content, so repeating a write stores nothing new, and two
 * different events that share an id are both kept. That needs no read permission.
 */
export class S3AuditClient implements AuditClient {
  readonly #client: S3Client;
  readonly #bucket: string;

  constructor(client: S3Client, bucket: string) {
    this.#client = client;
    this.#bucket = bucket;
  }

  async record(event: AuditEvent): Promise<void> {
    const parsed = auditEventSchema.safeParse(event);
    if (!parsed.success) {
      // The zod error isn't attached: it can quote parts of the input.
      throw new AppError('Audit event is invalid', {
        code: 'AUDIT_EVENT_INVALID',
        retryable: false,
      });
    }
    const body = JSON.stringify(parsed.data);
    try {
      await this.#client.send(
        new PutObjectCommand({
          Bucket: this.#bucket,
          Key: auditKey(parsed.data, body),
          Body: body,
          ContentType: 'application/json',
          ChecksumAlgorithm: 'SHA256',
          IfNoneMatch: '*',
        }),
        { abortSignal: AbortSignal.timeout(TIMEOUT_MS) },
      );
    } catch (cause) {
      const name = cause instanceof Error ? cause.name : '';
      // This exact event is already stored.
      if (name === 'PreconditionFailed') return;
      throw new AppError('Audit event could not be written', {
        code: 'AUDIT_WRITE_FAILED',
        retryable: !NOT_RETRYABLE.has(name),
        cause,
      });
    }
  }
}

function auditKey(event: AuditEvent, body: string): string {
  const hash = createHash('sha256').update(body).digest('hex').slice(0, 32);
  const [caseId, id] = [event.caseId, event.id].map(encodeURIComponent);
  return `cases/${caseId}/${event.occurredAt}-${id}-${hash}.json`;
}
