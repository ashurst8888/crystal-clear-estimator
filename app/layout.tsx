import type { Metadata } from 'next';
import './globals.css';

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
    <html lang="en">
      <body className="antialiased bg-white text-gray-900 min-h-screen">
        {children}
      </body>
    </html>
  );
}
