# ─── KMS Keys ────────────────────────────────────────────────────────────────
#
# Key policy design — "root delegation" pattern:
#   The root account statement grants the AWS account full control over the key.
#   This enables IAM policies on individual roles to grant kms:* access without
#   those role ARNs needing to appear in the key policy itself.
#   This is the standard AWS pattern and breaks the KMS ↔ IAM circular dependency.
#
#   Specific service principals (s3, secretsmanager) are granted directly here
#   because they assume the key on behalf of AWS-internal operations that bypass
#   normal IAM evaluation.

data "aws_caller_identity" "current" {}

resource "aws_kms_key" "s3" {
  description             = "LendStack S3 documents encryption key"
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
      {
        Sid    = "AllowS3Service"
        Effect = "Allow"
        Principal = { Service = "s3.amazonaws.com" }
        Action   = ["kms:GenerateDataKey", "kms:Decrypt", "kms:DescribeKey"]
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
      {
        Sid    = "AllowSecretsManager"
        Effect = "Allow"
        Principal = { Service = "secretsmanager.amazonaws.com" }
        Action   = ["kms:GenerateDataKey", "kms:Decrypt", "kms:DescribeKey"]
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
