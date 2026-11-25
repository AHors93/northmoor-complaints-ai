output "state_bucket" {
  value = aws_s3_bucket.state.id
}

output "deploy_role_arn" {
  value = aws_iam_role.deploy.arn
}

output "teardown_role_arn" {
  value = aws_iam_role.teardown.arn
}

output "boundary_arn" {
  value = aws_iam_policy.boundary.arn
}
