# ADR 0005: Tool tokens and the audit store

**Context.** Each tool call must be limited to one tool and one case. Audit events must not be altered,
and retries must not duplicate them.

**Decision.** Tool tokens are ES256 JWTs signed by an asymmetric KMS key. Each has one scope, one case
and a five-minute life, which the verifier enforces itself. A distinct `typ` stops a Cognito token being
accepted as a tool token. The claims and verifier are in `packages/tool-tokens`, so tools don't depend
on the API. Audit events are one S3 object each, written with `If-None-Match` under a key that includes
a hash of the content.

**Alternatives.** A shared HMAC secret, which any verifier could use to mint tokens. An audit client that
reads an object back before writing, which needs read access to the audit bucket.

**Consequences.** Every mint is a KMS call. Tokens can't be revoked before they expire. Minting doesn't
check case access: the API handler must do that first. Two events with the same id and different content
are both kept.
