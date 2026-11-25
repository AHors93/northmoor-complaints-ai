import type { PolicyDoc } from '@northmoor/shared';
import { generateComplaints } from './complaints.ts';
import { generateCustomers, type CustomerRecord } from './customers.ts';
import { buildExportRows, renderExport, type ExportFiles } from './export.ts';
import { POLICIES } from './policies.ts';

export const DEFAULT_SEED = 42;
export const CUSTOMER_COUNT = 2000;
export const COMPLAINT_COUNT = 500;
const SAMPLE_COMPLAINTS = 20;
/** One current, one superseded, one restricted. */
const SAMPLE_POLICIES = ['fee-waiver:1.0', 'fee-waiver:2.0', 'redress-authority:1.0'];

export interface Dataset {
  customers: CustomerRecord[];
  complaints: ExportFiles;
  policies: readonly PolicyDoc[];
}

export function generateDataset(seed: number): Dataset {
  const { customers, rows } = generate(seed);
  return { customers, complaints: renderExport(rows), policies: POLICIES };
}

/** A self-consistent slice of the full dataset, small enough to commit. */
export function generateSample(seed: number): Dataset {
  const { customers, rows } = generate(seed);
  // Start with the first complaint that was exported twice, so the sample includes a duplicate.
  const duplicated = rows.find((r) => r.duplicate === 'altered')?.complaint.id;
  const ids = new Set(duplicated === undefined ? [] : [duplicated]);
  for (const row of rows) {
    if (ids.size === SAMPLE_COMPLAINTS) break;
    ids.add(row.complaint.id);
  }
  const sampleRows = rows.filter((r) => ids.has(r.complaint.id));
  const customerIds = new Set(sampleRows.map((r) => r.complaint.customer.id));
  return {
    customers: customers.filter((c) => customerIds.has(c.customer.id)),
    complaints: renderExport(sampleRows),
    policies: POLICIES.filter((p) => SAMPLE_POLICIES.includes(`${p.id}:${p.version}`)),
  };
}

function generate(seed: number) {
  const customers = generateCustomers(seed, CUSTOMER_COUNT);
  const complaints = generateComplaints(seed, customers, COMPLAINT_COUNT);
  return { customers, rows: buildExportRows(seed, complaints) };
}
