import type { KeyObject } from 'node:crypto';
import { AppError } from '@northmoor/shared';
import { errors, jwtVerify } from 'jose';
import {
  TOOL_TOKEN_ALG,
  TOOL_TOKEN_MAX_AGE_SECONDS,
  TOOL_TOKEN_TYPE,
  toolTokenClaimsSchema,
  type ToolScope,
  type ToolTokenClaims,
} from './claims';

export type ToolTokenErrorCode =
  'TOOL_TOKEN_INVALID' | 'TOOL_TOKEN_EXPIRED' | 'TOOL_TOKEN_WRONG_SCOPE' | 'TOOL_TOKEN_WRONG_CASE';

export interface ToolTokenVerifierOptions {
  /** Trusted public keys by key id. */
  readonly keys: ReadonlyMap<string, KeyObject>;
  readonly issuer: string;
  readonly audience: string;
  readonly now?: () => Date;
}

export interface RequiredAccess {
  readonly scope: ToolScope;
  readonly caseId: string;
}

export class ToolTokenVerifier {
  readonly #options: ToolTokenVerifierOptions;

  constructor(options: ToolTokenVerifierOptions) {
    this.#options = options;
  }

  /** Resolves only if the token is genuine, current, and for exactly this scope and case. */
  async verify(token: string, required: RequiredAccess): Promise<ToolTokenClaims> {
    const claims = await this.#authenticate(token);
    if (claims.scope !== required.scope) throw denied('TOOL_TOKEN_WRONG_SCOPE');
    if (claims.case_id !== required.caseId) throw denied('TOOL_TOKEN_WRONG_CASE');
    return claims;
  }

  async #authenticate(token: string): Promise<ToolTokenClaims> {
    const { keys, issuer, audience, now = () => new Date() } = this.#options;
    let payload: unknown;
    try {
      ({ payload } = await jwtVerify(
        token,
        ({ kid }) => {
          const key = kid === undefined ? undefined : keys.get(kid);
          if (key === undefined) throw denied('TOOL_TOKEN_INVALID');
          return key;
        },
        {
          algorithms: [TOOL_TOKEN_ALG],
          typ: TOOL_TOKEN_TYPE,
          issuer,
          audience,
          // Enforced here too, so a token minted with a long expiry is still short-lived.
          maxTokenAge: TOOL_TOKEN_MAX_AGE_SECONDS,
          clockTolerance: 5,
          currentDate: now(),
        },
      ));
    } catch (error) {
      // The cause isn't attached: jose errors carry the token's claims.
      throw denied(
        error instanceof errors.JWTExpired ? 'TOOL_TOKEN_EXPIRED' : 'TOOL_TOKEN_INVALID',
      );
    }
    const parsed = toolTokenClaimsSchema.safeParse(payload);
    if (!parsed.success) throw denied('TOOL_TOKEN_INVALID');
    return parsed.data;
  }
}

function denied(code: ToolTokenErrorCode): AppError {
  return new AppError('Tool token rejected', { code, retryable: false });
}
