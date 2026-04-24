terraform {
  required_version = ">= 1.6.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.40.0"
    }
  }
  backend "s3" {
    # Fill in via -backend-config=backend.tfvars at init time.
    # bucket  = "smarterp-tfstate-prod"
    # key     = "smarterp/terraform.tfstate"
    # region  = "eu-south-1"
    # encrypt = true
  }
}

provider "aws" {
  region = var.aws_region
  default_tags {
    tags = {
      Project     = "SmartERP"
      Environment = var.environment
      ManagedBy   = "terraform"
      Owner       = "smarterp-sre"
      DataClass   = "confidential"
    }
  }
}

module "vpc" {
  source      = "./vpc"
  environment = var.environment
}

module "k8s" {
  source             = "./k8s"
  environment        = var.environment
  vpc_id             = module.vpc.vpc_id
  private_subnet_ids = module.vpc.private_subnet_ids
}

module "db" {
  source             = "./db"
  environment        = var.environment
  vpc_id             = module.vpc.vpc_id
  private_subnet_ids = module.vpc.private_subnet_ids
}

module "storage" {
  source      = "./storage"
  environment = var.environment
}

module "cdn_waf" {
  source      = "./cdn_waf"
  environment = var.environment
}

module "secrets" {
  source      = "./secrets"
  environment = var.environment
}

module "observability" {
  source      = "./observability"
  environment = var.environment
}
