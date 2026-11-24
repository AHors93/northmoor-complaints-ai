# ADR 0002: Enforcing the model-access boundary

**Context.** No PII may reach a model, so only `services/pii-proxy` may call one.

**Decision.** An ESLint rule bans model SDK imports and Bedrock runtime endpoint strings everywhere
else, covering dynamic imports, `require` and raw HTTP. Inline ESLint disables are off across the
repo. A test also checks that no other package depends on a model SDK. Embeddings count as model
calls, so RAG will embed through the proxy too.

**Alternatives.** Static import checks only, which dynamic imports get around; code review alone.

**Consequences.** A determined author could still build the string at runtime. From Phase 2, IAM
should grant `bedrock:InvokeModel` only to the proxy's role, which is the real control.
