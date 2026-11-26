import { existsSync, readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { withPrivateFile } from '../scripts/private-file.ts';

describe('private file for CLI input', () => {
  it('gives a readable file that only the owner can access', () => {
    withPrivateFile('{"Password":"secret"}', (path) => {
      expect(readFileSync(path, 'utf8')).toBe('{"Password":"secret"}');
      expect(statSync(path).mode & 0o777).toBe(0o600);
    });
  });

  it('is a regular file, not a pipe the macOS AWS CLI cannot open', () => {
    withPrivateFile('{}', (path) => {
      expect(statSync(path).isFile()).toBe(true);
    });
  });

  it('deletes the file afterwards', () => {
    const path = withPrivateFile('{}', (p) => p);
    expect(existsSync(path)).toBe(false);
  });

  it('deletes the file even when the command fails', () => {
    let seen = '';
    expect(() =>
      withPrivateFile('{}', (p) => {
        seen = p;
        throw new Error('CLI failed');
      }),
    ).toThrow('CLI failed');
    expect(existsSync(seen)).toBe(false);
  });
});
