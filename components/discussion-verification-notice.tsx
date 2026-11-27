'use client';

import { useEffect, useState } from 'react';
import { reviewedProposalWithdrawal } from '../lib/proposal-withdrawals.js';
import { useLocale } from '@/lib/use-locale';
import type { DiscussionVerification, LifecycleSnapshot } from '@/lib/digest-lifecycle';

export function DiscussionVerificationNotice({ id }: { id: string }) {
  const { locale, t } = useLocale();
  const [result, setResult] = useState<{ id: string; verification: DiscussionVerification | null } | null>(null);
  useEffect(() => {
    if (reviewedProposalWithdrawal(id)) return;
    let active = true;
    let controller: AbortController | null = null;
    const refresh = async () => {
      controller?.abort(); const requestController = new AbortController(); controller = requestController;
      const timeout = window.setTimeout(() => requestController.abort(), 10_000);
      try {
        const response = await fetch('/live/governance/evidence', { signal: requestController.signal, cache: 'no-cache' });
        if (!response.ok) return;
        const snapshot = await response.json() as LifecycleSnapshot;
        if (snapshot.version !== 1 || !snapshot.discussions || !Array.isArray(snapshot.events)) return;
        const verification = snapshot.discussions[id]?.verification;
        const complete = snapshot.events.some(event => event.id === `discussion-ended:${id}`);
        if (active) setResult({ id, verification: !complete && verification?.status === 'pending' ? verification : null });
      } catch { /* Existing collection freshness warnings cover unavailable sources. */ }
      finally { window.clearTimeout(timeout); }
    };
    void refresh();
    const interval = window.setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, 300_000);
    window.addEventListener('focus', refresh);
    return () => { active = false; controller?.abort(); window.clearInterval(interval); window.removeEventListener('focus', refresh); };
  }, [id]);
  const withdrawal = reviewedProposalWithdrawal(id);
  if (withdrawal) return <aside data-proposal-withdrawal className="mt-5 rounded-xl border border-border bg-muted/60 p-4 text-sm leading-6" aria-labelledby={`withdrawal-${id}`}>
    <h3 id={`withdrawal-${id}`} className="font-semibold">{t('本次提案已撤回', 'This proposal was withdrawn')}</h3>
    <p className="mt-2">{locale === 'en' ? withdrawal.noteEn : withdrawal.noteZh}</p>
    <a href={withdrawal.sourceUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block font-semibold underline underline-offset-2">{t('查看提案人撤回声明（第 34 楼）', 'Read the proposer’s withdrawal statement (post 34)')}</a>
  </aside>;
  const verification = result?.id === id ? result.verification : null;
  if (!verification) return null;
  const date = (value: string) => new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(value)) + ' UTC+8';
  return <aside data-discussion-verification className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-950" aria-labelledby={`discussion-verification-${id}`}>
    <h3 id={`discussion-verification-${id}`} className="font-semibold">{t('七天截止赞数待人工核验', 'Discussion-deadline likes require manual verification')}</h3>
    <p>{t('讨论截止：', 'Discussion deadline: ')}{date(verification.deadline)}</p>
    {verification.listComplete && verification.confirmedBefore !== null && verification.confirmedAfter !== null && <p>{t(`已核实在截止前：${verification.confirmedBefore}；截止后：${verification.confirmedAfter}；尚有 ${verification.unresolvedUsers.length} 条待核验。`, `Confirmed before deadline: ${verification.confirmedBefore}; after: ${verification.confirmedAfter}; ${verification.unresolvedUsers.length} unresolved.`)}</p>}
    {!!verification.unresolvedUsers.length && <ul className="mt-2 list-inside list-disc break-words">{verification.unresolvedUsers.map(username => <li key={username}><a href={`https://talk.nervos.org/u/${encodeURIComponent(username)}/activity/likes-given`} target="_blank" rel="noreferrer" className="font-semibold underline underline-offset-2">{username}</a>{t('：缺少可追溯的公开点赞时间。', ': no traceable public like timestamp.')}</li>)}</ul>}
    {verification.sourceError && <p>{t('公开来源读取不完整，已保留此前核实的证据。', 'Public evidence is incomplete; previously verified evidence has been retained.')}</p>}
    <p className="mt-2">{t('不会以当前赞数替代截止赞数；证据补足前不生成讨论结束事件。', 'Current likes are not a substitute for deadline likes. No discussion-ended event is generated until the evidence is complete.')}</p>
    <p className="mt-2 text-xs">{t('证据记录时间：', 'Evidence recorded at: ')}{date(verification.checkedAt)}</p>
    <a href={`https://talk.nervos.org/t/${id}/1`} target="_blank" rel="noreferrer" className="mt-2 inline-block font-semibold underline underline-offset-2">{t('查看首帖与公开证据', 'View the first post and public evidence')}</a>
  </aside>;
}
