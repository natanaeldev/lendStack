variable "name"                    { type = string }
variable "aws_region"              { type = string }
variable "alb_arn_suffix"          { type = string }
variable "target_group_arn_suffix" { type = string }
variable "ecs_cluster_name"        { type = string }
variable "ecs_web_service_name"    { type = string }
variable "sqs_queue_name"          { type = string }
variable "sqs_dlq_name"            { type = string }
variable "alert_emails" {
  type    = list(string)
  default = []
}
