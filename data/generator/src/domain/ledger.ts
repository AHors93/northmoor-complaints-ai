import type { Faker } from '@faker-js/faker';
import type { Customer } from '@northmoor/shared';
import { AS_AT, addDays, monthsBefore } from './dates.ts';
import { pickWeighted } from './random.ts';

export type ArrearsStatus = 'up_to_date' | 'one_missed' | 'two_missed' | 'three_or_more_missed';

export interface LedgerEntry {
  date: string;
  type: 'drawdown' | 'interest' | 'payment' | 'missed_payment_fee';
  /** Positive increases what the customer owes. */
  amountPence: number;
  /** True when the fee was charged twice for one missed payment: a planted bank error. */
  chargedInError?: true;
}

export interface Account {
  openedOn: string;
  entries: LedgerEntry[];
  balancePence: number;
  arrearsPence: number;
  arrearsStatus: ArrearsStatus;
  inArrearsSince: string | null;
}

/** Matches the fee waiver policy: £25 until 30 June 2025, then £12. */
export function missedPaymentFeePence(date: string): number {
  return date < '2025-07-01' ? 2500 : 1200;
}

export function buildLedger(faker: Faker, product: Customer['account']['product']): Account {
  const months = faker.number.int({ min: 12, max: 24 });
  const start = monthsBefore(AS_AT, months);
  const principal =
    faker.number.int(product === 'car_finance' ? { min: 60, max: 250 } : { min: 10, max: 150 }) *
    10_000;
  const instalment = Math.round(principal / faker.number.int({ min: 36, max: 60 })) + 2500;
  const monthlyRateBps = faker.number.int({ min: 50, max: 180 });
  const missRate = pickWeighted(faker, [
    { weight: 70, value: 0 },
    { weight: 22, value: 0.12 },
    { weight: 8, value: 0.4 },
  ]);

  const entries: LedgerEntry[] = [{ date: start, type: 'drawdown', amountPence: principal }];
  let balance = principal;
  let missed = 0;
  let inArrearsSince: string | null = null;
  const add = (entry: LedgerEntry): void => {
    entries.push(entry);
    balance += entry.amountPence;
  };

  for (let m = months - 1; m >= 0; m--) {
    const monthStart = monthsBefore(AS_AT, m);
    add({
      date: monthStart,
      type: 'interest',
      amountPence: Math.round((balance * monthlyRateBps) / 10_000),
    });
    const dueDate = addDays(monthStart, 14);
    if (faker.datatype.boolean({ probability: missRate })) {
      missed++;
      inArrearsSince ??= dueDate;
      const date = addDays(dueDate, 5);
      add({ date, type: 'missed_payment_fee', amountPence: missedPaymentFeePence(date) });
      if (faker.datatype.boolean({ probability: 0.12 })) {
        add({
          date,
          type: 'missed_payment_fee',
          amountPence: missedPaymentFeePence(date),
          chargedInError: true,
        });
      }
    } else {
      const catchUp = missed > 0 && faker.datatype.boolean({ probability: 0.35 }) ? 2 : 1;
      missed -= catchUp - 1;
      if (missed === 0) inArrearsSince = null;
      add({
        date: dueDate,
        type: 'payment',
        amountPence: -Math.min(balance, instalment * catchUp),
      });
    }
  }
  return {
    openedOn: start,
    entries,
    balancePence: balance,
    arrearsPence: missed * instalment,
    inArrearsSince,
    arrearsStatus:
      (['up_to_date', 'one_missed', 'two_missed'] as const)[missed] ?? 'three_or_more_missed',
  };
}
