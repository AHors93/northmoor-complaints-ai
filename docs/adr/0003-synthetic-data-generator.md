# ADR 0003: Synthetic data generator

**Context.** Later phases test ingestion, PII redaction and retrieval against this data, so it must be
reproducible and the ground truth must be exact.

**Decision.** Build complaint text from segments and record each PII value, with its offsets, as it is
inserted. Seed each stage separately, fix the as-at date at 31 October 2026, and set the PDF dates
explicitly. Record PII in final responses too, because they can also reach a model. Run TypeScript with
Node's type stripping, which needs `.ts` import extensions. Use faker and PDFKit.

**Alternatives.** Detecting PII after generation (inexact); rendering PDFs with a headless browser
(heavy, and not byte-stable); running through tsx (another dependency).

**Consequences.** The generator can only import types from `@northmoor/shared`, whose own imports have
no extensions; the tests check output against its schemas. Upgrading faker or PDFKit can change the
output, and the committed-sample test will show it.
