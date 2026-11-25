import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  PreTokenGenerationV2TriggerEvent,
} from 'aws-lambda';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handler as me } from '../src/handlers/me';
import { handler as preToken } from '../src/handlers/pre-token';

let logged: string;
beforeEach(() => {
  logged = '';
  vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
    logged += String(chunk);
    return true;
  });
});
afterEach(() => {
  vi.restoreAllMocks();
});

const meEvent = (claims: Record<string, string>) =>
  ({
    requestContext: { requestId: 'request-1', authorizer: { jwt: { claims } } },
  }) as unknown as APIGatewayProxyEventV2WithJWTAuthorizer;

const tokenEvent = (groups: string[] | undefined, attributes: Record<string, string>) =>
  ({
    request: {
      userAttributes: { sub: 'user-1', email: 'private@example.com', ...attributes },
      groupConfiguration: { groupsToOverride: groups },
    },
    response: {},
  }) as unknown as PreTokenGenerationV2TriggerEvent;
const context = { awsRequestId: 'request-1' };

describe('GET /me', () => {
  it('returns the identity and forbids caching', async () => {
    const response = await me(
      meEvent({
        sub: 'user-1',
        token_use: 'access',
        role: 'team_lead',
        team: 'bristol',
        scope: 'profile:read',
      }),
    );
    expect(response.statusCode).toBe(200);
    expect(response.headers).toMatchObject({ 'cache-control': 'no-store' });
    expect(JSON.parse(response.body ?? '')).toEqual({
      userId: 'user-1',
      role: 'team_lead',
      team: 'bristol',
      scopes: ['profile:read'],
    });
  });

  it('refuses claims that are not a valid access token', async () => {
    const response = await me(meEvent({ sub: 'user-1', token_use: 'id' }));
    expect(response.statusCode).toBe(403);
    expect(JSON.parse(response.body ?? '')).toEqual({ code: 'ACCESS_TOKEN_INVALID' });
  });
});

describe('pre-token trigger', () => {
  it('adds the role, team and scopes to the access token only', async () => {
    const result = await preToken(
      tokenEvent(['case_handler'], { 'custom:team': 'leeds' }),
      context,
    );
    expect(result.response.claimsAndScopeOverrideDetails).toEqual({
      accessTokenGeneration: {
        claimsToAddOrOverride: { role: 'case_handler', team: 'leeds' },
        scopesToAdd: ['profile:read', 'cases:read', 'cases:draft'],
      },
    });
  });

  it.each([
    ['a user with no group', tokenEvent(undefined, { 'custom:team': 'leeds' })],
    ['a user with no team', tokenEvent(['case_handler'], {})],
  ])('refuses %s', async (_, event) => {
    await expect(preToken(event, context)).rejects.toMatchObject({ code: 'USER_ACCESS_INVALID' });
  });

  it('refuses a malformed event', async () => {
    const event = {} as PreTokenGenerationV2TriggerEvent;
    await expect(preToken(event, context)).rejects.toMatchObject({ code: 'TRIGGER_EVENT_INVALID' });
  });

  it('does not log user attributes when it refuses', async () => {
    await preToken(tokenEvent([], {}), context).catch(() => undefined);
    expect(logged).toContain('USER_ACCESS_INVALID');
    expect(logged).not.toContain('private@example.com');
  });
});
