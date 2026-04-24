'use client';

import { useState } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import DashboardCard from './components/DashboardCard';

interface ModuleInfo {
  title: string;
  description: string;
  icon: string;
  href: string;
  color: string;
  stats: { label: string; value: string }[];
}

const modules: ModuleInfo[] = [
  {
    title: 'Produzione',
    description:
      'Gestione ordini di produzione, cicli di lavoro e pianificazione della capacita produttiva.',
    icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
    href: '/produzione',
    color: 'from-blue-500 to-blue-600',
    stats: [
      { label: 'Ordini Attivi', value: '24' },
      { label: 'Efficienza', value: '87%' },
    ],
  },
  {
    title: 'Magazzino',
    description:
      'Controllo scorte in tempo reale, movimentazioni, inventario e gestione multi-magazzino.',
    icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
    href: '/magazzino',
    color: 'from-emerald-500 to-emerald-600',
    stats: [
      { label: 'Prodotti', value: '1.247' },
      { label: 'Valore', value: '€342K' },
    ],
  },
  {
    title: 'Contabilita',
    description:
      'Fatturazione elettronica, prima nota, scadenzario e integrazione con il commercialista.',
    icon: 'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z',
    href: '/contabilita',
    color: 'from-amber-500 to-amber-600',
    stats: [
      { label: 'Fatture Mese', value: '156' },
      { label: 'Incassato', value: '€89K' },
    ],
  },
  {
    title: 'Vendite',
    description:
      'Gestione clienti, preventivi, ordini di vendita e analisi delle performance commerciali.',
    icon: 'M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z',
    href: '/vendite',
    color: 'from-violet-500 to-violet-600',
    stats: [
      { label: 'Ordini Mese', value: '89' },
      { label: 'Pipeline', value: '€125K' },
    ],
  },
  {
    title: 'Acquisti',
    description:
      'Gestione fornitori, richieste di acquisto, ordini e valutazione fornitori.',
    icon: 'M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z',
    href: '/acquisti',
    color: 'from-rose-500 to-rose-600',
    stats: [
      { label: 'Ordini Aperti', value: '31' },
      { label: 'In Arrivo', value: '12' },
    ],
  },
  {
    title: 'Risorse Umane',
    description:
      'Anagrafica dipendenti, presenze, ferie, buste paga e formazione del personale.',
    icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
    href: '/risorse-umane',
    color: 'from-teal-500 to-teal-600',
    stats: [
      { label: 'Dipendenti', value: '42' },
      { label: 'Presenti Oggi', value: '38' },
    ],
  },
];

const quickStats = [
  {
    label: 'Fatturato Mensile',
    value: '€247.500',
    change: '+12.5%',
    positive: true,
  },
  {
    label: 'Ordini in Produzione',
    value: '24',
    change: '+3',
    positive: true,
  },
  {
    label: 'Efficienza Produttiva',
    value: '87.3%',
    change: '+2.1%',
    positive: true,
  },
  {
    label: 'Scorte Sotto Minimo',
    value: '7',
    change: '-2',
    positive: true,
  },
];

export default function Dashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex flex-1 flex-col overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen(true)} />

        <main className="flex-1 overflow-y-auto bg-gray-50 p-4 md:p-6 lg:p-8">
          {/* Welcome Banner */}
          <div className="mb-8 rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-500 p-6 text-white shadow-lg md:p-8">
            <h1 className="text-2xl font-bold md:text-3xl">
              Benvenuto in SmartERP
            </h1>
            <p className="mt-2 text-indigo-100">
              Gestionale cloud per le PMI manifatturiere di Verona e provincia.
              Ecco il riepilogo della tua attivita.
            </p>
          </div>

          {/* Quick Stats */}
          <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {quickStats.map((stat) => (
              <div
                key={stat.label}
                className="rounded-xl bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
              >
                <p className="text-sm font-medium text-gray-500">
                  {stat.label}
                </p>
                <div className="mt-2 flex items-baseline justify-between">
                  <p className="text-2xl font-bold text-gray-900">
                    {stat.value}
                  </p>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      stat.positive
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {stat.change}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Module Cards */}
          <div className="mb-6">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              Moduli
            </h2>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {modules.map((module) => (
                <DashboardCard key={module.title} module={module} />
              ))}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="mt-8 rounded-xl bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              Attivita Recenti
            </h2>
            <div className="space-y-4">
              {[
                {
                  action: 'Ordine di produzione PO-2024-00124 completato',
                  time: '10 minuti fa',
                  user: 'Mario Rossi',
                  type: 'success',
                },
                {
                  action: 'Nuova fattura FE-2024-00456 emessa',
                  time: '25 minuti fa',
                  user: 'Anna Bianchi',
                  type: 'info',
                },
                {
                  action: 'Scorta minima raggiunta: Acciaio Inox 304',
                  time: '1 ora fa',
                  user: 'Sistema',
                  type: 'warning',
                },
                {
                  action: 'Nuovo ordine cliente CLI-2024-089 ricevuto',
                  time: '2 ore fa',
                  user: 'Luigi Verdi',
                  type: 'info',
                },
                {
                  action: 'Consegna DDT-2024-00234 confermata',
                  time: '3 ore fa',
                  user: 'Giuseppe Neri',
                  type: 'success',
                },
              ].map((activity, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-4 rounded-lg border border-gray-100 p-3 transition-colors hover:bg-gray-50"
                >
                  <div
                    className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${
                      activity.type === 'success'
                        ? 'bg-green-500'
                        : activity.type === 'warning'
                          ? 'bg-amber-500'
                          : 'bg-blue-500'
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      {activity.action}
                    </p>
                    <p className="text-xs text-gray-500">
                      {activity.user} - {activity.time}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
