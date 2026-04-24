variable "environment" { type = string }

# Placeholder S3 storage. The production module will provision:
#   - smarterp-${env}-fatturapa-archive (Conservazione a Norma retention)
#   - smarterp-${env}-reports (signed-URL report output)
#   - smarterp-${env}-sbom (CI artefact archive)
# With Object Lock (WORM, compliance mode, retain_days = 3650) on the
# fatturapa-archive bucket per Italian tax requirements (10 years).

output "fatturapa_bucket" {
  value = "smarterp-${var.environment}-fatturapa-archive"
}

output "reports_bucket" {
  value = "smarterp-${var.environment}-reports"
}

output "sbom_bucket" {
  value = "smarterp-${var.environment}-sbom"
}
