import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Header } from '@/components/Header';
import { PWARegister } from '@/components/PWARegister';

export const metadata: Metadata = {
  title: 'Cicatrizes do Gatilho — Builder & Wiki',
  description: 'Criador de personagens e wiki interativa do RPG Cicatrizes do Gatilho.',
  manifest: '/manifest.webmanifest',
  applicationName: 'CDG Builder',
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
    apple: [{ url: '/icon.svg', type: 'image/svg+xml' }]
  },
  appleWebApp: {
    capable: true,
    title: 'CDG Builder',
    statusBarStyle: 'black-translucent'
  }
};

export const viewport: Viewport = {
  themeColor: '#110c06',
  width: 'device-width',
  initialScale: 1
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <PWARegister />
        <div className="min-h-screen flex flex-col">
          <Header />
          <main className="flex-1">{children}</main>
          <footer className="border-t border-ink-700 py-4 text-center text-xs text-ink-400 print:hidden">
            CDG Builder — Fase 3. Dados v0.
          </footer>
        </div>
      </body>
    </html>
  );
}
