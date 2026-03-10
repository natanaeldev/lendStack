terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Remote state in S3 — bucket + DynamoDB lock table must exist before first init.
  # Create them once with the bootstrap script in infra/scripts/bootstrap-state.sh
  backend "s3" {
    bucket         = "lendstack-terraform-state"
    key            = "prod/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "lendstack-terraform-locks"
    encrypt        = true
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "lendstack"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

# Secondary provider for CloudFront WAF — WAF for CloudFront must be in us-east-1.
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
}
