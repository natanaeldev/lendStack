variable "name" { type = string }
variable "vpc_id" { type = string }
variable "private_subnet_ids" { type = list(string) }
variable "alb_sg_id" { type = string }
variable "target_group_arn" { type = string }
variable "alb_arn_suffix" { type = string }
variable "target_group_arn_suffix" { type = string }
variable "execution_role_arn" { type = string }
variable "web_task_role_arn" { type = string }
variable "worker_task_role_arn" { type = string }
variable "aws_region" { type = string }

variable "image_tag" {
  type    = string
  default = "latest"
}

variable "web_cpu" {
  type    = number
  default = 1024
}

variable "web_memory" {
  type    = number
  default = 2048
}

variable "worker_cpu" {
  type    = number
  default = 512
}

variable "worker_memory" {
  type    = number
  default = 1024
}

variable "web_desired_count" {
  type    = number
  default = 2
}

variable "web_min_count" {
  type    = number
  default = 2
}

variable "web_max_count" {
  type    = number
  default = 10
}

variable "secret_mongodb_uri_arn" { type = string }
variable "secret_nextauth_arn" { type = string }
variable "secret_resend_arn" { type = string }
variable "secret_stripe_arn" { type = string }
variable "secret_aws_config_arn" { type = string }
