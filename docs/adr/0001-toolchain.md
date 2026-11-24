# ADR 0001: Toolchain and version pins

**Context.** The stack is strict TypeScript on Node 22 with pnpm workspaces. TypeScript 7 is the
current release, but typescript-eslint 8.74 supports only versions below 6.1.

**Decision.** Pin exact versions. Use TypeScript 6.0.3 until typescript-eslint supports 7. Packages
export TypeScript source directly; esbuild will bundle the Lambdas. One root `tsconfig.json` checks
everything. Local Postgres uses port 5433, because 5432 is often taken by a host install.

**Alternatives.** TypeScript 7 without typed linting; project references with a build per package.

**Consequences.** No build step for local work. Packages can't be published as they are, which is
fine here. Revisit the TypeScript pin when typescript-eslint adds support.

pnpm is pinned to 11.29.0. Version 12 ships a native binary that pnpm 10's auto-switch installs
incorrectly (`ENOEXEC`), so it breaks for anyone starting from pnpm 10. Git hooks use lefthook, and
gitleaks runs from PATH or its Docker image.
