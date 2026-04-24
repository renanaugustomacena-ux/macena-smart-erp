import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'SmartERP - Gestionale Cloud per PMI Manifatturiere',
  description:
    'SmartERP: il gestionale cloud pensato per le piccole e medie imprese manifatturiere di Verona e provincia. Produzione, magazzino, contabilita, vendite e acquisti in un unica piattaforma.',
  keywords: [
    'ERP',
    'gestionale',
    'cloud',
    'PMI',
    'manifatturiero',
    'Verona',
    'Mozzecane',
    'produzione',
    'magazzino',
  ],
  authors: [{ name: 'SmartERP Team' }],
  openGraph: {
    title: 'SmartERP - Gestionale Cloud per PMI Manifatturiere',
    description:
      'Il gestionale cloud pensato per le PMI manifatturiere di Verona',
    type: 'website',
    locale: 'it_IT',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="it" className={inter.variable}>
      <body className={`${inter.className} antialiased`}>
        <div id="app-root" className="min-h-screen bg-gray-50">
          {children}
        </div>
      </body>
    </html>
  );
}
