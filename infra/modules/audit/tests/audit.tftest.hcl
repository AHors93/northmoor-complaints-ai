mock_provider "aws" {
  mock_data "aws_iam_policy_document" {
    defaults = {
      json = "{\"Version\":\"2012-10-17\",\"Statement\":[]}"
    }
  }
}

variables {
  bucket_name    = "northmoor-test-audit"
  kms_key_arn    = "arn:aws:kms:eu-west-2:000000000000:key/test"
  retention_days = 1
}

run "objects_are_locked" {
  command = plan
  assert {
    condition     = aws_s3_bucket.this.object_lock_enabled
    error_message = "Object Lock must be on."
  }
  assert {
    condition     = aws_s3_bucket_object_lock_configuration.this.rule[0].default_retention[0].mode == "GOVERNANCE"
    error_message = "Objects must be retained by default."
  }
  assert {
    condition     = aws_s3_bucket_public_access_block.this.restrict_public_buckets
    error_message = "The bucket must not be public."
  }
}

run "writers_can_only_write" {
  command = plan
  assert {
    condition     = toset(flatten([for s in data.aws_iam_policy_document.writer.statement : s.actions])) == toset(["s3:PutObject", "kms:GenerateDataKey"])
    error_message = "Audit writers must not read, delete or change retention."
  }
}
