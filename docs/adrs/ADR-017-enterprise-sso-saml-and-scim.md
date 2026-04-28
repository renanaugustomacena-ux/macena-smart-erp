# ADR-017 — Enterprise SSO via SAML 2.0 + SCIM 2.0

- **Status**: Accepted 2026-04-29 (Sprint 22, S22.4)
- **Date**: 2026-04-29
- **Owner**: CTO + Identity owner

## Context

Enterprise tenants (per ADR-001's commercial tier) and Professionale tenants with a Federico-class IT lead require single sign-on against their corporate identity provider (Okta, Azure AD, Google Workspace) and automated user-lifecycle provisioning (joiners / movers / leavers). The local-password flow does not scale for an organisation with > 25 employees and a managed AD/Entra ID rolling.

NIS2 D.Lgs. 138/2024 art. 24 + the platform's Sprint 20 NIS2 Compliance Pack require MFA for admin roles. Federated identity from an IdP that already enforces MFA satisfies this without SmartERP rolling its own MFA layer (ADR-013 deferred).

## Decision

The platform supports two complementary protocols per tenant:

- **SAML 2.0 (SP-initiated + IdP-initiated)** — the user-facing sign-in flow. SmartERP's Service Provider validates a signed SAMLResponse from the tenant's IdP, parses the canonical attributes (email, displayName, role) and issues a SmartERP JWT for the resolved Membership.
- **SCIM 2.0** — the automated provisioning protocol. The IdP creates / updates / deactivates SmartERP user accounts via `/scim/v2/tenants/:tenantId/Users` using an opaque per-tenant bearer token, rotated through the SSO config screen.

Configuration lives on a per-tenant `sso_configs` row (one per protocol; ADR-DA07 field-level encryption for IdP cert + bearer-token hash). Status is tri-state (`pending` → `active` → `paused`) so a tenant admin can stage the configuration before flipping it on.

Implementation notes:

- SAML strategy is a thin platform-side validator (`SamlStrategy`). v1 ships a stdlib-based signature verifier that is sufficient for the IdPs the SmartERP cohort uses (signed SAMLResponses with RSA-SHA256). The release branch adds `passport-saml` for full XML-DSig conformance — one-file swap behind the same port.
- SCIM bearer tokens are stored as sha-256 hashes; the plaintext is returned to the tenant admin on rotation and never logged. Verification uses a constant-time compare.
- **Break-glass admin** (S22.6) is a per-tenant always-allowed local-password account. It is heavily audited and rotated monthly per the Compliance runbook. The break-glass email lives on the SSO config row (`breakGlassEmail` + `breakGlassRotatedAt`).
- JIT user provisioning happens on first SAML login if the assertion's email maps to a non-existent SmartERP user. The new user inherits `defaultRole` from the tenant's SSO config row; further role changes flow through SCIM.

## Consequences

- Positive:
  - Enterprise tenants integrate without bespoke engineering.
  - The IdP enforces MFA — SmartERP inherits the satisfaction of NIS2 art. 24.
  - User lifecycle is automated end-to-end (Okta-side termination → SmartERP-side deactivation within the SCIM polling window).
  - Break-glass account provides a documented, audited recovery path for IdP outages.
- Negative:
  - SAML XML parsing is one of the higher-risk attack surfaces in any SSO implementation. Mitigation: pin to a signed-assertion-only path (no signed-response-only path); pin to RSA-SHA256; no fallback algorithms; pre-prod fuzz testing in Sprint 23.
  - SCIM bearer tokens are valuable secrets — rotation discipline depends on the tenant admin. Mitigation: SCIM token TTL alert at 12 months in the Compliance dashboard.
- Neutral:
  - Tenants on Base tier do not get SSO; the local-password flow remains. ADR-001 + the commercial tier matrix unchanged.

## Alternatives considered

- **OIDC instead of SAML**: deferred. OIDC is a better fit for SaaS-class consumers but the Italian SME IdP estate (Azure AD F1, Google Workspace, Okta-enterprise) already speaks SAML 2.0 fluently. ADR-018 (deferred) re-evaluates OIDC at €10M annual revenue.
- **Just-in-time provisioning only (no SCIM)**: rejected — termination becomes manual, which fails the NIS2 lifecycle requirement.
- **Off-the-shelf SSO platform (WorkOS, Frontegg)**: rejected for v1 — adds a vendor dependency the v1 budget does not justify. Reconsider at €1M annual revenue if the maintenance burden exceeds the platform margin.

## References

- Plan §31.1 Sprint 22 (S22.1 SAML strategy; S22.3 SCIM controller; S22.4 this ADR; S22.5 SSO config screen; S22.6 break-glass).
- ADR-001 — multi-tenant cloud posture.
- ADR-007 — JWT RS256 with refresh rotation (the JWT minted post-SAML).
- ADR-013 (deferred) — MFA layer; SAML-IdP MFA satisfies the NIS2 art. 24 obligation in the interim.
- ADR-DA07 — field-level encryption (used for the IdP cert + the SCIM bearer-token hash + the break-glass email).
- D.Lgs. 138/2024 (NIS2) art. 24 — security measures including authentication.
- RFC 7522 — SAML 2.0 for OAuth 2.0 client authentication (forward-compatibility note).
- RFC 7644 — SCIM 2.0 protocol.
- IETF XML-DSig (RFC 3275 / W3C XML Signature recommendation).
