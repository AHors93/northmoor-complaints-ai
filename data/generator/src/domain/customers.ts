import type { Faker } from '@faker-js/faker';
import type { Customer } from '@northmoor/shared';
import { AS_AT, addDays } from './dates.ts';
import { buildLedger, type ArrearsStatus, type LedgerEntry } from './ledger.ts';
import { createRandom } from './random.ts';
import { SURNAMES } from './surnames.ts';

export interface CustomerRecord {
  customer: Customer;
  arrearsStatus: ArrearsStatus;
  /** Start of the current unbroken spell of arrears, or null if up to date. */
  inArrearsSince: string | null;
  openedOn: string;
  ledger: LedgerEntry[];
}

const PLACES = [
  ['Leeds', 'LS', 20],
  ['Manchester', 'M', 20],
  ['Bristol', 'BS', 16],
  ['Birmingham', 'B', 21],
  ['Sheffield', 'S', 14],
  ['Nottingham', 'NG', 17],
  ['Cardiff', 'CF', 15],
  ['Newcastle upon Tyne', 'NE', 13],
  ['Norwich', 'NR', 13],
  ['Glasgow', 'G', 15],
] as const;

/** Letters that can appear in the second half of a UK postcode. */
const INWARD_LETTERS = 'ABDEFGHJLNPQRSTUWXYZ'.split('');

/** Ofcom ranges reserved for drama use, so no generated number can reach a real person. */
const PHONE_PREFIXES = ['07700 900', '020 7946 0', '0117 496 0', '0121 496 0', '0161 496 0'];

export function generateCustomers(seed: number, count: number): CustomerRecord[] {
  const faker = createRandom(seed, 'customers');
  const ledgerFaker = createRandom(seed, 'ledger');
  const phones = faker.helpers.shuffle(
    PHONE_PREFIXES.flatMap((prefix) =>
      Array.from({ length: 1000 }, (_, n) => prefix + String(n).padStart(3, '0')),
    ),
  );
  if (count > phones.length) throw new RangeError(`At most ${phones.length} customers`);
  const accountNumbers = faker.helpers.uniqueArray(
    () => String(faker.number.int({ min: 10_000_000, max: 99_999_999 })),
    count,
  );
  return accountNumbers.map((accountNumber, i) => {
    const product = faker.helpers.arrayElement(['personal_loan', 'car_finance'] as const);
    const account = buildLedger(ledgerFaker, product);
    const firstName = faker.person.firstName();
    const lastName = faker.helpers.arrayElement(SURNAMES);
    const [town, area, districts] = faker.helpers.arrayElement(PLACES);
    const phone = phones[i];
    if (phone === undefined) throw new RangeError('Ran out of phone numbers');
    return {
      customer: {
        id: `CUST-${String(i + 1).padStart(5, '0')}`,
        fullName: `${firstName} ${lastName}`,
        dateOfBirth: addDays(AS_AT, -faker.number.int({ min: 21 * 366, max: 78 * 365 })),
        address: {
          line1: `${faker.number.int({ min: 1, max: 180 })} ${faker.helpers.arrayElement(SURNAMES)} ${faker.helpers.arrayElement(['Road', 'Street', 'Avenue', 'Close', 'Lane'])}`,
          town,
          postcode: `${area}${faker.number.int({ min: 1, max: districts })} ${postcodeInward(faker)}`,
        },
        // Reserved example domains: these can never be delivered.
        email: faker.internet
          .exampleEmail({
            firstName: firstName.replaceAll(/[^a-z]/gi, ''),
            lastName: lastName.replaceAll(/[^a-z]/gi, ''),
          })
          .toLowerCase(),
        phone,
        account: {
          accountNumber,
          sortCode: [0, 1, 2].map(() => faker.number.int({ min: 10, max: 89 })).join('-'),
          product,
          balancePence: account.balancePence,
          arrearsPence: account.arrearsPence,
        },
      },
      arrearsStatus: account.arrearsStatus,
      inArrearsSince: account.inArrearsSince,
      openedOn: account.openedOn,
      ledger: account.entries,
    };
  });
}

function postcodeInward(faker: Faker): string {
  return `${faker.number.int({ min: 0, max: 9 })}${faker.helpers.arrayElement(INWARD_LETTERS)}${faker.helpers.arrayElement(INWARD_LETTERS)}`;
}
