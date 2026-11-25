# Mocked: no credentials and no AWS calls.
mock_provider "aws" {
  mock_data "aws_caller_identity" {
    defaults = {
      arn        = "arn:aws:sts::000000000000:assumed-role/northmoor-deploy/test"
      account_id = "000000000000"
    }
  }
  mock_data "aws_iam_policy_document" {
    defaults = {
      json = "{\"Version\":\"2012-10-17\",\"Statement\":[]}"
    }
  }
  mock_data "aws_subnets" {
    defaults = {
      ids = ["subnet-a", "subnet-b"]
    }
  }
}

variables {
  env                  = "dev"
  region               = "eu-west-2"
  account_id           = "000000000000"
  network_mode         = "dev"
  budget_amount        = 25
  budget_currency      = "USD"
  budget_email         = "alerts@example.com"
  audit_retention_days = 1
}

run "dev_plans" {
  command = plan
}

run "rejects_unknown_network_mode" {
  command = plan
  variables {
    network_mode = "production"
  }
  expect_failures = [var.network_mode]
}

run "rejects_malformed_account" {
  command = plan
  variables {
    account_id = "123"
  }
  expect_failures = [var.account_id]
}

run "rejects_other_credentials" {
  command = plan
  override_data {
    target = data.aws_caller_identity.current
    values = {
      arn = "arn:aws:iam::000000000000:user/someone"
    }
  }
  expect_failures = [data.aws_caller_identity.current]
}
