locals {
  # The tag budget only counts once the project tag is active for cost allocation. The region
  # budget works from the first day, and includes usage that can't be tagged.
  filters = {
    tag    = { name = "TagKeyValue", value = format("user:project$%s", var.project) }
    region = { name = "Region", value = var.region }
  }
  alerts = {
    actual-80      = { type = "ACTUAL", threshold = 80 }
    actual-100     = { type = "ACTUAL", threshold = 100 }
    forecasted-100 = { type = "FORECASTED", threshold = 100 }
  }
}

resource "aws_budgets_budget" "this" {
  for_each     = local.filters
  name         = "${var.name}-${each.key}"
  budget_type  = "COST"
  time_unit    = "MONTHLY"
  limit_amount = tostring(var.amount)
  limit_unit   = var.currency

  cost_filter {
    name   = each.value.name
    values = [each.value.value]
  }

  dynamic "notification" {
    for_each = local.alerts
    content {
      comparison_operator        = "GREATER_THAN"
      notification_type          = notification.value.type
      threshold                  = notification.value.threshold
      threshold_type             = "PERCENTAGE"
      subscriber_email_addresses = [var.email]
    }
  }
}
