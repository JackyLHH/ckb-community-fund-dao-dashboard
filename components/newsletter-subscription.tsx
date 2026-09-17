'use client';

import { useEffect, useState, type SubmitEvent } from 'react';
import { ArrowRight, CheckCircle2, Mail } from 'lucide-react';
import { useLocale } from '@/lib/use-locale';

type FormState = 'idle' | 'submitting' | 'confirmation_sent' | 'already_subscribed' | 'confirmed' | 'unsubscribed' | 'error';

export function NewsletterSubscription() {
  const { locale, t } = useLocale();
  const [email, setEmail] = useState('');
  const [state, setState] = useState<FormState>('idle');

  useEffect(() => {
    const result = new URLSearchParams(window.location.search).get('subscription');
    queueMicrotask(() => {
      if (result === 'confirmed') setState('confirmed');
      if (result === 'unsubscribed') setState('unsubscribed');
      if (result === 'error' || result === 'invalid') setState('error');
    });
  }, []);

  async function subscribe(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setState('submitting');
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, locale, company: form.get('company') }),
      });
      const result = await response.json() as { ok?: boolean; code?: string };
      if (!response.ok || !result.ok) throw new Error(result.code ?? 'subscription_failed');
      setState(result.code === 'already_subscribed' ? 'already_subscribed' : 'confirmation_sent');
      setEmail('');
    } catch {
      setState('error');
    }
  }

  const feedback: Partial<Record<FormState, string>> = {
    confirmation_sent: t('确认邮件已发送，请前往邮箱完成订阅。', 'Confirmation sent. Please check your inbox.'),
    already_subscribed: t('这个邮箱已经完成订阅。', 'This email address is already subscribed.'),
    confirmed: t('订阅已确认，欢迎加入。', 'Your subscription is confirmed.'),
    unsubscribed: t('你已取消订阅，不会再收到更新邮件。', 'You have been unsubscribed.'),
    error: t('暂时无法完成操作，请稍后再试。', 'We could not complete this request. Please try again later.'),
  };

  return (
    <section className="border-b border-white/10 bg-[#0b0f0e] text-white" aria-labelledby="proposal-updates-title">
      <div className="mx-auto grid max-w-7xl gap-8 px-5 py-12 lg:grid-cols-[1fr_.95fr] lg:items-center lg:px-8">
        <div>
          <span className="grid size-11 place-items-center rounded-xl bg-[#c8ff67] text-[#0b0f0e]"><Mail className="size-5" /></span>
          <h2 id="proposal-updates-title" className="mt-5 text-3xl font-black tracking-[-.035em]">
            {t('订阅每日提案更新', 'Subscribe to daily proposal updates')}
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-white/55">
            {t(
              '每天北京时间 08:00 汇总新提案与进展更新；没有变化时不发送邮件。',
              'Get one digest at 08:00 China Standard Time when new proposals or updates appear. No changes means no email.',
            )}
          </p>
        </div>
        <div>
          <form onSubmit={subscribe} className="flex flex-col gap-3 sm:flex-row">
            <label className="sr-only" htmlFor="subscription-email">{t('邮箱地址', 'Email address')}</label>
            <input
              id="subscription-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder={t('你的邮箱地址', 'Your email address')}
              className="h-12 min-w-0 flex-1 rounded-full border border-white/15 bg-white/8 px-5 text-sm text-white placeholder:text-white/35 focus:border-[#c8ff67] focus:outline-none"
            />
            <input name="company" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
            <button
              type="submit"
              disabled={state === 'submitting'}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[#c8ff67] px-6 text-sm font-black text-[#0b0f0e] transition hover:bg-[#b9ed60] disabled:cursor-wait disabled:opacity-65"
            >
              {state === 'submitting' ? t('提交中…', 'Submitting…') : t('订阅更新', 'Subscribe')}
              {state !== 'submitting' && <ArrowRight className="size-4" />}
            </button>
          </form>
          <p className="mt-3 text-xs leading-5 text-white/38">
            {t('需要通过邮件确认，可随时取消订阅。', 'Email confirmation is required. Unsubscribe at any time.')}
          </p>
          {feedback[state] && (
            <p className={`mt-4 flex items-center gap-2 text-sm ${state === 'error' ? 'text-[#ff9aa3]' : 'text-[#c8ff67]'}`} aria-live="polite">
              {state !== 'error' && <CheckCircle2 className="size-4 shrink-0" />}
              {feedback[state]}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
