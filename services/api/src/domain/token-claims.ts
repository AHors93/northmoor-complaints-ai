import { AppError, roleSchema, type Role } from '@northmoor/shared';
import { z } from 'zod';
import { scopesFor } from './access';

export const teamSchema = z.string().regex(/^[a-z][a-z0-9-]{0,31}$/);

export interface AccessTokenAdditions {
  readonly role: Role;
  readonly team: string;
  readonly scopes: readonly string[];
}

/** Fails closed: a user without exactly one known role and a valid team can't sign in. */
export function buildTokenAdditions(user: {
  readonly groups: readonly string[];
  readonly team: string | undefined;
}): AccessTokenAdditions {
  const [group, ...others] = user.groups;
  const role = roleSchema.safeParse(group);
  const team = teamSchema.safeParse(user.team);
  if (!role.success || others.length > 0 || !team.success) {
    throw new AppError('User has no valid role and team', {
      code: 'USER_ACCESS_INVALID',
      retryable: false,
    });
  }
  return { role: role.data, team: team.data, scopes: scopesFor(role.data) };
}
