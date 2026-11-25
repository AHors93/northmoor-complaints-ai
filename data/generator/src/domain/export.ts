import type { Complaint } from '@northmoor/shared';
import { toCsv } from './csv.ts';
import type { ComplaintRecord } from './complaints.ts';
import { formatDate, type DateFormat } from './dates.ts';
import { createRandom, pickWeighted } from './random.ts';
import { mapText, render, type PlantedPii, type Segment } from './segments.ts';

type Category = NonNullable<Complaint['category']>;

export const LABEL_VARIANTS: Record<Category, readonly string[]> = {
  fees: ['Fees', 'fee', 'charges', 'FEES '],
  arrears: ['Arrears', 'arrears', 'Collections', ' ARREARS'],
  mis_selling: ['Mis-selling', 'misselling', 'Mis Selling', 'missold'],
  service: ['Service', 'customer service', 'SERVICE ', 'Cust Svc'],
};

export const CSV_HEADER = [
  'complaint_ref',
  'account_number',
  'received_date',
  'team',
  'category',
  'complaint_text',
  'outcome',
  'redress_amount',
  'days_to_resolve',
  'final_response',
] as const;

const OUTCOME_LABELS = {
  upheld: 'upheld',
  not_upheld: 'not upheld',
  partially_upheld: 'partially upheld',
} as const;

export interface ExportRow {
  complaint: ComplaintRecord;
  ref: string;
  team: string;
  label: string;
  dateFormat: DateFormat;
  body: Segment[];
  duplicate: 'none' | 'exact' | 'altered';
}

export const DUPLICATE_RATE = 0.03;

/** Adds the mess a real export would have: mixed dates and labels, and repeated rows. */
export function buildExportRows(seed: number, complaints: readonly ComplaintRecord[]): ExportRow[] {
  const faker = createRandom(seed, 'export');
  const rows: ExportRow[] = complaints.map((complaint) => ({
    complaint,
    ref: complaint.id,
    team: complaint.team,
    label: faker.helpers.arrayElement(LABEL_VARIANTS[complaint.category]),
    dateFormat: faker.helpers.arrayElement(['iso', 'uk_slash', 'long'] as const),
    body: complaint.body,
    duplicate: 'none',
  }));
  const originals = faker.helpers.arrayElements(
    rows,
    Math.round((rows.length * DUPLICATE_RATE) / (1 - DUPLICATE_RATE)),
  );
  for (const original of originals) {
    const copy: ExportRow = pickWeighted(faker, [
      { weight: 4, value: { ...original, duplicate: 'exact' as const } },
      {
        weight: 6,
        value: {
          ...original,
          ref: `${original.ref.toLowerCase()} `,
          team: ` ${original.team.toUpperCase()}`,
          body: [' ', ...mapText(original.body, (t) => t.toUpperCase()), '  '],
          duplicate: 'altered' as const,
        },
      },
    ]);
    // Always after the original, so "first row wins" is the correct way to deduplicate.
    const at = faker.number.int({ min: rows.indexOf(original) + 1, max: rows.length });
    rows.splice(at, 0, copy);
  }
  return rows;
}

interface RowPii {
  /** 1-based data row in the CSV, not counting the header. */
  row: number;
  complaintId: string;
  complaintText: PlantedPii[];
  finalResponse: PlantedPii[];
}

export interface ExportFiles {
  csv: string;
  truth: {
    categories: Record<string, Category>;
    customerLinks: Record<string, string>;
    plantedPii: RowPii[];
    csvQuality: {
      rows: number;
      uniqueComplaints: number;
      duplicates: { row: number; originalRow: number; complaintId: string; kind: string }[];
      labelMapping: Record<string, Category>;
      labelCounts: Record<string, number>;
      dateFormatCounts: Record<DateFormat, number>;
    };
  };
}

export function renderExport(rows: readonly ExportRow[]): ExportFiles {
  const cells: string[][] = [];
  const plantedPii: RowPii[] = [];
  const categories: Record<string, Category> = {};
  const customerLinks: Record<string, string> = {};
  const labelMapping: Record<string, Category> = {};
  const labelCounts: Record<string, number> = {};
  const dateFormatCounts: Record<DateFormat, number> = { iso: 0, uk_slash: 0, long: 0 };
  const firstRow = new Map<string, number>();
  const duplicates: ExportFiles['truth']['csvQuality']['duplicates'] = [];

  rows.forEach((r, i) => {
    const row = i + 1;
    const { complaint } = r;
    const { resolution } = complaint;
    const body = render(r.body);
    const letter = render(resolution?.finalResponse ?? []);
    cells.push([
      r.ref,
      complaint.customer.account.accountNumber,
      formatDate(complaint.receivedOn, r.dateFormat),
      r.team,
      r.label,
      body.text,
      resolution ? OUTCOME_LABELS[resolution.outcome] : '',
      resolution ? (resolution.redressPence / 100).toFixed(2) : '',
      resolution ? String(resolution.daysToResolve) : '',
      letter.text,
    ]);
    plantedPii.push({
      row,
      complaintId: complaint.id,
      complaintText: body.pii,
      finalResponse: letter.pii,
    });
    categories[complaint.id] = complaint.category;
    customerLinks[complaint.id] = complaint.customer.id;
    labelMapping[r.label] = complaint.category;
    labelCounts[r.label] = (labelCounts[r.label] ?? 0) + 1;
    dateFormatCounts[r.dateFormat]++;
    const originalRow = firstRow.get(complaint.id);
    if (originalRow === undefined) firstRow.set(complaint.id, row);
    else duplicates.push({ row, originalRow, complaintId: complaint.id, kind: r.duplicate });
  });

  return {
    csv: toCsv(CSV_HEADER, cells),
    truth: {
      categories,
      customerLinks,
      plantedPii,
      csvQuality: {
        rows: rows.length,
        uniqueComplaints: firstRow.size,
        duplicates,
        labelMapping,
        labelCounts,
        dateFormatCounts,
      },
    },
  };
}
