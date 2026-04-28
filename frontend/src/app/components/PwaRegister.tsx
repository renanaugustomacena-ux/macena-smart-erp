'use client';

import { useEffect, useState } from 'react';

/**
 * PwaRegister — registers the service worker (S19.1) and surfaces the
 * native install prompt when the browser fires `beforeinstallprompt`.
 *
 * Mounted once in `app/layout.tsx`. Renders a small "Installa SmartERP"
 * pill in the bottom-right corner when the install prompt is available.
 */
type DeferredEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

export function PwaRegister() {
  const [deferred, setDeferred] = useState<DeferredEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        // No silent failures (R-A05) — log; UX remains operational.
        console.warn('[PwaRegister] service-worker registration failed', err);
      });
    }
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e as DeferredEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (installed || !deferred) return null;

  return (
    <button
      type="button"
      onClick={() => {
        void deferred.prompt();
      }}
      style={{
        position: 'fixed',
        right: '1rem',
        bottom: '1rem',
        background: '#0a3d62',
        color: '#fff',
        padding: '0.6rem 1.1rem',
        borderRadius: '999px',
        border: 0,
        boxShadow: '0 6px 20px rgba(0,0,0,0.18)',
        cursor: 'pointer',
        fontSize: '0.95rem',
        zIndex: 1000,
      }}
      aria-label="Installa SmartERP come app"
    >
      Installa SmartERP
    </button>
  );
}
