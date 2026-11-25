import type { Dataset } from './dataset.ts';

const json = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;
const jsonl = (values: readonly unknown[]): string =>
  values.map((v) => `${JSON.stringify(v)}\n`).join('');

/** Every generated text file except the policy documents, keyed by relative path. */
export function datasetFiles({ customers, complaints }: Dataset): Map<string, string> {
  const { truth, csv } = complaints;
  const entries = customers.flatMap(({ customer, ledger }) =>
    ledger.map(({ date, type, amountPence }, i) => ({
      id: `${customer.id}-${String(i + 1).padStart(3, '0')}`,
      customerId: customer.id,
      date,
      type,
      amountPence,
    })),
  );
  return new Map([
    [
      'customers.json',
      json(
        customers.map(({ customer, arrearsStatus, openedOn }) => ({
          ...customer,
          account: { ...customer.account, arrearsStatus, openedOn },
        })),
      ),
    ],
    ['transactions.jsonl', jsonl(entries)],
    ['fee_events.jsonl', jsonl(entries.filter((e) => e.type === 'missed_payment_fee'))],
    ['complaints_export.csv', csv],
    ['truth/categories.json', json(truth.categories)],
    ['truth/planted_pii.json', json(truth.plantedPii)],
    ['truth/customer_links.json', json(truth.customerLinks)],
    ['truth/csv_quality.json', json(truth.csvQuality)],
  ]);
}
