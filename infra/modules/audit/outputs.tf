output "bucket_name" {
  value = aws_s3_bucket.this.id
}

output "writer_policy_json" {
  value = data.aws_iam_policy_document.writer.json
}
