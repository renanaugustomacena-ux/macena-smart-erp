variable "environment" { type = string }
variable "vpc_id" { type = string }
variable "private_subnet_ids" { type = list(string) }

# Placeholder RDS for PostgreSQL 16. Production definition will set:
#   - engine_version = "16.3"
#   - multi_az = true (prod only)
#   - storage_encrypted = true + kms_key_id referencing module.secrets
#   - performance_insights_enabled = true
#   - backup_retention_period = 30
#   - deletion_protection = true (prod only)
#   - enabled_cloudwatch_logs_exports = ["postgresql","upgrade"]
#   - parameter_group: log_min_duration_statement=500ms, pgaudit.log='write'

output "db_endpoint" {
  value     = "placeholder.rds.${var.environment}.smarterp.internal:5432"
  sensitive = true
}

output "db_name" {
  value = "smarterp"
}

output "db_secret_arn" {
  value     = "arn:aws:secretsmanager:eu-south-1:000000000000:secret:smarterp-${var.environment}-db-xxxxxx"
  sensitive = true
}
