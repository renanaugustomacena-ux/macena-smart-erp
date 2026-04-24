# Commercial Pitch — SmartERP

**Target customer:** PMI manifatturiere italiane (Italian manufacturing SMEs) — 20 to 200 dipendenti, fatturato 3-50 M€ — con sede nel Nord-Est (Verona, Vicenza, Padova, Trento), specializzate in meccanica di precisione, lavorazione metalli, fonderia, stampaggio.

---

## 1. Il Problema

Le PMI manifatturiere italiane usano ancora gestionali degli anni '90 o '00 — Zucchetti, TeamSystem, Passepartout — con licenze on-premise costose, personalizzazioni rigide, aggiornamenti trimestrali pesanti, nessuna integrazione nativa con SDI (FatturaPA sincrona), nessuna API moderna, pochissima mobilità. I costi tipici vanno dai **10.000 € setup + 1.500 €/mese** ai **50.000 € setup + 8.000 €/mese** per 20 utenti, con hardware server dedicato.

Per un proprietario di una fonderia a Mozzecane che deve servire ordini, gestire magazzino, pianificare la produzione, emettere fatture elettroniche alla PA con split-payment e portare la contabilità ordinaria in Piano dei Conti CEE, significa pagare **due professionisti esterni** (commercialista + IT) oltre al canone software.

---

## 2. La Soluzione SmartERP

**Cloud-native, API-first, tenant isolato.** Un unico abbonamento per azienda. Sei moduli:
1. **Magazzino**: prodotti, depositi, movimenti, riservazioni, valorizzazione LIFO/FIFO/media ponderata.
2. **Produzione**: ordini di produzione, bill of materials, avanzamento work-order, efficienza per centro di lavoro.
3. **Vendite**: anagrafica clienti, ordini, DDT, integrazione diretta con magazzino e contabilità.
4. **Contabilità**: Piano dei Conti IV Direttiva CEE, prima nota, bilancio, liquidazione IVA periodica.
5. **Fatturazione Elettronica**: FatturaPA v1.2.2 nativa — emissione TD01-TD28, split payment art. 17-ter, reverse charge art. 17, intracomunitarie, conservazione a norma.
6. **Dashboard**: KPI in tempo reale — fatturato, marginalità, tempo di consegna, efficienza di produzione.

Accesso browser + mobile. **Nessun server da mantenere.** Aggiornamenti continui. API REST e webhook.

---

## 3. Il Differenziatore

- **Italian-first**: tutte le features regolamentari italiane **out of the box** — FatturaPA, split payment, reverse charge, IVA multi-aliquota, Piano dei Conti CEE, LIPE, conservazione a norma.
- **SME-pricing**: €99/utente/mese per il piano Base; €199 per Professionale; Enterprise custom. Setup in < 7 giorni.
- **Cloud-native con tenant isolation garantito**: ogni query è tenant-scoped; security audit-able.
- **API-first**: integra con e-commerce (Shopify, WooCommerce), MES industriali (OPC UA / MQTT), banche (CBI).
- **SLA 99.9%**: contrattuale per Professionale e Enterprise.

---

## 4. ROI

Per una fonderia tipica (30 dipendenti, 12 utenti SmartERP, 8 M€/anno fatturato):
- **Costo legacy stimato**: 30.000 € setup + 48.000 €/anno licenza + 12.000 €/anno IT consultant = **60.000 €/anno** (ammortizzato).
- **Costo SmartERP Professionale**: 12 utenti × 199 € × 12 = **28.656 €/anno**. Nessun setup.
- **Risparmio lordo**: ~31.000 €/anno, o il 52%.
- **Tempo risparmiato amministrazione** (automazione FatturaPA + liquidazione IVA): ~20 h/settimana → un FTE parziale.

---

## 5. Piano di Adozione

| Settimana | Attività |
|-----------|----------|
| 1 | Kickoff, migrazione anagrafiche (clienti, fornitori, prodotti) |
| 2 | Import storico fatture + movimenti magazzino + prima nota |
| 3 | Training amministratori (2 giorni) + operatori (1 giorno/ruolo) |
| 4 | Pilot su 3 operatori + shadow del sistema legacy |
| 5-6 | Estensione a tutti gli utenti; decommissioning legacy |
| 7+ | Go-live completo; support dedicato per il primo mese |

---

## 6. Prova dimostrativa

Richiedi una demo live di 30 minuti: `demo@smarterp.test`. Dataset dimostrativo preconfigurato con **Fonderia Mozzecane SRL** — 10 prodotti, 2 magazzini, 5 clienti incluso un Comune PA con split-payment, 3 ordini di produzione, 5 ordini di vendita, 3 fatture pronte per SDI.

---

## 7. Referenze

*[placeholder: prime 3-5 PMI adottanti, raccolte in fase di onboarding]*
