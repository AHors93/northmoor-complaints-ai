import type { Faker } from '@faker-js/faker';
import type { Complaint } from '@northmoor/shared';
import type { CustomerRecord } from './customers.ts';
import { AS_AT, addDays, daysBetween } from './dates.ts';
import { formatPence } from './money.ts';
import { createRandom, pickWeighted } from './random.ts';
import { SCENARIOS, type ScenarioMatch } from './scenarios.ts';
import { SURNAMES } from './surnames.ts';
import { mapText, type Segment } from './segments.ts';

const MAX_DAYS_TO_RESOLVE = 90;

export const TEAMS = ['leeds', 'bristol'] as const;

export interface ComplaintRecord {
  id: string;
  customer: CustomerRecord['customer'];
  team: string;
  receivedOn: string;
  category: NonNullable<Complaint['category']>;
  body: Segment[];
  /** Null while the case is still open. */
  resolution:
    | (Omit<NonNullable<Complaint['resolution']>, 'finalResponse'> & { finalResponse: Segment[] })
    | null;
}

export function generateComplaints(
  seed: number,
  customers: readonly CustomerRecord[],
  count: number,
): ComplaintRecord[] {
  const faker = createRandom(seed, 'complaints');
  const pools = SCENARIOS.map((scenario) => ({
    weight: scenario.weight,
    value: {
      scenario,
      candidates: customers.flatMap((record) => {
        const match = scenario.match(record);
        return match ? [{ record, match }] : [];
      }),
    },
  }));
  const used = new Set<string>();

  return Array.from({ length: count }, (_, i) => {
    const { scenario, candidates } = pickWeighted(faker, pools);
    const available = candidates.filter((c) => !used.has(c.record.customer.id));
    if (available.length === 0) {
      throw new RangeError(`Not enough customers for a ${scenario.category} complaint`);
    }
    const { record, match } = faker.helpers.arrayElement(available);
    const { customer } = record;
    used.add(customer.id);

    const earliest = addDays(match.notBefore, 2);
    // Most cases are old enough to be closed by the as-at date, however long they took.
    const settledBy = addDays(AS_AT, -MAX_DAYS_TO_RESOLVE);
    const latest =
      earliest < settledBy && faker.datatype.boolean({ probability: 0.95 }) ? settledBy : AS_AT;
    const receivedOn = addDays(
      earliest,
      faker.number.int({ min: 0, max: Math.max(0, daysBetween(earliest, latest)) }),
    );
    const daysToResolve = pickWeighted(faker, [
      { weight: 92, value: faker.number.int({ min: 2, max: 56 }) },
      { weight: 8, value: faker.number.int({ min: 57, max: MAX_DAYS_TO_RESOLVE }) },
    ]);
    const closed = addDays(receivedOn, daysToResolve) <= AS_AT;
    const redressPence =
      typeof match.redressPence === 'number' ? match.redressPence : match.redressPence(receivedOn);
    const id = `NML-${String(i + 1).padStart(5, '0')}`;

    return {
      id,
      customer,
      team: faker.helpers.arrayElement(TEAMS),
      receivedOn,
      category: scenario.category,
      body: writeBody(faker, customer, match),
      resolution: closed
        ? {
            outcome: scenario.outcome,
            redressPence,
            daysToResolve,
            finalResponse: writeFinalResponse(
              faker,
              id,
              customer,
              match,
              redressPence,
              scenario.outcome,
            ),
          }
        : null,
    };
  });
}

type CustomerDetails = ComplaintRecord['customer'];

const name = (value: string): Segment => ({ type: 'name', value });

function accountNumber(faker: Faker, c: CustomerDetails): Segment {
  const n = c.account.accountNumber;
  return {
    type: 'account_number',
    value: faker.helpers.arrayElement([n, n, `${n.slice(0, 4)} ${n.slice(4)}`]),
  };
}

function sortCode(faker: Faker, c: CustomerDetails): Segment {
  const s = c.account.sortCode;
  return {
    type: 'sort_code',
    value: faker.helpers.arrayElement([s, s, s.replaceAll('-', ' '), s.replaceAll('-', '')]),
  };
}

function phone(faker: Faker, c: CustomerDetails): Segment {
  const compact = c.phone.replaceAll(' ', '');
  return {
    type: 'phone',
    value: faker.helpers.arrayElement([c.phone, compact, `+44 ${c.phone.slice(1)}`]),
  };
}

function postcode(faker: Faker, c: CustomerDetails): Segment {
  const p = c.address.postcode;
  return {
    type: 'postcode',
    value: faker.helpers.arrayElement([p, p, p.toLowerCase(), p.replace(' ', '')]),
  };
}

const email = (c: CustomerDetails): Segment => ({ type: 'email', value: c.email });

function writeBody(faker: Faker, c: CustomerDetails, match: ScenarioMatch): Segment[] {
  const pick = (options: Segment[][]): Segment[] => faker.helpers.arrayElement(options);
  const opening = pick([
    ['My name is ', name(c.fullName), ' and my account number is ', accountNumber(faker, c), '. '],
    ['Hello, I want to make a complaint about account ', accountNumber(faker, c), '. '],
    ['Account ', accountNumber(faker, c), ', sort code ', sortCode(faker, c), '.\n\n'],
    ['This is ', name(c.fullName), ' of ', postcode(faker, c), '. I am writing to complain. '],
  ]);
  const aside = pick([
    [],
    [],
    [' I spoke to ', name(faker.person.firstName()), ' on the phone and got nowhere.'],
    [
      ' My partner ',
      name(`${faker.person.firstName()} ${faker.helpers.arrayElement(SURNAMES)}`),
      ' heard the whole thing.',
    ],
  ]);
  const contact = pick([
    [' Ring me on ', phone(faker, c), '.'],
    [' You can email me at ', email(c), '.'],
    [' Call ', phone(faker, c), ' or email ', email(c), '.'],
    [' Write to me, my postcode is ', postcode(faker, c), '.'],
    [' Any refund should go to ', sortCode(faker, c), ' ', accountNumber(faker, c), '.'],
  ]);
  const closing = pick([
    ['\n\nRegards,\n', name(c.fullName)],
    [' Thanks, ', name(c.fullName.split(' ')[0] ?? c.fullName)],
    [],
  ]);
  const body: Segment[] = [...opening, match.issue, ...aside, ...contact, ...closing];
  const transform = pickWeighted<(text: string) => string>(faker, [
    { weight: 86, value: (t) => t },
    { weight: 9, value: (t) => t.toLowerCase() },
    { weight: 5, value: (t) => t.toUpperCase() },
  ]);
  return mapText(body, transform);
}

function writeFinalResponse(
  faker: Faker,
  id: string,
  c: CustomerDetails,
  match: ScenarioMatch,
  redressPence: number,
  outcome: 'upheld' | 'not_upheld' | 'partially_upheld',
): Segment[] {
  const decision = {
    upheld: 'We are upholding your complaint.',
    partially_upheld: 'We are partially upholding your complaint.',
    not_upheld: 'We are not upholding your complaint.',
  }[outcome];
  const payment =
    redressPence > 0
      ? `\n\nWe will pay you ${formatPence(redressPence)} by bank transfer within 28 days.`
      : '';
  return [
    name(c.fullName),
    '\n',
    { type: 'address', value: c.address.line1 },
    '\n',
    { type: 'address', value: c.address.town },
    '\n',
    { type: 'postcode', value: c.address.postcode },
    '\n\nDear ',
    name(c.fullName),
    `,\n\nYour complaint: ${id}\nAccount: `,
    { type: 'account_number', value: c.account.accountNumber },
    `\n\nThis is our final response. ${decision}\n\n${match.finding}${payment}`,
    '\n\nIf you are unhappy with this response, you can refer your complaint to the Financial Ombudsman Service free of charge within six months of the date of this letter.\n\nYours sincerely,\n',
    name(`${faker.person.firstName()} ${faker.helpers.arrayElement(SURNAMES)}`),
    '\nNorthmoor Lending complaints team',
  ];
}
