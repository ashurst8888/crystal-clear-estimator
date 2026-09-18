import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'Crystal Clear Estimator',
  description: 'Internal estimating tool for Crystal Clear Cleaning & Contracting',
  robots: 'noindex, nofollow',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="antialiased bg-[#F4F6F9] text-gray-900 min-h-screen font-sans">
        {children}
      </body>
    </html>
  );
}
