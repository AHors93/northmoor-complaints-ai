import { AppError } from './errors';

export const LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

/** caseId for lines that belong to no case, such as startup. Explicit, so it's never forgotten. */
export const NO_CASE = 'none';

export interface LogContext {
  readonly caseId: string;
  readonly traceId: string;
}

/** Flat primitives only, so whole records (which may hold PII) can't be logged by accident. */
export type LogFields = Readonly<Record<string, string | number | boolean | null | undefined>>;

export interface Logger {
  debug(message: string, fields?: LogFields): void;
  info(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  error(message: string, fields?: LogFields): void;
  child(fields: LogFields): Logger;
}

/**
 * A backstop, not the PII control: masks fields whose name says they hold PII. It can't spot PII
 * inside free text, so never log complaint bodies, drafts or raw error messages from them.
 */
const PII_FIELDS = new Set([
  'name',
  'firstname',
  'lastname',
  'fullname',
  'customername',
  'dob',
  'dateofbirth',
  'address',
  'postcode',
  'email',
  'phone',
  'accountnumber',
  'sortcode',
  'ninumber',
  'body',
]);

function maskPii(fields: LogFields): LogFields {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [
      key,
      PII_FIELDS.has(key.toLowerCase().replaceAll(/[^a-z]/g, '')) ? '[MASKED]' : value,
    ]),
  );
}

export interface LoggerOptions {
  readonly service: string;
  readonly context: LogContext;
  readonly level?: LogLevel;
  readonly fields?: LogFields;
  readonly write?: (line: string) => void;
  readonly now?: () => Date;
}

export function createLogger(options: LoggerOptions): Logger {
  const { service, context, level = 'info', fields: base = {}, now = () => new Date() } = options;
  const write = options.write ?? ((line: string) => void process.stdout.write(`${line}\n`));
  if (!context.caseId || !context.traceId) {
    throw new AppError('Logger requires a non-empty caseId and traceId', {
      code: 'LOG_CONTEXT_INVALID',
      retryable: false,
    });
  }

  const log = (lineLevel: LogLevel, message: string, fields: LogFields = {}) => {
    if (LOG_LEVELS.indexOf(lineLevel) < LOG_LEVELS.indexOf(level)) return;
    write(
      JSON.stringify({
        ...maskPii({ ...base, ...fields }),
        // Reserved keys come last so fields can't overwrite them.
        time: now().toISOString(),
        level: lineLevel,
        service,
        caseId: context.caseId,
        traceId: context.traceId,
        message,
      }),
    );
  };

  return {
    debug: (message, fields) => log('debug', message, fields),
    info: (message, fields) => log('info', message, fields),
    warn: (message, fields) => log('warn', message, fields),
    error: (message, fields) => log('error', message, fields),
    child: (fields) => createLogger({ ...options, fields: { ...base, ...fields } }),
  };
}
