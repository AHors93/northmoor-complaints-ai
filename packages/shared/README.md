# @northmoor/shared

Code used by every service: the zod config loader, the JSON logger (requires `caseId` and
`traceId`), the audit client interface with a local file implementation, and the domain types. The S3
implementation is a separate entry point, `@northmoor/shared/s3-audit`, so other code doesn't load the
AWS SDK.

- **Run:** it's a library, imported as source by the other packages.
- **Test:** `pnpm vitest run packages/shared` from the repo root.
