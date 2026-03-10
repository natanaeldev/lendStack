output "reminders_queue_url" { value = aws_sqs_queue.reminders.url }
output "reminders_queue_arn" { value = aws_sqs_queue.reminders.arn }
output "reminders_dlq_url" { value = aws_sqs_queue.reminders_dlq.url }
output "reminders_dlq_arn" { value = aws_sqs_queue.reminders_dlq.arn }
