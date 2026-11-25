data "aws_vpc" "default" {
  default = true
  lifecycle {
    precondition {
      condition     = var.network_mode == "dev"
      error_message = "Enterprise mode is built in Phase 9."
    }
  }
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
  filter {
    name   = "default-for-az"
    values = ["true"]
  }
}

# No rules at all: in dev the database is reached only through the RDS Data API.
resource "aws_security_group" "database" {
  name        = "${var.name}-database"
  description = "Aurora: no network access"
  vpc_id      = data.aws_vpc.default.id
}
