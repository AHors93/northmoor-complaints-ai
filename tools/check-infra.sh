#!/bin/sh
# Every Terraform check. Needs node_modules, terraform, tflint and trivy (or Docker), and no AWS credentials.
set -eu
cd "$(dirname "$0")/.."
# Terraform reads the Lambda bundles.
node --experimental-strip-types --disable-warning=ExperimentalWarning services/api/scripts/build.ts
export TF_PLUGIN_CACHE_DIR="$PWD/.local/terraform-plugins"
mkdir -p "$TF_PLUGIN_CACHE_DIR"
cd infra
terraform fmt -check -recursive
for dir in . bootstrap modules/*; do
  echo "== $dir"
  # Modules use the root's lock file, so they share its verified provider instead of downloading it.
  case $dir in modules/*) cp .terraform.lock.hcl "$dir/" ;; esac
  terraform -chdir="$dir" init -backend=false -input=false -lockfile=readonly >/dev/null
  terraform -chdir="$dir" validate
  if [ -d "$dir/tests" ]; then terraform -chdir="$dir" test; fi
done
tflint --init >/dev/null
tflint --recursive --config "$PWD/.tflint.hcl"
if command -v trivy >/dev/null 2>&1; then
  trivy config --quiet --exit-code 1 --skip-dirs '**/.terraform' .
else
  docker run --rm -v "$PWD:/infra:ro" \
    aquasec/trivy:0.76.2@sha256:8f6bb947dbc528902e11f2f5be52f7b519f6a39d5d148f41166f2040499768fb \
    config --quiet --exit-code 1 --skip-dirs '**/.terraform' /infra
fi
