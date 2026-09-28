'use client';

import { useEffect } from 'react';

export default function GlobalError({ error }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    const key = `reported-global-error:${error.digest ?? error.message}:${window.location.pathname}`;
    try {
      if (window.sessionStorage.getItem(key)) return;
      window.sessionStorage.setItem(key, '1');
    } catch {
      // Reporting still works if session storage is unavailable.
    }

    void fetch('/api/client-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({
        message: error.message,
        stack: error.stack,
        digest: error.digest,
        path: window.location.pathname,
        userAgent: window.navigator.userAgent,
        release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
      }),
    }).catch(() => undefined);
  }, [error]);

  return (
    <html lang="zh-CN">
      <body style={{ margin: 0, background: '#0b0f0e', color: '#fff', fontFamily: 'system-ui, sans-serif' }}>
        <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
          <section style={{ width: 'min(560px, 100%)', border: '1px solid rgba(255,255,255,.14)', borderRadius: 28, padding: 36, background: 'rgba(255,255,255,.05)' }}>
            <p style={{ margin: 0, color: '#c8ff67', fontSize: 13, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase' }}>CKB Community Fund DAO</p>
            <h1 style={{ margin: '18px 0 0', fontSize: 32, lineHeight: 1.1 }}>页面暂时无法加载<br />This page couldn’t load</h1>
            <p style={{ margin: '18px 0 0', color: 'rgba(255,255,255,.68)', lineHeight: 1.7 }}>请重新加载页面。网站已记录本次错误，便于后续排查。<br />Please reload the page. This error has been recorded for investigation.</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 28 }}>
              <button type="button" onClick={() => window.location.reload()} style={{ border: 0, borderRadius: 999, padding: '13px 22px', background: '#c8ff67', color: '#102119', fontWeight: 800, cursor: 'pointer' }}>重新加载 / Reload</button>
              <button type="button" onClick={() => window.history.back()} style={{ border: '1px solid rgba(255,255,255,.2)', borderRadius: 999, padding: '13px 22px', background: 'transparent', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>返回 / Back</button>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
