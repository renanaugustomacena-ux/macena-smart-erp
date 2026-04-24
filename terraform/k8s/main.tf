variable "environment" { type = string }
variable "vpc_id" { type = string }
variable "private_subnet_ids" { type = list(string) }

# Placeholder EKS module. Real definition would call
# terraform-aws-modules/eks/aws ~> 20 with node groups, IRSA for the
# External-Secrets operator, an aws-load-balancer-controller chart, and
# Karpenter for autoscaling. Kept skeletal so the module boundary is
# authoritative even before implementation.

output "cluster_name" {
  value = "smarterp-${var.environment}"
}

output "cluster_endpoint" {
  value     = "https://placeholder.eks.${var.environment}.smarterp.internal"
  sensitive = true
}
