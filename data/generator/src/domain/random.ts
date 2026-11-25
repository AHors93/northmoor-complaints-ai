import { Faker, en, en_GB } from '@faker-js/faker';

const STREAMS = { customers: 1, ledger: 2, complaints: 3, export: 4 } as const;

/** Each stage has its own random stream, so changing one stage doesn't reshuffle the others. */
export function createRandom(seed: number, stream: keyof typeof STREAMS): Faker {
  const faker = new Faker({ locale: [en_GB, en] });
  faker.seed([seed, STREAMS[stream]]);
  return faker;
}

export function pickWeighted<T>(faker: Faker, options: readonly { weight: number; value: T }[]): T {
  return faker.helpers.weightedArrayElement(options);
}
