# @northmoor/api

HTTP API with JWT and scope checks.

- `GET /me` returns the signed-in user's role, team and scopes.
- The pre-token Lambda adds those to Cognito access tokens, and refuses users without exactly one role
  and a team.
- `mintToolToken` creates case-scoped tool tokens. No route exposes it yet: that needs case access
  checks, which arrive with cases in Phase 3.

```sh
pnpm vitest run services/api   # no AWS account needed
pnpm build:lambdas             # bundles to services/api/dist
```

After a deploy, with credentials for the dev account (see `infra/README.md`):

```sh
pnpm test-users create --region <region> --pool <user_pool_id>
pnpm test-users check --region <region> --pool <user_pool_id> --client <client_id> --api <api_url>
```

`create` writes random passwords to the gitignored `.local/test-users.json`.
