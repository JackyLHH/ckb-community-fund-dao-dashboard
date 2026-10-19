'use client';

import { useSyncExternalStore } from 'react';
import { Analytics } from '@vercel/analytics/next';

/** Never report personal subscription links or search strings to analytics. */
const subscribeLocation = (sync: () => void) => {
  window.addEventListener('popstate', sync);
  return () => window.removeEventListener('popstate', sync);
};
function analyticsAllowed() {
    const url = new URL(window.location.href);
    return !url.pathname.startsWith('/subscription') && !url.pathname.startsWith('/api/') && !url.searchParams.has('token');
}
export function PrivacyAnalytics() {
  const allowed = useSyncExternalStore(subscribeLocation, analyticsAllowed, () => false);
  if (!allowed) return null;
  return <Analytics beforeSend={(event) => {
    const url = new URL(event.url);
    if (url.pathname.startsWith('/subscription') || url.searchParams.has('token')) return null;
    url.hash = ''; url.search = '';
    return { ...event, url: url.toString() };
  }} />;
}
