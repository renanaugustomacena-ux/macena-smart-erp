variable "environment" { type = string }

# Placeholder VPC scaffold. The real definition would set
# cidr_block, NAT gateways per AZ, private + public subnets, flow logs,
# and VPC endpoints for S3, Secrets Manager, ECR. Kept as a skeleton so
# that `terraform init / validate` succeeds in CI.

output "vpc_id" {
  value       = "vpc-placeholder-${var.environment}"
  description = "Populated when the real VPC resource block is added."
}

output "private_subnet_ids" {
  value = [
    "subnet-private-a-${var.environment}",
    "subnet-private-b-${var.environment}",
    "subnet-private-c-${var.environment}",
  ]
}

output "public_subnet_ids" {
  value = [
    "subnet-public-a-${var.environment}",
    "subnet-public-b-${var.environment}",
    "subnet-public-c-${var.environment}",
  ]
}
