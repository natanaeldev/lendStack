variable "name" {
  type = string
}

variable "kms_key_arn" {
  type = string
}

variable "web_task_role_arn" {
  type    = string
  default = null
}

variable "worker_task_role_arn" {
  type    = string
  default = null
}
