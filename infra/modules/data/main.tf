resource "aws_db_subnet_group" "this" {
  name       = var.name
  subnet_ids = var.subnet_ids
}

# trivy:ignore:AWS-0077 Synthetic data that the generator can rebuild needs no long backups.
# trivy:ignore:AWS-0343 Synthetic data that the generator can rebuild; dev must be destroyable.
resource "aws_rds_cluster" "this" {
  cluster_identifier          = var.name
  engine                      = "aurora-postgresql"
  engine_mode                 = "provisioned"
  engine_version              = "16.15"
  database_name               = "northmoor"
  master_username             = "northmoor_owner"
  manage_master_user_password = true
  enable_http_endpoint        = true
  storage_encrypted           = true
  kms_key_id                  = var.kms_key_arn
  db_subnet_group_name        = aws_db_subnet_group.this.name
  vpc_security_group_ids      = [var.security_group_id]
  backup_retention_period     = 1
  copy_tags_to_snapshot       = true
  # The data is synthetic and the generator can rebuild it.
  skip_final_snapshot = true

  serverlessv2_scaling_configuration {
    min_capacity             = 0
    max_capacity             = 1
    seconds_until_auto_pause = 300
  }
}

# trivy:ignore:AWS-0077 See the cluster above.
# trivy:ignore:AWS-0133 Performance Insights can stop a cluster from pausing.
resource "aws_rds_cluster_instance" "this" {
  identifier                 = "${var.name}-1"
  cluster_identifier         = aws_rds_cluster.this.id
  instance_class             = "db.serverless"
  engine                     = aws_rds_cluster.this.engine
  engine_version             = aws_rds_cluster.this.engine_version
  publicly_accessible        = false
  auto_minor_version_upgrade = true
}
