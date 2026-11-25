output "cluster_arn" {
  value = aws_rds_cluster.this.arn
}

output "secret_arn" {
  value = aws_rds_cluster.this.master_user_secret[0].secret_arn
}
