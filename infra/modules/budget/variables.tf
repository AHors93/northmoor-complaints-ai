variable "project" {
  type = string
}

variable "name" {
  type = string
}

variable "region" {
  type = string
}

variable "amount" {
  type = number
}

variable "currency" {
  type = string
}

variable "email" {
  type      = string
  sensitive = true
}
