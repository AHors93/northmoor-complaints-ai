mock_provider "aws" {}

run "users_cannot_change_their_team" {
  command = plan
  variables {
    name = "northmoor-test"
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
