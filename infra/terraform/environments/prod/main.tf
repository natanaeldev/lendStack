# ─── LendStack Production Environment ────────────────────────────────────────
#
# Wires all modules together. Module outputs feed into the next module's inputs.
# Dependency order:
#   vpc → (iam needs placeholder arns) → s3 + sqs → kms → iam (real arns) → secrets → ecs
#
# Note: IAM has a chicken-and-egg with KMS (KMS needs role ARNs, IAM needs KMS ARNs).
# Solved by creating IAM roles first with placeholder KMS vars, then updating KMS.
# Terraform handles this via depends_on and apply ordering.

locals {
  name = "lendstack-${var.environment}"
}

# ─── 1. Network Foundation ────────────────────────────────────────────────────

module "vpc" {
  source = "../../modules/vpc"

  name            = local.name
  aws_region      = var.aws_region
  vpc_cidr        = "10.0.0.0/16"
  azs             = ["${var.aws_region}a", "${var.aws_region}b"]
  public_subnets  = ["10.0.0.0/24", "10.0.1.0/24"]
  private_subnets = ["10.0.10.0/24", "10.0.11.0/24"]
}

# ─── 2. SQS (needed by IAM for resource ARNs) ────────────────────────────────
# Create with placeholder roles, update after IAM is created.

module "sqs" {
  source = "../../modules/sqs"

  name                 = local.name
  kms_key_arn          = module.kms.s3_key_arn  # Reuse S3 key for SQS (or use dedicated)
  web_task_role_arn    = module.iam.web_task_role_arn
  worker_task_role_arn = module.iam.worker_task_role_arn

  depends_on = [module.iam]
}

# ─── 3. S3 (needed by IAM for resource ARN) ──────────────────────────────────

module "s3" {
  source = "../../modules/s3"

  bucket_name     = var.documents_bucket_name
  kms_key_arn     = module.kms.s3_key_arn
  allowed_origins = ["https://${var.domain_name}"]

  depends_on = [module.kms]
}

# ─── 4. IAM (needs S3 + SQS ARNs, provides role ARNs for KMS + ECS) ─────────
# Bootstrap with dummy KMS ARN first apply, then real one flows through.

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

# ─── 5. KMS (needs IAM role ARNs for key policies) ───────────────────────────

module "kms" {
  source = "../../modules/kms"

  name                   = local.name
  ecs_task_role_arn      = module.iam.web_task_role_arn
  ecs_execution_role_arn = module.iam.execution_role_arn
}

# ─── 6. Secrets Manager ───────────────────────────────────────────────────────

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

# ─── 7. ALB ──────────────────────────────────────────────────────────────────

module "alb" {
  source = "../../modules/alb"

  name                      = local.name
  vpc_id                    = module.vpc.vpc_id
  public_subnet_ids         = module.vpc.public_subnet_ids
  acm_certificate_arn       = var.acm_certificate_arn
  access_logs_bucket        = module.s3.bucket_name  # Or a dedicated logs bucket
  enable_deletion_protection = var.environment == "prod"
}

# ─── 8. ECS ──────────────────────────────────────────────────────────────────

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

  secret_mongodb_uri_arn  = module.secrets.mongodb_uri_arn
  secret_nextauth_arn     = module.secrets.nextauth_arn
  secret_resend_arn       = module.secrets.resend_arn
  secret_stripe_arn       = module.secrets.stripe_arn
  secret_aws_config_arn   = module.secrets.aws_config_arn

  web_desired_count = var.web_desired_count
  web_min_count     = var.web_min_count
  web_max_count     = var.web_max_count
}

# ─── 9. CloudFront ───────────────────────────────────────────────────────────

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

# ─── 10. Monitoring ──────────────────────────────────────────────────────────

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
