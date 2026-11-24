# Architecture

AI case-handling assistant for a (mock) UK lender's complaints team.

```mermaid
flowchart TB
    user["Case handler<br/>SSO via OIDC, role-based"]

    subgraph vpc["Private VPC (Terraform)"]
        api["API + auth<br/>Scoped JWT per tool call"]
        wf["Agent workflow<br/>Step Functions, durable"]
        hitl["Human approval<br/>Slack gate (task token)"]
        obs["Tracing + evals<br/>OpenTelemetry, CI gate"]

        pii["Model via PII proxy<br/>Redact → Bedrock → restore"]
        rag["Permission-filtered RAG<br/>Hybrid search, doc ACLs, citations"]
        mcp["MCP server<br/>Wraps legacy SOAP API"]

        audit[("Audit log<br/>S3 Object Lock")]
        pg[("Postgres + pgvector<br/>Fed by PDF/CSV ETL")]
        core["Mock core banking<br/>SOAP, rate limited"]
    end

    user --> api --> wf
    wf --> hitl
    wf --> obs
    wf --> pii
    wf --> rag
    wf --> mcp
    pii --> audit
    rag --> pg
    mcp --> core
```

## Key decisions

| Decision | Why |
|---|---|
| Step Functions over Temporal | AWS-native, durable by default, task tokens give a clean human-approval pause |
| Bedrock via VPC endpoint | Model traffic never leaves the private network |
| PII redaction before the model | Consistent placeholder tokens let the model reason about "Customer A" without seeing real data |
| Permission filter applied at query time | Users can only retrieve documents their role allows; no post-hoc filtering |
| S3 Object Lock for audit | The audit trail can't be altered, which matters in a regulated setting |

## Numbers

<!-- Fill in once measured -->
| Metric | Value |
|---|---|
| p50 / p95 latency per case | |
| Cost per case | |
| Eval pass rate (golden set) | |
| Abstention accuracy | |
