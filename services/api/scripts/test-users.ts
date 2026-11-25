/**
 * Dev only. `create` makes the four test users; `check` signs each one in and calls GET /me.
 * Uses the AWS CLI with the caller's credentials. Passwords go to a gitignored file that only the
 * owner can read, and are passed to the CLI on stdin so they don't appear in the process list.
 */
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { parseArgs } from 'node:util';
import { z } from 'zod';

const PASSWORDS = join(import.meta.dirname, '../../../.local/test-users.json');
const USERS = [
  { email: 'leeds-handler@example.com', team: 'leeds', group: 'case_handler' },
  { email: 'leeds-lead@example.com', team: 'leeds', group: 'team_lead' },
  { email: 'bristol-handler@example.com', team: 'bristol', group: 'case_handler' },
  { email: 'bristol-admin@example.com', team: 'bristol', group: 'admin' },
];

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    pool: { type: 'string' },
    client: { type: 'string' },
    api: { type: 'string' },
    region: { type: 'string' },
  },
});

function required(name: 'pool' | 'client' | 'api' | 'region'): string {
  const value = values[name];
  if (value === undefined) throw new Error(`--${name} is required`);
  return value;
}

function cognito(command: string, input: object): unknown {
  const output = execFileSync(
    'aws',
    [
      'cognito-idp',
      command,
      '--region',
      required('region'),
      '--output',
      'json',
      '--cli-input-json',
      'file:///dev/stdin',
    ],
    { input: JSON.stringify(input), encoding: 'utf8', stdio: ['pipe', 'pipe', 'inherit'] },
  );
  return output.trim() === '' ? null : JSON.parse(output);
}

async function create(): Promise<void> {
  const UserPoolId = required('pool');
  const passwords: Record<string, string> = {};
  for (const { email, team, group } of USERS) {
    // The suffix satisfies the pool's character rules; the randomness is in the prefix.
    const Password = `${randomBytes(24).toString('base64url')}aA1!`;
    passwords[email] = Password;
    cognito('admin-create-user', {
      UserPoolId,
      Username: email,
      MessageAction: 'SUPPRESS',
      UserAttributes: [
        { Name: 'email', Value: email },
        { Name: 'email_verified', Value: 'true' },
        { Name: 'custom:team', Value: team },
      ],
    });
    cognito('admin-set-user-password', { UserPoolId, Username: email, Password, Permanent: true });
    cognito('admin-add-user-to-group', { UserPoolId, Username: email, GroupName: group });
  }
  await mkdir(dirname(PASSWORDS), { recursive: true });
  await writeFile(PASSWORDS, JSON.stringify(passwords), { mode: 0o600 });
  process.stdout.write(`Created ${USERS.length} users\n`);
}

const signInSchema = z.object({
  AuthenticationResult: z.object({ AccessToken: z.string(), IdToken: z.string() }),
});

async function check(): Promise<void> {
  const passwords = z
    .record(z.string(), z.string())
    .parse(JSON.parse(await readFile(PASSWORDS, 'utf8')));
  const me = async (token?: string) => {
    const response = await fetch(`${required('api')}/me`, {
      headers: token === undefined ? {} : { authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10_000),
    });
    return { status: response.status, body: await response.text() };
  };
  const bodies = new Set<string>();
  let idToken = '';
  for (const { email, team, group } of USERS) {
    const result = signInSchema.parse(
      cognito('admin-initiate-auth', {
        UserPoolId: required('pool'),
        ClientId: required('client'),
        AuthFlow: 'ADMIN_USER_PASSWORD_AUTH',
        AuthParameters: { USERNAME: email, PASSWORD: passwords[email] ?? '' },
      }),
    ).AuthenticationResult;
    idToken = result.IdToken;
    const { status, body } = await me(result.AccessToken);
    if (status !== 200) throw new Error(`GET /me returned ${status} for ${email}`);
    const identity = z.object({ role: z.string(), team: z.string() }).parse(JSON.parse(body));
    if (identity.role !== group || identity.team !== team) {
      throw new Error(`GET /me returned the wrong identity for ${email}`);
    }
    bodies.add(body);
    process.stdout.write(`${email}: ${body}\n`);
  }
  if (bodies.size !== USERS.length) throw new Error('Two users got the same response');
  for (const [label, token] of [
    ['no token', undefined],
    ['an ID token', idToken],
  ] as const) {
    const { status } = await me(token);
    if (status !== 401 && status !== 403) throw new Error(`${label} got ${status}`);
    process.stdout.write(`${label}: rejected with ${status}\n`);
  }
}

const command = positionals[0];
if (command === 'create') await create();
else if (command === 'check') await check();
else throw new Error('Use: test-users.ts create|check');
