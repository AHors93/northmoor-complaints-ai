import { generateKeyPairSync, sign, verify } from 'node:crypto';
import { KMSClient } from '@aws-sdk/client-kms';
import { ToolTokenVerifier } from '@northmoor/tool-tokens';
import { describe, expect, it } from 'vitest';
import { KmsTokenSigner } from '../src/adapters/kms-token-signer';
import { derToJose } from '../src/domain/ecdsa-signature';
import { mintToolToken } from '../src/domain/mint-tool-token';

const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const KEY_ID = 'arn:aws:kms:eu-west-2:000000000000:key/test';
const NOW = new Date('2026-11-25T12:00:00Z');

/** A real KMS client whose transport signs locally. */
function fakeKms(respond: (message: Buffer) => { status: number; body: object }): KMSClient {
  return new KMSClient({
    region: 'eu-west-2',
    credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
    maxAttempts: 1,
    requestHandler: {
      handle: (request: { body: string | Uint8Array }) => {
        const input = JSON.parse(Buffer.from(request.body).toString()) as { Message: string };
        const { status, body } = respond(Buffer.from(input.Message, 'base64'));
        return Promise.resolve({
          response: {
            statusCode: status,
            headers: { 'content-type': 'application/x-amz-json-1.1' },
            body: Buffer.from(JSON.stringify(body)),
          },
        });
      },
    },
  });
}

const workingKms = fakeKms((message) => ({
  status: 200,
  body: { Signature: sign('sha256', message, privateKey).toString('base64') },
}));

const mint = (client = workingKms) =>
  mintToolToken(
    {
      signer: new KmsTokenSigner(client, KEY_ID),
      issuer: 'northmoor-api',
      audience: 'northmoor-tools',
      now: () => NOW,
      newId: () => 'token-1',
    },
    { userId: 'user-1', scope: 'core_banking:read', caseId: 'CASE-A' },
  );

const verifier = new ToolTokenVerifier({
  keys: new Map([[KEY_ID, publicKey]]),
  issuer: 'northmoor-api',
  audience: 'northmoor-tools',
  now: () => NOW,
});

describe('minting a tool token', () => {
  it('produces a token the verifier accepts', async () => {
    const claims = await verifier.verify(await mint(), {
      scope: 'core_banking:read',
      caseId: 'CASE-A',
    });
    expect(claims).toMatchObject({ sub: 'user-1', jti: 'token-1' });
    expect(claims.exp - claims.iat).toBe(300);
  });

  it('produces a token that is rejected for another case', async () => {
    await expect(
      verifier.verify(await mint(), { scope: 'core_banking:read', caseId: 'CASE-B' }),
    ).rejects.toMatchObject({ code: 'TOOL_TOKEN_WRONG_CASE' });
  });

  it.each([
    ['ThrottlingException', true],
    ['AccessDeniedException', false],
  ])('reports %s with retryable %s', async (type, retryable) => {
    const client = fakeKms(() => ({ status: 400, body: { __type: type, message: 'no' } }));
    await expect(mint(client)).rejects.toMatchObject({
      code: 'TOOL_TOKEN_SIGN_FAILED',
      retryable,
    });
  });
});

describe('DER signature conversion', () => {
  it('matches the JOSE signature length and verifies for many signatures', () => {
    // Enough signatures to include values with leading zero bytes.
    for (let i = 0; i < 1000; i++) {
      const message = Buffer.from(`message ${i}`);
      const jose = derToJose(sign('sha256', message, privateKey));
      expect(jose).toHaveLength(64);
      expect(verify('sha256', message, { key: publicKey, dsaEncoding: 'ieee-p1363' }, jose)).toBe(
        true,
      );
    }
  });

  it.each([
    ['empty', []],
    ['truncated', [0x30, 0x06, 0x02, 0x01, 0x01]],
    ['trailing bytes', [0x30, 0x06, 0x02, 0x01, 0x01, 0x02, 0x01, 0x01, 0x00]],
    ['wrong tag', [0x30, 0x06, 0x03, 0x01, 0x01, 0x02, 0x01, 0x01]],
    ['oversized integer', [0x30, 0x27, 0x02, 0x22, ...Array<number>(34).fill(1), 0x02, 0x01, 0x01]],
  ])('rejects %s input', (_, bytes) => {
    expect(() => derToJose(Uint8Array.from(bytes))).toThrowError(
      expect.objectContaining({ code: 'TOOL_TOKEN_SIGNATURE_INVALID' }),
    );
  });
});
