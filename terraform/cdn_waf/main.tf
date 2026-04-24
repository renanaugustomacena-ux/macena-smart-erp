variable "environment" { type = string }

# Placeholder CloudFront + WAFv2. Production spec:
#   - WAF managed rule groups: AWSManagedRulesCommonRuleSet,
#     AWSManagedRulesSQLiRuleSet, AWSManagedRulesKnownBadInputsRuleSet.
#   - Geo block list outside EU/EEA for /api/v1/accounting/sdi/* (optional).
#   - Rate-based rule: 2000 req / 5min per IP.
#   - CloudFront distribution fronting Next.js at app.smarterp.it.
#   - TLSv1.2_2021 minimum, HSTS / Referrer-Policy from response-header policy.

output "distribution_domain" {
  value = "placeholder-${var.environment}.cloudfront.net"
}

output "waf_arn" {
  value = "arn:aws:wafv2:us-east-1:000000000000:global/webacl/smarterp-${var.environment}/placeholder"
}
