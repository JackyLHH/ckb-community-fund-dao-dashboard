'use client';

import { useEffect, useRef, useState, type SubmitEvent } from 'react';
import { ArrowRight, CheckCircle2, ExternalLink, Mail, Send, X } from 'lucide-react';
import { useLocale } from '@/lib/use-locale';
import { maskedEmail } from '@/lib/subscription-preferences';
import { StaticLink } from '@/components/static-link';

type FormState = 'idle' | 'submitting' | 'confirmation_sent' | 'confirmed' | 'unsubscribed' | 'error';

function DigestPreview() {
  const { t } = useLocale();
  const dialog = useRef<HTMLDialogElement>(null);
  const [format, setFormat] = useState<'email' | 'telegram'>('email');
  return <>
    <button type="button" onClick={() => dialog.current?.showModal()} className="inline-flex min-h-11 items-center rounded-full px-2 text-sm font-semibold text-[#c8ff67] underline-offset-4 hover:underline">{t('查看推送示例', 'Preview the digest')}</button>
    <dialog ref={dialog} aria-labelledby="digest-preview-title" className="m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-[640px] overflow-y-auto rounded-3xl border border-[var(--border)] bg-[var(--background)] p-0 text-[var(--foreground)] shadow-xl backdrop:bg-black/60">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--border)] bg-[var(--background)] px-6 py-4">
        <h2 id="digest-preview-title" className="text-xl font-bold">{t('提案动态示例', 'A sample proposal digest')}</h2>
        <button type="button" onClick={() => dialog.current?.close()} aria-label={t('关闭示例', 'Close preview')} className="grid size-11 place-items-center rounded-full hover:bg-[var(--muted)]"><X className="size-5" /></button>
      </div>
      <div className="p-6">
        <p className="text-sm leading-6 text-[var(--muted-foreground)]">{t('以下仅为内容和样式示例，不代表今天的真实动态。邮件与频道使用相同的真实来源。', 'This is a content and layout example, not today’s activity. Emails and channels use the same verified sources.')}</p>
        <fieldset className="mt-4 flex gap-2"><legend className="sr-only">{t('示例格式', 'Preview format')}</legend>
          {(['email', 'telegram'] as const).map((value) => <button key={value} type="button" aria-pressed={format === value} onClick={() => setFormat(value)} className={`min-h-11 rounded-full border px-4 text-sm font-semibold ${format === value ? 'border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]' : 'border-[var(--border)]'}`}>{value === 'email' ? t('邮件', 'Email') : 'Telegram'}</button>)}
        </fieldset>
        <div className="mt-5 rounded-2xl border border-[var(--border)] p-5 text-sm leading-7">
          <p className="font-semibold">{t('你好，CKB 社区的朋友 👋', 'Hello, CKB community 👋')}</p>
          <p className="mt-3">{t('今天有 1 份新提案和 1 条进展更新：', 'Today: 1 new proposal and 1 proposal update:')}</p>
          <h3 className="mt-5 font-bold">🆕 {t('新提案', 'New proposal')}</h3>
          <div className={format === 'email' ? 'mt-2 rounded-xl border border-[var(--border)] p-4' : 'mt-2'}>
            <p className="font-bold">{t('示例：社区开发者工具', 'Example: community developer tools')}</p>
            <p>{t('简介：为 CKB 开发者提供开源工具与入门指南。', 'Overview: open-source tools and onboarding guides for CKB developers.')}</p>
            <p>{t('提案人：Example · 预算：$3,000', 'Proposer: Example · Budget: $3,000')}</p>
            <span className="font-semibold text-primary">{t('查看原始提案 →', 'Read the original proposal →')}</span>
          </div>
          <h3 className="mt-5 font-bold">🔄 {t('进展更新', 'Proposal updates')}</h3>
          <div className={format === 'email' ? 'mt-2 rounded-xl border border-[var(--border)] p-4' : 'mt-2'}>
            <p className="font-bold">{format === 'telegram' ? '1. ' : ''}{t('示例提案', 'Example proposal')}{format === 'email' ? ` · ${t('执行中', 'In progress')}` : ''}</p>
            {format === 'email' && <p className="text-[var(--muted-foreground)]">{t('由 Example 更新 · 示例日期', 'Updated by Example · Sample date')}</p>}
            <p>{t('发布了周报', 'Published a weekly update.')}</p>
            <span className="font-semibold text-primary">{t('查看本次更新 →', 'View this update →')}</span>
            {format === 'email' && <span className="ml-3 font-semibold text-primary">{t('提案记录 →', 'Proposal record →')}</span>}
          </div>
        </div>
        <p className="mt-4 text-sm leading-6 text-[var(--muted-foreground)]">{t('汇总还会包含：讨论期结束及首帖赞数、投票开始和链接、投票结束及结果。每天北京时间 16:00 汇总；没有符合条件的变化时不发送。', 'Digests also cover the discussion deadline and first-post likes, voting invitations, and final voting results. Delivered at 16:00 Beijing time (UTC+8); no qualifying changes means no message.')}</p>
      </div>
    </dialog>
  </>;
}

function NewsletterSubscription() {
  const { locale, t } = useLocale();
  const [email, setEmail] = useState('');
  const [state, setState] = useState<FormState>('idle');
  const [errorCode, setErrorCode] = useState('');
  const [destination, setDestination] = useState('');
  const [sentEmail, setSentEmail] = useState('');
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    const result = new URLSearchParams(window.location.search).get('subscription');
    queueMicrotask(() => {
      if (result === 'confirmed') setState('confirmed');
      if (result === 'unsubscribed') setState('unsubscribed');
      if (result === 'error' || result === 'invalid') { setState('error'); setErrorCode('invalid_link'); }
    });
  }, []);
  useEffect(() => {
    if (!remaining) return;
    const timer = setTimeout(() => setRemaining((value) => Math.max(0, value - 1)), 1_000);
    return () => clearTimeout(timer);
  }, [remaining]);

  async function subscribe(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setState('submitting');
    setErrorCode('');
    const form = new FormData(event.currentTarget);
    const submittedEmail = email.trim().toLowerCase();
    try {
      const response = await fetch('/api/subscribe', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: submittedEmail, locale, company: form.get('company') }),
      });
      const result = await response.json() as { ok?: boolean; code?: string; destination?: string; retryAfter?: number };
      if (!response.ok || !result.ok) {
        setErrorCode(result.code ?? 'service_unavailable');
        if (result.retryAfter) { setRemaining(result.retryAfter); setSentEmail(submittedEmail); }
        setState('error'); return;
      }
      setState('confirmation_sent');
      setDestination(result.destination ?? maskedEmail(submittedEmail));
      setSentEmail(submittedEmail);
      setRemaining(result.retryAfter ?? 0);
    } catch { setErrorCode('network'); setState('error'); }
  }

  const errorText: Record<string, string> = {
    invalid_email: t('请检查邮箱格式后重试。', 'Please check the email address and try again.'),
    confirmation_cooldown: t('确认邮件刚刚发送，请稍候再重新发送，并检查垃圾邮件。', 'A confirmation was just sent. Please check your spam folder before requesting another.'),
    delivery_blocked: t('此邮箱此前发生退信或投诉，已停止发送。请换一个邮箱，或联系 jacky@ckba.build。', 'Delivery is paused after a bounce or complaint. Try another address or contact jacky@ckba.build.'),
    invalid_link: t('此确认链接无效或已失效。请重新输入邮箱申请确认邮件。', 'This link is invalid or no longer active. Enter your email to request another confirmation.'),
    network: t('网络连接中断，邮箱已保留。请检查网络后重试。', 'The connection failed. Your address is still here; check your connection and try again.'),
    service_unavailable: t('订阅服务暂时不可用，邮箱已保留。请稍后重试。', 'The subscription service is temporarily unavailable. Your address is still here; please try again later.'),
  };
  const feedback: Partial<Record<FormState, string>> = {
    confirmation_sent: t(`请求已收到，请检查 ${destination} 的邮件及垃圾邮件。首次订阅还需点击邮件中的“确认订阅”；已订阅者会收到私人管理链接。若始终未收到，请联系 jacky@ckba.build。`, `Request received. Check ${destination}, including spam. New subscribers must select “Confirm subscription”; existing subscribers receive a private management link. If nothing arrives, contact jacky@ckba.build.`),
    confirmed: t('订阅已确认，欢迎加入！有新动态时，你将收到每日汇总。', 'You are now subscribed. Welcome! You will receive a daily digest when there are qualifying updates.'),
    unsubscribed: t('你已取消订阅，不会再收到更新邮件。', 'You have been unsubscribed and will not receive further digests.'),
    error: errorText[errorCode] ?? errorText.service_unavailable,
  };
  const coolingDown = remaining > 0 && email.trim().toLowerCase() === sentEmail;
  return (
    <section id="subscribe" aria-labelledby="proposal-updates-title">
      <div className="mx-auto grid max-w-7xl items-start gap-8 px-5 py-12 sm:py-16 lg:grid-cols-[1fr_1.05fr] lg:gap-16 lg:px-8">
        <div>
          <span className="grid size-11 place-items-center rounded-xl bg-[#c8ff67] text-[#0b0f0e]"><Mail className="size-5" aria-hidden="true" /></span>
          <h2 id="proposal-updates-title" className="mt-5 text-3xl font-bold tracking-[-.025em]">{t('订阅每日提案更新', 'Subscribe to daily proposal updates')}</h2>
          <p className="mt-3 max-w-xl text-sm leading-7 text-white/80">{t('每天北京时间 16:00 汇总新提案、提案人进展和治理动态；没有变化时不发送邮件。', 'One digest at 16:00 Beijing time (UTC+8), covering new proposals, proposer updates and governance events. No changes means no email.')}</p>
          <DigestPreview />
        </div>
        <div className="grid min-w-0 gap-4 sm:gap-5">
          <section data-subscription-channel="email" aria-labelledby="email-subscription-title" className="min-w-0 rounded-3xl border border-white/15 bg-white/[.04] p-5 sm:p-6">
            <h3 id="email-subscription-title" className="flex items-center gap-3 text-base font-bold"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#c8ff67]/10 text-[#c8ff67]"><Mail className="size-4" aria-hidden="true" /></span>{t('邮件订阅', 'Email subscription')}</h3>
          <form onSubmit={subscribe} className="mt-5">
            <label className="sr-only" htmlFor="subscription-email">{t('邮箱地址', 'Email address')}</label>
            <div className="grid gap-3">
              <input id="subscription-email" type="email" inputMode="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" aria-describedby="subscription-help subscription-feedback" aria-invalid={state === 'error' && errorCode === 'invalid_email'} className="h-12 w-full min-w-0 rounded-xl border border-white/25 bg-white/[.04] px-4 text-base text-white placeholder:text-white/55 focus:border-[#c8ff67] focus:outline-none focus:ring-2 focus:ring-[#c8ff67]/40" />
              <input name="company" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
              <button type="submit" disabled={state === 'submitting' || coolingDown} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#c8ff67] px-5 py-3 text-sm font-bold text-[#0b0f0e] transition hover:bg-[#b9ed60] disabled:cursor-not-allowed disabled:opacity-65">
                {state === 'submitting' ? t('发送中…', 'Sending…') : coolingDown ? t(`${remaining} 秒后可重发`, `Resend in ${remaining}s`) : state === 'confirmation_sent' ? t('重发确认邮件', 'Resend confirmation') : t('订阅更新', 'Subscribe')}{state !== 'submitting' && !coolingDown && <ArrowRight className="size-4" aria-hidden="true" />}
              </button>
            </div>
          </form>
          <p id="subscription-help" className="mt-4 text-xs leading-6 text-white/65">{t('仅用于提案动态。需要邮件确认，可随时取消订阅。', 'Only for proposal updates. Email confirmation is required; unsubscribe at any time.')}</p>
          <output id="subscription-feedback" className="block" aria-live="polite" aria-atomic="true">
            {feedback[state] && <span className={`mt-4 flex items-start gap-2 text-sm leading-6 ${state === 'error' ? 'text-[#ffb6bd]' : 'text-[#c8ff67]'}`}>{state !== 'error' && <CheckCircle2 className="mt-1 size-4 shrink-0" aria-hidden="true" />}{feedback[state]}</span>}
          </output>
          <StaticLink href="/subscription" className="mt-1 inline-flex min-h-11 items-center text-xs font-semibold leading-6 text-white/80 underline underline-offset-4 hover:text-white">{t('管理已有订阅或只关注部分提案', 'Manage a subscription or follow selected proposals')}</StaticLink>
          </section>
          <section data-subscription-channel="telegram" aria-labelledby="telegram-subscription-title" className="min-w-0 rounded-3xl border border-white/15 bg-white/[.04] p-5 sm:p-6">
            <h3 id="telegram-subscription-title" className="flex items-center gap-3 text-base font-bold"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#c8ff67]/10 text-[#c8ff67]"><Send className="size-4" aria-hidden="true" /></span>{t('通过 Telegram 接收更新', 'Get updates on Telegram')}</h3>
            <p className="mt-3 text-sm leading-6 text-white/65">{t('选择频道语言，接收同一份全站每日汇总。', 'Choose a language for the same all-proposal daily digest.')}</p>
            <div className="mt-5 grid gap-3 min-[360px]:grid-cols-2">
              <a href="/api/telegram?locale=zh" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/25 px-3 py-2 text-sm font-semibold transition hover:border-[#c8ff67]/50 hover:bg-white/[.06]">{t('加入中文频道', 'Chinese channel')}<ExternalLink className="size-3.5 shrink-0" aria-hidden="true" /></a>
              <a href="/api/telegram?locale=en" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/25 px-3 py-2 text-sm font-semibold transition hover:border-[#c8ff67]/50 hover:bg-white/[.06]">{t('加入英文频道', 'English channel')}<ExternalLink className="size-3.5 shrink-0" aria-hidden="true" /></a>
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}

export function SiteFooter() {
  return <footer className="bg-[#0b0f0e] text-white"><NewsletterSubscription /></footer>;
}
