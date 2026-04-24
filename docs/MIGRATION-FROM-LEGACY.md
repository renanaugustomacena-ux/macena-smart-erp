# Migration from Legacy ERP — SmartERP

This guide is for customers migrating from Zucchetti, TeamSystem Enterprise, Passepartout, or custom-built ERPs to SmartERP.

---

## 1. Overview

A typical migration takes 4-6 weeks. The sequence is:
1. Discovery: inventory of current data and integrations.
2. Mapping: legacy schema → SmartERP entities.
3. Pilot: subset of data loaded into staging tenant.
4. Parallel run: both systems live, SmartERP shadows.
5. Cutover: decommission legacy.

---

## 2. Data-Mapping Reference

### 2.1 Customers / Anagrafica Clienti

| Legacy field | SmartERP field | Notes |
|--------------|-----------------|-------|
| Codice / Ragione Sociale | `customer.code` / `customer.name` | Reuse legacy code as external key |
| Partita IVA | `customer.vatNumber` | 11 digits |
| Codice Fiscale | `customer.fiscalCode` | 11 or 16 chars |
| Codice SDI / PEC | `customer.sdiDestinationCode` / `pecEmail` | Either must be present for FatturaPA |
| Tipo cliente | `customer.customerType` enum | business / public_administration / individual / foreign |
| Split-payment | `customer.splitPayment` boolean | Typically TRUE for PA |

### 2.2 Prodotti

| Legacy | SmartERP |
|--------|----------|
| SKU / Codice articolo | `product.sku` |
| Descrizione | `product.name` |
| Categoria merceologica | `product.category` enum |
| Prezzo acquisto | `product.unitCost` |
| Prezzo vendita | `product.sellingPrice` |
| Unità di misura | `product.unitOfMeasure` enum (pz, kg, l, m, ...) |
| Barcode EAN | `product.barcode` |
| Scorta minima | `product.minimumStock` |

### 2.3 Fornitori

- Modellati come utenti di dominio (materiali): mettere il nome fornitore in `product.supplier` durante la migrazione v1.
- v2 introdurrà una tabella supplier a sé stante.

### 2.4 Magazzini

| Legacy | SmartERP |
|--------|----------|
| Codice magazzino | `warehouse.code` |
| Denominazione | `warehouse.name` |
| Indirizzo completo | `warehouse.address` + city + postalCode + province |

### 2.5 Giacenze iniziali

Caricate come `StockMovement` di tipo `ADJUSTMENT` con `notes: 'migrazione da legacy'`. Ogni giacenza per (productId, warehouseId) diventa una riga `quantity` con `destinationWarehouseId = warehouseId`.

### 2.6 Piano dei Conti

- SmartERP seed il Piano dei Conti IV Direttiva CEE standard (26 conti).
- Per customer che avevano un PDC custom: aggiungere righe via `POST /api/accounting/accounts` conservando il `code` legacy. Eventuali mapping 1-a-molti li si documenta in un foglio di lavoro.

### 2.7 Prima Nota / Libro Giornale

- `POST /api/accounting/journal-entries` per ciascuna registrazione.
- `reference` = identificatore legacy (per riconciliazione).
- Saldo iniziale: una grande entry di apertura con `description: 'Saldi iniziali migrazione'`, bilanciata.

### 2.8 Fatture storiche

- Caricate come `invoice.status = 'archived'`.
- Mantengono il `number` legacy (non riemettibili).
- L'XML FatturaPA, se già emesso, si carica in `xmlPath` (S3).

---

## 3. Strumenti di migrazione

Fornisci:
- Script Python `migration/legacy_to_smarterp.py` parametrico per CSV-in → SmartERP REST API.
- `migration/schema_map.yaml` — mappa campo-per-campo per ogni ERP supportato.
- `migration/validate.py` — confronta record legacy con SmartERP post-carico.

---

## 4. Checklist di pre-cutover

- [ ] Tutti i clienti caricati con Partita IVA + almeno uno tra Codice SDI / PEC.
- [ ] Tutti i prodotti con SKU unico per tenant.
- [ ] Scorte iniziali caricate e valorizzate.
- [ ] Piano dei Conti completo + saldi iniziali.
- [ ] Almeno un ordine di vendita di test emesso.
- [ ] Almeno una fattura test spedita a SDI (può essere TD01 autofattura).
- [ ] Utenti operativi creati con ruoli corretti (admin, manager, operator, viewer).
- [ ] Backup legacy archiviato offline (cold storage, 10 anni).

---

## 5. Cutover Day

07:00 — snapshot finale legacy.
08:00 — export delta dal giorno precedente.
09:00 — import delta in SmartERP; validate diff.
10:00 — redirect app users to SmartERP URL.
12:00 — smoke test: login, creare ordine, creare fattura, ricevere ricevuta SDI.
15:00 — shutdown read-only del legacy.

Post-cutover: mantenere legacy in read-only per 90 giorni per consultazione; poi decommissionare.

---

## 6. Rollback Plan

Entro 7 giorni dal cutover: il legacy è ancora in read-only + sincronizzato con delta quotidiani. Se SmartERP mostrasse problemi critici, re-point l'ingress al legacy. Oltre 7 giorni, il rollback richiede re-importazione.
