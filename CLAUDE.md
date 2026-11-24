# Northmoor Complaints AI

Portfolio project: an AI case-handling assistant for a fictional UK lender's complaints team ("Northmoor Lending"). It is built to demonstrate Forward Deployed Engineer skills: enterprise identity, permission-filtered RAG, MCP over a legacy system, PII guardrails, human-in-the-loop durable workflows, evals, observability, and a clean handoff.

The build plan is in `docs/BUILD_PLAN.md`. The architecture is in `docs/ARCHITECTURE.md`. Work through the plan **one phase at a time**, and stop for review at the end of each phase.

## What the system does

A complaint comes in. The agent workflow:

1. Triages it into one of four categories: fees, arrears, mis-selling, service.
2. Pulls the customer's account history from the legacy core banking system through an MCP server.
3. Retrieves the relevant policy and past decisions, filtered by the user's permissions, with citations.
4. Drafts a response. All PII is redacted before any model call and restored afterwards.
5. Sends the draft to a team lead in Slack for approval. Nothing is finalised without a named human approval.
6. Writes every model call, tool call and approval to a log that can't be altered.

## Non-negotiable rules

- **No PII reaches the model in clear text.** Every call to Bedrock goes through `services/pii-proxy`. There are no direct model calls anywhere else, and a lint rule or test enforces this.
- **A human approves every draft.** The workflow cannot reach "finalised" without an approval event that carries an approver identity.
- **Permissions are enforced at query time** with Postgres row-level security, never by filtering results afterwards.
- **Every model and tool call is audited:** who, what, when, inputs (redacted), outputs (redacted), cost, latency.
- **The answer cites its sources, or it abstains.** A draft that cites no retrieved source is rejected by the workflow.

## Cost rules (this is a personal AWS account)

- Never create a NAT gateway, in any mode.
- Interface VPC endpoints exist only when `network_mode = "enterprise"`.
- Aurora Serverless v2 runs with minimum capacity 0 so it auto-pauses.
- Tag every resource with `project = northmoor` and `env`.
- Keep an AWS Budgets alarm in the Terraform, at £20 a month.
- Prefer local development (docker-compose) over deploying.

## Stack

- TypeScript (strict), Node 22, pnpm workspaces
- Tests: vitest. Validation: zod. Bundling: esbuild for Lambdas.
- AWS: Lambda, API Gateway HTTP API, Step Functions (Standard), Cognito, Aurora Serverless v2 Postgres with pgvector, S3 (Object Lock for audit), DynamoDB, Bedrock, Comprehend, KMS, Secrets Manager
- Models via the Bedrock Converse API: a small, cheap Claude model for triage and classification; a stronger Claude model for drafting. Model IDs live in config, never hard-coded.
- Embeddings: Bedrock Titan Text Embeddings v2
- MCP: the official `@modelcontextprotocol/sdk`, Streamable HTTP transport
- Infrastructure as code: Terraform, with one variable `network_mode = "dev" | "enterprise"`
- Tracing: OpenTelemetry, exported to Langfuse Cloud (free tier)
- Local: docker-compose with Postgres + pgvector and the mock SOAP service

Check the current stable versions of all packages and Terraform providers before you pin them. Don't rely on remembered versions.

## Repo layout

```
infra/                  Terraform (modules/, envs/)
services/
  api/                  HTTP API, JWT + scope checks
  workflow/             Step Functions definition + task Lambdas
  pii-proxy/            Redact → model → restore; the ONLY model caller
  rag/                  Ingestion + permission-filtered hybrid search
  mcp-core-banking/     MCP server wrapping the SOAP API
  mock-core-banking/    Fake legacy SOAP service (WSDL, rate limits)
  slack-approvals/      Slack interactivity → Step Functions task token
  admin/                Admin page for prompts and config
packages/
  shared/               Types, logger, tracing, audit client, config
data/
  generator/            Synthetic data generator (seeded, reproducible)
  raw/                  Inputs (e.g. the FCA DISP PDF, downloaded by hand)
  generated/            Generator output (gitignored, except a small sample)
evals/                  Golden datasets, eval runners, CI gate
docs/                   ARCHITECTURE.md, BUILD_PLAN.md, RUNBOOK.md, ADRs
```

## How you work (Claude)

- **Plan before you code.** At the start of each task, state your plan in a few bullets: files to touch, approach, risks. Then build.
- **Never mark something done without running the checks**: `pnpm lint && pnpm typecheck && pnpm test`, plus the phase's "done when" checks. Report what you ran and what the output said.
- **Never weaken a test to make it pass.** No editing assertions, skipping tests, or adding `.only` or `.skip`. If a test is wrong, explain why and ask.
- **Ask before you:**
  - run `terraform apply` or `terraform destroy`, or any command that creates AWS resources or costs money;
  - add a new dependency;
  - change the public interface of a shared package;
  - delete files you didn't create in this task.
- **Never commit secrets, `.env` files, or generated data** outside `data/generated/sample/`.
- **Stay in scope.** Don't refactor unrelated code or start the next phase. Note anything you spot under "Follow-ups" in your phase summary.
- **If you're stuck after two attempts, stop and explain** what you tried. Don't keep making speculative changes.
- **When the docs and the code disagree, say so.** Don't silently pick one.

## Code standards

**TypeScript**
- Strict mode, with `noUncheckedIndexedAccess`. No `any`; use `unknown` and narrow it. No non-null `!` assertions without a comment explaining why.
- Validate every external input at the boundary with zod: HTTP bodies, SQS and Step Functions payloads, SOAP responses, model output, env vars. Inside the boundary, trust the types.
- Model output is untrusted input. Parse it against a schema, and reject or retry it if it doesn't match.
- Prefer small pure functions. Keep handlers thin: parse → call domain logic → map to a response.
- Named exports only. Use `camelCase` for functions and variables, `PascalCase` for types, and `kebab-case` for file names.

**Structure (ports and adapters)**
- Each service is split into `domain/` (pure logic, no AWS imports), `adapters/` (Bedrock, Postgres, SOAP, S3, Slack) and `handlers/` (Lambda entry points).
- The domain depends on interfaces, never on AWS SDKs directly. This keeps the domain unit-testable without mocking AWS.
- Create SDK clients once per Lambda container, outside the handler.

**Errors**
- Use typed errors with a stable `code` (e.g. `PII_REDACTION_FAILED`, `CORE_BANKING_RATE_LIMITED`). Never throw bare strings.
- Separate retryable from non-retryable errors explicitly. Step Functions retry policies key off the error name.
- Never swallow errors. Log once at the boundary, with context, then rethrow or map the error.
- Error messages and logs never contain PII.

**Reliability**
- Every task Lambda in the workflow is **idempotent**: key the work by `caseId` + step, so a retry never duplicates a draft, an approval request or an audit event.
- Put timeouts on every network call. Retry with exponential backoff and jitter, retrying only errors marked as retryable.

**Testing**
- **Unit tests** for domain logic, with no network. **Integration tests** against real Postgres (docker-compose) and the SOAP mock. **End-to-end tests** per phase as specified.
- Test behaviour, not implementation. One reason to fail per test, with a descriptive name (`rejects a token scoped to another case`).
- Use deterministic fixtures from the seeded generator. No real model calls in unit tests: use a fake adapter. Integration tests that call Bedrock are tagged and run on demand.
- Every bug fix comes with a regression test.

**Security**
- Least-privilege IAM: one role per Lambda, scoped to exact resource ARNs. No `*` resources except where AWS requires them, and comment those.
- Secrets live in Secrets Manager, read at runtime and cached. Never put them in env vars or in code.
- Encrypt data at rest with KMS. TLS everywhere.
- Parameterised SQL only. Every database query runs as the app role with row-level security, never as the owner role.

**Terraform**
- Pin provider versions. Run `terraform fmt` and `tflint` in CI, plus `trivy config` (or `checkov`) for security scanning.
- Small modules with typed `variables.tf` and `outputs.tf`, and no hard-coded account IDs or regions.
- Use remote state in S3 with locking, set up in a small `bootstrap/` folder.
- Tag every resource through the provider's `default_tags`.

**Git and docs**
- Use Conventional Commits (`feat(rag): add RLS policies for restricted docs`). Keep commits small and focused, each passing CI.
- Each service has a `README.md` covering what it does, how to run it locally, and how to test it.
- Record significant decisions as ADRs in `docs/adr/`: context, decision, alternatives, consequences.
- Use structured JSON logs with `caseId` and `traceId` on every line. Never log raw PII.
- Add a pre-commit hook (lefthook or husky) that runs lint, typecheck, and a secrets scan (gitleaks).
