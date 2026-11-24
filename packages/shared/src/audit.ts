import { appendFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { auditEventSchema, type AuditEvent } from './domain';
import { AppError } from './errors';

export interface AuditClient {
  /** Resolves only once the event is stored. Callers must await it and fail if it rejects. */
  record(event: AuditEvent): Promise<void>;
}

/**
 * Local development only: appends JSON lines to a file. It isn't tamper-proof; the S3 Object Lock
 * client replaces it in Phase 2.
 */
export class FileAuditClient implements AuditClient {
  readonly #path: string;
  #tail: Promise<void> = Promise.resolve();

  constructor(path: string) {
    this.#path = path;
  }

  record(event: AuditEvent): Promise<void> {
    const write = this.#tail.then(async () => {
      const parsed = auditEventSchema.safeParse(event);
      if (!parsed.success) {
        // The zod error isn't attached: it can quote parts of the input.
        throw new AppError('Audit event is invalid', {
          code: 'AUDIT_EVENT_INVALID',
          retryable: false,
        });
      }
      try {
        await mkdir(dirname(this.#path), { recursive: true });
        const line = `${JSON.stringify(parsed.data)}\n`;
        await appendFile(this.#path, line, { encoding: 'utf8', flush: true });
      } catch (cause) {
        throw new AppError('Audit event could not be written', {
          code: 'AUDIT_WRITE_FAILED',
          retryable: true,
          cause,
        });
      }
    });
    // Keep the queue usable after a failure; the caller still sees the rejection.
    this.#tail = write.catch(() => undefined);
    return write;
  }
}
