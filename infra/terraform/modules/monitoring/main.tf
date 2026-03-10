# ─── CloudWatch Monitoring, Alarms & Dashboard ───────────────────────────────
#
# Alarms cover 4 golden signals:
#   1. Latency    — P99 response time > 3s on ALB
#   2. Traffic    — tracked via request count (informational, not alarmed)
#   3. Errors     — ALB 5xx error rate > 1% of requests
#   4. Saturation — ECS CPU > 80%, ECS Memory > 80%, SQS depth > 100

resource "aws_cloudwatch_metric_alarm" "alb_5xx" {
  alarm_name          = "${var.name}-alb-5xx-errors"
  alarm_description   = "ALB HTTP 5xx error rate > 1% — app is throwing errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  threshold           = 1
  treat_missing_data  = "notBreaching"

  metric_query {
    id          = "error_rate"
    expression  = "errors / MAX([errors, requests]) * 100"
    label       = "5xx Error Rate (%)"
    return_data = true
  }

  metric_query {
    id = "errors"
    metric {
      metric_name = "HTTPCode_Target_5XX_Count"
      namespace   = "AWS/ApplicationELB"
      period      = 60
      stat        = "Sum"
      dimensions  = { LoadBalancer = var.alb_arn_suffix }
    }
  }

  metric_query {
    id = "requests"
    metric {
      metric_name = "RequestCount"
      namespace   = "AWS/ApplicationELB"
      period      = 60
      stat        = "Sum"
      dimensions  = { LoadBalancer = var.alb_arn_suffix }
    }
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]
}

resource "aws_cloudwatch_metric_alarm" "alb_latency_p99" {
  alarm_name          = "${var.name}-alb-latency-p99"
  alarm_description   = "ALB P99 latency > 3s - app is slow"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  threshold           = 3
  treat_missing_data  = "notBreaching"
  metric_name         = "TargetResponseTime"
  namespace           = "AWS/ApplicationELB"
  period              = 60
  extended_statistic  = "p99"
  dimensions          = { LoadBalancer = var.alb_arn_suffix }

  alarm_actions = [aws_sns_topic.alerts.arn]
}

resource "aws_cloudwatch_metric_alarm" "ecs_web_cpu" {
  alarm_name          = "${var.name}-ecs-web-cpu"
  alarm_description   = "ECS web service CPU > 80% for 5 minutes"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 5
  threshold           = 80
  treat_missing_data  = "notBreaching"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ECS"
  period              = 60
  statistic           = "Average"
  dimensions = {
    ClusterName = var.ecs_cluster_name
    ServiceName = var.ecs_web_service_name
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]
}

resource "aws_cloudwatch_metric_alarm" "ecs_web_memory" {
  alarm_name          = "${var.name}-ecs-web-memory"
  alarm_description   = "ECS web service memory > 85%"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  threshold           = 85
  treat_missing_data  = "notBreaching"
  metric_name         = "MemoryUtilization"
  namespace           = "AWS/ECS"
  period              = 60
  statistic           = "Average"
  dimensions = {
    ClusterName = var.ecs_cluster_name
    ServiceName = var.ecs_web_service_name
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
}

resource "aws_cloudwatch_metric_alarm" "sqs_depth" {
  alarm_name          = "${var.name}-sqs-queue-depth"
  alarm_description   = "Reminders queue has > 100 messages — worker may be stuck"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  threshold           = 100
  treat_missing_data  = "notBreaching"
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = 300
  statistic           = "Maximum"
  dimensions          = { QueueName = var.sqs_queue_name }

  alarm_actions = [aws_sns_topic.alerts.arn]
}

resource "aws_cloudwatch_metric_alarm" "sqs_dlq_depth" {
  alarm_name          = "${var.name}-sqs-dlq-depth"
  alarm_description   = "DLQ has messages — some reminders are failing permanently"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  threshold           = 0
  treat_missing_data  = "notBreaching"
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = 60
  statistic           = "Sum"
  dimensions          = { QueueName = var.sqs_dlq_name }

  alarm_actions = [aws_sns_topic.alerts.arn]
}

resource "aws_cloudwatch_metric_alarm" "unhealthy_hosts" {
  alarm_name          = "${var.name}-unhealthy-ecs-tasks"
  alarm_description   = "ALB has unhealthy ECS tasks — deployment may have failed"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  threshold           = 0
  treat_missing_data  = "notBreaching"
  metric_name         = "UnHealthyHostCount"
  namespace           = "AWS/ApplicationELB"
  period              = 60
  statistic           = "Maximum"
  dimensions = {
    LoadBalancer = var.alb_arn_suffix
    TargetGroup  = var.target_group_arn_suffix
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]
}

# ─── SNS Topic for Alerts ─────────────────────────────────────────────────────

resource "aws_sns_topic" "alerts" {
  name         = "${var.name}-alerts"
  display_name = "LendStack Alerts"
  tags         = { Name = "${var.name}-alerts" }
}

resource "aws_sns_topic_subscription" "email" {
  count     = length(var.alert_emails)
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.alert_emails[count.index]
}

# ─── CloudWatch Dashboard ─────────────────────────────────────────────────────

resource "aws_cloudwatch_dashboard" "main" {
  dashboard_name = "${var.name}-operations"

  dashboard_body = jsonencode({
    widgets = [
      {
        type = "metric"
        properties = {
          title   = "ALB Request Count"
          period  = 60
          stat    = "Sum"
          metrics = [["AWS/ApplicationELB", "RequestCount", "LoadBalancer", var.alb_arn_suffix]]
        }
      },
      {
        type = "metric"
        properties = {
          title  = "ALB 5xx Errors"
          period = 60
          stat   = "Sum"
          metrics = [
            ["AWS/ApplicationELB", "HTTPCode_Target_5XX_Count", "LoadBalancer", var.alb_arn_suffix],
            ["AWS/ApplicationELB", "HTTPCode_Target_4XX_Count", "LoadBalancer", var.alb_arn_suffix]
          ]
        }
      },
      {
        type = "metric"
        properties = {
          title   = "ALB P99 Latency (ms)"
          period  = 60
          stat    = "p99"
          metrics = [["AWS/ApplicationELB", "TargetResponseTime", "LoadBalancer", var.alb_arn_suffix]]
        }
      },
      {
        type = "metric"
        properties = {
          title  = "ECS CPU & Memory"
          period = 60
          metrics = [
            ["AWS/ECS", "CPUUtilization", "ClusterName", var.ecs_cluster_name, "ServiceName", var.ecs_web_service_name, { stat = "Average", label = "CPU %" }],
            ["AWS/ECS", "MemoryUtilization", "ClusterName", var.ecs_cluster_name, "ServiceName", var.ecs_web_service_name, { stat = "Average", label = "Memory %" }]
          ]
        }
      },
      {
        type = "metric"
        properties = {
          title  = "SQS Queue Depth"
          period = 60
          metrics = [
            ["AWS/SQS", "ApproximateNumberOfMessagesVisible", "QueueName", var.sqs_queue_name, { label = "Reminders Queue" }],
            ["AWS/SQS", "ApproximateNumberOfMessagesVisible", "QueueName", var.sqs_dlq_name, { label = "DLQ" }]
          ]
        }
      },
      {
        type = "log"
        properties = {
          title  = "Application Errors (last 1h)"
          query  = "SOURCE '/ecs/${var.name}/web' | filter @message like /ERROR/ | sort @timestamp desc | limit 50"
          region = var.aws_region
          view   = "table"
        }
      }
    ]
  })
}

# ─── Log Metric Filters ───────────────────────────────────────────────────────
# Create CloudWatch metrics from application log patterns

resource "aws_cloudwatch_log_metric_filter" "app_errors" {
  name           = "${var.name}-app-errors"
  log_group_name = "/ecs/${var.name}/web"
  pattern        = "ERROR"

  metric_transformation {
    name          = "AppErrorCount"
    namespace     = "LendStack/App"
    value         = "1"
    default_value = "0"
  }
}

resource "aws_cloudwatch_log_metric_filter" "payment_events" {
  name           = "${var.name}-payment-events"
  log_group_name = "/ecs/${var.name}/web"
  pattern        = "[POST /api/clients]"

  metric_transformation {
    name          = "PaymentRegistered"
    namespace     = "LendStack/Business"
    value         = "1"
    default_value = "0"
  }
}

