import { z } from 'zod';
import { AppError } from './errors';

/**
 * Validates environment variables at startup. Error messages name the bad variable and never
 * include its value, because it may be a secret.
 */
export function loadConfig<S extends z.ZodObject>(
  schema: S,
  env: Record<string, string | undefined> = process.env,
): z.output<S> {
  // An empty variable counts as unset, so defaults apply and required values fail.
  const present = Object.fromEntries(
    Object.entries(env).filter(([, v]) => v !== undefined && v !== ''),
  );
  const result = schema.safeParse(present);
  if (result.success) return result.data;
  const problems = result.error.issues.map((i) => {
    const key = i.path.join('.') || '(root)';
    return key in present ? `${key}: invalid (${i.code})` : `${key}: missing`;
  });
  throw new AppError(`Invalid configuration: ${problems.join('; ')}`, {
    code: 'CONFIG_INVALID',
    retryable: false,
  });
}

export const baseConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});
