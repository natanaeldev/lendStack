# ─── IAM Roles ───────────────────────────────────────────────────────────────
#
# Principle of Least Privilege applied throughout.
# There are TWO distinct IAM roles per ECS service:
#
#   1. Task Execution Role — used by the ECS AGENT (not your app code) to:
#        - Pull the container image from ECR
#        - Write logs to CloudWatch
#        - Fetch secrets from Secrets Manager at container startup
#
#   2. Task Role — the runtime identity your APPLICATION CODE assumes to:
#        - Read/write S3 documents
#        - Send messages to SQS
#        - Read secrets at runtime (if needed beyond startup env vars)
#
# The worker task role has different permissions: it reads from SQS,
# sends emails via SES, but does NOT have S3 write access.

data "aws_iam_policy_document" "ecs_assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

# ─── ECS Task Execution Role (shared by web + worker) ────────────────────────

resource "aws_iam_role" "ecs_execution" {
  name               = "${var.name}-ecs-execution-role"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
}

# AWS managed policy: pull ECR images + write CloudWatch logs
resource "aws_iam_role_policy_attachment" "ecs_execution_managed" {
  role       = aws_iam_role.ecs_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Allow execution role to fetch secrets (injected as env vars at startup)
resource "aws_iam_role_policy" "ecs_execution_secrets" {
  name = "${var.name}-ecs-execution-secrets"
  role = aws_iam_role.ecs_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "GetSecrets"
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret"
        ]
        Resource = var.secret_arns
      },
      {
        Sid      = "DecryptSecrets"
        Effect   = "Allow"
        Action   = ["kms:Decrypt", "kms:DescribeKey"]
        Resource = [var.secrets_kms_key_arn]
      }
    ]
  })
}

# ─── Web Task Role (runtime identity for Next.js app) ────────────────────────

resource "aws_iam_role" "ecs_web_task" {
  name               = "${var.name}-ecs-web-task-role"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
}

resource "aws_iam_role_policy" "ecs_web_task_policy" {
  name = "${var.name}-ecs-web-task-policy"
  role = aws_iam_role.ecs_web_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      # S3: scoped to the documents bucket ONLY. No other buckets accessible.
      {
        Sid    = "S3Documents"
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:DeleteObject",
          "s3:HeadObject"
        ]
        Resource = "${var.documents_bucket_arn}/*"
      },
      {
        Sid      = "S3ListBucket"
        Effect   = "Allow"
        Action   = "s3:ListBucket"
        Resource = var.documents_bucket_arn
      },
      # KMS: decrypt/encrypt S3 objects
      {
        Sid      = "S3KMS"
        Effect   = "Allow"
        Action   = ["kms:GenerateDataKey", "kms:Decrypt", "kms:DescribeKey"]
        Resource = [var.s3_kms_key_arn]
      },
      # SQS: web can SEND payment reminder jobs to the queue
      {
        Sid      = "SQSSendReminders"
        Effect   = "Allow"
        Action   = ["sqs:SendMessage", "sqs:GetQueueUrl", "sqs:GetQueueAttributes"]
        Resource = var.reminders_queue_arn
      },
      # CloudWatch: emit custom metrics from the app
      {
        Sid      = "CloudWatchMetrics"
        Effect   = "Allow"
        Action   = ["cloudwatch:PutMetricData"]
        Resource = "*"
        Condition = {
          StringEquals = { "cloudwatch:namespace" = "LendStack/App" }
        }
      }
    ]
  })
}

# ─── Worker Task Role (reminder processor) ───────────────────────────────────

resource "aws_iam_role" "ecs_worker_task" {
  name               = "${var.name}-ecs-worker-task-role"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
}

resource "aws_iam_role_policy" "ecs_worker_task_policy" {
  name = "${var.name}-ecs-worker-task-policy"
  role = aws_iam_role.ecs_worker_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      # SQS: worker polls queue and deletes messages after processing
      {
        Sid    = "SQSConsumeReminders"
        Effect = "Allow"
        Action = [
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueUrl",
          "sqs:GetQueueAttributes",
          "sqs:ChangeMessageVisibility"
        ]
        Resource = [var.reminders_queue_arn, var.reminders_dlq_arn]
      },
      # CloudWatch: worker emits processing metrics
      {
        Sid      = "CloudWatchMetrics"
        Effect   = "Allow"
        Action   = ["cloudwatch:PutMetricData"]
        Resource = "*"
        Condition = {
          StringEquals = { "cloudwatch:namespace" = "LendStack/Worker" }
        }
      }
    ]
  })
}

# ─── GitHub Actions Deployment Role ──────────────────────────────────────────
# CI/CD pipeline assumes this role via OIDC — no long-lived access keys needed.
# This is the modern, secure way to do CI/CD with AWS.

data "aws_iam_openid_connect_provider" "github" {
  count = var.create_github_oidc ? 1 : 0
  url   = "https://token.actions.githubusercontent.com"
}

resource "aws_iam_openid_connect_provider" "github" {
  count = var.create_github_oidc ? 1 : 0
  url   = "https://token.actions.githubusercontent.com"

  client_id_list = ["sts.amazonaws.com"]

  # GitHub's OIDC thumbprint — verify at https://github.com/.well-known/openid-configuration
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"]
}

resource "aws_iam_role" "github_actions" {
  name = "${var.name}-github-actions-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Federated = var.create_github_oidc ? aws_iam_openid_connect_provider.github[0].arn : data.aws_iam_openid_connect_provider.github[0].arn
      }
      Action = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringLike = {
          "token.actions.githubusercontent.com:sub" = "repo:${var.github_repo}:*"
        }
        StringEquals = {
          "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
        }
      }
    }]
  })
}

resource "aws_iam_role_policy" "github_actions" {
  name = "${var.name}-github-actions-policy"
  role = aws_iam_role.github_actions.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      # ECR: push images
      {
        Sid    = "ECRPush"
        Effect = "Allow"
        Action = [
          "ecr:GetAuthorizationToken",
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
          "ecr:InitiateLayerUpload",
          "ecr:UploadLayerPart",
          "ecr:CompleteLayerUpload",
          "ecr:PutImage"
        ]
        Resource = "*"
      },
      # ECS: deploy new task revisions
      {
        Sid    = "ECSDeployWeb"
        Effect = "Allow"
        Action = [
          "ecs:UpdateService",
          "ecs:DescribeServices",
          "ecs:RegisterTaskDefinition",
          "ecs:DescribeTaskDefinition",
          "ecs:ListTaskDefinitions"
        ]
        Resource = "*"
      },
      # CloudFront: allow cache invalidation after deploy
      {
        Sid      = "CloudFrontInvalidate"
        Effect   = "Allow"
        Action   = ["cloudfront:CreateInvalidation"]
        Resource = "*"
      },
      # IAM PassRole: needed for ECS to accept task definitions with these roles
      {
        Sid    = "PassECSRoles"
        Effect = "Allow"
        Action = "iam:PassRole"
        Resource = [
          aws_iam_role.ecs_execution.arn,
          aws_iam_role.ecs_web_task.arn,
          aws_iam_role.ecs_worker_task.arn
        ]
      }
    ]
  })
}


