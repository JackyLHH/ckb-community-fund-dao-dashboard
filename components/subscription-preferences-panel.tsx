'use client';

import { useEffect, useState, type SubmitEvent } from 'react';
import { Check, LockKeyhole, X } from 'lucide-react';
import { useLocale } from '@/lib/use-locale';
import { getProposalTitle, proposals } from '@/lib/proposals';
import { normalizeSubscriptionPreferences, subscriptionCategories, type SubscriptionCategory, type SubscriptionPreferences } from '@/lib/subscription-preferences';

const categoryText: Record<SubscriptionCategory, [string, string]> = {
  new: ['新提案', 'New proposals'], progress: ['提案人的进展与报告', 'Proposer progress and reports'],
  'discussion-ended': ['讨论期结束与赞数门槛', 'Discussion deadlines and like thresholds'],
  'vote-started': ['投票开始', 'Voting starts'], 'vote-ended': ['最终投票结果', 'Final voting results'],
};
type State = 'request' | 'loading' | 'ready' | 'saving' | 'saved' | 'sent' | 'error';

export function SubscriptionPreferencesPanel() {
  const { t, locale } = useLocale();
  const [state, setState] = useState<State>('request');
  const [privateToken, setPrivateToken] = useState('');
  const [authorized, setAuthorized] = useState(false);
  const [email, setEmail] = useState('');
  const [destination, setDestination] = useState('');
  const [emailLocale, setEmailLocale] = useState<'zh' | 'en'>('zh');
  const [preferences, setPreferences] = useState<SubscriptionPreferences>(normalizeSubscriptionPreferences());
  const [proposalId, setProposalId] = useState('');
  const [suggestion, setSuggestion] = useState('');
  const [error, setError] = useState('');
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    const url = new URL(window.location.href);
    const value = new URLSearchParams(url.hash.slice(1)).get('token') ?? '';
    const proposed = url.searchParams.get('proposal') ?? '';
    if (/^[1-9]\d{0,8}$/.test(proposed)) queueMicrotask(() => { setSuggestion(proposed); setProposalId(proposed); });
    if (!/^[a-f0-9]{64}$/.test(value)) return;
    let active = true;
    queueMicrotask(() => { setPrivateToken(value); setState('loading'); });
    fetch('/api/subscription?action=preferences', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: value }), cache: 'no-store', referrerPolicy: 'no-referrer' })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok || !result.ok) throw new Error(result.code ?? 'service_unavailable');
        if (!active) return;
        setPreferences(normalizeSubscriptionPreferences(result.preferences));
        setEmailLocale(result.locale === 'en' ? 'en' : 'zh');
        setDestination(result.destination); setAuthorized(true); setState('ready');
      }).catch((reason: unknown) => { if (active) { setError(reason instanceof Error ? reason.message : 'network'); setState('error'); } });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!remaining) return;
    const timer = setTimeout(() => setRemaining((value) => Math.max(0, value - 1)), 1_000);
    return () => clearTimeout(timer);
  }, [remaining]);

  async function requestLink(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault(); setState('loading'); setError('');
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch('/api/subscription?action=manage-link', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, locale, company: form.get('company'), proposalId: suggestion || undefined }) });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.code ?? 'service_unavailable');
      setState('sent'); setRemaining(result.retryAfter ?? 60);
    } catch { setState('request'); setError('request_failed'); }
  }
  async function save(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault(); setState('saving'); setError('');
    try {
      const response = await fetch('/api/subscription?action=preferences', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: privateToken, locale: emailLocale, preferences }), cache: 'no-store', referrerPolicy: 'no-referrer' });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.code ?? 'service_unavailable');
      setPreferences(normalizeSubscriptionPreferences(result.preferences)); setState('saved');
    } catch (reason) { setState('ready'); setError(reason instanceof Error ? reason.message : 'network'); }
  }
  function addProposal() {
    const id = proposalId.trim().match(/(?:[?&]id=|\/)(\d{1,9})(?:[/?#]|$)/)?.[1] ?? proposalId.trim();
    if (!/^[1-9]\d{0,8}$/.test(id)) { setError('invalid_proposal'); return; }
    setPreferences((current) => normalizeSubscriptionPreferences({ ...current, scope: 'selected', proposalIds: [...current.proposalIds, id] }));
    setProposalId(''); setError(''); setState('ready'); setSuggestion('');
  }
  const secured = authorized;
  const inputClass = 'mt-2 min-h-12 w-full rounded-xl border border-border bg-card px-4 text-base text-card-foreground';
  const buttonClass = 'inline-flex min-h-12 items-center justify-center rounded-full bg-primary px-6 text-sm font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60';
  const errorText = error === 'invalid_link'
    ? t('这个私人链接无效，或订阅已取消。请使用下方表单申请新链接；首次订阅请使用页面底部的订阅模块。', 'This private link is invalid, or the subscription was cancelled. Request a new link below. To subscribe for the first time, use the form at the bottom of this page.')
    : error === 'invalid_proposal' ? t('请输入有效的提案编号或提案链接。', 'Enter a valid proposal number or link.')
      : t('暂时无法完成操作。你的输入已保留，请检查网络后重试。', 'The request could not be completed. Your input is still here; check your connection and try again.');
  return <>
    <span className="inline-flex items-center gap-2 text-sm font-semibold text-primary"><LockKeyhole className="size-4" aria-hidden="true" />{t('无需注册账号', 'No account required')}</span>
    <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{t('选择你想收到的提案动态', 'Choose the updates you receive')}</h1>
    <p className="mt-4 text-base leading-7 text-muted-foreground">{t('使用邮件中的私人链接管理语言、动态类别和关注的提案。默认订阅全部；只有保存后才会更改。每日北京时间 16:00 汇总，没有符合你选择的变化就不发送。', 'Use your private email link to choose the language, update types and proposals. The default is all updates; nothing changes until you save. Digests arrive at 16:00 Beijing time (UTC+8), only when there are matching changes.')}</p>
    {state === 'loading' && privateToken && <output className="mt-8 block rounded-2xl border border-border bg-card p-6">{t('正在安全读取你的订阅偏好…', 'Securely loading your preferences…')}</output>}
    {secured ? <form onSubmit={save} className="mt-8 space-y-6">
      <p className="rounded-xl bg-secondary px-4 py-3 text-sm text-secondary-foreground">{t('正在管理', 'Managing')} {destination} · {t('请勿分享此私人链接', 'Keep this personal link private')}</p>
      <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <label htmlFor="preference-language" className="block font-semibold">{t('邮件语言', 'Email language')}</label>
        <select id="preference-language" value={emailLocale} onChange={(event) => { setEmailLocale(event.target.value === 'en' ? 'en' : 'zh'); setState('ready'); }} className={inputClass}><option value="zh">中文</option><option value="en">English</option></select>
      </div>
      <fieldset className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <legend className="px-1 font-semibold">{t('接收哪些动态', 'Update types')}</legend>
        {subscriptionCategories.map((category) => <label key={category} className="flex min-h-12 cursor-pointer items-center gap-3 text-sm"><input type="checkbox" checked={preferences.categories.includes(category)} onChange={(event) => { setPreferences((current) => ({ ...current, categories: event.target.checked ? [...current.categories, category] : current.categories.filter((value) => value !== category) })); setState('ready'); }} className="size-5 accent-[var(--primary)]" />{t(...categoryText[category])}</label>)}
        {!preferences.categories.length && <p className="mt-2 text-sm text-muted-foreground">{t('未选择动态类别：保存后将暂停发送，直到你重新选择。', 'No update types selected: saving will pause digests until you select a type again.')}</p>}
      </fieldset>
      <fieldset className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <legend className="px-1 font-semibold">{t('关注范围', 'Proposals to follow')}</legend>
        <label className="flex min-h-12 items-center gap-3 text-sm"><input type="radio" name="scope" checked={preferences.scope === 'all'} onChange={() => { setPreferences((current) => ({ ...current, scope: 'all' })); setState('ready'); }} className="size-5 accent-[var(--primary)]" />{t('全部提案（包含未来新提案）', 'All proposals, including future proposals')}</label>
        <label className="flex min-h-12 items-center gap-3 text-sm"><input type="radio" name="scope" checked={preferences.scope === 'selected'} onChange={() => { setPreferences((current) => ({ ...current, scope: 'selected' })); setState('ready'); }} className="size-5 accent-[var(--primary)]" />{t('仅以下提案', 'Only the proposals below')}</label>
        {preferences.scope === 'selected' && <div className="mt-4">
          <label htmlFor="follow-proposal" className="block text-sm font-semibold">{t('添加提案编号或链接', 'Add a proposal number or link')}</label>
          <div className="flex flex-col gap-2 sm:flex-row"><input id="follow-proposal" value={proposalId} onChange={(event) => setProposalId(event.target.value)} placeholder="10015" className={`${inputClass} min-w-0 flex-1`} /><button type="button" onClick={addProposal} className={`${buttonClass} mt-2`}>{t('添加', 'Add')}</button></div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{t('最多关注 100 份提案。新增提案不会自动加入此列表。', 'Follow up to 100 proposals. Future proposals are not automatically added to this list.')}</p>
          <ul className="mt-3 space-y-2">{preferences.proposalIds.map((id) => { const proposal = proposals.find((item) => item.id === id); return <li key={id} className="flex items-center justify-between gap-3 rounded-xl bg-secondary pl-3 text-sm text-secondary-foreground"><span className="min-w-0">#{id} {proposal ? getProposalTitle(proposal, locale) : ''}</span><button type="button" aria-label={t(`移除提案 ${id}`, `Remove proposal ${id}`)} onClick={() => { setPreferences((current) => ({ ...current, proposalIds: current.proposalIds.filter((value) => value !== id) })); setState('ready'); }} className="grid size-11 shrink-0 place-items-center rounded-full"><X className="size-4" /></button></li>; })}</ul>
          {!preferences.proposalIds.length && <p className="mt-3 text-sm text-muted-foreground">{t('尚未添加提案：保存后将不会收到任何汇总。', 'No proposals added: saving will mean no digests are sent.')}</p>}
        </div>}
        {suggestion && <button type="button" onClick={addProposal} className="mt-3 min-h-11 text-sm font-semibold text-primary underline underline-offset-4">{t(`将提案 #${suggestion} 加入关注列表`, `Add proposal #${suggestion} to the watchlist`)}</button>}
      </fieldset>
      <output className="block" aria-live="polite">{state === 'saved' && <span className="flex items-center gap-2 text-sm font-semibold text-primary"><Check className="size-4" />{t('偏好已保存。下一次汇总将按你的选择发送。', 'Preferences saved. Your next digest will follow these choices.')}</span>}{error && <span className="block text-sm leading-6 text-destructive">{errorText}</span>}</output>
      <button type="submit" disabled={state === 'saving'} className={buttonClass}>{state === 'saving' ? t('保存中…', 'Saving…') : t('保存订阅偏好', 'Save preferences')}</button>
    </form> : !(state === 'loading' && privateToken) && <div className="mt-8 rounded-2xl border border-border bg-card p-5 sm:p-6">
      {error && <p role="alert" className="mb-4 text-sm leading-6 text-destructive">{errorText}</p>}
      <h2 className="text-xl font-bold">{t('获取私人管理链接', 'Get your private management link')}</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{t('请输入已确认订阅的邮箱。若此邮箱已有有效订阅，我们会发出管理链接；请同时检查垃圾邮件。', 'Enter your confirmed subscription address. If it has an active subscription, we will send a management link. Please also check spam.')}</p>
      {suggestion && <p className="mt-3 text-sm font-semibold text-primary">{t(`打开链接后，可选择关注提案 #${suggestion}。`, `After opening the link, you can choose to follow proposal #${suggestion}.`)}</p>}
      <form onSubmit={requestLink} className="mt-5"><label htmlFor="management-email" className="text-sm font-semibold">{t('已订阅的邮箱地址', 'Subscribed email address')}</label><input id="management-email" type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className={inputClass} /><input name="company" autoComplete="off" tabIndex={-1} aria-hidden="true" className="hidden" /><button type="submit" disabled={state === 'loading' || remaining > 0} className={`${buttonClass} mt-4`}>{state === 'loading' ? t('发送中…', 'Sending…') : remaining ? t(`${remaining} 秒后可重发`, `Resend in ${remaining}s`) : t('发送私人链接', 'Send private link')}</button></form>
      {state === 'sent' && <output className="mt-4 block text-sm leading-6 text-primary">{t('请求已收到。如果邮箱已有有效订阅，管理链接将发至该邮箱。请检查收件箱及垃圾邮件。', 'Request received. If the address has an active subscription, the link will arrive by email. Check your inbox and spam folder.')}</output>}
      <p className="mt-4 text-sm leading-6 text-muted-foreground">{t('尚未订阅？请在下方输入邮箱并完成确认，所有类别默认开启。', 'Not subscribed yet? Use the form below and confirm your email. All update types are enabled by default.')}</p>
    </div>}
  </>;
}
