# Vendor Due Diligence — InfoCert S.p.A. (Conservazione a Norma)

- **Vendor**: InfoCert S.p.A. (Tinexta Group)
- **Vendor category**: Conservatore Accreditato AgID
- **Criticality**: P0 (NIS2 supply-chain risk article 25; ADR-016 second-vendor for Professionale+ tenants)
- **Engagement owner**: CTO + Compliance owner
- **Date of last review**: 2026-04-29
- **Review cadence**: annual

## 1. Identity + governance

- Legal entity: InfoCert S.p.A.
- Registered office: Piazza Sallustio 9, 00187 Roma, Italy
- VAT: IT07945211006
- Public certifications: ISO 27001, ISO 22301, eIDAS QTSP, AgID Conservatore Accreditato.
- Last audit report on file: 2025-Q4 SOC-equivalent attestation; link on file with Compliance.

## 2. Data flows

Identical to Aruba (same FatturaPA + SDI receipts + index metadata).

## 3. Security posture

- Encryption at rest: AES-256, keys in HSM (eIDAS-grade).
- Encryption in transit: TLS 1.2+ on the REST endpoint (`services.infocert.it`).
- Access controls: OAuth 2.0 client-credentials; per-tenant `clientId` + `clientSecret` stored field-level encrypted (ADR-DA07).
- Audit logs retention: 10 years.
- Vulnerability management: monthly patching, quarterly external pentest.

## 4. Continuity + DR

- RTO 4h / RPO 1h.
- DR drill quarterly; SmartERP receives summary annually.
- Geographic redundancy: Italy multi-region.

## 5. Incident response

- Notification window: 24 hours.
- Channel: InfoCert customer portal + named-contact email.

## 6. Compliance

- GDPR DPA signed: 2026-Q2; on file.
- AgID accreditation id: present in the public registry.
- eIDAS QTSP listing: yes.

## 7. Commercial

- Per-document fee: ~€0.07 (2026 list).
- Contract: 12-month auto-renewal; 90-day notice.
- Exit-data return SLA: 30 days.

## 8. Decision

- **Approved** as **secondary** Conservatore for Professionale + Enterprise tenants per ADR-025.
- Conditions: production wiring lands in Sprint 23 (per InfoCert adapter Sunset note); sandbox mode covers contract testing in the interim.
- Reviewer: CTO + Compliance owner
- Sign-off date: 2026-04-29

## 9. Change log

| Date | Reviewer | Change |
|---|---|---|
| 2026-04-29 | Compliance owner | Initial version (Sprint 20, S20.2) |
