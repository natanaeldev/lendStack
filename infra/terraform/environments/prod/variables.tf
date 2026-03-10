variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "environment" {
  type    = string
  default = "prod"
}
variable "domain_name" {
  type = string
}
variable "documents_bucket_name" {
  type = string
}
variable "acm_certificate_arn" {
  type        = string
  description = "ACM cert ARN (must be in us-east-1 for CloudFront)"
}

variable "cloudfront_secret_header" {
  type      = string
  sensitive = true
}
variable "github_repo" {
  type        = string
  description = "org/repo e.g. natanaeldev/lendStack"
}
variable "create_github_oidc" {
  type    = bool
  default = true
}
variable "alert_emails" {
  type    = list(string)
  default = []
}
variable "image_tag" {
  type    = string
  default = "latest"
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

# Secrets — populated via terraform.tfvars (gitignored) or CI env vars
variable "mongodb_uri" {
  type      = string
  sensitive = true
}

variable "nextauth_secret" {
  type      = string
  sensitive = true
}

variable "resend_api_key" {
  type      = string
  sensitive = true
}
variable "stripe_secret_key" {
  type      = string
  sensitive = true
}
variable "stripe_webhook_secret" {
  type      = string
  sensitive = true
}
