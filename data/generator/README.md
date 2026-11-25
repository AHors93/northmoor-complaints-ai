# @northmoor/data-generator

Generates the synthetic data for the whole project. The same seed always gives the same bytes.

```sh
pnpm gen                 # full dataset in data/generated/ (gitignored)
pnpm gen --seed 7 --out /some/folder
pnpm gen:sample          # refreshes the committed data/generated/sample/
pnpm vitest run data/generator
```

| File                        | Contents                                                                                 |
| --------------------------- | ---------------------------------------------------------------------------------------- |
| `customers.json`            | 2,000 customers, each with one account                                                   |
| `transactions.jsonl`        | 12–24 months per account, reconciling to its balance                                     |
| `fee_events.jsonl`          | The fee entries from `transactions.jsonl`                                                |
| `complaints_export.csv`     | 500 complaints, about 3% duplicated, with mixed dates and labels                         |
| `policies/`                 | 15 documents, each as markdown, PDF and JSON metadata                                    |
| `truth/categories.json`     | True category per complaint                                                              |
| `truth/customer_links.json` | Customer per complaint                                                                   |
| `truth/planted_pii.json`    | Every PII value per CSV row, with offsets, for the complaint text and the final response |
| `truth/csv_quality.json`    | Planted duplicates, label mapping, and label and date counts                             |

Amounts are in pence, except `redress_amount` in the CSV, which is in pounds. Everything is as at
31 October 2026; the generator never reads the clock. Emails and phone numbers use reserved example ranges.

Old and current policy versions share an `id` and differ by `version` and `effectiveDate`. The FCA
DISP sourcebook isn't generated: download it by hand into `data/raw/fca/`.

The policy markdown lives in `policies/`. After an intended change to the output, run
`pnpm gen:sample` and commit the result, because a test compares it with the generator.

The optional `--llm` rewrite isn't built. It needs the PII proxy (Phase 5).
