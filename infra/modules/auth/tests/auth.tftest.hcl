mock_provider "aws" {}

run "users_cannot_change_their_team" {
  command = plan
  variables {
    name                      = "northmoor-test"
    pre_token_lambda_arn      = "arn:aws:lambda:eu-west-2:000000000000:function:test"
    allow_admin_password_auth = false
  }
  assert {
    condition     = aws_cognito_user_pool_client.this.write_attributes == toset(["name"])
    error_message = "Users may write only their name."
  }
  assert {
    condition     = aws_cognito_user_pool.this.admin_create_user_config[0].allow_admin_create_user_only
    error_message = "Self sign-up must be off."
  }
}

run "admin_password_sign_in_is_opt_in" {
  command = plan
  variables {
    name                      = "northmoor-test"
    pre_token_lambda_arn      = "arn:aws:lambda:eu-west-2:000000000000:function:test"
    allow_admin_password_auth = false
  }
  assert {
    condition     = !contains(aws_cognito_user_pool_client.this.explicit_auth_flows, "ALLOW_ADMIN_USER_PASSWORD_AUTH")
    error_message = "Admin password sign-in must be off unless asked for."
  }
}
