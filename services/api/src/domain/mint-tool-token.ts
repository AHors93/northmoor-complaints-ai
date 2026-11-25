import {
  TOOL_TOKEN_ALG,
  TOOL_TOKEN_MAX_AGE_SECONDS,
  TOOL_TOKEN_TYPE,
  toolTokenClaimsSchema,
  type ToolScope,
} from '@northmoor/tool-tokens';

export interface TokenSigner {
  readonly keyId: string;
  /** Returns an ES256 signature in JOSE form: r and s, 32 bytes each. */
  sign(message: Uint8Array): Promise<Uint8Array>;
}

export interface MintOptions {
  readonly signer: TokenSigner;
  readonly issuer: string;
  readonly audience: string;
  readonly now: () => Date;
  readonly newId: () => string;
}

export interface ToolTokenRequest {
  readonly userId: string;
  readonly scope: ToolScope;
  readonly caseId: string;
}

/** The caller must already have checked that this user may work on this case. */
export async function mintToolToken(
  { signer, issuer, audience, now, newId }: MintOptions,
  request: ToolTokenRequest,
): Promise<string> {
  const iat = Math.floor(now().getTime() / 1000);
  const claims = toolTokenClaimsSchema.parse({
    iss: issuer,
    aud: audience,
    sub: request.userId,
    scope: request.scope,
    case_id: request.caseId,
    jti: newId(),
    iat,
    exp: iat + TOOL_TOKEN_MAX_AGE_SECONDS,
  });
  const header = { alg: TOOL_TOKEN_ALG, typ: TOOL_TOKEN_TYPE, kid: signer.keyId };
  const message = `${encode(header)}.${encode(claims)}`;
  const signature = await signer.sign(Buffer.from(message));
  return `${message}.${Buffer.from(signature).toString('base64url')}`;
}

const encode = (value: unknown): string => Buffer.from(JSON.stringify(value)).toString('base64url');
