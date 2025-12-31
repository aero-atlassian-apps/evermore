import "./globals.css"
import { MSWInitializer } from '@/components/common/MSWInitializer';

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  interactiveWidget: 'resizes-content',
};

export const metadata = {
  title: 'Evermore — Where stories live forever',
  description: 'Preserve your family\'s priceless stories through voice conversations.',
  icons: {
    icon: '/favicon.svg',
    apple: '/evermore-icon-terracotta.svg', // Fallback to SVG for now, ideally PNG
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Evermore',
  },
};

/**
 * Root layout - Server Component.
 * 
 * IMPORTANT: This uses suppressHydrationWarning to handle:
 * 1. Browser extensions injecting attributes (e.g., data-jetski-tab-id)
 * 2. Any client-side only class modifications
 * 
 * The MSWInitializer is a client component that handles mock setup.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Fonts */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Merriweather:wght@400;600;700&display=swap" rel="stylesheet" />

        {/* Icons */}
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
      </head>
      <body className="font-sans antialiased" suppressHydrationWarning>
        <MSWInitializer />
        {children}
      </body>
    </html>
  );
}
