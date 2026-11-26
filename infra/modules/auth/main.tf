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

  # Puts role, team and scopes in the access token.
  lambda_config {
    pre_token_generation_config {
      lambda_arn     = var.pre_token_lambda_arn
      lambda_version = "V2_0"
    }
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

  # The admin flow needs IAM credentials. The test-user check uses it in dev.
  explicit_auth_flows = concat(
    ["ALLOW_USER_SRP_AUTH", "ALLOW_REFRESH_TOKEN_AUTH"],
    var.allow_admin_password_auth ? ["ALLOW_ADMIN_USER_PASSWORD_AUTH"] : [],
  )
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
