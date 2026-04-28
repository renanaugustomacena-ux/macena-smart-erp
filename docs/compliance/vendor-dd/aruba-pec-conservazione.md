# Vendor Due Diligence — Aruba PEC S.p.A. (Conservazione a Norma)

- **Vendor**: Aruba PEC S.p.A.
- **Vendor category**: Conservatore Accreditato AgID
- **Criticality**: P0 (legal 10-year retention + DPCM 3/12/2013 stability requirement).
- **Engagement owner**: CTO + Compliance owner
- **Date of last review**: 2026-04-29
- **Review cadence**: annual

## 1. Identity + governance

- Legal entity: Aruba PEC S.p.A.
- Registered office: Via San Clemente 53, 24036 Ponte San Pietro (BG), Italy
- VAT: IT01879020517
- Public certifications: ISO 27001, ISO 9001, AgID accreditation as Conservatore Accreditato
- Last audit report on file: 2025-09 (annual SOC-equivalent attestation) — link withheld; on file with Compliance owner

## 2. Data flows

- Data processed: FatturaPA XML envelopes + SDI receipts + per-document index metadata + per-versamento bundle hashes (per ADR-016).
- Data classification: confidential.
- Data residency: Italy (Arezzo + Bergamo data centres).
- Sub-processors: none disclosed beyond the contracted infrastructure providers; verified via Aruba's published sub-processor list 2025.

## 3. Security posture

- Encryption at rest: AES-256 with keys managed inside Aruba HSM cluster.
- Encryption in transit: TLS 1.2+ on the SOAP endpoint.
- Access controls: per-tenant credentials issued by Aruba; SmartERP stores them under `tenant.settings.conservazione.aruba` field-level encrypted (ADR-DA07).
- Audit logs retention: 10 years (DPCM 3/12/2013 §8).
- Vulnerability management cadence: monthly internal patching; CVE-driven external testing.
- Pentest cadence: annual; last report 2025-Q4.

## 4. Continuity + DR

- RTO 4h / RPO 1h per Aruba contract addendum 2025.
- DR drill cadence: quarterly (Aruba-side); SmartERP receives drill summary annually.
- Backup retention: 10 years (regulatory).
- Geographic redundancy: Italy multi-region within EU.

## 5. Incident response

- Notification window: 24 hours from confirmed incident (contractual).
- Notification channel: Aruba ticket portal + named-contact email.
- Escalation matrix: Aruba CSM → Aruba security ops → SmartERP CTO + Compliance.

## 6. Compliance

- GDPR DPA signed: 2026-Q1; on file.
- Sub-processor list: published quarterly.
- Data Subject Request SLA: per Aruba's published SLA (≤ 30 days).
- AgID accreditation id: present in the public AgID registry.
- Insurance: cyber liability ceiling per Aruba master agreement (figure on file with Compliance).

## 7. Commercial

- Per-document fee: ~€0.05 (2026 list).
- Contract auto-renewal: yes (12-month term).
- Termination clause: 90-day notice; data handover clause active for 30 days post-termination per DPCM 3/12/2013 stability rule.
- Exit-data return SLA: 30 days for the full archive bundle.

## 8. Decision

- **Approved** as **primary** Conservatore for all SmartERP tenants per ADR-016 + ADR-025.
- Conditions: re-affirmed annually; downgrade triggers if Aruba's regulatory uptime drops below 99.9% in two consecutive quarters.
- Reviewer: CTO + Compliance owner
- Sign-off date: 2026-04-29

## 9. Change log

| Date | Reviewer | Change |
|---|---|---|
| 2026-04-29 | Compliance owner | Initial version (Sprint 20, S20.2) |
