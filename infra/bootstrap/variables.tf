variable "project" {
  type    = string
  default = "northmoor"
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

variable "operator_arn" {
  type        = string
  description = "The IAM user allowed to assume the deploy and teardown roles, with MFA."
}

variable "create_cost_category" {
  type    = bool
  default = false
}

variable "other_applications" {
  type        = list(string)
  description = "Other values of the project tag to report separately."
  default     = ["gherkin"]
}
