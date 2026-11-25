/**
 * Files that must never be committed. .gitignore covers the same paths, but `git add -f` skips it.
 * @type {readonly { reason: string, matches: (path: string) => boolean }[]}
 */
const FORBIDDEN = [
  {
    reason: 'generated data outside the sample',
    matches: (p) => p.startsWith('data/generated/') && !p.startsWith('data/generated/sample/'),
  },
  {
    reason: 'raw input data',
    matches: (p) => p.startsWith('data/raw/') && p !== 'data/raw/README.md',
  },
  {
    reason: 'environment file',
    matches: (p) => /(^|\/)\.env(\.[^/]+)?$/i.test(p) && !/(^|\/)\.env\.example$/.test(p),
  },
  { reason: 'Terraform state or plan', matches: (p) => /\.(tfstate(\.[^/]+)?|tfplan)$/.test(p) },
];

/**
 * @param {readonly string[]} paths
 * @returns {string[]}
 */
export function findForbiddenFiles(paths) {
  return paths.flatMap((path) =>
    FORBIDDEN.filter((rule) => rule.matches(path)).map((rule) => `${path}: ${rule.reason}`),
  );
}
