import { z } from 'zod';

/** A token carries exactly one scope, and each scope names one tool. */
export const toolScopeSchema = z.enum(['core_banking:read', 'policy_search:read']);
export type ToolScope = z.infer<typeof toolScopeSchema>;

export const TOOL_TOKEN_ALG = 'ES256';
/** A distinct type, so a Cognito token can never be accepted as a tool token. */
export const TOOL_TOKEN_TYPE = 'tool+jwt';
export const TOOL_TOKEN_MAX_AGE_SECONDS = 300;

const id = z.string().trim().min(1);

export const toolTokenClaimsSchema = z.strictObject({
  iss: id,
  aud: id,
  /** The user the tool call is made for. */
  sub: id,
  scope: toolScopeSchema,
  case_id: id,
  jti: id,
  iat: z.int().nonnegative(),
  exp: z.int().nonnegative(),
});
export type ToolTokenClaims = z.infer<typeof toolTokenClaimsSchema>;
