import { generateKeyPairSync, type KeyObject } from 'node:crypto';
import { SignJWT, UnsecuredJWT } from 'jose';
import { describe, expect, it } from 'vitest';
import { ToolTokenVerifier } from '../src';

const NOW = 1_800_000_000;
const trusted = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const other = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const required = { scope: 'core_banking:read', caseId: 'CASE-A' } as const;

const claims = {
  iss: 'northmoor-api',
  aud: 'northmoor-tools',
  sub: 'user-1',
  scope: 'core_banking:read',
  case_id: 'CASE-A',
  jti: 'token-1',
  iat: NOW,
  exp: NOW + 300,
};

const sign = (
  overrides: Record<string, unknown> = {},
  header: Record<string, unknown> = {},
  key: KeyObject = trusted.privateKey,
) =>
  new SignJWT({ ...claims, ...overrides })
    .setProtectedHeader({ alg: 'ES256', typ: 'tool+jwt', kid: 'key-1', ...header })
    .sign(key);

const verifierAt = (seconds: number) =>
  new ToolTokenVerifier({
    keys: new Map([['key-1', trusted.publicKey]]),
    issuer: 'northmoor-api',
    audience: 'northmoor-tools',
    now: () => new Date(seconds * 1000),
  });

const verify = (token: string, at = NOW + 10) => verifierAt(at).verify(token, required);

describe('tool token verifier', () => {
  it('accepts a current token for the right scope and case', async () => {
    await expect(verify(await sign())).resolves.toEqual(claims);
  });

  it('rejects an expired token', async () => {
    await expect(verify(await sign(), NOW + 400)).rejects.toMatchObject({
      code: 'TOOL_TOKEN_EXPIRED',
      retryable: false,
    });
  });

  it('rejects a token older than five minutes even if its expiry is later', async () => {
    await expect(verify(await sign({ exp: NOW + 86_400 }), NOW + 400)).rejects.toMatchObject({
      code: 'TOOL_TOKEN_EXPIRED',
    });
  });

  it('rejects a token with another scope', async () => {
    await expect(verify(await sign({ scope: 'policy_search:read' }))).rejects.toMatchObject({
      code: 'TOOL_TOKEN_WRONG_SCOPE',
    });
  });

  it('rejects a token scoped to another case', async () => {
    await expect(verify(await sign({ case_id: 'CASE-B' }))).rejects.toMatchObject({
      code: 'TOOL_TOKEN_WRONG_CASE',
    });
  });

  it.each([
    ['an unknown scope', { scope: 'core_banking:write' }],
    ['several scopes', { scope: 'core_banking:read policy_search:read' }],
    ['another issuer', { iss: 'someone-else' }],
    ['another audience', { aud: 'another-service' }],
    ['a list of audiences', { aud: ['northmoor-tools', 'another-service'] }],
    ['an issue time in the future', { iat: NOW + 3600, exp: NOW + 3700 }],
    ['no expiry', { exp: undefined }],
    ['no subject', { sub: undefined }],
    ['no case', { case_id: undefined }],
    ['an unexpected claim', { role: 'admin' }],
  ])('rejects a token with %s', async (_, overrides) => {
    await expect(verify(await sign(overrides))).rejects.toMatchObject({
      code: 'TOOL_TOKEN_INVALID',
    });
  });

  it.each([
    ['another token type', { typ: 'JWT' }],
    ['an unknown key id', { kid: 'key-2' }],
    ['no key id', { kid: undefined }],
  ])('rejects a token with %s', async (_, header) => {
    await expect(verify(await sign({}, header))).rejects.toMatchObject({
      code: 'TOOL_TOKEN_INVALID',
    });
  });

  it('rejects a token signed by another key', async () => {
    await expect(verify(await sign({}, {}, other.privateKey))).rejects.toMatchObject({
      code: 'TOOL_TOKEN_INVALID',
    });
  });

  it('rejects a token whose claims were changed after signing', async () => {
    const [header, , signature] = (await sign()).split('.');
    const payload = Buffer.from(JSON.stringify({ ...claims, case_id: 'CASE-B' })).toString(
      'base64url',
    );
    const forged = [header, payload, signature].join('.');
    await expect(
      verifierAt(NOW + 10).verify(forged, { ...required, caseId: 'CASE-B' }),
    ).rejects.toMatchObject({ code: 'TOOL_TOKEN_INVALID' });
  });

  it.each(['', 'not-a-token', new UnsecuredJWT(claims).encode()])(
    'rejects an unsigned or malformed token',
    async (token) => {
      await expect(verify(token)).rejects.toMatchObject({ code: 'TOOL_TOKEN_INVALID' });
    },
  );

  it('does not expose the claims in the error', async () => {
    const error: unknown = await verify(await sign({ sub: 'private-subject' }), NOW + 400).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).cause).toBeUndefined();
    expect((error as Error).message).not.toContain('private-subject');
  });
});
