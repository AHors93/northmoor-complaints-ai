import { z } from 'zod';

const id = z.string().trim().min(1);
/** Money is always integer pence. */
const pence = z.int();
const nonNegativePence = pence.nonnegative();
const isoDate = z.iso.date();
const isoDateTime = z.iso.datetime();

export const complaintCategorySchema = z.enum(['fees', 'arrears', 'mis_selling', 'service']);
export type ComplaintCategory = z.infer<typeof complaintCategorySchema>;

export const complaintOutcomeSchema = z.enum(['upheld', 'not_upheld', 'partially_upheld']);
export type ComplaintOutcome = z.infer<typeof complaintOutcomeSchema>;

export const roleSchema = z.enum(['case_handler', 'team_lead', 'admin']);
export type Role = z.infer<typeof roleSchema>;

export const customerSchema = z.object({
  id,
  fullName: z.string().min(1),
  dateOfBirth: isoDate,
  address: z.object({
    line1: z.string().min(1),
    line2: z.string().min(1).optional(),
    town: z.string().min(1),
    postcode: z.string().min(1),
  }),
  email: z.email(),
  phone: z.string().min(1),
  account: z.object({
    accountNumber: z.string().regex(/^\d{8}$/),
    sortCode: z.string().regex(/^\d{2}-\d{2}-\d{2}$/),
    product: z.enum(['personal_loan', 'car_finance']),
    balancePence: pence,
    arrearsPence: nonNegativePence,
  }),
});
export type Customer = z.infer<typeof customerSchema>;

/** A normalised complaint. The messy CSV shape is a separate concern of ingestion. */
export const complaintSchema = z.object({
  id,
  customerId: id,
  team: id,
  receivedOn: isoDate,
  body: z.string().min(1),
  /** Null until triaged. */
  category: complaintCategorySchema.nullable(),
  /** Null until the case is closed. */
  resolution: z
    .object({
      outcome: complaintOutcomeSchema,
      redressPence: nonNegativePence,
      daysToResolve: z.int().nonnegative(),
      finalResponse: z.string().min(1),
    })
    .nullable(),
});
export type Complaint = z.infer<typeof complaintSchema>;

export const policyDocSchema = z.object({
  id,
  title: z.string().min(1),
  version: z.string().min(1),
  effectiveDate: isoDate,
  accessLevel: z.enum(['all', 'team_lead']),
});
export type PolicyDoc = z.infer<typeof policyDocSchema>;

export const citationSchema = z.object({
  docId: id,
  title: z.string().min(1),
  version: z.string().min(1),
  section: z.string().min(1),
});
export type Citation = z.infer<typeof citationSchema>;

/**
 * Citations may be empty here so ValidateDraft can see and reject an uncited draft with a reason.
 */
export const draftSchema = z.object({
  id,
  caseId: id,
  revision: z.int().positive(),
  body: z.string().min(1),
  citations: z.array(citationSchema),
  proposedOutcome: complaintOutcomeSchema,
  proposedRedressPence: nonNegativePence,
  createdAt: isoDateTime,
});
export type Draft = z.infer<typeof draftSchema>;

/** A named human's decision on one exact draft revision. */
export const approvalEventSchema = z.object({
  id,
  caseId: id,
  draftId: id,
  draftRevision: z.int().positive(),
  decision: z.enum(['approved', 'changes_requested', 'rejected']),
  approver: z.object({ id, displayName: z.string().trim().min(1), role: roleSchema }),
  comment: z.string().optional(),
  decidedAt: isoDateTime,
});
export type ApprovalEvent = z.infer<typeof approvalEventSchema>;

const auditBase = z.object({
  id,
  caseId: id,
  traceId: id,
  occurredAt: isoDateTime,
  actor: z.object({ type: z.enum(['user', 'service']), id }),
  /** The caller must redact these first: the audit client stores them as given. */
  redactedInput: z.json(),
  redactedOutput: z.json(),
  status: z.enum(['success', 'error', 'denied']),
});

export const auditEventSchema = z.discriminatedUnion('type', [
  auditBase.extend({
    type: z.literal('model_call'),
    modelId: id,
    tokensIn: z.int().nonnegative(),
    tokensOut: z.int().nonnegative(),
    /** Bedrock bills in USD; reporting converts to GBP. */
    costUsd: z.number().nonnegative(),
    latencyMs: z.number().nonnegative(),
  }),
  auditBase.extend({
    type: z.literal('tool_call'),
    tool: id,
    costUsd: z.number().nonnegative(),
    latencyMs: z.number().nonnegative(),
  }),
  auditBase.extend({ type: z.literal('approval'), approvalId: id }),
  auditBase.extend({ type: z.literal('state_transition'), from: id.nullable(), to: id }),
  auditBase.extend({ type: z.literal('config_change'), key: id, version: id }),
]);
export type AuditEvent = z.infer<typeof auditEventSchema>;
