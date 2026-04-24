'use client';

import { useState } from 'react';

interface HeaderProps {
  onMenuClick: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const notifications = [
    {
      id: 1,
      title: 'Scorta minima raggiunta',
      message: 'Acciaio Inox 304 sotto il livello minimo',
      time: '5 min fa',
      unread: true,
    },
    {
      id: 2,
      title: 'Ordine completato',
      message: 'PO-2024-00124 completato con successo',
      time: '15 min fa',
      unread: true,
    },
    {
      id: 3,
      title: 'Nuova fattura',
      message: 'Fattura FE-2024-00456 pronta per invio SDI',
      time: '1 ora fa',
      unread: false,
    },
  ];

  return (
    <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 lg:px-8">
      {/* Left section */}
      <div className="flex items-center gap-4">
        {/* Mobile menu button */}
        <button
          onClick={onMenuClick}
          className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 lg:hidden"
          aria-label="Apri menu"
        >
          <svg
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>

        {/* Search bar */}
        <div className="hidden md:block">
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              placeholder="Cerca prodotti, ordini, clienti..."
              className="w-80 rounded-lg border border-gray-200 bg-gray-50 py-2 pl-10 pr-4 text-sm text-gray-900 placeholder-gray-400 transition-colors focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded border border-gray-200 bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-400">
              Ctrl+K
            </kbd>
          </div>
        </div>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-2">
        {/* Environment badge */}
        <span className="hidden rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-700 sm:inline-flex">
          Sviluppo
        </span>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => {
              setShowNotifications(!showNotifications);
              setShowUserMenu(false);
            }}
            className="relative rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            aria-label="Notifiche"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
              />
            </svg>
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />
          </button>

          {/* Notifications dropdown */}
          {showNotifications && (
            <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border border-gray-200 bg-white py-2 shadow-xl">
              <div className="border-b border-gray-100 px-4 py-2">
                <h3 className="text-sm font-semibold text-gray-900">
                  Notifiche
                </h3>
              </div>
              {notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`px-4 py-3 transition-colors hover:bg-gray-50 ${
                    notif.unread ? 'bg-indigo-50/50' : ''
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {notif.unread && (
                      <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-indigo-500" />
                    )}
                    <div className={notif.unread ? '' : 'ml-4'}>
                      <p className="text-sm font-medium text-gray-900">
                        {notif.title}
                      </p>
                      <p className="text-xs text-gray-500">{notif.message}</p>
                      <p className="mt-1 text-[11px] text-gray-400">
                        {notif.time}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
              <div className="border-t border-gray-100 px-4 py-2">
                <button className="text-xs font-medium text-indigo-600 hover:text-indigo-700">
                  Vedi tutte le notifiche
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="mx-1 h-6 w-px bg-gray-200" />

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => {
              setShowUserMenu(!showUserMenu);
              setShowNotifications(false);
            }}
            className="flex items-center gap-3 rounded-lg p-1.5 transition-colors hover:bg-gray-100"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white">
              MR
            </div>
            <div className="hidden text-left md:block">
              <p className="text-sm font-medium text-gray-900">Mario Rossi</p>
              <p className="text-[11px] text-gray-500">Amministratore</p>
            </div>
            <svg
              className="hidden h-4 w-4 text-gray-400 md:block"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {/* User dropdown */}
          {showUserMenu && (
            <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-xl border border-gray-200 bg-white py-2 shadow-xl">
              <div className="border-b border-gray-100 px-4 py-3">
                <p className="text-sm font-medium text-gray-900">
                  Mario Rossi
                </p>
                <p className="text-xs text-gray-500">
                  mario.rossi@azienda.it
                </p>
                <p className="mt-1 text-[11px] text-gray-400">
                  Azienda Meccanica SRL
                </p>
              </div>
              <div className="py-1">
                <a
                  href="/profilo"
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Il mio profilo
                </a>
                <a
                  href="/impostazioni"
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Impostazioni
                </a>
                <a
                  href="/impostazioni/azienda"
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Dati azienda
                </a>
              </div>
              <div className="border-t border-gray-100 py-1">
                <button className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50">
                  Esci
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
