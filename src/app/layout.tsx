import type { Metadata, Viewport } from 'next';
import type React from 'react';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { NavWrapper } from '@/components/navigation/NavWrapper';

export const metadata: Metadata = {
  title: "Let's Carol – Church Carol Tracking",
  description: 'Real-time tracking and route management for community caroling groups.',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: "Let's Carol" },
  openGraph: {
    title: "Let's Carol",
    description: 'Spread the joy. Share the love.',
    type: 'website',
  },
};

export const viewport: Viewport = {
  themeColor: '#166534',
  width: 'device-width',
  initialScale: 1,
  // maximumScale and userScalable intentionally NOT set:
  // WCAG 1.4.4 — users must be able to resize text up to 200%.
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap"
        />
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
          crossOrigin="anonymous"
        />
      </head>
      <body>
        <AuthProvider>
          <AuthGuard>
            <main>{children}</main>
            <NavWrapper />
          </AuthGuard>
        </AuthProvider>
      </body>
    </html>
  );
}
