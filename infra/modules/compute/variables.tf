variable "name" {
  type = string
}

variable "region" {
  type = string
}

variable "account_id" {
  type = string
}

variable "user_pool_id" {
  type = string
}

variable "user_pool_arn" {
  type = string
}

variable "client_id" {
  type = string
}

variable "lambda_dir" {
  type = string
}

variable "role_path" {
  type = string
}

variable "permissions_boundary_arn" {
  type = string
}

variable "log_groups" {
  type = map(object({ name = string, arn = string }))
}
