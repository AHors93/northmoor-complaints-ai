# ADR 0006: Infrastructure foundations

**Context.** Northmoor shares an AWS account with other projects, and its costs must be separable. Dev
has no NAT gateway and no interface endpoints.

**Decision.**

- **Access:** a deploy role, assumed with MFA for at most an hour, that works only in one region. App
  roles must carry a permissions boundary. Terraform refuses other accounts and other credentials.
- **Costs:** a `project` tag on everything, a region no other project uses, and a budget for each. A cost
  category reports them by application.
- **Database:** Aurora is reached through the RDS Data API in dev, so Lambdas stay outside the VPC. The
  security group has no rules.
- **Audit:** Object Lock in governance mode. The deploy role can't bypass it; only a teardown role can,
  and only on dev audit buckets. The bucket rejects any write without `If-None-Match`.
- **State:** S3 with a lock file. The bootstrap state is local.

**Alternatives.** A separate AWS account, which isolates better but needs an organisation and SSO. Aurora
with a public endpoint. A NAT gateway or endpoints in dev, which cost too much.

**Consequences.** Quotas and some account-wide charges stay shared. Row-level security must be proven
through the Data API. The region budget would count another project that moved into the region. Mocked
tests can't prove the IAM policies: the first deploy does. `enterprise` is rejected until Phase 9.
