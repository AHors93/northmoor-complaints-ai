resource "aws_kms_key" "tool_tokens" {
  description              = "${var.name} tool token signing"
  key_usage                = "SIGN_VERIFY"
  customer_master_key_spec = "ECC_NIST_P256"
  deletion_window_in_days  = 7
}

resource "aws_kms_alias" "tool_tokens" {
  name          = "alias/${var.name}-tool-tokens"
  target_key_id = aws_kms_key.tool_tokens.key_id
}
