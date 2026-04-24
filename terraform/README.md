# SmartERP Terraform

Seven module placeholders per v2.0 Mission I plan Section 11.

| Module | Purpose |
|---|---|
| `vpc/` | AWS VPC, subnets, NAT, route tables (eu-south-1 primary) |
| `k8s/` | EKS cluster + node groups for SmartERP workloads |
| `db/` | RDS for PostgreSQL 16 Multi-AZ, read replica optional |
| `storage/` | S3 buckets: FatturaPA archive, reports, SBOM artefacts |
| `cdn_waf/` | CloudFront + AWS WAFv2 in front of the Next.js frontend |
| `secrets/` | AWS Secrets Manager + KMS CMK for PII field encryption |
| `observability/` | Managed Prometheus, Grafana, X-Ray / OTel Collector |

Region choice: `eu-south-1` (Milan) primary to keep Italian customer data
in-country per v2.0 §15 data residency; `eu-west-1` (Dublin) for DR.

Every module currently ships the minimum Terraform skeleton required to
`terraform init / validate`. Concrete resource definitions are deferred
to Phase 4 infrastructure build-out; shipping the modules now unblocks
CI `terraform fmt / validate` steps and makes the module boundary
auditable.
