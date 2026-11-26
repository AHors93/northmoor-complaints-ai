locals {
  functions = toset(["me", "pre-token"])
}

data "aws_iam_policy_document" "assume_lambda" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "lambda" {
  for_each             = local.functions
  name                 = "${var.name}-${each.key}"
  path                 = var.role_path
  permissions_boundary = var.permissions_boundary_arn
  assume_role_policy   = data.aws_iam_policy_document.assume_lambda.json
}

data "aws_iam_policy_document" "lambda_logs" {
  for_each = local.functions
  statement {
    actions   = ["logs:CreateLogStream", "logs:PutLogEvents"]
    resources = ["${var.log_groups["api-${each.key}"].arn}:*"]
  }
}

resource "aws_iam_role_policy" "lambda_logs" {
  for_each = local.functions
  name     = "logs"
  role     = aws_iam_role.lambda[each.key].id
  policy   = data.aws_iam_policy_document.lambda_logs[each.key].json
}

# trivy:ignore:AWS-0066 Tracing arrives with OpenTelemetry in Phase 8.
resource "aws_lambda_function" "this" {
  for_each         = local.functions
  function_name    = "${var.name}-${each.key}"
  role             = aws_iam_role.lambda[each.key].arn
  runtime          = "nodejs22.x"
  architectures    = ["arm64"]
  handler          = "index.handler"
  filename         = "${var.lambda_dir}/${each.key}.zip"
  source_code_hash = filebase64sha256("${var.lambda_dir}/${each.key}.zip")
  memory_size      = 256
  timeout          = 5

  logging_config {
    log_format = "Text"
    log_group  = var.log_groups["api-${each.key}"].name
  }

  environment {
    variables = {
      NODE_ENV = "production"
    }
  }

  depends_on = [aws_iam_role_policy.lambda_logs]
}

resource "aws_lambda_permission" "cognito" {
  action         = "lambda:InvokeFunction"
  function_name  = aws_lambda_function.this["pre-token"].function_name
  principal      = "cognito-idp.amazonaws.com"
  source_arn     = var.user_pool_arn
  source_account = var.account_id
}
