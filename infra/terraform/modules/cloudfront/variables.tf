variable "name" { type = string }
variable "alb_dns_name" { type = string }
variable "acm_certificate_arn" { type = string }
variable "domain_names" { type = list(string) }

variable "cloudfront_secret_header" {
  type      = string
  sensitive = true
}
