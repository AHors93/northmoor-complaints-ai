import type { PolicyDoc } from '@northmoor/shared';

const doc = (
  id: string,
  title: string,
  version: string,
  effectiveDate: string,
  accessLevel: PolicyDoc['accessLevel'] = 'all',
): PolicyDoc => ({ id, title, version, effectiveDate, accessLevel });

/** Superseded versions share an id with the current one, and have an earlier effective date. */
export const POLICIES: readonly PolicyDoc[] = [
  doc('fee-waiver', 'Fee Waiver Policy', '1.0', '2023-04-01'),
  doc('fee-waiver', 'Fee Waiver Policy', '2.0', '2025-07-01'),
  doc('arrears-handling', 'Arrears Handling Policy', '1.0', '2023-01-16'),
  doc('arrears-handling', 'Arrears Handling Policy', '2.0', '2025-03-03'),
  doc('affordability-checks', 'Affordability Checks Policy', '1.0', '2024-02-01'),
  doc('complaint-handling', 'Complaint Handling Procedure', '1.0', '2024-01-08'),
  doc('redress-calculation', 'Redress Calculation Policy', '1.0', '2024-05-01'),
  doc('commission-disclosure', 'Commission Disclosure Policy', '1.0', '2024-09-02'),
  doc('early-settlement', 'Early Settlement Policy', '1.0', '2023-10-02'),
  doc('credit-file-reporting', 'Credit File Reporting Policy', '1.0', '2024-03-04'),
  doc('service-standards', 'Customer Service Standards', '1.0', '2024-06-03'),
  doc('customer-data', 'Customer Identification and Data Policy', '1.0', '2024-04-15'),
  doc('fraud-indicators', 'Fraud Indicators', '1.0', '2024-07-01', 'team_lead'),
  doc('vulnerable-customers', 'Vulnerable Customer Procedures', '1.0', '2024-08-05', 'team_lead'),
  doc('redress-authority', 'Redress Authority Limits', '1.0', '2024-05-01', 'team_lead'),
];

export const policyFileName = (p: PolicyDoc): string => `${p.id}-v${p.version}`;
