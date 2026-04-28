'use client';

import { useEffect, useRef, useState } from 'react';
import { createHidScanner } from '../../../lib/barcode/barcode-scanner';

/**
 * Operator workstation — full-screen mobile-first page (S19.2).
 *
 * Designed for an operator at a single linea/posto-lavoro. The page
 * runs full-screen via the PWA `display: standalone` manifest, listens
 * for barcode scans (HID by default), and surfaces the last 5 scans
 * with their resolved meaning.
 *
 * v1 keeps the resolver as a thin REST call against /api/inventory; the
 * scan-to-WO-progress flow lives on the next page (`/mobile/work-order`).
 */
export default function OperatorPage() {
  const [scans, setScans] = useState<
    Array<{ code: string; at: string; status: 'pending' | 'ok' | 'error' }>
  >([]);
  const scannerRef = useRef<ReturnType<typeof createHidScanner> | null>(null);

  useEffect(() => {
    const scanner = createHidScanner();
    scannerRef.current = scanner;
    scanner.start((code) => {
      setScans((prev) => [
        { code, at: new Date().toISOString(), status: 'pending' },
        ...prev.slice(0, 4),
      ]);
    });
    return () => scanner.stop();
  }, []);

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#0a3d62',
        color: '#fff',
        padding: '1.2rem',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
      }}
    >
      <header style={{ marginBottom: '1.2rem' }}>
        <h1 style={{ fontSize: '1.6rem', margin: 0 }}>Postazione operatore</h1>
        <p style={{ margin: '0.4rem 0 0', opacity: 0.78 }}>
          Scansiona un codice per avviare un&apos;operazione di linea.
        </p>
      </header>

      <section
        style={{
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.18)',
          borderRadius: '12px',
          padding: '1.2rem',
          textAlign: 'center',
          marginBottom: '1.2rem',
        }}
        aria-live="polite"
      >
        {scans.length === 0 ? (
          <p style={{ fontSize: '1.05rem' }}>
            In attesa di una scansione…
          </p>
        ) : (
          <p style={{ fontSize: '1.4rem', fontWeight: 600, margin: 0 }}>
            Ultimo codice: <code>{scans[0].code}</code>
          </p>
        )}
      </section>

      <h2 style={{ fontSize: '1rem', textTransform: 'uppercase', opacity: 0.7 }}>
        Storico (ultime 5 scansioni)
      </h2>
      <ol
        style={{
          listStyle: 'none',
          padding: 0,
          margin: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: '0.6rem',
        }}
      >
        {scans.map((s) => (
          <li
            key={`${s.code}-${s.at}`}
            style={{
              background: 'rgba(255,255,255,0.08)',
              padding: '0.8rem 1rem',
              borderRadius: '8px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <code style={{ fontSize: '1rem' }}>{s.code}</code>
            <span style={{ opacity: 0.7, fontSize: '0.85rem' }}>
              {s.at.slice(11, 19)} UTC · {s.status}
            </span>
          </li>
        ))}
      </ol>
    </main>
  );
}
