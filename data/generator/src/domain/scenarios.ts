import type { ComplaintCategory, ComplaintOutcome } from '@northmoor/shared';
import type { CustomerRecord } from './customers.ts';
import { AS_AT, addDays, daysBetween, formatDate } from './dates.ts';
import type { LedgerEntry } from './ledger.ts';
import { formatPence } from './money.ts';

export interface ScenarioMatch {
  /** The complaint can't have been received before this. */
  notBefore: string;
  issue: string;
  finding: string;
  redressPence: number | ((receivedOn: string) => number);
}

export interface Scenario {
  category: ComplaintCategory;
  outcome: ComplaintOutcome;
  weight: number;
  /** The account facts this complaint relies on, or null if this customer doesn't fit. */
  match: (record: CustomerRecord) => ScenarioMatch | null;
}

const longDate = (date: string): string => formatDate(date, 'long');
const yearAgo = addDays(AS_AT, -365);

const fees = (r: CustomerRecord): LedgerEntry[] =>
  r.ledger.filter((e) => e.type === 'missed_payment_fee');

const findFee = (
  r: CustomerRecord,
  accept: (fee: LedgerEntry, previousInYear: LedgerEntry[]) => boolean,
): LedgerEntry | undefined => {
  const all = fees(r);
  return all.find((fee, i) => {
    const previous = all.slice(0, i).filter((p) => daysBetween(p.date, fee.date) <= 365);
    const onlyFeeThatDay = all.filter((p) => p.date === fee.date).length === 1;
    const recent = fee.date > yearAgo && fee.date < addDays(AS_AT, -10);
    return recent && (fee.chargedInError || onlyFeeThatDay) && accept(fee, previous);
  });
};

/** A scenario that any customer passing `fits` could raise. */
const general =
  (
    fits: (r: CustomerRecord) => boolean,
    issue: string,
    finding: string,
    redressPence: number,
  ): Scenario['match'] =>
  (r) =>
    fits(r) ? { notBefore: yearAgo, issue, finding, redressPence } : null;

const anyone = (): boolean => true;

const arrears =
  (issue: string, finding: string, redressPence: number): Scenario['match'] =>
  (r) =>
    r.inArrearsSince !== null
      ? {
          notBefore: r.inArrearsSince > yearAgo ? r.inArrearsSince : yearAgo,
          issue,
          finding,
          redressPence,
        }
      : null;

export const SCENARIOS: readonly Scenario[] = [
  {
    category: 'fees',
    outcome: 'upheld',
    weight: 8,
    match: (r) => {
      const fee = findFee(r, (f) => f.chargedInError === true);
      return fee
        ? {
            notBefore: fee.date,
            issue: `You charged me the missed payment fee twice on ${longDate(fee.date)}. Both were ${formatPence(fee.amountPence)} and I only missed one payment.`,
            finding: `Our records show two missed payment fees on ${longDate(fee.date)} for a single missed payment. The second was an error, and we are refunding it.`,
            redressPence: fee.amountPence,
          }
        : null;
    },
  },
  {
    category: 'fees',
    outcome: 'partially_upheld',
    weight: 10,
    match: (r) => {
      const fee = findFee(r, (f, previous) => !f.chargedInError && previous.length === 0);
      return fee
        ? {
            notBefore: fee.date,
            issue: `I was charged ${formatPence(fee.amountPence)} on ${longDate(fee.date)} because a payment was late. It is the first time in a year and I think you should give it back.`,
            finding: `The fee on ${longDate(fee.date)} was charged correctly. Because it was the first in 12 months, we are refunding it as a gesture of goodwill.`,
            redressPence: fee.amountPence,
          }
        : null;
    },
  },
  {
    category: 'fees',
    outcome: 'not_upheld',
    weight: 10,
    match: (r) => {
      const fee = findFee(r, (f, previous) => !f.chargedInError && previous.length > 0);
      return fee
        ? {
            notBefore: fee.date,
            issue: `There is another ${formatPence(fee.amountPence)} charge on my loan from ${longDate(fee.date)}. These charges are unfair and I want it refunded.`,
            finding: `The payment due that month was not received, so the fee on ${longDate(fee.date)} was charged correctly. Another fee was charged in the 12 months before it, so it does not qualify for a goodwill refund.`,
            redressPence: 0,
          }
        : null;
    },
  },
  {
    category: 'arrears',
    outcome: 'upheld',
    weight: 8,
    match: arrears(
      'I agreed a payment plan with you for my missed payments and you still sent me a default notice. I have not slept.',
      'We agreed a payment plan with you and should have paused collections activity. The default notice was sent in error and has been withdrawn.',
      15_000,
    ),
  },
  {
    category: 'arrears',
    outcome: 'partially_upheld',
    weight: 8,
    match: arrears(
      'I know I am behind, but your collections team keep ringing me, sometimes four times in one day.',
      'We were entitled to contact you about the missed payments, but we called more often than our limit of three contacts in seven days.',
      5000,
    ),
  },
  {
    category: 'arrears',
    outcome: 'not_upheld',
    weight: 9,
    match: arrears(
      'You have put missed payments on my credit file and it has stopped me getting a phone contract. I want them taken off.',
      'The payments were not received when due, so the entries on your credit file are accurate and we cannot remove them.',
      0,
    ),
  },
  {
    category: 'mis_selling',
    outcome: 'upheld',
    weight: 6,
    match: (r) => ({
      notBefore: yearAgo,
      issue:
        'You should never have lent me this money. Nobody asked for payslips or looked at my other debts, and I could not afford it from day one.',
      finding:
        'We did not verify your income before lending, as our affordability policy requires. We are refunding the interest you have been charged.',
      redressPence: (receivedOn) =>
        r.ledger
          .filter((e) => e.type === 'interest' && e.date <= receivedOn)
          .reduce((total, e) => total + e.amountPence, 0),
    }),
  },
  {
    category: 'mis_selling',
    outcome: 'partially_upheld',
    weight: 6,
    match: general(
      (r) => r.customer.account.product === 'car_finance',
      'The dealer never told me they were getting commission from you for my car finance. I feel misled.',
      'The existence of commission was disclosed in your agreement, but it was not explained clearly. It did not change your interest rate.',
      15_000,
    ),
  },
  {
    category: 'mis_selling',
    outcome: 'not_upheld',
    weight: 8,
    match: general(
      anyone,
      'I was told I could finish the agreement early without paying anything extra. Now I find there is an early settlement charge.',
      'The early settlement charge is set out in the pre-contract information you signed, and the recorded sales call explains it.',
      0,
    ),
  },
  {
    category: 'service',
    outcome: 'upheld',
    weight: 8,
    match: general(
      anyone,
      'I gave you my new address months ago and you carried on posting letters to the old one. Someone else has been opening my post.',
      'You told us about your change of address and we failed to update our records, so letters went to the wrong address.',
      15_000,
    ),
  },
  {
    category: 'service',
    outcome: 'partially_upheld',
    weight: 9,
    match: general(
      anyone,
      'I was on hold for over an hour and then cut off. When I rang back I had to explain everything again.',
      'Your call was answered and your query resolved the same day, but the wait was longer than our service standard.',
      5000,
    ),
  },
  {
    category: 'service',
    outcome: 'not_upheld',
    weight: 10,
    match: general(
      anyone,
      'The person I spoke to was rude and refused to discuss my account, just because I could not remember a password.',
      'We listened to the call. The adviser was polite and was right not to discuss the account before completing security checks.',
      0,
    ),
  },
];
