import { roleSchema } from '@northmoor/shared';
import { describe, expect, it } from 'vitest';
import { scopesFor } from '../src/domain/access';
import { parseIdentity } from '../src/domain/identity';
import { buildTokenAdditions } from '../src/domain/token-claims';

const claims = {
  sub: 'user-1',
  token_use: 'access',
  role: 'case_handler',
  team: 'leeds',
  scope: 'aws.cognito.signin.user.admin profile:read cases:read',
};

describe('identity from an access token', () => {
  it('returns the role, team and API scopes', () => {
    expect(parseIdentity(claims)).toEqual({
      userId: 'user-1',
      role: 'case_handler',
      team: 'leeds',
      scopes: ['profile:read', 'cases:read'],
    });
  });

  it.each([
    ['an ID token', { token_use: 'id' }],
    ['no role', { role: undefined }],
    ['an unknown role', { role: 'superuser' }],
    ['no team', { team: undefined }],
    ['a malformed team', { team: "leeds' OR 1=1" }],
    ['no scope', { scope: undefined }],
    ['no subject', { sub: '' }],
  ])('rejects %s', (_, overrides) => {
    expect(() => parseIdentity({ ...claims, ...overrides })).toThrow(
      expect.objectContaining({ code: 'ACCESS_TOKEN_INVALID' }),
    );
  });
});

describe('access token additions', () => {
  it.each(roleSchema.options)('gives a %s their own scopes', (role) => {
    expect(buildTokenAdditions({ groups: [role], team: 'leeds' })).toEqual({
      role,
      team: 'leeds',
      scopes: scopesFor(role),
    });
  });

  it.each([
    ['no group', { groups: [], team: 'leeds' }],
    ['an unknown group', { groups: ['superuser'], team: 'leeds' }],
    ['two groups', { groups: ['case_handler', 'team_lead'], team: 'leeds' }],
    ['no team', { groups: ['case_handler'], team: undefined }],
    ['an invalid team', { groups: ['case_handler'], team: 'Leeds North' }],
  ])('refuses a user with %s', (_, user) => {
    expect(() => buildTokenAdditions(user)).toThrow(
      expect.objectContaining({ code: 'USER_ACCESS_INVALID' }),
    );
  });

  it('lets only a team lead approve cases', () => {
    const approvers = roleSchema.options.filter((r) => scopesFor(r).includes('cases:approve'));
    expect(approvers).toEqual(['team_lead']);
  });
});
