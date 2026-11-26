mock_provider "aws" {
  mock_data "aws_iam_policy_document" {
    defaults = {
      json = "{\"Version\":\"2012-10-17\",\"Statement\":[]}"
    }
  }
}

variables {
  name                     = "northmoor-test"
  region                   = "eu-west-2"
  account_id               = "000000000000"
  user_pool_id             = "eu-west-2_test"
  user_pool_arn            = "arn:aws:cognito-idp:eu-west-2:000000000000:userpool/eu-west-2_test"
  client_id                = "client"
  lambda_dir               = "../../../services/api/dist"
  role_path                = "/northmoor/app/"
  permissions_boundary_arn = "arn:aws:iam::000000000000:policy/northmoor/bootstrap/northmoor-app-boundary"
  log_groups = {
    api-access    = { name = "/t/api-access", arn = "arn:aws:logs:eu-west-2:000000000000:log-group:/t/api-access" }
    api-me        = { name = "/t/api-me", arn = "arn:aws:logs:eu-west-2:000000000000:log-group:/t/api-me" }
    api-pre-token = { name = "/t/api-pre-token", arn = "arn:aws:logs:eu-west-2:000000000000:log-group:/t/api-pre-token" }
  }
}

run "me_needs_a_scoped_jwt" {
  command = plan
  assert {
    condition     = aws_apigatewayv2_route.me.authorization_type == "JWT" && contains(aws_apigatewayv2_route.me.authorization_scopes, "profile:read")
    error_message = "GET /me must need a JWT with profile:read."
  }
  assert {
    condition     = aws_apigatewayv2_authorizer.jwt.jwt_configuration[0].audience == toset(["client"])
    error_message = "Only this app's client may call the API."
  }
}

run "lambda_roles_are_bounded" {
  command = plan
  assert {
    condition     = alltrue([for r in aws_iam_role.lambda : r.permissions_boundary == var.permissions_boundary_arn && r.path == var.role_path])
    error_message = "Every Lambda role needs the boundary and the app path."
  }
  assert {
    condition     = alltrue([for k, d in data.aws_iam_policy_document.lambda_logs : one(d.statement).resources == toset(["${var.log_groups["api-${k}"].arn}:*"])])
    error_message = "Each Lambda may write only to its own log group."
  }
}
