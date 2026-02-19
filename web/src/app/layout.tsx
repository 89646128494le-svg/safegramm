import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin', 'cyrillic'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'SafeGram — Защищённый мессенджер',
  description: 'E2EE, Zero-Knowledge, Safety AI. Создан Lev.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className="dark">
      <body className={`${inter.variable} font-sans antialiased bg-safegram-bg text-slate-200 min-h-screen`}>
        {children}
      </body>
    </html>
  );
}
