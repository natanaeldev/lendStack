variable "name"                 { type = string }
variable "secret_arns"          { type = list(string) }
variable "secrets_kms_key_arn"  { type = string }
variable "s3_kms_key_arn"       { type = string }
variable "documents_bucket_arn" { type = string }
variable "reminders_queue_arn"  { type = string }
variable "reminders_dlq_arn"    { type = string }
variable "github_repo" {
  type        = string
  description = "org/repo e.g. natanaeldev/lendStack"
}
variable "create_github_oidc" {
  type    = bool
  default = true
}
