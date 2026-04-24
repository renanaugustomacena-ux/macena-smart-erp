# Demo Script (30 min) — SmartERP

**Stack pre-requisito:** docker compose up; seed eseguito.
**Tenant demo:** Fonderia Mozzecane SRL (P.IVA 02345678901).
**Utente demo:** `admin@fonderia-mozzecane.test` / `FonderiaMozzecane2026!` (rotare in produzione).

---

## 0. Introduzione (3 min)

> Oggi ti mostro SmartERP con un profilo realistico: Fonderia Mozzecane SRL, 30 dipendenti, produce valvole in ottone, ha due magazzini — uno principale a Mozzecane e un satellite a Verona. Clienti tipici: meccanica scaligera, un Comune in regime split-payment, un cliente tedesco in reverse charge.

Apri `http://localhost:3000`.

---

## 1. Login & Dashboard (2 min)

Login con le credenziali demo. La dashboard mostra i KPI del giorno: fatturato aperto, ordini in produzione, ordini in ritardo, livello di magazzino basso, prossima scadenza fiscale. *"Tutto questo è tenant-isolato: un altro utente di un'altra azienda, anche se attacca l'URL, riceve 403."*

---

## 2. Magazzino — Catalogo e Riservazioni (5 min)

Apri "Magazzino → Prodotti". Visualizza i 10 SKU precaricati: materie prime (Acciaio Inox, Alluminio, Ottone), semilavorati, prodotti finiti, consumabili, ricambi. Spiega la classificazione ABC per rotazione.

Apri "Magazzino → Movimenti". Mostra i 20 movimenti di seed — inbound, outbound, trasferimenti fra i due depositi, aggiustamenti. Clicca un movimento per vedere il dettaglio: ogni riga ha `referenceNumber`, `performedBy`, `unitCostAtTime` (valorizzazione puntuale).

Torna alla lista prodotti, filtra per `category=FINISHED_PRODUCT`, apri "Valvola A100". Clicca "Registra movimento" → **Inbound 100 pezzi a magazzino MAG-01**. Il saldo `quantityOnHand` si aggiorna live.

---

## 3. Vendite — Crea Ordine e Riserva Stock (5 min)

Apri "Vendite → Clienti". Mostra i 5 clienti, evidenzia:
- **CUST-001 Meccanica Scaligera SRL** — B2B ordinario.
- **CUST-002 Comune di Mozzecane** — PA, `splitPayment=true`.
- **CUST-005 Technik Handel GmbH** — B2B intra-UE, `country=DE`, `defaultIvaRate=0` (reverse charge art. 17).

Crea un nuovo ordine per Meccanica Scaligera: 20 pezzi di Valvola A100 a €89 + 50 Connettori K8 a €7.50. `POST /api/sales/orders` → subtotale €2.155 + IVA €474,10 = **€2.629,10**. Stato DRAFT.

Clicca "Conferma ordine". Il backend, in una transazione, **riserva stock** nel magazzino principale. `quantityReserved` delle due SKU aumenta. Se lo stock non fosse sufficiente, il confirm fallisce atomicamente.

Mostra in Magazzino che `quantityReserved` è ora > 0 e `quantityOnHand - quantityReserved` (available) è diminuito.

---

## 4. Produzione — Ordine con BOM Expansion (5 min)

Apri "Produzione → Ordini". Mostra i 3 ordini di produzione precaricati. Apri `PO-2026-00002` (Pompa P50, 80 pz, CONFIRMED).

Mostra il **Bill of Materials**: Alluminio 6061 (3,5 kg/pz) + 2 Cuscinetti 6205 per pezzo. Totale per batch: 280 kg alluminio + 160 cuscinetti.

Cambia stato a `IN_PROGRESS`. Il backend **espande il BOM** e scala lo stock: 280 kg alluminio → movimento `PRODUCTION_CONSUMPTION` registrato; `quantityOnHand` aggiornato. Se non c'è stock, transazione rolled-back.

---

## 5. Contabilità — Fattura Elettronica PA (5 min)

Apri "Contabilità → Fatture". Vedi le 3 fatture seed:
1. `000001/2026` — fattura TD01 a Meccanica Scaligera, IVA 22%, stato ACCEPTED.
2. `000002/2026` — fattura TD01 al Comune di Mozzecane, **split-payment**, `taxAmount=0` nel totale pagabile.
3. `000003/2026` — fattura TD01 a Technik Handel, reverse charge intra-UE, `ivaNature=N6.1`.

Clicca la #000002 → **"Genera FatturaPA XML"**. Il backend produce un file `IT02345678901_{progressivo}.xml`. Apri l'XML: mostra `<EsigibilitaIVA>S</EsigibilitaIVA>` (split), i campi `<CedentePrestatore>` con P.IVA del fornitore, `<CessionarioCommittente>` con Codice Fiscale del Comune, `<DatiTrasmissione><CodiceDestinatario>UFXE7W</CodiceDestinatario>`.

*"Questo XML è conforme al formato FatturaPA v1.2.2 dell'Agenzia delle Entrate. Può essere inoltrato al SDI."*

Click "Accetta" sulla prima fattura → il backend **auto-posta in partita doppia**: Crediti v/Clienti DR €1.085,80 vs Ricavi CR €890 + IVA a debito CR €195,80. Mostra l'entry nel libro giornale.

---

## 6. Prima Nota & Liquidazione IVA (3 min)

Apri "Contabilità → Libro Giornale". Vedi le 50 righe di prima nota seed + le nuove registrazioni auto-generate. Filtra per giornale `vendite`.

Apri "Contabilità → Liquidazione IVA" → seleziona il mese corrente. Il backend aggrega le fatture ACCEPTED per aliquota: **IVA 22% imponibile €890, imposta €195,80**. Le righe di Technik Handel (reverse charge) e del Comune (split-payment) non contribuiscono alla liquidazione.

---

## 7. API e Integrazioni (2 min)

Apri Swagger UI a `http://localhost:3001/api/docs`. Mostra:
- `POST /api/auth/login` — access + refresh token.
- `POST /api/sales/orders` — Bearer auth required.
- `GET /api/accounting/invoices` — paginato + filtrabile per stato.
- `GET /metrics` — Prometheus scraping per osservabilità.

*"Ogni endpoint è documentato, versionato, tenant-scoped, rate-limited."*

---

## 8. Chiusura & Q&A (remaining)

Torna alla dashboard. Chiedi cosa vorrebbe vedere in più: Shopify? Bonifici CBI? Quadratura banca?

Offri la prova gratuita 14 giorni: la sua azienda come tenant, migrazione di un campione di anagrafiche, training 1-a-1.
