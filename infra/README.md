# Infrastructure

Terraform for AWS. `bootstrap/` is applied once by hand; everything else is one stack with a tfvars file
per environment in `envs/`. The account is shared with other projects: see
[ADR 0006](../docs/adr/0006-infrastructure-foundations.md).

```sh
pnpm check:infra   # fmt, validate, mocked tests, tflint, trivy. No AWS credentials needed.
```

## First deploy

Each `apply` creates billable resources.

1. Turn on MFA for the IAM user that will deploy. The roles can't be assumed without it.
2. Create `infra/bootstrap/local.auto.tfvars` (gitignored) with `region`, `account_id` and `operator_arn`,
   then run `terraform init` and `terraform apply` there with that user's own profile.
3. Add a profile to `~/.aws/config`:

   ```ini
   [profile northmoor]
   role_arn = <deploy_role_arn output>
   source_profile = default
   mfa_serial = <your MFA device ARN>
   region = eu-west-2
   ```

4. Create `infra/local.auto.tfvars` (gitignored) with `account_id` and `budget_email`.
5. Terraform can't prompt for an MFA code. In a real terminal (not an editor or agent shell, which can't
   take typed input), run `aws sts get-caller-identity --profile northmoor` and enter the code. The CLI
   caches the role's credentials for an hour. Then export them for Terraform:

   ```sh
   pnpm build:lambdas
   cd infra
   eval "$(aws configure export-credentials --profile northmoor --format env)"
   terraform init -backend-config=bucket=<state_bucket output> -backend-config=region=eu-west-2
   terraform plan -var-file=envs/dev.tfvars -out=dev.tfplan
   terraform apply dev.tfplan
   ```

6. Once resources exist, activate the `project` tag in Billing → Cost allocation tags. It can take a day
   to appear. Then set `create_cost_category = true` in `bootstrap/` and apply it again.

## Destroy

Audit objects can't be deleted before their retention ends (1 day in dev). Wait, or empty the bucket
with the `northmoor-teardown` role, then run `terraform destroy -var-file=envs/dev.tfvars`. KMS keys
stay scheduled for deletion for 7 days; AWS doesn't charge for them while they wait.
