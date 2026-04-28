'use client';

import { useState } from 'react';

/**
 * Per-screen AI Copilot sidebar (plan §31.2 Sprint 27 / S27.1).
 *
 * Mounts as a slide-in panel on the right side of the screen. Persona
 * is selected based on the active route (router-aware in v2; v1 keeps
 * `sara` as the default + a manual selector).
 */
type Persona = 'sara' | 'marco' | 'luca' | 'giulia' | 'andrea';

export function CopilotSidebar({ defaultPersona = 'sara' }: { defaultPersona?: Persona }) {
  const [open, setOpen] = useState(false);
  const [persona, setPersona] = useState<Persona>(defaultPersona);
  const [optedIn, setOptedIn] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('smarterp.copilotOptIn') === 'true';
  });
  const [messages, setMessages] = useState<
    Array<{ from: 'user' | 'assistant'; text: string }>
  >([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);

  async function send() {
    if (!input.trim() || busy) return;
    const text = input.trim();
    setInput('');
    setBusy(true);
    setMessages((prev) => [...prev, { from: 'user', text }]);
    try {
      const res = await fetch('/api/ai-copilot/ask', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, persona }),
      });
      const data = (await res.json()) as { output: string };
      setMessages((prev) => [
        ...prev,
        { from: 'assistant', text: data.output },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { from: 'assistant', text: `Errore: ${String(err)}` },
      ]);
    } finally {
      setBusy(false);
    }
  }

  function optIn() {
    localStorage.setItem('smarterp.copilotOptIn', 'true');
    setOptedIn(true);
  }

  if (!optedIn) {
    return (
      <button
        type="button"
        onClick={optIn}
        style={{
          position: 'fixed',
          right: '1rem',
          bottom: '4.4rem',
          background: '#0a3d62',
          color: '#fff',
          padding: '0.6rem 1rem',
          borderRadius: '999px',
          border: 0,
          fontSize: '0.92rem',
          cursor: 'pointer',
          zIndex: 1000,
        }}
        aria-label="Attiva il Copilot AI per questo tenant"
      >
        Attiva Copilot AI
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          position: 'fixed',
          right: '1rem',
          bottom: '4.4rem',
          background: '#0a3d62',
          color: '#fff',
          padding: '0.6rem 1rem',
          borderRadius: '999px',
          border: 0,
          fontSize: '0.92rem',
          cursor: 'pointer',
          zIndex: 1000,
        }}
        aria-expanded={open}
      >
        {open ? 'Chiudi Copilot' : 'Copilot AI'}
      </button>
      {open && (
        <aside
          role="dialog"
          aria-label="Copilot AI"
          style={{
            position: 'fixed',
            right: '1rem',
            bottom: '8.5rem',
            width: '360px',
            maxHeight: '70vh',
            background: '#fff',
            border: '1px solid #cbd5e1',
            borderRadius: '12px',
            boxShadow: '0 12px 36px rgba(0,0,0,0.24)',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 1001,
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <header
            style={{
              padding: '0.8rem 1rem',
              borderBottom: '1px solid #e2e8f0',
              fontWeight: 600,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span>Copilot AI</span>
            <select
              value={persona}
              onChange={(e) => setPersona(e.target.value as Persona)}
              style={{ fontSize: '0.85rem' }}
            >
              <option value="sara">Sara</option>
              <option value="marco">Marco</option>
              <option value="luca">Luca</option>
              <option value="giulia">Giulia</option>
              <option value="andrea">Andrea</option>
            </select>
          </header>
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '0.8rem',
              fontSize: '0.92rem',
            }}
          >
            {messages.length === 0 && (
              <p style={{ color: '#64748b' }}>
                Scrivi una domanda. Il Copilot risponde in italiano + chiama i
                tool tenant-scoped quando serve.
              </p>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                style={{
                  marginBottom: '0.6rem',
                  textAlign: m.from === 'user' ? 'right' : 'left',
                }}
              >
                <span
                  style={{
                    display: 'inline-block',
                    padding: '0.5rem 0.8rem',
                    borderRadius: '8px',
                    background: m.from === 'user' ? '#dbeafe' : '#f1f5f9',
                    maxWidth: '85%',
                  }}
                >
                  {m.text}
                </span>
              </div>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
            style={{
              borderTop: '1px solid #e2e8f0',
              padding: '0.6rem',
              display: 'flex',
              gap: '0.4rem',
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Domanda…"
              style={{
                flex: 1,
                padding: '0.5rem',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
              }}
            />
            <button
              type="submit"
              disabled={busy}
              style={{
                padding: '0.5rem 0.9rem',
                background: '#0a3d62',
                color: '#fff',
                border: 0,
                borderRadius: '6px',
                cursor: busy ? 'not-allowed' : 'pointer',
              }}
            >
              {busy ? '...' : 'Invia'}
            </button>
          </form>
        </aside>
      )}
    </>
  );
}
