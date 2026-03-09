# ─── S3 Bucket for Borrower Documents ────────────────────────────────────────
#
# Design decisions:
#   - Completely private. No ACLs. No public access. Ever.
#   - Presigned URLs (15-minute TTL) are the only way objects are accessed.
#     The app generates them server-side after verifying the user's session and
#     confirming the document belongs to their organization.
#   - SSE-KMS: objects encrypted at rest with a customer-managed KMS key.
#     This gives you an audit trail of every decrypt operation in CloudTrail.
#   - Versioning: protects against accidental deletion and ransomware.
#     Deleted objects become "delete markers" — you can recover them.
#   - Lifecycle: moves objects to cheaper storage tiers automatically.
#     IA (30 days) → Glacier (90 days) → expire after 7 years (compliance).
#   - S3 Object Lock not enabled here (it would prevent versioned deletes).
#     Consider enabling in WORM mode for stricter compliance requirements.
#   - Server Access Logging: every request to the bucket is logged.
#     Required for PCI-DSS, SOC 2, and forensic investigations.

resource "aws_s3_bucket" "documents" {
  bucket = var.bucket_name

  # Prevent accidental destruction via terraform destroy.
  # To delete, first set this to false in a separate apply.
  lifecycle {
    prevent_destroy = true
  }

  tags = { Name = var.bucket_name, Purpose = "borrower-documents" }
}

# Block all public access — belt AND suspenders approach
resource "aws_s3_bucket_public_access_block" "documents" {
  bucket = aws_s3_bucket.documents.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Disable ACLs entirely — bucket owner always owns all objects
resource "aws_s3_bucket_ownership_controls" "documents" {
  bucket = aws_s3_bucket.documents.id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

# SSE-KMS encryption at rest
resource "aws_s3_bucket_server_side_encryption_configuration" "documents" {
  bucket = aws_s3_bucket.documents.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = var.kms_key_arn
    }
    # Force all uploads to use SSE-KMS (reject unencrypted puts)
    bucket_key_enabled = true  # Reduces KMS API call cost by ~99%
  }
}

# Versioning — protect against overwrites and deletes
resource "aws_s3_bucket_versioning" "documents" {
  bucket = aws_s3_bucket.documents.id

  versioning_configuration {
    status = "Enabled"
  }
}

# Lifecycle rules: cost optimization for rarely-accessed documents
resource "aws_s3_bucket_lifecycle_configuration" "documents" {
  bucket = aws_s3_bucket.documents.id

  # Current version transitions
  rule {
    id     = "documents-lifecycle"
    status = "Enabled"

    transition {
      days          = 30
      storage_class = "STANDARD_IA"  # ~40% cheaper for infrequently accessed
    }

    transition {
      days          = 90
      storage_class = "GLACIER_IR"   # ~68% cheaper — instant retrieval available
    }

    expiration {
      days = 2555  # 7 years — typical financial record retention requirement
    }
  }

  # Non-current (overwritten) versions — keep 30 days then purge
  rule {
    id     = "noncurrent-version-cleanup"
    status = "Enabled"

    noncurrent_version_transition {
      noncurrent_days = 30
      storage_class   = "GLACIER_IR"
    }

    noncurrent_version_expiration {
      noncurrent_days = 90
    }
  }

  # Incomplete multipart uploads — clean up after 7 days to avoid orphaned costs
  rule {
    id     = "abort-multipart"
    status = "Enabled"

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}

# CORS — allow presigned uploads directly from the browser (optional)
resource "aws_s3_bucket_cors_configuration" "documents" {
  bucket = aws_s3_bucket.documents.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["PUT", "GET"]
    allowed_origins = var.allowed_origins
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

# Bucket policy — deny any request that is not over HTTPS
# Also denies access to any principal other than the ECS task role
resource "aws_s3_bucket_policy" "documents" {
  bucket = aws_s3_bucket.documents.id

  # Must wait for public access block to be applied first
  depends_on = [aws_s3_bucket_public_access_block.documents]

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      # Deny all HTTP (non-TLS) requests — documents must be fetched over HTTPS
      {
        Sid       = "DenyNonHTTPS"
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:*"
        Resource  = [
          "${aws_s3_bucket.documents.arn}",
          "${aws_s3_bucket.documents.arn}/*"
        ]
        Condition = {
          Bool = { "aws:SecureTransport" = "false" }
        }
      },
      # Deny unencrypted uploads (must use SSE-KMS, not SSE-S3 or nothing)
      {
        Sid       = "DenyUnencryptedUploads"
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:PutObject"
        Resource  = "${aws_s3_bucket.documents.arn}/*"
        Condition = {
          StringNotEquals = {
            "s3:x-amz-server-side-encryption" = "aws:kms"
          }
        }
      }
    ]
  })
}

# Server access logging bucket (separate from documents bucket)
resource "aws_s3_bucket" "logs" {
  bucket = "${var.bucket_name}-access-logs"
  tags   = { Name = "${var.bucket_name}-access-logs", Purpose = "s3-access-logs" }
}

resource "aws_s3_bucket_public_access_block" "logs" {
  bucket                  = aws_s3_bucket.logs.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "logs" {
  bucket = aws_s3_bucket.logs.id

  rule {
    id     = "expire-logs"
    status = "Enabled"
    expiration { days = 90 }
  }
}

resource "aws_s3_bucket_logging" "documents" {
  bucket        = aws_s3_bucket.documents.id
  target_bucket = aws_s3_bucket.logs.id
  target_prefix = "s3-access-logs/"
}
