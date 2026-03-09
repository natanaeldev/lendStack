# ─── SQS Queues ───────────────────────────────────────────────────────────────
#
# Design decisions:
#   - Standard queue (not FIFO) — reminder delivery order doesn't matter,
#     and standard has higher throughput. At-least-once delivery is fine
#     since the worker checks if an email was already sent before sending.
#   - Dead Letter Queue (DLQ): after 3 failed attempts, messages land here.
#     An alarm fires so the team investigates why reminders are failing.
#   - Message visibility timeout: 5 minutes. If the worker crashes mid-processing,
#     the message becomes visible again after 5 min for another worker to pick up.
#   - SSE with KMS: SQS messages contain client names and contact info (PII).
#     Encrypt them at rest.
#   - Message retention: 14 days. If the worker is down, messages pile up
#     but don't get lost immediately.

resource "aws_sqs_queue" "reminders_dlq" {
  name                       = "${var.name}-reminders-dlq"
  message_retention_seconds  = 1209600  # 14 days — inspect why messages failed
  kms_master_key_id          = var.kms_key_arn

  tags = { Name = "${var.name}-reminders-dlq", Purpose = "dead-letter" }
}

resource "aws_sqs_queue" "reminders" {
  name                       = "${var.name}-reminders"
  message_retention_seconds  = 1209600  # 14 days
  visibility_timeout_seconds = 300      # 5 minutes — match your worker timeout
  receive_wait_time_seconds  = 20       # Long polling: reduces empty receives + cost
  kms_master_key_id          = var.kms_key_arn

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.reminders_dlq.arn
    maxReceiveCount     = 3  # Try 3 times before sending to DLQ
  })

  tags = { Name = "${var.name}-reminders", Purpose = "payment-reminders" }
}

# Queue policy: only the web ECS task role can send, only the worker can receive
resource "aws_sqs_queue_policy" "reminders" {
  queue_url = aws_sqs_queue.reminders.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowSend"
        Effect = "Allow"
        Principal = { AWS = var.web_task_role_arn }
        Action   = ["sqs:SendMessage"]
        Resource = aws_sqs_queue.reminders.arn
      },
      {
        Sid    = "AllowConsume"
        Effect = "Allow"
        Principal = { AWS = var.worker_task_role_arn }
        Action = [
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:ChangeMessageVisibility",
          "sqs:GetQueueAttributes"
        ]
        Resource = aws_sqs_queue.reminders.arn
      },
      # Deny all other principals
      {
        Sid       = "DenyEverythingElse"
        Effect    = "Deny"
        Principal = "*"
        Action    = "sqs:*"
        Resource  = aws_sqs_queue.reminders.arn
        Condition = {
          ArnNotLike = {
            "aws:PrincipalArn" = [var.web_task_role_arn, var.worker_task_role_arn]
          }
        }
      }
    ]
  })
}
