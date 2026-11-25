# ADR 0004: CI security checks

**Context.** The repo is public, and the next phase adds AWS. The local hook can be skipped with
`--no-verify`, and `main` was unprotected.

**Decision.** Run gitleaks over the full history, `pnpm audit`, dependency review and zizmor in CI, with
CodeQL through GitHub's default setup. Pin actions to commit SHAs. Dependabot waits 7 days before
proposing routine updates. Tests block generated data and env files from being tracked, and allow only
reserved emails and phone ranges in the sample. A ruleset on `main` requires a PR and passing checks.

**Alternatives.** Snyk or SonarCloud, which mostly overlap and need more accounts and tokens.

**Consequences.** A newly published high-severity vulnerability can fail an unrelated PR. The ruleset
needs no approval, because a sole maintainer can't approve their own PRs. Terraform, row-level security,
PII leakage and eval gates arrive with the phases that build them.
