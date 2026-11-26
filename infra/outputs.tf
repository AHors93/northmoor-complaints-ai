output "audit_bucket" {
  value = module.audit.bucket_name
}

output "database_cluster_arn" {
  value = module.data.cluster_arn
}

output "database_secret_arn" {
  value = module.data.secret_arn
}

output "user_pool_id" {
  value = module.auth.user_pool_id
}

output "tool_token_key_arn" {
  value = module.compute.tool_token_key_arn
}

output "client_id" {
  value = module.auth.client_id
}

output "api_url" {
  value = module.compute.api_url
}
