/**
 * Dashboard catalogue — 40 pre-built dashboards (plan §31.1 Sprint 18 / S18.4).
 *
 * Each dashboard is a manifest: id, persona, title, description, and an
 * ordered list of "widgets". A widget references one of the registered
 * projections (see `projection-registry.service.ts`) and renders its
 * read-model rows in a specified visual form. The frontend is
 * persona-aware — it filters by `persona` to render the home dashboard
 * for the active user.
 *
 * 4 personas × 10 dashboards = 40 entries. Personas mirror plan §4.1.
 */

export type DashboardPersona = 'marco' | 'sara' | 'luca' | 'giulia';

export type DashboardWidgetType =
  | 'kpi'
  | 'time_series'
  | 'top_n'
  | 'bar_per_status'
  | 'table';

export interface DashboardWidget {
  id: string;
  title: string;
  type: DashboardWidgetType;
  projectionId: string;
  /** Optional projection key prefix to filter rows. */
  keyPrefix?: string;
  /** Optional payload field that this widget plots / sums / displays. */
  field?: string;
  /** Limit for top-N widgets. */
  limit?: number;
}

export interface DashboardManifest {
  id: string;
  persona: DashboardPersona;
  title: string;
  description: string;
  widgets: DashboardWidget[];
}

export const DASHBOARD_CATALOG: ReadonlyArray<DashboardManifest> = [
  // ─── Marco — Titolare ──────────────────────────────────────
  {
    id: 'marco/revenue_overview',
    persona: 'marco',
    title: 'Andamento fatturato',
    description: 'Fatturato mensile, IVA, marginalità.',
    widgets: [
      {
        id: 'rev_monthly',
        title: 'Fatturato mensile',
        type: 'time_series',
        projectionId: 'monthly_invoice_totals',
        field: 'totalCents',
      },
      {
        id: 'iva_monthly',
        title: 'IVA periodica',
        type: 'time_series',
        projectionId: 'iva_periodic_balance',
        field: 'balanceCents',
      },
    ],
  },
  {
    id: 'marco/top_customers',
    persona: 'marco',
    title: 'Top clienti YTD',
    description: 'I 10 clienti per fatturato YTD.',
    widgets: [
      {
        id: 'cust_top10',
        title: 'Top 10 clienti',
        type: 'top_n',
        projectionId: 'customer_revenue_ranking',
        field: 'totalCents',
        limit: 10,
      },
    ],
  },
  {
    id: 'marco/top_suppliers',
    persona: 'marco',
    title: 'Top fornitori YTD',
    description: 'I 10 fornitori per spesa YTD.',
    widgets: [
      {
        id: 'sup_top10',
        title: 'Top 10 fornitori',
        type: 'top_n',
        projectionId: 'supplier_spend_ranking',
        field: 'totalCents',
        limit: 10,
      },
    ],
  },
  {
    id: 'marco/pipeline',
    persona: 'marco',
    title: 'Pipeline vendite',
    description: 'Stati preventivi + valore totale.',
    widgets: [
      {
        id: 'pipeline_status',
        title: 'Preventivi per stato',
        type: 'bar_per_status',
        projectionId: 'quotation_pipeline_summary',
        field: 'totalCents',
      },
    ],
  },
  {
    id: 'marco/intrastat',
    persona: 'marco',
    title: 'Intrastat',
    description: 'Cessioni e acquisti intracomunitari per mese.',
    widgets: [
      {
        id: 'intra_monthly',
        title: 'Intrastat mensile',
        type: 'time_series',
        projectionId: 'intrastat_monthly_summary',
        field: 'cessioniValueCents',
      },
    ],
  },
  {
    id: 'marco/iva_balance',
    persona: 'marco',
    title: 'Liquidazione IVA',
    description: 'Bilancio IVA mensile (vendite - acquisti).',
    widgets: [
      {
        id: 'iva_balance',
        title: 'IVA da versare/credito',
        type: 'time_series',
        projectionId: 'iva_periodic_balance',
        field: 'balanceCents',
      },
    ],
  },
  {
    id: 'marco/ddt_flow',
    persona: 'marco',
    title: 'DDT mensili',
    description: 'Flusso DDT per mese e stato.',
    widgets: [
      {
        id: 'ddt_monthly',
        title: 'DDT per stato',
        type: 'bar_per_status',
        projectionId: 'ddt_throughput',
      },
    ],
  },
  {
    id: 'marco/hr_overview',
    persona: 'marco',
    title: 'Costo del lavoro (snapshot)',
    description: 'Ore lavorate aggregate.',
    widgets: [
      {
        id: 'hr_workedhours',
        title: 'Ore lavorate / mese',
        type: 'time_series',
        projectionId: 'employee_attendance_summary',
        field: 'workedHours',
      },
    ],
  },
  {
    id: 'marco/leave_overview',
    persona: 'marco',
    title: 'Ferie + permessi pendenti',
    description: 'Saldo ferie + permessi, pendenti vs approvati.',
    widgets: [
      {
        id: 'leave_balance',
        title: 'Saldo ferie + permessi',
        type: 'table',
        projectionId: 'leave_balance_summary',
      },
    ],
  },
  {
    id: 'marco/inventory',
    persona: 'marco',
    title: 'Magazzino — snapshot',
    description: 'Valore + giacenze magazzino corrente.',
    widgets: [
      {
        id: 'inv_snapshot',
        title: 'Giacenze per magazzino',
        type: 'table',
        projectionId: 'inventory_stock_snapshot',
      },
    ],
  },

  // ─── Sara — Admin / Contabilità ────────────────────────────
  ...(['sara'] as const).flatMap((persona) =>
    [
      {
        id: 'sara/iva_close',
        title: 'Chiusura IVA mensile',
        description: 'Bilancio IVA per chiusura periodica.',
        projectionId: 'iva_periodic_balance',
        widgetField: 'balanceCents',
        widgetType: 'time_series' as DashboardWidgetType,
      },
      {
        id: 'sara/sales_recap',
        title: 'Riepilogo vendite',
        description: 'Fatturato + IVA per mese.',
        projectionId: 'monthly_invoice_totals',
        widgetField: 'totalCents',
        widgetType: 'time_series' as DashboardWidgetType,
      },
      {
        id: 'sara/purchases_recap',
        title: 'Riepilogo acquisti',
        description: 'Fatture passive per mese.',
        projectionId: 'monthly_supplier_invoice_totals',
        widgetField: 'totalCents',
        widgetType: 'time_series' as DashboardWidgetType,
      },
      {
        id: 'sara/customers_top',
        title: 'Clienti per fatturato',
        description: 'Top clienti.',
        projectionId: 'customer_revenue_ranking',
        widgetField: 'totalCents',
        widgetType: 'top_n' as DashboardWidgetType,
      },
      {
        id: 'sara/suppliers_top',
        title: 'Fornitori per spesa',
        description: 'Top fornitori.',
        projectionId: 'supplier_spend_ranking',
        widgetField: 'totalCents',
        widgetType: 'top_n' as DashboardWidgetType,
      },
      {
        id: 'sara/intrastat_period',
        title: 'Intrastat periodica',
        description: 'Aggregato Intrastat mensile.',
        projectionId: 'intrastat_monthly_summary',
        widgetField: 'cessioniValueCents',
        widgetType: 'time_series' as DashboardWidgetType,
      },
      {
        id: 'sara/quotation_pipeline',
        title: 'Pipeline preventivi',
        description: 'Stati preventivi.',
        projectionId: 'quotation_pipeline_summary',
        widgetField: 'totalCents',
        widgetType: 'bar_per_status' as DashboardWidgetType,
      },
      {
        id: 'sara/ddt_flow',
        title: 'Flusso DDT',
        description: 'DDT per stato e mese.',
        projectionId: 'ddt_throughput',
        widgetField: undefined,
        widgetType: 'bar_per_status' as DashboardWidgetType,
      },
      {
        id: 'sara/leave_pending',
        title: 'Ferie pendenti',
        description: 'Permessi e ferie da approvare.',
        projectionId: 'leave_balance_summary',
        widgetField: 'pendingDays',
        widgetType: 'table' as DashboardWidgetType,
      },
      {
        id: 'sara/inventory_value',
        title: 'Valore magazzino',
        description: 'Snapshot giacenze.',
        projectionId: 'inventory_stock_snapshot',
        widgetField: 'quantity',
        widgetType: 'table' as DashboardWidgetType,
      },
    ].map<DashboardManifest>((row) => ({
      id: row.id,
      persona,
      title: row.title,
      description: row.description,
      widgets: [
        {
          id: row.id.split('/')[1],
          title: row.title,
          type: row.widgetType,
          projectionId: row.projectionId,
          field: row.widgetField,
          limit: row.widgetType === 'top_n' ? 10 : undefined,
        },
      ],
    })),
  ),

  // ─── Luca — Produzione ─────────────────────────────────────
  ...(['luca'] as const).flatMap((persona) =>
    [
      {
        id: 'luca/inventory_snapshot',
        title: 'Snapshot magazzino',
        description: 'Giacenze correnti.',
        projectionId: 'inventory_stock_snapshot',
        widgetType: 'table' as DashboardWidgetType,
      },
      {
        id: 'luca/ddt_outbound',
        title: 'DDT in uscita',
        description: 'Flusso DDT outbound.',
        projectionId: 'ddt_throughput',
        widgetType: 'bar_per_status' as DashboardWidgetType,
      },
      {
        id: 'luca/work_orders_volume',
        title: 'Volume produttivo',
        description: 'Carico produttivo mensile (proxy: DDT throughput).',
        projectionId: 'ddt_throughput',
        widgetType: 'time_series' as DashboardWidgetType,
      },
      {
        id: 'luca/quotation_demand',
        title: 'Domanda da preventivi',
        description: 'Pipeline da pre-vendita.',
        projectionId: 'quotation_pipeline_summary',
        widgetType: 'bar_per_status' as DashboardWidgetType,
      },
      {
        id: 'luca/team_attendance',
        title: 'Presenze team',
        description: 'Ore lavorate / mese.',
        projectionId: 'employee_attendance_summary',
        widgetType: 'time_series' as DashboardWidgetType,
      },
      {
        id: 'luca/leave_planner',
        title: 'Pianificazione ferie',
        description: 'Saldo permessi/ferie.',
        projectionId: 'leave_balance_summary',
        widgetType: 'table' as DashboardWidgetType,
      },
      {
        id: 'luca/customer_spend',
        title: 'Top clienti',
        description: 'Per pianificare priorità produttive.',
        projectionId: 'customer_revenue_ranking',
        widgetType: 'top_n' as DashboardWidgetType,
      },
      {
        id: 'luca/supplier_spend',
        title: 'Spesa fornitori',
        description: 'Per gestire approvvigionamenti.',
        projectionId: 'supplier_spend_ranking',
        widgetType: 'top_n' as DashboardWidgetType,
      },
      {
        id: 'luca/sales_total',
        title: 'Fatturato vendite',
        description: 'Trend per pianificazione.',
        projectionId: 'monthly_invoice_totals',
        widgetType: 'time_series' as DashboardWidgetType,
      },
      {
        id: 'luca/purchase_total',
        title: 'Spesa acquisti',
        description: 'Trend acquisti / pianificazione MRP.',
        projectionId: 'monthly_supplier_invoice_totals',
        widgetType: 'time_series' as DashboardWidgetType,
      },
    ].map<DashboardManifest>((row) => ({
      id: row.id,
      persona,
      title: row.title,
      description: row.description,
      widgets: [
        {
          id: row.id.split('/')[1],
          title: row.title,
          type: row.widgetType,
          projectionId: row.projectionId,
          limit: row.widgetType === 'top_n' ? 10 : undefined,
        },
      ],
    })),
  ),

  // ─── Giulia — Magazzino / Logistics ───────────────────────
  ...(['giulia'] as const).flatMap((persona) =>
    [
      {
        id: 'giulia/stock_snapshot',
        title: 'Giacenze per magazzino',
        description: 'Snapshot stock (warehouse × prodotto).',
        projectionId: 'inventory_stock_snapshot',
        widgetType: 'table' as DashboardWidgetType,
      },
      {
        id: 'giulia/ddt_pipeline',
        title: 'Pipeline DDT',
        description: 'DDT in transito / consegnati.',
        projectionId: 'ddt_throughput',
        widgetType: 'bar_per_status' as DashboardWidgetType,
      },
      {
        id: 'giulia/customer_priority',
        title: 'Priorità clienti',
        description: 'Top clienti per fatturato.',
        projectionId: 'customer_revenue_ranking',
        widgetType: 'top_n' as DashboardWidgetType,
      },
      {
        id: 'giulia/purchases_history',
        title: 'Storico acquisti',
        description: 'Andamento acquisti.',
        projectionId: 'monthly_supplier_invoice_totals',
        widgetType: 'time_series' as DashboardWidgetType,
      },
      {
        id: 'giulia/team_attendance',
        title: 'Presenze magazzino',
        description: 'Ore di reparto.',
        projectionId: 'employee_attendance_summary',
        widgetType: 'time_series' as DashboardWidgetType,
      },
      {
        id: 'giulia/leave_team',
        title: 'Ferie team',
        description: 'Pianificazione ferie reparto.',
        projectionId: 'leave_balance_summary',
        widgetType: 'table' as DashboardWidgetType,
      },
      {
        id: 'giulia/quotation_signal',
        title: 'Segnale preventivi',
        description: 'Pipeline preventivi (quanti accettati = preparare merce).',
        projectionId: 'quotation_pipeline_summary',
        widgetType: 'bar_per_status' as DashboardWidgetType,
      },
      {
        id: 'giulia/intrastat',
        title: 'Movimenti intra-EU',
        description: 'Cessioni intracomunitarie.',
        projectionId: 'intrastat_monthly_summary',
        widgetType: 'time_series' as DashboardWidgetType,
      },
      {
        id: 'giulia/sales_trend',
        title: 'Trend vendite',
        description: 'Per anticipare carichi spedizione.',
        projectionId: 'monthly_invoice_totals',
        widgetType: 'time_series' as DashboardWidgetType,
      },
      {
        id: 'giulia/iva_balance',
        title: 'Bilancio IVA',
        description: 'Per allineamento con Sara.',
        projectionId: 'iva_periodic_balance',
        widgetType: 'time_series' as DashboardWidgetType,
      },
    ].map<DashboardManifest>((row) => ({
      id: row.id,
      persona,
      title: row.title,
      description: row.description,
      widgets: [
        {
          id: row.id.split('/')[1],
          title: row.title,
          type: row.widgetType,
          projectionId: row.projectionId,
          limit: row.widgetType === 'top_n' ? 10 : undefined,
        },
      ],
    })),
  ),
];
