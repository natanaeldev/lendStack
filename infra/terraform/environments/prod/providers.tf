terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Remote state — bootstrap bucket + table first with infra/scripts/bootstrap-state.sh
  backend "s3" {
    bucket         = "lendstack-terraform-state"
    key            = "prod/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "lendstack-terraform-locks"
    encrypt        = true
  }
}

# Provider blocks cannot reference input variables — hardcode the region.
# Override at runtime with: AWS_REGION=eu-west-1 terraform apply
provider "aws" {
  region = "us-east-1"

  default_tags {
    tags = {
      Project     = "lendstack"
      Environment = "prod"
      ManagedBy   = "terraform"
    }
  }
}

# Alias required for CloudFront WAF (must be us-east-1 regardless of main region)
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
}
