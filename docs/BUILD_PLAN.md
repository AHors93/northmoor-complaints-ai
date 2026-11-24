# Build plan

Work through the phases in order. At the end of each phase:

1. Run every "done when" check.
2. Update the relevant README and any ADRs.
3. **Stop and summarise for review:** what you built, what you decided and why, what's left. Don't start the next phase until I confirm.

When a task is ambiguous, ask me. Don't guess.

---

## Phase 0: Repo and local dev

**Tasks**
- Set up a pnpm workspace with the layout in `CLAUDE.md`: strict TypeScript config, ESLint, Prettier, vitest.
- Create `packages/shared` with:
  - a config loader (zod)
  - a JSON logger that requires `caseId` / `traceId`
  - an audit client interface (it writes to a local file for now)
  - shared domain types: `Complaint`, `Customer`, `PolicyDoc`, `Draft`, `ApprovalEvent`, `AuditEvent`
- Add `docker-compose.yml` with Postgres 16 + pgvector.
- Add GitHub Actions CI: install, lint, typecheck, test.
- Add an ESLint rule (or a test) that fails if anything outside `services/pii-proxy` imports the Bedrock runtime client.

**Done when**
- `pnpm i && pnpm lint && pnpm typecheck && pnpm test` passes locally and in CI.
- `docker compose up` gives a working Postgres with the `vector` extension.
- The Bedrock-import rule fails on a deliberate violation.

---

## Phase 1: Synthetic data generator

All data is fake but realistic and deliberately messy. **The generator is seeded and reproducible**, and it writes ground-truth files that the evals use later.

**Tasks** (in `data/generator`, using faker with a fixed seed)
- **Customers and accounts** (about 2,000): name, DOB, address with a UK postcode, email, phone, account number, sort code, product (personal loan or car finance), balance, arrears status, and 12–24 months of transactions and fee events.
- **Historical complaints** (about 500) as `complaints_export.csv`, made messy on purpose:
  - Mixed date formats (`03/04/2026`, `2026-04-03`, `3rd April 2026`).
  - About 3% duplicate rows, some with slightly different whitespace or case.
  - Inconsistent category labels (`Fees`, `fee`, `charges`, `FEES `) mapping to the 4 true categories.
  - Free-text complaint bodies with names, account numbers, sort codes, phone numbers, emails and postcodes embedded in them.
  - Outcome fields: `upheld` / `not upheld` / `partially upheld`, redress amount, team, days to resolve.
  - Final response letter text for each closed case.
- **Ground truth files:**
  - `truth/categories.json`: the true category for each complaint.
  - `truth/planted_pii.json`: every PII value planted in every complaint body. This is used later to prove zero PII leakage exactly.
  - `truth/customer_links.json`: which customer each complaint belongs to.
- **Internal policy documents** (12–15), written as markdown and rendered to PDF:
  - Fee waiver policy, arrears handling, affordability checks, complaint handling procedure, redress calculation, and so on.
  - Mark 3 as **restricted** to team leads: fraud indicators, vulnerable customer procedures, redress authority limits.
  - Two documents should have an out-of-date older version with a different effective date, to test retrieval picks the current one.
  - Write a metadata file per document: `{ id, title, version, effectiveDate, accessLevel: "all" | "team_lead" }`.
- **External regulation:** I'll download the FCA DISP sourcebook PDF by hand into `data/raw/fca/`. The generator only references it.
- **Optional:** a `--llm` flag that rewrites the templated complaint bodies through Bedrock to make them more natural. Off by default, and it must still write `planted_pii.json` correctly.

**Done when**
- `pnpm gen` produces identical output on every run with the same seed.
- A test checks that every value in `planted_pii.json` appears in the generated CSV, and that the duplicate rate is between 2% and 5%.
- A small sample (20 cases, 3 documents) is committed under `data/generated/sample/`; the rest is gitignored.

---

## Phase 2: Infra skeleton and identity

**Tasks**
- Terraform, split into modules: `network`, `data`, `auth`, `compute`, `audit`, `observability`, `budget`. Include an `envs/dev` tfvars file and `network_mode`.
- **Dev mode:** default VPC subnets only where needed, Aurora Serverless v2 (min capacity 0) with pgvector, no NAT, no interface endpoints.
- **Cognito:** a user pool with OIDC, groups `case_handler`, `team_lead`, `admin`, and a custom attribute `team`. Create 4 test users across 2 teams.
- **API:** an HTTP API with a JWT authorizer. Add `GET /me`, which returns the user's role, team and scopes.
- **Scoped tool tokens:** the API mints short-lived JWTs scoped to a single tool and a single case (e.g. `scope: "core_banking:read"`, `case_id`). Tools reject tokens with the wrong scope or case.
- An S3 audit bucket with Object Lock (governance mode in dev), and the audit client writing to it.
- An AWS Budgets alarm at £20 a month.

**Done when**
- `terraform apply` succeeds in dev mode, and `terraform destroy` removes everything cleanly.
- `GET /me` returns different data for each test user.
- Tests show a tool rejects an expired token, a wrong-scope token, and a wrong-case token.
- An audit object can't be deleted or overwritten before its retention date ends.

---

## Phase 3: Ingestion and permission-filtered RAG

**Tasks**
- **Ingestion pipeline:**
  - Parse text PDFs with a library. Only use Textract for scanned PDFs.
  - Chunk by heading, and keep the document metadata on every chunk.
  - Embed chunks with Titan v2 and store them in Postgres.
  - Normalise and deduplicate the messy CSV. Write a reconciliation report: rows in, duplicates removed, labels mapped, unparseable dates.
- **Schema:** `documents`, `chunks` (with an embedding column and a tsvector), `cases`. Apply row-level security so that:
  - case handlers see only their team's cases;
  - restricted documents are visible only to `team_lead`.
- **Hybrid search:** combine vector similarity and full-text search with reciprocal rank fusion, and return the top k with citations: doc id, title, version, section.
- **Abstention:** if the best score is below a threshold, return "insufficient evidence" instead of results.
- **Current versions only:** retrieval prefers the newest effective version of a document.

**Done when**
- A test logs in as a case handler, asks about fraud indicators, and gets zero restricted chunks back. As a team lead, the same query returns them.
- A test confirms that a handler can't read another team's cases, even with hand-written SQL through the app's database role.
- A small retrieval eval (about 20 questions, with the expected doc ids) reports recall@5, and it's checked in.
- The reconciliation report numbers match the duplicates and labels the generator planted.

---

## Phase 4: Legacy SOAP mock and MCP server

**Tasks**
- **`mock-core-banking`:** a SOAP service with a WSDL, using the generated customer data. Operations: `GetCustomer`, `GetAccountSummary`, `GetTransactions`, `GetFeeHistory`. It should behave like a real legacy system:
  - a rate limit of about 5 requests a second, returning SOAP faults when exceeded;
  - occasional 2–5 second slow responses;
  - about 1% random faults.
- **`mcp-core-banking`:** an MCP server using the Streamable HTTP transport.
  - Expose tools that mirror the operations, with clean JSON schemas.
  - Translate SOAP to JSON.
  - Retry with backoff and jitter, a circuit breaker, and per-case response caching.
  - Require a scoped tool token, check the case binding, and audit every call.
  - Expose only read tools. There are no write tools in scope.

**Done when**
- The MCP Inspector can connect, list the tools, and call each one.
- A load test at 20 requests a second completes without errors reaching the caller: retries and the cache absorb the faults.
- A call with a token for case A asking for case B's customer is rejected and audited.

---

## Phase 5: PII proxy and audit

**Tasks**
- **Detection:** UK-specific regex patterns (sort code, 8-digit account number, postcode, phone, email, National Insurance number) plus Comprehend `DetectPiiEntities` for names and addresses.
- **Consistent tokens:** within a case, the same value always maps to the same placeholder (`[PERSON_1]`, `[ACCOUNT_1]`). Store the mapping per case in DynamoDB, encrypted with KMS, with a TTL.
- **The flow:** redact → call Bedrock through the Converse API → restore tokens in the output → audit both the redacted input and the redacted output.
- Record tokens in, tokens out, cost and latency for every call.
- **Model routing:** the cheap model for triage, the strong model for drafting. If the primary model times out or is throttled, fall back to the other.

**Done when**
- Over all 500 generated complaints, **zero** values from `planted_pii.json` appear in any redacted payload. This test runs in CI.
- Restoring the tokens gives back the original text exactly.
- The fallback is exercised by a test that simulates throttling.

---

## Phase 6: Agent workflow and Slack approval

**Tasks**
- **Step Functions (Standard) states:**
  1. `Triage`
  2. `GatherAccount` (MCP)
  3. `RetrievePolicy` (RAG)
  4. `Draft`
  5. `ValidateDraft` (must cite at least one retrieved source; flags any redress over the handler's authority limit)
  6. `AwaitApproval` (task token, 72-hour timeout)
  7. `Finalise` or `Revise`
- **Self-correction:** if `ValidateDraft` fails, loop back to `Draft` once with the reasons, then escalate to a human.
- **Slack app:** post the draft with its citations and **Approve**, **Request changes** and **Reject** buttons. The interactivity handler verifies Slack's request signature, then calls `SendTaskSuccess` or `SendTaskFailure` with the approver's identity.
  - This handler runs outside the VPC. There's no NAT, so this is deliberate.
- Every state transition writes an audit event.

**Done when**
- An end-to-end run on a sample case goes from triage to approval in Slack to finalised, with a complete audit trail.
- Killing a task Lambda mid-run leads to a retry and correct completion, with no duplicate approvals sent.
- Nothing can finalise without an approval event carrying an approver id (a test tries to skip it).

---

## Phase 7: Evals

**Tasks**
- **Golden dataset:** 50 cases taken from the generated history. They need the true category (from `truth/`), the expected policy doc ids, the expected outcome, and 10 out-of-scope questions where the right answer is to abstain.
- **Metrics:** triage accuracy, retrieval recall@5, citation validity (each cited doc was actually retrieved), abstention accuracy, PII leakage (must be zero), cost and latency per case.
- **LLM-as-judge** to score draft quality (tone, addresses the complaint, policy-consistent).
  - Calibrate it: I'll hand-label 20 drafts, and you report how often the judge agrees with my labels.
- **Trajectory checks:** the workflow called the expected tools in a valid order, and called no write tools.
- **CI gate:** the eval run fails the build if any metric drops below its threshold. Store results as JSON and a markdown summary in `evals/results/`.

**Done when**
- `pnpm eval` runs the full suite and prints a summary table.
- CI fails on a deliberately degraded prompt.
- Judge agreement with my labels is reported.

---

## Phase 8: Observability and ROI

**Tasks**
- OpenTelemetry spans across the API, workflow tasks, MCP calls and model calls, all sharing one trace id, exported to Langfuse.
- Cost attribution per case, per team and per model.
- A dashboard showing: cases processed, time to first draft, approval rate, cost per case, estimated hours saved. Assume a baseline of 5 days and 3 handler-hours per case.
- Alerts for: error rate, cost per case over £0.50, eval regressions, and silent failures (cases stuck in a state for more than 24 hours).

**Done when**
- One trace in Langfuse shows the whole case path end to end.
- The dashboard is populated from a batch run of 50 cases.

---

## Phase 9: Enterprise mode, resilience and handoff

**Tasks**
- **`network_mode = "enterprise"`:**
  - private subnets for data services;
  - interface endpoints for Bedrock, Comprehend, Secrets Manager, KMS, Step Functions and STS (single availability zone to save cost);
  - gateway endpoints for S3 and DynamoDB;
  - security groups with no `0.0.0.0/0` egress from data services.
- **Chaos tests:** kill a workflow mid-run; make the SOAP mock return only faults for 2 minutes; throttle Bedrock. Document how the system behaves in each case.
- **Admin page** (Cognito, admins only): edit prompts, thresholds and model choice. Version every change and audit it.
- **`docs/RUNBOOK.md`:** deploy, roll back, rotate secrets, switch modes, what to do when the model or the legacy API is down, and how to read the dashboards.

**Done when**
- A fresh `terraform apply` in enterprise mode passes the end-to-end test, and a test confirms there's no internet egress from data services.
- The chaos results are written up.
- `terraform destroy` brings the costs back to near zero.

---

## Phase 10: Write-up

**Tasks**
- A README with: the problem, the architecture diagram, key decisions (link the ADRs), eval results, latency and cost tables, and a "how I'd deploy this for a real client" section.
- A 3–5 minute demo video script: a complaint comes in, the draft appears in Slack with citations, it's approved, then a walk through the trace and the audit trail.
- Write down any honest limitations and what you'd do next.

**Done when**
- I can send someone the repo link and they understand the project in 2 minutes.
