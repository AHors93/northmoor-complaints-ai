/**
 * Static checks for the cost rules in CLAUDE.md. They read the text, so they apply to every
 * environment, including ones that nobody has planned yet.
 */

/**
 * @param {string} source
 * @returns {string}
 */
function stripComments(source) {
  // Strings are matched first so that a # or // inside one is kept.
  return source.replace(/"(?:\\.|[^"\\])*"|\/\*[\s\S]*?\*\/|(?:#|\/\/)[^\n]*/g, (m) =>
    m.startsWith('"') ? m : '',
  );
}

/**
 * Top-level blocks whose header matches, each with its whole body.
 * @param {string} source
 * @param {RegExp} header
 * @returns {{ label: string, body: string }[]}
 */
function blocks(source, header) {
  return [...source.matchAll(header)].map((match) => {
    const open = source.indexOf('{', match.index);
    let depth = 0;
    let end = open;
    for (; end < source.length; end++) {
      if (source[end] === '{') depth++;
      if (source[end] === '}' && --depth === 0) break;
    }
    return { label: match[1] ?? '', body: source.slice(open, end + 1) };
  });
}

/**
 * @param {Readonly<Record<string, string>>} files Terraform source by path.
 * @returns {string[]}
 */
export function findInfraViolations(files) {
  return Object.entries(files).flatMap(([path, raw]) => {
    const source = stripComments(raw);
    /** @type {string[]} */
    const problems = [];
    if (/\baws_nat_gateway\b/.test(source)) problems.push('NAT gateway');
    for (const { body } of blocks(source, /^\s*module\s+"([^"]+)"/gm)) {
      // A third-party module could create anything, so none of these checks would hold.
      if (!/^\s*source\s*=\s*"\.\.?\//m.test(body)) problems.push('non-local module');
    }
    for (const { body } of blocks(source, /^\s*resource\s+"aws_vpc_endpoint"\s+"([^"]+)"/gm)) {
      const gateway = /vpc_endpoint_type\s*=\s*"Gateway"/.test(body);
      const gated = /^\s*(count|for_each)\s*=\s*var\.network_mode\s*==\s*"enterprise"\s*\?/m.test(
        body,
      );
      if (!gateway && !gated) problems.push('interface endpoint outside enterprise mode');
    }
    for (const { body } of blocks(source, /^\s*resource\s+"aws_rds_cluster"\s+"([^"]+)"/gm)) {
      if (!/^\s*min_capacity\s*=\s*0\s*$/m.test(body)) problems.push('Aurora minimum is not 0');
    }
    for (const { body } of blocks(source, /^\s*provider\s+"(aws)"/gm)) {
      const tags = blocks(body, /^\s*(default_tags)\b/gm)[0]?.body ?? '';
      if (!/\bproject\s*=/.test(tags) || !/\benv\s*=/.test(tags)) {
        problems.push('provider without project and env default tags');
      }
      if (!/^\s*allowed_account_ids\s*=/m.test(body))
        problems.push('provider without account guard');
    }
    if (/"[^"]*\b\d{12}\b[^"]*"/.test(source) && !path.endsWith('.tftest.hcl')) {
      problems.push('hard-coded account id');
    }
    return problems.map((problem) => `${path}: ${problem}`);
  });
}
