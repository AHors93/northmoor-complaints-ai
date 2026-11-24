#!/bin/sh
# Runs gitleaks from PATH, or from its Docker image if it isn't installed. Fails if neither works.
set -eu
[ $# -gt 0 ] || set -- --log-opts=--all
if command -v gitleaks >/dev/null 2>&1; then
  exec gitleaks git --redact --no-banner "$@" .
fi
exec docker run --rm -v "$PWD:/repo:ro" -w /repo ghcr.io/gitleaks/gitleaks:v8.30.1 \
  git --redact --no-banner "$@" .
