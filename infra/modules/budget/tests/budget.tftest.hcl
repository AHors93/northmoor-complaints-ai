mock_provider "aws" {}

run "tracks_this_project_only" {
  command = plan
  variables {
    project  = "northmoor"
    name     = "northmoor-test"
    region   = "eu-west-2"
    amount   = 25
    currency = "USD"
    email    = "alerts@example.com"
  }
  assert {
    condition     = one(aws_budgets_budget.this["tag"].cost_filter).values == tolist(["user:project$northmoor"])
    error_message = "The tag budget must filter on this project."
  }
  assert {
    condition     = one(aws_budgets_budget.this["region"].cost_filter).values == tolist(["eu-west-2"])
    error_message = "The region budget must filter on this region."
  }
  assert {
    condition     = length(aws_budgets_budget.this["tag"].notification) == 3
    error_message = "There must be three alerts."
  }
}
