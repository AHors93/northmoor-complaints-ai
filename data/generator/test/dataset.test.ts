import { complaintCategorySchema, customerSchema } from '@northmoor/shared';
import { describe, expect, it } from 'vitest';
import { AS_AT, addDays, daysBetween } from '../src/domain/dates.ts';
import { generateDataset, DEFAULT_SEED } from '../src/domain/dataset.ts';
import { generateComplaints, type ComplaintRecord } from '../src/domain/complaints.ts';
import { LABEL_VARIANTS } from '../src/domain/export.ts';
import { datasetFiles } from '../src/domain/files.ts';
import { missedPaymentFeePence } from '../src/domain/ledger.ts';
import { render } from '../src/domain/segments.ts';
import { parseCsv } from './parse-csv.ts';

const dataset = generateDataset(DEFAULT_SEED);
const { customers } = dataset;
const { csv, truth } = dataset.complaints;
const [header = [], ...rows] = parseCsv(csv);
const column = (row: string[], name: string): string => {
  const index = header.indexOf(name);
  const value = row[index];
  if (value === undefined) throw new Error(`Missing column ${name}`);
  return value;
};
const complaints = generateComplaints(DEFAULT_SEED, customers, 500);
const customerById = new Map(customers.map((c) => [c.customer.id, c]));
const rowText = rows.map((row, i) => ({
  row,
  customer: customerById.get(truth.customerLinks[truth.plantedPii[i]?.complaintId ?? ''] ?? '')
    ?.customer,
  fields: [
    { text: column(row, 'complaint_text'), pii: truth.plantedPii[i]?.complaintText ?? [] },
    { text: column(row, 'final_response'), pii: truth.plantedPii[i]?.finalResponse ?? [] },
  ],
}));

describe('reproducibility', () => {
  it('produces the same text files for the same seed', () => {
    expect(datasetFiles(generateDataset(7))).toEqual(datasetFiles(generateDataset(7)));
  });

  it('produces different data for a different seed', () => {
    expect(generateDataset(7).complaints.csv).not.toBe(generateDataset(8).complaints.csv);
  });

  it.each([1, 7, 99, 2026])('finds enough matching customers with seed %i', (seed) => {
    expect(generateDataset(seed).complaints.truth.csvQuality.uniqueComplaints).toBe(500);
  });
});

describe('planted PII', () => {
  it('has an entry for every CSV row', () => {
    expect(truth.plantedPii.map((p) => p.row)).toEqual(rows.map((_, i) => i + 1));
  });

  it('plants at least one value in every complaint body', () => {
    expect(truth.plantedPii.filter((p) => p.complaintText.length === 0)).toEqual([]);
  });

  it('finds every recorded value at its offsets in the CSV', () => {
    for (const { fields } of rowText) {
      for (const { text, pii } of fields) {
        for (const p of pii) expect(text.slice(p.start, p.end)).toBe(p.value);
      }
    }
  });

  it('plants every required type', () => {
    const types = new Set(truth.plantedPii.flatMap((p) => p.complaintText.map((v) => v.type)));
    expect([...types].sort()).toEqual(
      ['account_number', 'email', 'name', 'phone', 'postcode', 'sort_code'].sort(),
    );
  });

  it('leaves no unrecorded email, number or postcode in the text', () => {
    const patterns = [
      /\S+@\S+/g,
      /\b\d{4} ?\d{4}\b/g,
      /\b\d{2}[- ]?\d{2}[- ]?\d{2}\b/g,
      /(?:\+44 ?|\b0)\d[\d ]{8,}\d/g,
      /\b[A-Z]{1,2}\d{1,2} ?\d[A-Z]{2}\b/gi,
    ];
    const missed = rowText.flatMap(({ fields }) =>
      fields.flatMap(({ text, pii }) => {
        let rest = text;
        for (const p of pii) {
          rest = rest.slice(0, p.start) + '#'.repeat(p.end - p.start) + rest.slice(p.end);
        }
        return patterns.flatMap((pattern) => rest.match(pattern) ?? []);
      }),
    );
    expect(missed).toEqual([]);
  });

  it('leaves no unrecorded full name, street or email of the customer in the text', () => {
    const missed = rowText.flatMap(({ fields, customer }) => {
      if (!customer) throw new Error('Row has no customer link');
      return fields.flatMap(({ text, pii }) => {
        const rest = pii
          .reduce(
            (t, p) => t.slice(0, p.start) + '#'.repeat(p.end - p.start) + t.slice(p.end),
            text,
          )
          .toLowerCase();
        return [customer.fullName, customer.address.line1, customer.email].filter((v) =>
          rest.includes(v.toLowerCase()),
        );
      });
    });
    expect(missed).toEqual([]);
  });
});

describe('complaints export', () => {
  it('duplicates between 2% and 5% of rows', () => {
    const rate = truth.csvQuality.duplicates.length / rows.length;
    expect(rate).toBeGreaterThanOrEqual(0.02);
    expect(rate).toBeLessThanOrEqual(0.05);
  });

  it('records the same duplicates that appear in the CSV', () => {
    const seen = new Map<string, number>();
    const found: { row: number; originalRow: number }[] = [];
    rows.forEach((row, i) => {
      const ref = column(row, 'complaint_ref').trim().toUpperCase();
      const originalRow = seen.get(ref);
      if (originalRow === undefined) seen.set(ref, i + 1);
      else found.push({ row: i + 1, originalRow });
    });
    expect(
      truth.csvQuality.duplicates.map(({ row, originalRow }) => ({ row, originalRow })),
    ).toEqual(found);
  });

  it('includes both exact and altered duplicates', () => {
    expect(new Set(truth.csvQuality.duplicates.map((d) => d.kind))).toEqual(
      new Set(['exact', 'altered']),
    );
  });

  it('marks a duplicate as exact only if the whole row is identical', () => {
    for (const { row, originalRow, kind } of truth.csvQuality.duplicates) {
      const same = JSON.stringify(rows[row - 1]) === JSON.stringify(rows[originalRow - 1]);
      expect(same).toBe(kind === 'exact');
    }
  });

  it('uses every label variant, each mapping to one category', () => {
    expect(Object.keys(truth.csvQuality.labelMapping).sort()).toEqual(
      Object.values(LABEL_VARIANTS).flat().sort(),
    );
  });

  it('counts labels as they appear in the CSV', () => {
    const counts: Record<string, number> = {};
    for (const row of rows) {
      const label = column(row, 'category');
      counts[label] = (counts[label] ?? 0) + 1;
    }
    expect(truth.csvQuality.labelCounts).toEqual(counts);
  });

  it('counts date formats as they appear in the CSV', () => {
    const counts = { iso: 0, uk_slash: 0, long: 0 };
    for (const row of rows) {
      const date = column(row, 'received_date');
      if (/^\d{4}-\d{2}-\d{2}$/.test(date)) counts.iso++;
      else if (/^\d{2}\/\d{2}\/\d{4}$/.test(date)) counts.uk_slash++;
      else if (/^\d{1,2}(st|nd|rd|th) [A-Z][a-z]+ \d{4}$/.test(date)) counts.long++;
    }
    expect(truth.csvQuality.dateFormatCounts).toEqual(counts);
  });

  it('gives every complaint a category and an existing customer', () => {
    expect(Object.keys(truth.categories)).toHaveLength(500);
    for (const [id, category] of Object.entries(truth.categories)) {
      expect(complaintCategorySchema.options).toContain(category);
      expect(customerById.has(truth.customerLinks[id] ?? '')).toBe(true);
    }
  });

  it('links each row to the customer who owns its account number', () => {
    for (const { row, customer } of rowText) {
      expect(column(row, 'account_number')).toBe(customer?.account.accountNumber);
    }
  });

  it('has a final response for exactly the closed cases', () => {
    for (const row of rows) {
      expect(column(row, 'final_response') !== '').toBe(column(row, 'outcome') !== '');
    }
  });
});

describe('customers', () => {
  it('generates 2,000 customers that match the shared schema', () => {
    expect(customers).toHaveLength(2000);
    for (const { customer } of customers) expect(customerSchema.parse(customer)).toEqual(customer);
  });

  it('gives every customer a unique account number', () => {
    expect(new Set(customers.map((c) => c.customer.account.accountNumber)).size).toBe(2000);
  });

  it('reconciles every balance with its transactions', () => {
    for (const { customer, ledger } of customers) {
      expect(ledger.reduce((sum, e) => sum + e.amountPence, 0)).toBe(customer.account.balancePence);
    }
  });

  it('gives every account 12 to 24 months of history', () => {
    for (const { ledger } of customers) {
      const months = ledger.filter((e) => e.type === 'interest').length;
      expect(months).toBeGreaterThanOrEqual(12);
      expect(months).toBeLessThanOrEqual(24);
    }
  });

  it('charges the fee that was in force on the day', () => {
    for (const fee of customers.flatMap((c) => c.ledger)) {
      if (fee.type === 'missed_payment_fee') {
        expect(fee.amountPence).toBe(missedPaymentFeePence(fee.date));
      }
    }
  });

  it('reports arrears status consistently with the arrears balance', () => {
    for (const { customer, arrearsStatus } of customers) {
      expect(arrearsStatus === 'up_to_date').toBe(customer.account.arrearsPence === 0);
    }
  });
});

describe('complaints agree with the account history', () => {
  const ledgerOf = (c: ComplaintRecord) => customerById.get(c.customer.id)?.ledger ?? [];
  const closed = (category: string, outcome: string) =>
    complaints.filter((c) => c.category === category && c.resolution?.outcome === outcome);

  it('upholds a fee complaint only where a fee was charged twice', () => {
    const cases = closed('fees', 'upheld');
    expect(cases.length).toBeGreaterThan(0);
    for (const c of cases) {
      expect(
        ledgerOf(c).some((e) => e.chargedInError && e.amountPence === c.resolution?.redressPence),
      ).toBe(true);
    }
  });

  it('refunds exactly one fee that was charged before the complaint as goodwill', () => {
    const cases = closed('fees', 'partially_upheld');
    expect(cases.length).toBeGreaterThan(0);
    for (const c of cases) {
      expect(
        ledgerOf(c).some(
          (e, _, all) =>
            e.type === 'missed_payment_fee' &&
            e.date < c.receivedOn &&
            e.amountPence === c.resolution?.redressPence &&
            !all.some(
              (p) =>
                p.type === 'missed_payment_fee' &&
                p.date < e.date &&
                daysBetween(p.date, e.date) <= 365,
            ),
        ),
      ).toBe(true);
    }
  });

  it('raises arrears complaints only for customers in arrears', () => {
    const cases = complaints.filter((c) => c.category === 'arrears');
    expect(cases.length).toBeGreaterThan(0);
    for (const c of cases) expect(c.customer.account.arrearsPence).toBeGreaterThan(0);
  });

  it('receives arrears complaints only after the arrears began', () => {
    for (const c of complaints.filter((x) => x.category === 'arrears')) {
      const since = customerById.get(c.customer.id)?.inArrearsSince;
      expect(since).toEqual(expect.any(String));
      expect(c.receivedOn > (since ?? AS_AT)).toBe(true);
    }
  });

  it('leaves between 2% and 15% of complaints open', () => {
    const rate = complaints.filter((c) => c.resolution === null).length / complaints.length;
    expect(rate).toBeGreaterThanOrEqual(0.02);
    expect(rate).toBeLessThanOrEqual(0.15);
  });

  it('never dates a complaint or its resolution after the as-at date', () => {
    for (const c of complaints) {
      expect(c.receivedOn <= AS_AT).toBe(true);
      if (c.resolution) {
        expect(addDays(c.receivedOn, c.resolution.daysToResolve) <= AS_AT).toBe(true);
      }
    }
  });

  it('states the redress amount in the final response', () => {
    for (const c of complaints) {
      if (!c.resolution || c.resolution.redressPence === 0) continue;
      expect(render(c.resolution.finalResponse).text).toContain(
        `£${(c.resolution.redressPence / 100).toFixed(2)}`,
      );
    }
  });
});
