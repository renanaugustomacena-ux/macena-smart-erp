# FatturaPA v1.2.2 XSD Pinning

**Status (2026-04-17):** The consolidation environment could not reach
`https://www.fatturapa.gov.it/` nor `assets.fatturapa.gov.it` at scan time.
The schema download is therefore deferred to the first online deployment.

## Required file

- **Filename:** `Schema_del_file_xml_FatturaPA_v1.2.2.xsd`
- **Authoritative URL:**
  `https://www.fatturapa.gov.it/export/documenti/fatturapa/v1.2.2/Schema_del_file_xml_FatturaPA_versione_1.2.2.xsd`
- **Secondary mirror (Agenzia delle Entrate):**
  Search for "Schema VFPR12" on `https://www.agenziaentrate.gov.it/portale/web/guest/schede/comunicazioni/fatture-e-corrispettivi/fatturapa-schema`.

## Pin procedure (run at production deploy)

```
curl -fsSLo docs/schemas/Schema_del_file_xml_FatturaPA_v1.2.2.xsd \
  https://www.fatturapa.gov.it/export/documenti/fatturapa/v1.2.2/Schema_del_file_xml_FatturaPA_versione_1.2.2.xsd
sha256sum docs/schemas/Schema_del_file_xml_FatturaPA_v1.2.2.xsd \
  | tee docs/schemas/Schema_del_file_xml_FatturaPA_v1.2.2.xsd.sha256
```

Then update `docs/ITALIAN-COMPLIANCE.md §3.3` "SHA-256" column with the captured digest and today's date as the `Accessed` value. Commit both files.

## Runtime XSD validation

```
xmllint --noout --schema docs/schemas/Schema_del_file_xml_FatturaPA_v1.2.2.xsd \
  <generated-invoice>.xml
```

Integrate into the golden-path E2E test (`backend/test/fatturapa.e2e-spec.ts`) as tracked in `docs/TECHNICAL-DEBT.md` item T-12.
