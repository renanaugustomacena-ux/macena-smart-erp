'use client';

import { useEffect, useState } from 'react';
import { createHidScanner } from '../../../lib/barcode/barcode-scanner';

/**
 * Mobile picking screen with optimised path (S19.4).
 *
 * v1 renders a fixed list of pick lines. The path-optimisation hook
 * (`computeOptimisedPath`) is a pluggable function — v1 returns the
 * lines sorted by the `bay` ASCII order, the simplest correct
 * heuristic for a single-aisle warehouse. Sprint 24 swaps it for the
 * real OR-Tools-derived path planner.
 */
type PickLine = {
  id: string;
  productCode: string;
  description: string;
  quantity: number;
  bay: string;
  picked: boolean;
};

const SAMPLE_LINES: PickLine[] = [
  {
    id: '1',
    productCode: '8001234567890',
    description: 'Cuscinetto a sfere 6204',
    quantity: 24,
    bay: 'A-03-02',
    picked: false,
  },
  {
    id: '2',
    productCode: '8001234567906',
    description: 'Vite M8x40 inox',
    quantity: 100,
    bay: 'B-01-04',
    picked: false,
  },
  {
    id: '3',
    productCode: '8001234567913',
    description: 'O-ring 28x4 Viton',
    quantity: 50,
    bay: 'A-05-01',
    picked: false,
  },
];

export function computeOptimisedPath(lines: PickLine[]): PickLine[] {
  return [...lines].sort((a, b) => a.bay.localeCompare(b.bay));
}

export default function PickingPage() {
  const [path, setPath] = useState<PickLine[]>(() =>
    computeOptimisedPath(SAMPLE_LINES),
  );

  useEffect(() => {
    const scanner = createHidScanner();
    scanner.start((code) => {
      setPath((prev) =>
        prev.map((l) =>
          l.productCode === code ? { ...l, picked: true } : l,
        ),
      );
    });
    return () => scanner.stop();
  }, []);

  return (
    <main
      style={{
        minHeight: '100vh',
        padding: '1rem',
        fontFamily: 'system-ui, sans-serif',
        background: '#f8fafc',
      }}
    >
      <h1 style={{ fontSize: '1.4rem', marginBottom: '0.4rem' }}>
        Lista di prelievo
      </h1>
      <p style={{ color: '#475569', marginTop: 0, marginBottom: '1rem' }}>
        Percorso ottimizzato: {path.length} righe.
      </p>
      <ol style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {path.map((l, i) => (
          <li
            key={l.id}
            style={{
              padding: '0.9rem 1rem',
              marginBottom: '0.6rem',
              borderRadius: '10px',
              background: l.picked ? '#dcfce7' : '#fff',
              border: `1px solid ${l.picked ? '#86efac' : '#e2e8f0'}`,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span style={{ fontWeight: 600 }}>
                {i + 1}. {l.bay}
              </span>
              <span style={{ color: '#475569' }}>×{l.quantity}</span>
            </div>
            <div style={{ fontSize: '0.95rem', marginTop: '0.4rem' }}>
              {l.description}
            </div>
            <code
              style={{
                fontSize: '0.85rem',
                color: '#475569',
                display: 'block',
                marginTop: '0.4rem',
              }}
            >
              {l.productCode}
            </code>
          </li>
        ))}
      </ol>
    </main>
  );
}
