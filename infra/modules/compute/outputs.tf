output "tool_token_key_arn" {
  value = aws_kms_key.tool_tokens.arn
}

output "api_url" {
  value = aws_apigatewayv2_api.this.api_endpoint
}

output "pre_token_lambda_arn" {
  value = aws_lambda_function.this["pre-token"].arn
}
