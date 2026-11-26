import { AppError, roleSchema, type Role } from '@northmoor/shared';
import { z } from 'zod';
import { teamSchema } from './token-claims';

export interface Identity {
  readonly userId: string;
  readonly role: Role;
  readonly team: string;
  readonly scopes: readonly string[];
}

const claimsSchema = z.object({
  sub: z.string().min(1),
  // An ID token is signed by the same pool, but it isn't proof of API access.
  token_use: z.literal('access'),
  role: roleSchema,
  team: teamSchema,
  scope: z.string().min(1),
});

/** Reads claims that API Gateway's JWT authorizer has already verified. */
export function parseIdentity(claims: unknown): Identity {
  const parsed = claimsSchema.safeParse(claims);
  if (!parsed.success) {
    throw new AppError('Access token claims are not valid', {
      code: 'ACCESS_TOKEN_INVALID',
      retryable: false,
    });
  }
  const { sub, role, team, scope } = parsed.data;
  // Cognito's own scopes are for its self-service API, not ours.
  const scopes = scope.split(' ').filter((s) => s !== '' && !s.startsWith('aws.cognito.'));
  return { userId: sub, role, team, scopes };
}
