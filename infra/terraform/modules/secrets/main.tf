# ─── AWS Secrets Manager ─────────────────────────────────────────────────────
#
# Design decisions:
#   - Every application secret lives here — never in environment files or repo.
#   - KMS-encrypted with the customer-managed key from the kms module.
#   - Secrets are injected into ECS containers at STARTUP as environment variables
#     via the ECS task definition `secrets` block (not `environment`).
#     This means the plaintext value is never stored in the task definition JSON,
#     CloudFormation templates, or any Terraform state secret exposure.
#   - The ECS execution role (not task role) decrypts secrets. By the time your
#     application code runs, the values are plain env vars — no SDK calls needed.
#   - Rotation: Secrets Manager supports automatic rotation for RDS.
#     For MongoDB Atlas, you'd wire up a Lambda rotation function.
#     For API keys (Resend, Stripe), rotation is manual — set a reminder.

resource "aws_secretsmanager_secret" "mongodb_uri" {
  name                    = "${var.name}/mongodb-uri"
  description             = "MongoDB Atlas connection string"
  kms_key_id              = var.kms_key_arn
  recovery_window_in_days = 7 # 7-day recovery window before permanent deletion

  tags = { Name = "${var.name}-mongodb-uri", Sensitive = "true" }
}

resource "aws_secretsmanager_secret_version" "mongodb_uri" {
  secret_id = aws_secretsmanager_secret.mongodb_uri.id
  # Placeholder — set the real value with:
  # aws secretsmanager put-secret-value --secret-id <arn> --secret-string "mongodb+srv://..."
  secret_string = jsonencode({ MONGODB_URI = var.mongodb_uri })

  # Ignore changes to the secret value — it will be updated out-of-band
  lifecycle {
    ignore_changes = [secret_string]
  }
}

resource "aws_secretsmanager_secret" "nextauth" {
  name                    = "${var.name}/nextauth"
  description             = "NextAuth.js secret and URL"
  kms_key_id              = var.kms_key_arn
  recovery_window_in_days = 7

  tags = { Name = "${var.name}-nextauth", Sensitive = "true" }
}

resource "aws_secretsmanager_secret_version" "nextauth" {
  secret_id = aws_secretsmanager_secret.nextauth.id
  secret_string = jsonencode({
    NEXTAUTH_SECRET = var.nextauth_secret
    NEXTAUTH_URL    = var.nextauth_url
  })

  lifecycle {
    ignore_changes = [secret_string]
  }
}

resource "aws_secretsmanager_secret" "resend" {
  name                    = "${var.name}/resend"
  description             = "Resend email API key"
  kms_key_id              = var.kms_key_arn
  recovery_window_in_days = 7

  tags = { Name = "${var.name}-resend", Sensitive = "true" }
}

resource "aws_secretsmanager_secret_version" "resend" {
  secret_id     = aws_secretsmanager_secret.resend.id
  secret_string = jsonencode({ RESEND_API_KEY = var.resend_api_key })

  lifecycle {
    ignore_changes = [secret_string]
  }
}

resource "aws_secretsmanager_secret" "stripe" {
  name                    = "${var.name}/stripe"
  description             = "Stripe secret key and webhook secret"
  kms_key_id              = var.kms_key_arn
  recovery_window_in_days = 7

  tags = { Name = "${var.name}-stripe", Sensitive = "true" }
}

resource "aws_secretsmanager_secret_version" "stripe" {
  secret_id = aws_secretsmanager_secret.stripe.id
  secret_string = jsonencode({
    STRIPE_SECRET_KEY     = var.stripe_secret_key
    STRIPE_WEBHOOK_SECRET = var.stripe_webhook_secret
  })

  lifecycle {
    ignore_changes = [secret_string]
  }
}

resource "aws_secretsmanager_secret" "aws_config" {
  name                    = "${var.name}/aws-config"
  description             = "AWS region and S3 bucket config for the app"
  kms_key_id              = var.kms_key_arn
  recovery_window_in_days = 7

  tags = { Name = "${var.name}-aws-config" }
}

resource "aws_secretsmanager_secret_version" "aws_config" {
  secret_id = aws_secretsmanager_secret.aws_config.id
  secret_string = jsonencode({
    AWS_REGION              = var.aws_region
    AWS_S3_DOCUMENTS_BUCKET = var.s3_documents_bucket
    AWS_SQS_REMINDERS_URL   = var.sqs_reminders_url
  })

  lifecycle {
    ignore_changes = [secret_string]
  }
}
