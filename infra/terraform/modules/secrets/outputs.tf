output "mongodb_uri_arn" { value = aws_secretsmanager_secret.mongodb_uri.arn }
output "nextauth_arn" { value = aws_secretsmanager_secret.nextauth.arn }
output "resend_arn" { value = aws_secretsmanager_secret.resend.arn }
output "stripe_arn" { value = aws_secretsmanager_secret.stripe.arn }
output "aws_config_arn" { value = aws_secretsmanager_secret.aws_config.arn }

output "all_secret_arns" {
  value = [
    aws_secretsmanager_secret.mongodb_uri.arn,
    aws_secretsmanager_secret.nextauth.arn,
    aws_secretsmanager_secret.resend.arn,
    aws_secretsmanager_secret.stripe.arn,
    aws_secretsmanager_secret.aws_config.arn,
  ]
}
