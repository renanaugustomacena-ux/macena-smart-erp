variable "aws_region" {
  description = "Primary AWS region for SmartERP infrastructure."
  type        = string
  default     = "eu-south-1" # Milan — Italian data residency
}

variable "environment" {
  description = "Deployment environment (dev, staging, prod)."
  type        = string
  default     = "dev"
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "environment must be one of dev/staging/prod."
  }
}
