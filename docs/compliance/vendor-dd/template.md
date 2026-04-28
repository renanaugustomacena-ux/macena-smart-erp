# Vendor Due Diligence — Template

> NIS2 D.Lgs. 138/2024 art. 25 — supply-chain risk management. SmartERP
> uses this template to substantiate the per-vendor risk assessment for
> every critical third-party supplier (Conservatori AgID, PSD2 banks,
> SDI intermediaries, payment processors, hosting providers).

- **Vendor**: ____________________________________________________
- **Vendor category**: Conservatore AgID / SDI intermediary / Hosting / PSD2 bank / Payment processor / Other
- **Criticality**: P0 / P1 / P2 / P3
- **Engagement owner**: ___________________________________________
- **Date of last review**: ________________________________________
- **Review cadence**: annual / quarterly

## 1. Identity + governance

- Legal entity: ___________________________________________________
- Registered office: ______________________________________________
- DUNS / VAT / fiscal id: _________________________________________
- Public certifications (ISO 27001, ISO 22301, SOC 2, AgID accreditation): ____________________________
- Last audit report on file (date + URL): ________________________

## 2. Data flows

- What SmartERP data does the vendor process? ___________________
- Data classification (per ADR-DA07): public / internal / confidential / restricted
- Data residency (EU member state): _____________________________
- Sub-processors (transitive vendors): __________________________

## 3. Security posture

- Encryption at rest: ____________________________________________
- Encryption in transit: TLS version + cipher suites
- Access controls: MFA mandatory? RBAC granularity? __________
- Audit logs retention: __________________________________________
- Vulnerability management cadence: ______________________________
- Pentest cadence + last report on file (date + URL): __________

## 4. Continuity + DR

- RTO / RPO contracted: __________________________________________
- DR drill cadence: ______________________________________________
- Backup retention: ______________________________________________
- Geographic redundancy (regions): _______________________________

## 5. Incident response

- Notification window for security incidents (hours): __________
- Notification channel (email / phone / portal): ________________
- Escalation matrix: _____________________________________________

## 6. Compliance

- GDPR DPA signed (date): ________________________________________
- Sub-processor list public: yes / no
- Data Subject Request SLA (hours): ______________________________
- AgID accreditation (Conservatori only): yes / no — accreditation id ____
- PSD2 / EBA RTS conformance (banks only): yes / no
- Insurance: cyber liability policy + ceiling: __________________

## 7. Commercial

- Contract value annual: _________________________________________
- Contract auto-renewal: ________________________________________
- Termination clause + notice period: ___________________________
- Exit-data return SLA (days): __________________________________

## 8. Decision

- Approved / Conditional / Rejected: ____________________________
- Conditions (if conditional): __________________________________
- Reviewer: _____________________________________________________
- Sign-off date: ________________________________________________

## 9. Change log

| Date | Reviewer | Change |
|---|---|---|
| | | |
