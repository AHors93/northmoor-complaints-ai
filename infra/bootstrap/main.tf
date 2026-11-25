# Applied once, by hand, with the default profile, because the deploy role doesn't exist yet.
# Its state is local and gitignored: it only describes the few resources in this folder.
terraform {
  required_version = "~> 1.17.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "6.72.0"
    }
  }
}

provider "aws" {
  region              = var.region
  allowed_account_ids = [var.account_id]
  default_tags {
    tags = {
      project = var.project
      env     = "bootstrap"
    }
  }
}

locals {
  partition    = "arn:aws"
  state_bucket = "${var.project}-tfstate-${var.account_id}"
  # Roles that Terraform creates for the app live under this path, and must carry the boundary.
  app_path = "/${var.project}/app/"
  app_roles = [
    "${local.partition}:iam::${var.account_id}:role${local.app_path}*",
  ]
  app_buckets = "${local.partition}:s3:::${var.project}-*"
}

# trivy:ignore:AWS-0089 Access logging would need a second bucket, for a state file only one person uses.
resource "aws_s3_bucket" "state" {
  bucket = local.state_bucket
  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_s3_bucket_versioning" "state" {
  bucket = aws_s3_bucket.state.id
  versioning_configuration {
    status = "Enabled"
  }
}

# trivy:ignore:AWS-0132 The AWS managed key is enough here, and a customer key costs $1 a month.
resource "aws_s3_bucket_server_side_encryption_configuration" "state" {
  bucket = aws_s3_bucket.state.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "aws:kms"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "state" {
  bucket                  = aws_s3_bucket.state.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

data "aws_iam_policy_document" "state" {
  statement {
    sid       = "TlsOnly"
    effect    = "Deny"
    actions   = ["s3:*"]
    resources = [aws_s3_bucket.state.arn, "${aws_s3_bucket.state.arn}/*"]
    principals {
      type        = "*"
      identifiers = ["*"]
    }
    condition {
      test     = "Bool"
      variable = "aws:SecureTransport"
      values   = ["false"]
    }
  }
}

resource "aws_s3_bucket_policy" "state" {
  bucket     = aws_s3_bucket.state.id
  policy     = data.aws_iam_policy_document.state.json
  depends_on = [aws_s3_bucket_public_access_block.state]
}
