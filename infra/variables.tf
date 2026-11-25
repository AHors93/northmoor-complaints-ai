variable "project" {
  type    = string
  default = "northmoor"
}

variable "env" {
  type = string
}

variable "region" {
  type = string
}

variable "account_id" {
  type        = string
  description = "Terraform refuses to run in any other account."
  validation {
    condition     = can(regex("^\\d{12}$", var.account_id))
    error_message = "account_id must be 12 digits."
  }
}

variable "network_mode" {
  type        = string
  description = "dev uses the default VPC. enterprise (private subnets and endpoints) is built in Phase 9."
  validation {
    condition     = contains(["dev", "enterprise"], var.network_mode)
    error_message = "network_mode must be dev or enterprise."
  }
}

variable "budget_amount" {
  type        = number
  description = "Monthly limit, in budget_currency."
}

variable "budget_currency" {
  type        = string
  description = "Must match the account's billing currency."
}

variable "budget_email" {
  type        = string
  description = "Where budget alerts go. Keep it in the gitignored local.auto.tfvars."
  sensitive   = true
}

variable "audit_retention_days" {
  type = number
}
