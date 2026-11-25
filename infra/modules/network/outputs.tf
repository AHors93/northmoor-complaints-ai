output "subnet_ids" {
  value = data.aws_subnets.default.ids
}

output "database_security_group_id" {
  value = aws_security_group.database.id
}
