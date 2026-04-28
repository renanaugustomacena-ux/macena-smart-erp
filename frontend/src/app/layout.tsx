import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { PwaRegister } from './components/PwaRegister';

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
  manifest: '/manifest.webmanifest',
  applicationName: 'SmartERP',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'SmartERP',
  },
};

export const viewport: Viewport = {
  themeColor: '#0a3d62',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
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
        <PwaRegister />
      </body>
    </html>
  );
}
