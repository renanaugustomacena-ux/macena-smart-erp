# Runbook — Multi-region failover (eu-south-1 → eu-west-1)

> Plan §31.3 Sprint 40. ADR-041. Owner: SRE. Last reviewed: 2026-04-29.

## 1. Trigger conditions

Trigger this runbook when **all** of the following are true:

- The primary region (`eu-south-1`) has been unreachable for > 10 minutes (PagerDuty + Grafana confirm).
- The Aruba / InfoCert Conservazione endpoints in the primary region are also unreachable (rules out a regional-DNS-only issue).
- The on-call engineer has confirmed with the AWS health dashboard that the issue is not a 5-minute glitch.

Do **NOT** trigger on AZ-only outages — the primary region's multi-AZ ALB + RDS handle those automatically.

## 2. Pre-flight checks (T-0)

Before flipping DNS:

1. Verify the `eu-west-1` standby is healthy:
   ```bash
   aws --region eu-west-1 elbv2 describe-target-health --target-group-arn $TG_ARN
   ```
2. Verify the cross-region RDS read-replica lag is < 60 seconds:
   ```bash
   aws --region eu-west-1 cloudwatch get-metric-statistics \
     --namespace AWS/RDS --metric-name ReplicaLag \
     --dimensions Name=DBInstanceIdentifier,Value=smarterp-eu-west-1-replica \
     --start-time $(date -u -d '5 min ago' +%FT%TZ) --end-time $(date -u +%FT%TZ) \
     --period 60 --statistics Maximum
   ```
3. Confirm the synthetic-tenant smoke suite passes against `eu-west-1` ALB directly:
   ```bash
   BASE_URL=https://eu-west-1.api.internal.smarterp.it npm run smoke
   ```

## 3. Promote standby (T+0)

```bash
aws --region eu-west-1 rds promote-read-replica \
  --db-instance-identifier smarterp-eu-west-1-replica
```

Wait for `Available` (~5-10 min). The promoted instance becomes the new primary.

## 4. DNS flip (T+10 min)

Update the Route 53 ALIAS for `api.smarterp.it`:

```bash
aws route53 change-resource-record-sets \
  --hosted-zone-id $ZONE \
  --change-batch file://failover-batch.json
```

The `failover-batch.json` file lives under `infra/dr/failover-batch-eu-west-1.json` (versioned per release).

DNS TTL: 60 seconds. Propagation: typically < 5 minutes globally.

## 5. Validation (T+15 min)

- Run the synthetic-tenant smoke suite against `api.smarterp.it`:
  ```bash
  BASE_URL=https://api.smarterp.it npm run smoke
  ```
- Manual spot check: log in as the demo tenant + create one invoice + verify the audit-log row exists.
- Re-affirm Conservazione versamento: trigger one test versamento and verify the receipt.

## 6. Communication

- Status page update with timestamp + region.
- Customer email if the outage exceeds 30 minutes (per the SLA in MODUS_OPERANDI).
- Post-mortem ticket created with the on-call engineer's name + the trigger timestamp.

## 7. Rollback (when eu-south-1 is restored)

1. Verify `eu-south-1` is healthy via the same pre-flight checks (§2).
2. Set up reverse cross-region replication (`eu-west-1` → `eu-south-1`) and wait for catch-up.
3. Promote `eu-south-1` back to primary; flip DNS again.
4. Re-establish the standard active-passive direction (eu-south-1 primary, eu-west-1 standby).

## 8. Post-incident

- Drill cadence: quarterly, Sprint 47 owns the recurring drill in
  staging.
- Post-mortem template: `docs/post-mortem-template.md`.
- SLA refund eligibility: per MODUS_OPERANDI §15.4 and the customer's
  Enterprise contract.

## References

- ADR-041 — active-passive multi-region.
- AWS Route 53 + RDS cross-region promotion documentation.
- SOC 2 TSC A1.3 — BCP / DR (this runbook is the substantiating evidence).
