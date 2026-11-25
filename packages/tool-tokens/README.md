# @northmoor/tool-tokens

The claims and verifier for tool tokens: ES256 JWTs that last at most five minutes and allow one scope
on one case. `services/api` mints them, and each tool verifies them. See
[ADR 0005](../../docs/adr/0005-tool-tokens-and-audit-store.md).

- **Run:** it's a library, imported as source by the other packages.
- **Test:** `pnpm vitest run packages/tool-tokens` from the repo root.
