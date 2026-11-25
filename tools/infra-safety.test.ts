import { globSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { findInfraViolations } from './infra-safety.js';

const infra = resolve(import.meta.dirname, '../infra');
const check = (source: string) => findInfraViolations({ 'x.tf': source });

describe('infra safety', () => {
  it('finds no violations in the real Terraform', () => {
    const paths = globSync('**/*.{tf,tfvars}', { cwd: infra }).filter(
      (p) => !p.includes('.terraform/'),
    );
    expect(paths).toContain('versions.tf');
    const files = Object.fromEntries(
      paths.map((p) => [p, readFileSync(resolve(infra, p), 'utf8')]),
    );
    expect(findInfraViolations(files)).toEqual([]);
  });

  it.each([
    ['a NAT gateway', 'resource "aws_nat_gateway" "x" {}'],
    [
      'a conditional NAT gateway',
      'resource "aws_nat_gateway" "x" {\n  count = var.network_mode == "enterprise" ? 1 : 0\n}',
    ],
    ['a registry module', 'module "vpc" {\n  source = "terraform-aws-modules/vpc/aws"\n}'],
    [
      'an ungated interface endpoint',
      'resource "aws_vpc_endpoint" "x" {\n  vpc_endpoint_type = "Interface"\n}',
    ],
    [
      'an interface endpoint gated the wrong way',
      'resource "aws_vpc_endpoint" "x" {\n  count = var.network_mode == "dev" ? 1 : 0\n  vpc_endpoint_type = "Interface"\n}',
    ],
    ['an endpoint with no type', 'resource "aws_vpc_endpoint" "x" {\n}'],
    [
      'Aurora with a non-zero minimum',
      'resource "aws_rds_cluster" "x" {\n  serverlessv2_scaling_configuration {\n    min_capacity = 0.5\n  }\n}',
    ],
    ['Aurora with no minimum', 'resource "aws_rds_cluster" "x" {\n}'],
    [
      'a provider missing the env tag',
      'provider "aws" {\n  allowed_account_ids = [var.a]\n  default_tags {\n    tags = {\n      project = "x"\n    }\n  }\n}',
    ],
    [
      'a provider without an account guard',
      'provider "aws" {\n  default_tags {\n    tags = {\n      project = "x"\n      env = "dev"\n    }\n  }\n}',
    ],
    ['a hard-coded account id', 'locals {\n  a = "arn:aws:iam::123456789012:root"\n}'],
  ])('rejects %s', (_, source) => {
    expect(check(source)).toHaveLength(1);
  });

  it.each([
    ['a comment about NAT', '# never an aws_nat_gateway\n/* aws_nat_gateway */'],
    ['a local module', 'module "x" {\n  source = "./modules/x"\n}'],
    [
      'an enterprise-only interface endpoint',
      'resource "aws_vpc_endpoint" "x" {\n  count = var.network_mode == "enterprise" ? 1 : 0\n  vpc_endpoint_type = "Interface"\n}',
    ],
    ['a gateway endpoint', 'resource "aws_vpc_endpoint" "x" {\n  vpc_endpoint_type = "Gateway"\n}'],
  ])('allows %s', (_, source) => {
    expect(check(source)).toEqual([]);
  });
});
