import type { Metadata } from 'next';
import { PrivacyAnalytics } from '@/components/privacy-analytics';
import { preferencesBootstrap } from '@/lib/ui-preferences';
import './globals.css';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ckbcommunityfunddao.xyz';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'CKB Community Fund DAO',
    template: '%s | CKB Community Fund DAO',
  },
  description:
    'Explore the rules, funding, proposals, votes, and progress of the CKB Community Fund DAO.',
  icons: { icon: '/favicon.svg' },
  openGraph: {
    title: 'CKB Community Fund DAO',
    description: 'Rules · Funding · Proposals · Progress',
    type: 'website',
    images: [{ url: '/og.png', width: 1731, height: 909, alt: 'CKB Community Fund DAO — Rules, Funding, Proposals, Progress' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CKB Community Fund DAO',
    description: 'Rules · Funding · Proposals · Progress',
    images: ['/og.png'],
  },
  other: {
    google: 'notranslate',
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" translate="no" className="notranslate" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: preferencesBootstrap }} /></head>
      <body className="notranslate">
        {children}
        <PrivacyAnalytics />
      </body>
    </html>
  );
}
