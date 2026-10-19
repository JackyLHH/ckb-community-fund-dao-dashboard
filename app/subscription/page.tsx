import type { Metadata } from 'next';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { SubscriptionPreferencesPanel } from '@/components/subscription-preferences-panel';

export const metadata: Metadata = {
  title: 'Subscription preferences',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default function SubscriptionPage() {
  return <div className="min-h-screen bg-background text-foreground"><SiteHeader /><main id="main-content" tabIndex={-1} className="mx-auto max-w-3xl px-5 py-10 sm:py-14"><SubscriptionPreferencesPanel /></main><SiteFooter /></div>;
}
