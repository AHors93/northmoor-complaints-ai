output "log_groups" {
  value = { for key, group in aws_cloudwatch_log_group.this : key => { name = group.name, arn = group.arn } }
}
