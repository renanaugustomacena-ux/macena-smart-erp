variable "environment" { type = string }

# Placeholder observability stack. Production spec:
#   - Amazon Managed Service for Prometheus (AMP) workspace.
#   - Amazon Managed Grafana workspace with SAML via the customer IdP.
#   - ADOT collector configuration via EKS Helm chart.
#   - CloudWatch log group "/smarterp/${env}" with 30-day retention.

output "prometheus_workspace_id" {
  value = "ws-smarterp-${var.environment}-placeholder"
}

output "grafana_workspace_url" {
  value = "https://placeholder-${var.environment}.grafana-workspace.eu-south-1.amazonaws.com"
}

output "otlp_endpoint" {
  value = "http://otel-collector.observability.svc.cluster.local:4318"
}
