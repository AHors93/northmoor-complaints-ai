export interface AppErrorOptions {
  readonly code: string;
  readonly retryable: boolean;
  readonly cause?: unknown;
}

/** Base for typed errors. Messages must never contain PII. */
export class AppError extends Error {
  readonly code: string;
  readonly retryable: boolean;

  constructor(message: string, options: AppErrorOptions) {
    super(message, { cause: options.cause });
    // Step Functions retry policies match on the error name.
    this.name = options.code;
    this.code = options.code;
    this.retryable = options.retryable;
  }
}
