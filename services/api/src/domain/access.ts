import type { Role } from '@northmoor/shared';

/** API scopes by role. The pre-token Lambda puts these in the access token. */
const SCOPES_BY_ROLE: Record<Role, readonly string[]> = {
  case_handler: ['profile:read', 'cases:read', 'cases:draft'],
  team_lead: ['profile:read', 'cases:read', 'cases:draft', 'cases:approve'],
  admin: ['profile:read', 'config:read', 'config:write'],
};

export const scopesFor = (role: Role): readonly string[] => SCOPES_BY_ROLE[role];
