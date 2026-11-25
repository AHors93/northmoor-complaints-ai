data "aws_iam_policy_document" "assume_with_mfa" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "AWS"
      identifiers = [var.operator_arn]
    }
    condition {
      test     = "Bool"
      variable = "aws:MultiFactorAuthPresent"
      values   = ["true"]
    }
  }
}

# The most any app role can ever do, whatever policy is attached to it.
data "aws_iam_policy_document" "boundary" {
  statement {
    sid = "AppServices"
    actions = [
      "bedrock:*",
      "comprehend:*",
      "kms:Decrypt",
      "kms:GenerateDataKey",
      "kms:GetPublicKey",
      "kms:Sign",
      "lambda:InvokeFunction",
      "logs:CreateLogStream",
      "logs:PutLogEvents",
      "rds-data:*",
      "secretsmanager:GetSecretValue",
      "states:*",
    ]
    # A boundary only caps permissions. Each role's own policy names exact resources.
    resources = ["*"]
    condition {
      test     = "StringEquals"
      variable = "aws:RequestedRegion"
      values   = [var.region]
    }
  }
  statement {
    sid       = "AppBuckets"
    actions   = ["s3:GetObject", "s3:PutObject", "s3:ListBucket"]
    resources = [local.app_buckets]
  }
  statement {
    sid       = "AppTables"
    actions   = ["dynamodb:*"]
    resources = ["${local.partition}:dynamodb:${var.region}:${var.account_id}:table/${var.project}-*"]
  }
  statement {
    sid       = "NeverTouchState"
    effect    = "Deny"
    actions   = ["s3:*"]
    resources = ["${local.partition}:s3:::${local.state_bucket}", "${local.partition}:s3:::${local.state_bucket}/*"]
  }
}

resource "aws_iam_policy" "boundary" {
  name   = "${var.project}-app-boundary"
  path   = "/${var.project}/bootstrap/"
  policy = data.aws_iam_policy_document.boundary.json
}

# trivy:ignore:AWS-0342 PassRole is limited to app roles, which carry the boundary, and two services.
data "aws_iam_policy_document" "deploy" {
  statement {
    sid = "RegionalServices"
    actions = [
      "apigateway:*",
      "cognito-idp:*",
      "ec2:CreateSecurityGroup",
      "ec2:CreateTags",
      "ec2:DeleteSecurityGroup",
      "ec2:DeleteTags",
      "ec2:Describe*",
      "ec2:RevokeSecurityGroupEgress",
      "kms:*",
      "lambda:*",
      "logs:*",
      "rds:*",
      "rds-data:*",
      "secretsmanager:*",
      "states:*",
    ]
    # The other projects in this account are in other regions, so the region is the limit.
    resources = ["*"]
    condition {
      test     = "StringEquals"
      variable = "aws:RequestedRegion"
      values   = [var.region]
    }
  }
  statement {
    sid = "ProjectBuckets"
    actions = [
      "s3:CreateBucket",
      "s3:DeleteBucket",
      "s3:DeleteBucketPolicy",
      "s3:DeleteObject",
      "s3:DeleteObjectVersion",
      "s3:Get*",
      "s3:List*",
      "s3:PutBucket*",
      "s3:PutEncryptionConfiguration",
      "s3:PutObject",
      "s3:TagResource",
      "s3:UntagResource",
    ]
    resources = [local.app_buckets]
  }
  statement {
    sid       = "ProjectTables"
    actions   = ["dynamodb:*"]
    resources = ["${local.partition}:dynamodb:${var.region}:${var.account_id}:table/${var.project}-*"]
  }
  statement {
    sid       = "ProjectBudgets"
    actions   = ["budgets:*"]
    resources = ["${local.partition}:budgets::${var.account_id}:budget/${var.project}-*"]
  }
  statement {
    sid       = "CreateAppRolesWithBoundary"
    actions   = ["iam:CreateRole", "iam:PutRolePermissionsBoundary"]
    resources = local.app_roles
    condition {
      test     = "StringEquals"
      variable = "iam:PermissionsBoundary"
      values   = [aws_iam_policy.boundary.arn]
    }
  }
  statement {
    sid = "ManageAppRoles"
    actions = [
      "iam:AttachRolePolicy",
      "iam:DeleteRole",
      "iam:DeleteRolePolicy",
      "iam:DetachRolePolicy",
      "iam:GetRole",
      "iam:GetRolePolicy",
      "iam:ListAttachedRolePolicies",
      "iam:ListInstanceProfilesForRole",
      "iam:ListRolePolicies",
      "iam:PutRolePolicy",
      "iam:TagRole",
      "iam:UntagRole",
      "iam:UpdateRole",
    ]
    resources = local.app_roles
  }
  statement {
    sid       = "PassAppRoles"
    actions   = ["iam:PassRole"]
    resources = local.app_roles
    condition {
      test     = "StringEquals"
      variable = "iam:PassedToService"
      values   = ["lambda.amazonaws.com", "states.amazonaws.com"]
    }
  }
  statement {
    sid       = "RdsServiceLinkedRole"
    actions   = ["iam:CreateServiceLinkedRole"]
    resources = ["${local.partition}:iam::${var.account_id}:role/aws-service-role/rds.amazonaws.com/*"]
    condition {
      test     = "StringEquals"
      variable = "iam:AWSServiceName"
      values   = ["rds.amazonaws.com"]
    }
  }
  # Audit records outlive the deploy role's reach: only the teardown role can bypass retention.
  statement {
    sid       = "NeverBypassRetention"
    effect    = "Deny"
    actions   = ["s3:BypassGovernanceRetention"]
    resources = ["*"]
  }
  statement {
    sid     = "ProtectState"
    effect  = "Deny"
    actions = ["s3:DeleteBucket", "s3:DeleteBucketPolicy", "s3:DeleteObjectVersion", "s3:PutBucketPolicy", "s3:PutBucketVersioning"]
    resources = [
      "${local.partition}:s3:::${local.state_bucket}",
      "${local.partition}:s3:::${local.state_bucket}/*",
    ]
  }
}

# trivy:ignore:AWS-0342 See the policy document above.
resource "aws_iam_policy" "deploy" {
  name   = "${var.project}-deploy"
  path   = "/${var.project}/bootstrap/"
  policy = data.aws_iam_policy_document.deploy.json
}

resource "aws_iam_role" "deploy" {
  name                 = "${var.project}-deploy"
  path                 = "/${var.project}/bootstrap/"
  assume_role_policy   = data.aws_iam_policy_document.assume_with_mfa.json
  max_session_duration = 3600
}

resource "aws_iam_role_policy_attachment" "deploy" {
  role       = aws_iam_role.deploy.name
  policy_arn = aws_iam_policy.deploy.arn
}

# Empties a dev audit bucket before its retention ends, and can do nothing else.
data "aws_iam_policy_document" "teardown" {
  statement {
    actions   = ["s3:ListBucketVersions"]
    resources = ["${local.partition}:s3:::${var.project}-dev-audit-*"]
  }
  statement {
    actions   = ["s3:BypassGovernanceRetention", "s3:DeleteObject", "s3:DeleteObjectVersion"]
    resources = ["${local.partition}:s3:::${var.project}-dev-audit-*/*"]
  }
}

resource "aws_iam_role" "teardown" {
  name                 = "${var.project}-teardown"
  path                 = "/${var.project}/bootstrap/"
  assume_role_policy   = data.aws_iam_policy_document.assume_with_mfa.json
  max_session_duration = 3600
}

resource "aws_iam_role_policy" "teardown" {
  name   = "empty-dev-audit-bucket"
  role   = aws_iam_role.teardown.id
  policy = data.aws_iam_policy_document.teardown.json
}
