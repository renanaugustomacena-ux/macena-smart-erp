'use client';

import { useEffect, useState } from 'react';

/**
 * Audit-explorer (S20.4) — admin-side page to browse the per-tenant
 * `audit_logs` rows. v1 calls /api/compliance/audit; v2 will add
 * filters by user, action, and a date-range picker.
 */
type AuditRow = {
  id: string;
  createdAt: string;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  method: string;
  path: string;
  statusCode: number | null;
  outcome: 'success' | 'failure' | 'denied';
  actorEmail: string | null;
  correlationId: string | null;
};

export default function AuditExplorerPage() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [outcome, setOutcome] = useState<'' | 'success' | 'failure' | 'denied'>('');
  const [action, setAction] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    setError(null);
    try {
      const params = new URLSearchParams();
      if (outcome) params.set('outcome', outcome);
      if (action) params.set('action', action);
      params.set('limit', '200');
      const res = await fetch(`/api/compliance/audit?${params.toString()}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as AuditRow[];
      setRows(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  useEffect(() => {
    void reload();
    // intentionally not subscribing to filter changes — explicit reload
    // gives the operator predictable behaviour at scale.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main
      style={{
        padding: '1.5rem',
        fontFamily: 'system-ui, sans-serif',
        background: '#f8fafc',
        minHeight: '100vh',
      }}
    >
      <h1 style={{ fontSize: '1.6rem', marginBottom: '0.6rem' }}>
        Audit explorer
      </h1>
      <p style={{ color: '#475569', marginTop: 0 }}>
        Tracciato completo delle operazioni del tenant (RFC 7807 + DPCM 3/12/2013).
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void reload();
        }}
        style={{ display: 'flex', gap: '0.6rem', marginBottom: '1rem' }}
      >
        <select
          value={outcome}
          onChange={(e) =>
            setOutcome(
              e.target.value as '' | 'success' | 'failure' | 'denied',
            )
          }
          style={{ padding: '0.5rem' }}
        >
          <option value="">Tutti gli esiti</option>
          <option value="success">success</option>
          <option value="failure">failure</option>
          <option value="denied">denied</option>
        </select>
        <input
          value={action}
          onChange={(e) => setAction(e.target.value)}
          placeholder="action contains…"
          style={{ flex: 1, padding: '0.5rem' }}
        />
        <button
          type="submit"
          style={{
            padding: '0.5rem 1rem',
            background: '#0a3d62',
            color: '#fff',
            border: 0,
            borderRadius: '6px',
          }}
        >
          Aggiorna
        </button>
      </form>

      {error && (
        <p style={{ color: '#b91c1c' }} role="alert">
          Errore: {error}
        </p>
      )}

      <div style={{ overflow: 'auto', background: '#fff', borderRadius: '10px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', background: '#f1f5f9' }}>
              <th style={{ padding: '0.6rem' }}>Quando</th>
              <th style={{ padding: '0.6rem' }}>Action</th>
              <th style={{ padding: '0.6rem' }}>Method</th>
              <th style={{ padding: '0.6rem' }}>Path</th>
              <th style={{ padding: '0.6rem' }}>Status</th>
              <th style={{ padding: '0.6rem' }}>Outcome</th>
              <th style={{ padding: '0.6rem' }}>Attore</th>
              <th style={{ padding: '0.6rem' }}>Correlation</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                style={{ borderTop: '1px solid #e2e8f0', verticalAlign: 'top' }}
              >
                <td style={{ padding: '0.6rem' }}>
                  {new Date(r.createdAt).toISOString().slice(0, 19).replace('T', ' ')}
                </td>
                <td style={{ padding: '0.6rem' }}>
                  <code>{r.action}</code>
                </td>
                <td style={{ padding: '0.6rem' }}>{r.method}</td>
                <td style={{ padding: '0.6rem', maxWidth: '20rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {r.path}
                </td>
                <td style={{ padding: '0.6rem' }}>{r.statusCode ?? '-'}</td>
                <td
                  style={{
                    padding: '0.6rem',
                    color:
                      r.outcome === 'success'
                        ? '#15803d'
                        : r.outcome === 'failure'
                          ? '#b91c1c'
                          : '#92400e',
                  }}
                >
                  {r.outcome}
                </td>
                <td style={{ padding: '0.6rem' }}>{r.actorEmail ?? '-'}</td>
                <td style={{ padding: '0.6rem' }}>
                  {r.correlationId ? <code>{r.correlationId.slice(0, 8)}…</code> : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
