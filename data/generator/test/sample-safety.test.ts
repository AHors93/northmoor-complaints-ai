import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { findReachableContacts } from './contact-safety.ts';

const SAMPLE = join(import.meta.dirname, '../../generated/sample');

describe('committed sample', () => {
  it('contains only reserved email domains and phone ranges', async () => {
    const entries = await readdir(SAMPLE, { recursive: true, withFileTypes: true });
    // The PDFs are rendered from the markdown files next to them.
    const files = entries.filter((e) => e.isFile() && !e.name.endsWith('.pdf'));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const text = await readFile(join(file.parentPath, file.name), 'utf8');
      expect(findReachableContacts(text), file.name).toEqual([]);
    }
  });
});

describe('contact check', () => {
  it.each([
    'jo@gmail.com',
    'JO@GMAIL.COM',
    'jo@example.com.evil.net',
    '07911 123456',
    '+44 7911 123456',
    '0113 496 0000',
  ])('flags %s', (contact) => {
    expect(findReachableContacts(`Reach me on ${contact}.`)).toHaveLength(1);
  });

  it.each(['jo@example.org', 'JO@EXAMPLE.COM', '07700 900123', '+44 20 7946 0958', '01174960123'])(
    'allows %s',
    (contact) => {
      expect(findReachableContacts(`Reach me on ${contact}.`)).toEqual([]);
    },
  );
});
