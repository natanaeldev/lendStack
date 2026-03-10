variable "name"       { type = string }
variable "kms_key_arn"{ type = string }
variable "aws_region" { type = string }
variable "nextauth_url"          { type = string }
variable "s3_documents_bucket"   { type = string }
variable "sqs_reminders_url"     { type = string }
variable "mongodb_uri" {
  type      = string
  sensitive = true
  default   = "REPLACE_ME"
}
variable "nextauth_secret" {
  type      = string
  sensitive = true
  default   = "REPLACE_ME"
}
variable "resend_api_key" {
  type      = string
  sensitive = true
  default   = "REPLACE_ME"
}
variable "stripe_secret_key" {
  type      = string
  sensitive = true
  default   = "REPLACE_ME"
}
variable "stripe_webhook_secret" {
  type      = string
  sensitive = true
  default   = "REPLACE_ME"
}
