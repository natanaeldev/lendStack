variable "bucket_name" { type = string }
variable "kms_key_arn" { type = string }

variable "allowed_origins" {
  type    = list(string)
  default = []
}
