# One report for the whole account, split by application. The first matching rule wins.
resource "aws_ce_cost_category" "application" {
  # Off until the project tag is active as a cost allocation tag.
  count         = var.create_cost_category ? 1 : 0
  name          = "Application"
  rule_version  = "CostCategoryExpression.v1"
  default_value = "other"

  rule {
    value = var.project
    rule {
      or {
        tags {
          key           = "project"
          values        = [var.project]
          match_options = ["EQUALS"]
        }
      }
      or {
        # Catches usage that can't be tagged. Nothing else in the account uses this region.
        dimension {
          key           = "REGION"
          values        = [var.region]
          match_options = ["EQUALS"]
        }
      }
    }
  }

  dynamic "rule" {
    for_each = var.other_applications
    content {
      value = rule.value
      rule {
        tags {
          key           = "project"
          values        = [rule.value]
          match_options = ["EQUALS"]
        }
      }
    }
  }
}
