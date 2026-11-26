resource "aws_cloudwatch_log_group" "this" {
  for_each          = toset(["api-access", "api-me", "api-pre-token"])
  name              = "/${var.name}/${each.key}"
  retention_in_days = 14
  kms_key_id        = var.kms_key_arn
}
