resource "aws_cloudwatch_log_group" "api" {
  name              = "/${var.name}/api"
  retention_in_days = 14
  kms_key_id        = var.kms_key_arn
}
