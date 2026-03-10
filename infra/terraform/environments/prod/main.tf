# ─── LendStack Production Environment ────────────────────────────────────────
#
# Clean dependency order (no cycles):
#   vpc  → (nothing)
#   kms  → (nothing)
#   s3   → kms
#   sqs  → kms
#   iam  → kms, s3, sqs, secrets
#   secrets → kms, s3, sqs
#   alb  → vpc, s3
#   ecs  → iam, secrets, alb, vpc
#   cloudfront → alb
#   monitoring → alb, ecs, sqs

locals {
  name = "lendstack-${var.environment}"
}

# ─── 1. Network ───────────────────────────────────────────────────────────────

module "vpc" {
  source = "../../modules/vpc"

  name            = local.name
  aws_region      = var.aws_region
  vpc_cidr        = "10.0.0.0/16"
  azs             = ["${var.aws_region}a", "${var.aws_region}b"]
  public_subnets  = ["10.0.0.0/24", "10.0.1.0/24"]
  private_subnets = ["10.0.10.0/24", "10.0.11.0/24"]
}

# ─── 2. KMS (no external deps) ───────────────────────────────────────────────

module "kms" {
  source = "../../modules/kms"

  name = local.name
}

# ─── 3. S3 + SQS (depend only on KMS) ───────────────────────────────────────

module "s3" {
  source = "../../modules/s3"

  bucket_name     = var.documents_bucket_name
  kms_key_arn     = module.kms.s3_key_arn
  allowed_origins = ["https://${var.domain_name}"]
}

module "sqs" {
  source = "../../modules/sqs"

  name        = local.name
  kms_key_arn = module.kms.s3_key_arn
}

# ─── 4. Secrets (depends on KMS, S3, SQS) ────────────────────────────────────

module "secrets" {
  source = "../../modules/secrets"

  name                  = local.name
  kms_key_arn           = module.kms.secrets_key_arn
  aws_region            = var.aws_region
  mongodb_uri           = var.mongodb_uri
  nextauth_secret       = var.nextauth_secret
  nextauth_url          = "https://${var.domain_name}"
  resend_api_key        = var.resend_api_key
  stripe_secret_key     = var.stripe_secret_key
  stripe_webhook_secret = var.stripe_webhook_secret
  s3_documents_bucket   = module.s3.bucket_name
  sqs_reminders_url     = module.sqs.reminders_queue_url
}

# ─── 5. IAM (depends on KMS, S3, SQS, Secrets) ───────────────────────────────

module "iam" {
  source = "../../modules/iam"

  name                 = local.name
  documents_bucket_arn = module.s3.bucket_arn
  reminders_queue_arn  = module.sqs.reminders_queue_arn
  reminders_dlq_arn    = module.sqs.reminders_dlq_arn
  secrets_kms_key_arn  = module.kms.secrets_key_arn
  s3_kms_key_arn       = module.kms.s3_key_arn
  secret_arns          = module.secrets.all_secret_arns
  github_repo          = var.github_repo
  create_github_oidc   = var.create_github_oidc
}

# ─── 6. ALB (depends on VPC) ─────────────────────────────────────────────────

module "alb" {
  source = "../../modules/alb"

  name                       = local.name
  vpc_id                     = module.vpc.vpc_id
  public_subnet_ids          = module.vpc.public_subnet_ids
  acm_certificate_arn        = var.acm_certificate_arn
  access_logs_bucket         = module.s3.bucket_name
  enable_deletion_protection = var.environment == "prod"
}

# ─── 7. ECS (depends on IAM, Secrets, ALB, VPC) ──────────────────────────────

module "ecs" {
  source = "../../modules/ecs"

  name                    = local.name
  vpc_id                  = module.vpc.vpc_id
  private_subnet_ids      = module.vpc.private_subnet_ids
  alb_sg_id               = module.alb.alb_sg_id
  target_group_arn        = module.alb.target_group_arn
  alb_arn_suffix          = split("loadbalancer/", module.alb.alb_arn)[1]
  target_group_arn_suffix = split(":targetgroup/", module.alb.target_group_arn)[1]
  execution_role_arn      = module.iam.execution_role_arn
  web_task_role_arn       = module.iam.web_task_role_arn
  worker_task_role_arn    = module.iam.worker_task_role_arn
  aws_region              = var.aws_region
  image_tag               = var.image_tag

  secret_mongodb_uri_arn = module.secrets.mongodb_uri_arn
  secret_nextauth_arn    = module.secrets.nextauth_arn
  secret_resend_arn      = module.secrets.resend_arn
  secret_stripe_arn      = module.secrets.stripe_arn
  secret_aws_config_arn  = module.secrets.aws_config_arn

  web_desired_count = var.web_desired_count
  web_min_count     = var.web_min_count
  web_max_count     = var.web_max_count
}

# ─── 8. CloudFront (depends on ALB) ──────────────────────────────────────────

module "cloudfront" {
  source = "../../modules/cloudfront"

  name                     = local.name
  alb_dns_name             = module.alb.alb_dns_name
  acm_certificate_arn      = var.acm_certificate_arn
  domain_names             = [var.domain_name]
  cloudfront_secret_header = var.cloudfront_secret_header

  providers = {
    aws.us_east_1 = aws.us_east_1
  }
}

# ─── 9. Monitoring (depends on ALB, ECS, SQS) ────────────────────────────────

module "monitoring" {
  source = "../../modules/monitoring"

  name                    = local.name
  aws_region              = var.aws_region
  alb_arn_suffix          = split("loadbalancer/", module.alb.alb_arn)[1]
  target_group_arn_suffix = split(":targetgroup/", module.alb.target_group_arn)[1]
  ecs_cluster_name        = module.ecs.cluster_name
  ecs_web_service_name    = module.ecs.web_service_name
  sqs_queue_name          = "${local.name}-reminders"
  sqs_dlq_name            = "${local.name}-reminders-dlq"
  alert_emails            = var.alert_emails
}
