# ─── KMS Keys ────────────────────────────────────────────────────────────────
#
# Design decisions:
#   - Separate keys per service (S3, Secrets) so a compromise of one key
#     doesn't expose all data. AWS lets you audit each key independently.
#   - Key rotation enabled: AWS auto-rotates the backing key material annually.
#     The key ARN stays the same; existing ciphertext is transparently re-wrapped.
#   - Deletion window: 30 days minimum. This prevents accidental permanent data
#     loss — you have 30 days to cancel if a key is deleted by mistake.

data "aws_caller_identity" "current" {}

resource "aws_kms_key" "s3" {
  description             = "LendStack S3 documents encryption key"
  deletion_window_in_days = 30
  enable_key_rotation     = true

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      # Root account has full control — required, otherwise you can lock yourself out
      {
        Sid    = "EnableRootAccess"
        Effect = "Allow"
        Principal = { AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root" }
        Action   = "kms:*"
        Resource = "*"
      },
      # ECS task role can encrypt/decrypt S3 objects
      {
        Sid    = "AllowECSTaskS3"
        Effect = "Allow"
        Principal = { AWS = var.ecs_task_role_arn }
        Action = [
          "kms:GenerateDataKey",
          "kms:Decrypt",
          "kms:DescribeKey"
        ]
        Resource = "*"
      },
      # S3 service can use the key on behalf of bucket operations
      {
        Sid    = "AllowS3Service"
        Effect = "Allow"
        Principal = { Service = "s3.amazonaws.com" }
        Action = [
          "kms:GenerateDataKey",
          "kms:Decrypt",
          "kms:DescribeKey"
        ]
        Resource = "*"
      }
    ]
  })

  tags = { Name = "${var.name}-s3-key" }
}

resource "aws_kms_alias" "s3" {
  name          = "alias/${var.name}-s3"
  target_key_id = aws_kms_key.s3.key_id
}

resource "aws_kms_key" "secrets" {
  description             = "LendStack Secrets Manager encryption key"
  deletion_window_in_days = 30
  enable_key_rotation     = true

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "EnableRootAccess"
        Effect = "Allow"
        Principal = { AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root" }
        Action   = "kms:*"
        Resource = "*"
      },
      # ECS execution role needs to decrypt secrets at container startup
      {
        Sid    = "AllowECSExecution"
        Effect = "Allow"
        Principal = { AWS = var.ecs_execution_role_arn }
        Action = [
          "kms:Decrypt",
          "kms:DescribeKey"
        ]
        Resource = "*"
      },
      # Secrets Manager service uses the key
      {
        Sid    = "AllowSecretsManager"
        Effect = "Allow"
        Principal = { Service = "secretsmanager.amazonaws.com" }
        Action = [
          "kms:GenerateDataKey",
          "kms:Decrypt",
          "kms:DescribeKey"
        ]
        Resource = "*"
      }
    ]
  })

  tags = { Name = "${var.name}-secrets-key" }
}

resource "aws_kms_alias" "secrets" {
  name          = "alias/${var.name}-secrets"
  target_key_id = aws_kms_key.secrets.key_id
}
