locals {
  name = "${var.project}-${var.env}"
}

data "aws_caller_identity" "current" {
  lifecycle {
    postcondition {
      condition     = strcontains(self.arn, ":assumed-role/${var.project}-deploy/")
      error_message = "Use the ${var.project} profile, which assumes the deploy role."
    }
  }
}

# One customer key for data at rest, shared because each key costs $1 a month.
resource "aws_kms_key" "data" {
  description             = "${local.name} data at rest"
  enable_key_rotation     = true
  deletion_window_in_days = 7
  policy                  = data.aws_iam_policy_document.data_key.json
}

resource "aws_kms_alias" "data" {
  name          = "alias/${local.name}-data"
  target_key_id = aws_kms_key.data.key_id
}

# trivy:ignore:AWS-0057 In a key policy, "*" means this key only.
data "aws_iam_policy_document" "data_key" {
  statement {
    sid       = "AccountAdmin"
    actions   = ["kms:*"]
    resources = ["*"]
    principals {
      type        = "AWS"
      identifiers = ["arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"]
    }
  }
  statement {
    sid       = "CloudWatchLogs"
    actions   = ["kms:Decrypt*", "kms:DescribeKey", "kms:Encrypt*", "kms:GenerateDataKey*", "kms:ReEncrypt*"]
    resources = ["*"]
    principals {
      type        = "Service"
      identifiers = ["logs.${var.region}.amazonaws.com"]
    }
    condition {
      test     = "ArnLike"
      variable = "kms:EncryptionContext:aws:logs:arn"
      values   = ["arn:aws:logs:${var.region}:${var.account_id}:log-group:/${local.name}/*"]
    }
  }
}

module "network" {
  source       = "./modules/network"
  name         = local.name
  network_mode = var.network_mode
}

module "data" {
  source            = "./modules/data"
  name              = local.name
  kms_key_arn       = aws_kms_key.data.arn
  subnet_ids        = module.network.subnet_ids
  security_group_id = module.network.database_security_group_id
}

module "auth" {
  source = "./modules/auth"
  name   = local.name
}

module "compute" {
  source = "./modules/compute"
  name   = local.name
}

module "audit" {
  source         = "./modules/audit"
  bucket_name    = "${local.name}-audit-${var.account_id}"
  kms_key_arn    = aws_kms_key.data.arn
  retention_days = var.audit_retention_days
}

module "observability" {
  source      = "./modules/observability"
  name        = local.name
  kms_key_arn = aws_kms_key.data.arn
}

module "budget" {
  source   = "./modules/budget"
  project  = var.project
  name     = local.name
  region   = var.region
  amount   = var.budget_amount
  currency = var.budget_currency
  email    = var.budget_email
}
