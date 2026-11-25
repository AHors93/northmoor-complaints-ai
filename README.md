# Northmoor Complaints AI

An AI case-handling assistant for a fictional UK lender's complaints team. The plan is in
[docs/BUILD_PLAN.md](docs/BUILD_PLAN.md) and decisions are in [docs/adr](docs/adr).

## Local setup

Needs Node 22, pnpm and Docker. `pnpm i` also installs a pre-commit hook: lint, typecheck, secrets scan.

```sh
pnpm i
pnpm lint && pnpm typecheck && pnpm test
pnpm db:up   # Postgres 16 + pgvector on localhost:5433 (override with POSTGRES_PORT)
pnpm gen     # synthetic data in data/generated (see data/generator)
```

## How this was built

I set the problem, the architecture, the non-negotiable rules and the acceptance checks. They're in
[CLAUDE.md](CLAUDE.md), [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and
[docs/BUILD_PLAN.md](docs/BUILD_PLAN.md). Claude Code writes much of the implementation, one phase at
a time.

Each phase is a pull request that has to pass its "done when" checks, and I review it before the next
one starts. Significant decisions are recorded in [docs/adr](docs/adr).
