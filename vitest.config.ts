import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      '{packages,services}/*/test/**/*.test.ts',
      '{data/generator,evals,tools}/**/*.test.ts',
    ],
    testTimeout: 20_000,
  },
});
