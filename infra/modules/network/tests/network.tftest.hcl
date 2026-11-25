mock_provider "aws" {}

run "enterprise_refuses_until_phase_9" {
  command = plan
  variables {
    name         = "northmoor-test"
    network_mode = "enterprise"
  }
  expect_failures = [data.aws_vpc.default]
}
