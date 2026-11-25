resource "aws_cognito_user_pool" "this" {
  name                = var.name
  user_pool_tier      = "ESSENTIALS"
  username_attributes = ["email"]
  mfa_configuration   = "OPTIONAL"

  software_token_mfa_configuration {
    enabled = true
  }

  admin_create_user_config {
    allow_admin_create_user_only = true
  }

  password_policy {
    minimum_length                   = 14
    require_lowercase                = true
    require_numbers                  = true
    require_symbols                  = true
    require_uppercase                = true
    temporary_password_validity_days = 1
  }

  # Row-level security depends on this. The app client has no permission to write it.
  schema {
    name                = "team"
    attribute_data_type = "String"
    mutable             = true
    string_attribute_constraints {
      min_length = 1
      max_length = 32
    }
  }
}

resource "aws_cognito_user_group" "this" {
  for_each     = toset(["case_handler", "team_lead", "admin"])
  name         = each.key
  user_pool_id = aws_cognito_user_pool.this.id
}

resource "aws_cognito_user_pool_client" "this" {
  name         = var.name
  user_pool_id = aws_cognito_user_pool.this.id

  explicit_auth_flows           = ["ALLOW_USER_SRP_AUTH", "ALLOW_REFRESH_TOKEN_AUTH"]
  prevent_user_existence_errors = "ENABLED"
  enable_token_revocation       = true
  read_attributes               = ["email", "name", "custom:team"]
  # An empty list would let users write every attribute, including their own team.
  write_attributes = ["name"]

  access_token_validity  = 15
  id_token_validity      = 15
  refresh_token_validity = 1
  token_validity_units {
    access_token  = "minutes"
    id_token      = "minutes"
    refresh_token = "days"
  }
}
