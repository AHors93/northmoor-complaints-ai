import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Writes `content` to a file only the owner can read, passes its path to `use`, and deletes it
 * afterwards, even if `use` throws. For handing secrets to a CLI without putting them in its
 * arguments, which other processes can see. The macOS AWS CLI can't read input from a pipe.
 */
export function withPrivateFile<T>(content: string, use: (path: string) => T): T {
  const dir = mkdtempSync(join(tmpdir(), 'northmoor-private-'));
  try {
    const path = join(dir, 'input');
    writeFileSync(path, content, { mode: 0o600 });
    return use(path);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
