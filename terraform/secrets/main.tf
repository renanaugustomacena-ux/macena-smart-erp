variable "environment" { type = string }

# Placeholder Secrets Manager + KMS. Production spec:
#   - aws_kms_key "pii" with rotation enabled (365-day rotation) for the
#     field-level AES-256-GCM encryption of payment IBANs.
#   - aws_secretsmanager_secret for DB creds, Redis password, JWT secrets,
#     SDI intermediary API key, PII encryption key.
#   - IAM policy granting the EKS IRSA role GetSecretValue on just those.

output "kms_pii_key_arn" {
  value = "arn:aws:kms:eu-south-1:000000000000:key/placeholder-${var.environment}"
}

output "app_secret_arn" {
  value = "arn:aws:secretsmanager:eu-south-1:000000000000:secret:smarterp-${var.environment}-app-placeholder"
}
