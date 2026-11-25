mock_provider "aws" {}

variables {
  name              = "northmoor-test"
  kms_key_arn       = "arn:aws:kms:eu-west-2:000000000000:key/test"
  subnet_ids        = ["subnet-a", "subnet-b"]
  security_group_id = "sg-test"
}

run "pauses_and_stays_private" {
  command = plan
  assert {
    condition     = aws_rds_cluster.this.serverlessv2_scaling_configuration[0].min_capacity == 0
    error_message = "Aurora must be able to pause."
  }
  assert {
    condition     = aws_rds_cluster.this.storage_encrypted && aws_rds_cluster.this.enable_http_endpoint
    error_message = "Aurora must be encrypted and reachable through the Data API."
  }
  assert {
    condition     = aws_rds_cluster_instance.this.publicly_accessible == false
    error_message = "Aurora must not be public."
  }
}
