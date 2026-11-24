# Northmoor Complaints AI

An AI case-handling assistant for a fictional UK lender's complaints team. The plan is in
[docs/BUILD_PLAN.md](docs/BUILD_PLAN.md) and decisions are in [docs/adr](docs/adr).

## Local setup

Needs Node 22, pnpm and Docker. `pnpm i` also installs a pre-commit hook: lint, typecheck, secrets scan.

```sh
pnpm i
pnpm lint && pnpm typecheck && pnpm test
pnpm db:up   # Postgres 16 + pgvector on localhost:5433 (override with POSTGRES_PORT)
```
