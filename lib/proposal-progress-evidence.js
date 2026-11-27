import { isCompletedTestRun } from './proposal-test-report.js';
import { isProposalScopeRevision } from './proposal-revision.js';

// Classify the complete, unquoted source post before extracting its display
// title. A concise report title may not itself contain every progress keyword.
const progressUpdatePattern = /(?:\b(?:status|project|development|test|testing|progress|product delivery|delivery|completion|final|weekly|monthly|month\s*\d+)\s+(?:updates?|reports?)\b|\b(?:update|report)\s*[:：#-]|\bmilestone\s*#?\s*\d+[^.!?]{0,100}\b(?:complete|completed|delivered|report|update|testing)\b|\b(?:is|are|was|were|has been|have been)\s+(?:now\s+)?(?:completed|delivered|deployed|launched|released)\b|\b(?:we|i)\s+(?:have\s+)?(?:completed|delivered|deployed|launched|released|shipped)\b|\b(?:game|project|product|platform|development)\s+(?:is|remains)\s+still\s+(?:in|under)\s+development\b|项目(?:进展|更新|交付|完结)(?:报告|说明|更新)?|周报|(?:进展|状态|交付|完工|完成|最终|月度|周度)(?:更新|报告)|里程碑\s*[#第]?\s*[\d一二三四五六七八九十]+[^。！？]{0,80}(?:完成|交付|报告|更新|测试)|(?:游戏|项目|产品|平台)[^。！？]{0,16}(?:仍在|正在)开发)/i;
const nonProgressReplyPattern = /^(?:\s*(?:\[DIS\]|中文版|a quick housekeeping note\b|meeting minutes\b|会议纪要|持续问答更新|ongoing q\s*&\s*a updates?\b|thanks?\s+for\b|thank you\b|hi\s+(?!(?:everyone|community|nervos)\b)@?[^,，!！]{1,100}[,，!！]|in regards to\b))/i;
const governanceOnlyUpdatePattern = /^(?:\s*(?:\d{4}[/.-]\d{1,2}[/.-]\d{1,2}\s*)?(?:update\s*[:：-]\s*)?(?:(?:the|our|this)\s+)?(?:proposal|poll|vote|voting)\b.{0,180}\b(?:passed|approved|rejected|live|open|closed|restarted|quorum)|\s*(?:更新\s*[:：-]?\s*)?(?:投票|提案投票).{0,180}(?:开始|进行|通过|未通过|结束|关闭|作废|重启|门槛)|\s*[^。！？\n]{0,50}(?:投票更新|投票同步|提案通过)|\s*[^。！？\n]{0,90}(?:投票提案|voting proposal).{0,180}(?:关闭|作废|重启|closed|invalid|restarted))/i;
const proposalEditOnlyPattern = /^(?:\s*(?:proposal update|proposal amendment|提案更新)|\s*update\s*[:：-]\s*(?:i|we)\s+(?:have\s+)?changed\s+the\s+timeline\b)/i;

const explicitProgressPattern = /(?:\b(?:weekly|bi[\s-]?weekly|monthly|quarterly|annual|yearly|status|progress|project|development|milestone|completion|delivery|final|test|testing)\s+(?:updates?|reports?)\b|\b(?:week|month|quarter|year|milestone|phase|stage)\s*#?\d+\s*(?:updates?|reports?|completed|complete|delivered)\b|\bq[1-4]\s+(?:updates?|reports?)\b|\b(?:update|report)\s*#\s*\d+\b|周报|双周报|月报|季报|年报|状态更新|(?:项目|工作)?进展(?:更新|报告)|进度(?:更新|报告)|项目更新|里程碑(?:报告|更新|进展)|里程碑\s*[#第]?[一二三四五六七八九十\d]+\s*(?:已完成|完成|已交付)|结项报告|完结报告|完成报告|交付报告)/i;
// Procurement and deployment starts are observed work, even without a
// formal report heading. Modal, conditional and negated clauses are not proof.
export function hasObservedOperationalWork(text = '') {
  const clauses = text.split(/(?<=[.!?。！？])\s+|[\n；;]/);
  return clauses.some(clause => {
    const line = clause.replace(/\s+/g, ' ').trim();
    if (!line || /[?？]$/.test(line) || /\b(?:will|would|could|should|might|may|if|when|unless|once|plan(?:s|ned|ning)?|intend(?:s|ed)?|not|never|haven't|hasn't|didn't)\b|(?:尚未|未曾|没有|计划|打算|将会|如果|待到)/i.test(line)) return false;
    return /^(?:servers?|machines?|hardware|equipment|nodes?)\s+(?:(?:have|has)\s+been\s+|were\s+|was\s+|are\s+|is\s+)?(?:ordered|purchased|paid for|provisioned|deployed)\b/i.test(line)
      || /\b(?:we|i)\s+(?:(?:have|has|had|just|already)\s+)*(?:ordered|purchased|bought|paid for|provisioned)\b[^.!?]{0,140}\b(?:servers?|machines?|hardware|equipment|nodes?|hosting)\b/i.test(line)
      || /^(?:setup|deployment|provisioning)\s+(?:(?:has|have)\s+)?(?:started|begun|starts now|is underway|is in progress)\b/i.test(line)
      || /(?:已(?:经)?(?:订购|采购|支付|付款|部署)|部署(?:现在|现已|已经)?开始|开始部署)/.test(line);
  });
}

// A past grant's delivery and maintenance are not deliverables of the proposal
// hosting the reply. In a retrospective/Q&A reply, accept only an explicitly
// attributed current-proposal paragraph; leave ambiguous cross-project work out.
export function currentProposalProgressText(text = '') {
  const retrospective = /\b(?:my|our|the)\s+(?:previous|earlier|prior)\s+(?:community fund\s+)?grant\s+(?:was|is)\b|(?:我|我们)(?:此前|之前|过去)的(?:社区基金)?资助项目/.test(text.slice(0, 800).toLowerCase());
  const firstLine = text.trim().split(/\n+/)[0] || '';
  const historyHeading = /\b(?:previous|earlier|prior|past)\s+(?:community fund\s+)?(?:grants?|projects?)\b/i.test(firstLine);
  const answers = /\b(?:i|we)(?:['’]ll| will)\s+(?:answer|address)\s+(?:each|your|these|the)\s+(?:questions?|points?)\b|\b(?:answering your questions|here are (?:my|our) answers|responses? to (?:your|the) questions)\b|逐一回答|答复.{0,15}问题/i.test(text.slice(0, 800));
  if (!retrospective && !historyHeading && !answers) return text;
  return text.split(/\n+/).filter(line => /^(?:(?:for|under|as part of)\s+(?:this|the current)\s+(?:proposal|project|grant)\b|(?:this|current)\s+(?:proposal|project)\s*[:：]|(?:本提案|本项目)(?:新增工作|进展|交付)?[：:])/i.test(line.trim()) && !/\[(?:CONFIRM|TODO|TBD)\b[^\]]*\]/i.test(line)).map(line => line.split(/(?<=[.!?。！？])\s+/)[0]).join('\n');
}

// A report mentioned in a reply is not a completion report for this grant.
// Accept a leading report title or an explicit, non-hypothetical statement that
// the current proposal's entire scope is complete; never a body keyword alone.
export function hasCurrentCompletionReport(text = '') {
  text = currentProposalProgressText(text);
  const lines = text.split(/\n+/).map(line => line.trim()).filter(Boolean);
  const heading = (lines.find(line => !/^(?:(?:hi|hello|hey)(?: everyone| community| all)?[!,. ]*|大家好[！!，,。]*)$/i.test(line)) || '').replace(/^#+\s*|^\[|\]$/g, '');
  const reference = /\b(?:previous|earlier|prior|past|old|draft|posted|published|reference)\b|\[(?:CONFIRM|TODO|TBD)\b|往期|此前|旧项目|草稿|待确认/i;
  const narrative = /^(?:here|please|see|read|i|we|you|my|our)\b|\b(?:is|was|are|from|background|context)\b|^(?:请看|参考|这里|这是)/i.test(heading);
  if (!narrative && !reference.test(heading) && (/^[^.!?\n]{0,120}\b(?:completion|final)\s+report(?:\s*[—–:：-]\s*[^.!?]{1,100})?[.!]?$/i.test(heading) || /^[^。！？\n]{0,80}(?:结项|完结|完成)报告[。！]?$/.test(heading))) return true;
  return lines.some(line => !reference.test(line) && !/\b(?:will|would|could|should|may|might|if|when|not|never)\b|计划|尚未|如果|将会/i.test(line)
    && /\b(?:this|our|the current)\s+(?:project|proposal|grant)\s+(?:is|has been)\s+(?:now\s+)?(?:complete|completed)\b|\b(?:we|i)\s+(?:have\s+)?completed\s+all\s+(?:work|deliverables?|milestones?)\s+for\s+(?:this|our|the current)\s+(?:proposal|project|grant)\b|本(?:提案|项目)(?:承诺的)?(?:全部工作|全部交付物)?(?:现已|已经|已)全部完成/i.test(line));
}

export function isProposalProgressUpdate(text = '') {
  text = currentProposalProgressText(text);
  if (isProposalScopeRevision(text)) return false;
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (nonProgressReplyPattern.test(normalized) || governanceOnlyUpdatePattern.test(normalized) || proposalEditOnlyPattern.test(normalized)) return false;
  // A proposer may publish concrete test results as a reply without a report
  // heading. Require both an executed successful run and technical evidence.
  // A plan to publish a report, a hypothetical completed milestone, and a
  // quoted prior release are not completed work. Keep real report headings
  // and observed actions even when a later paragraph describes future steps.
  const observed = text.split(/(?<=[.!?。！？])\s+|[\n；;]/)
    .filter(line => !/[?？]\s*$/.test(line)
      && !/\b(?:will|would|could|should|might|may|if|when|unless|once|planned|upcoming|not|never|haven't|hasn't|didn't)\b|(?:尚未|未曾|没有|计划|打算|将会|如果)/i.test(line))
    .join('\n');
  const attributable = hasCurrentCompletionReport(observed) ? observed : observed.replace(/\b(?:final|completion)\s+reports?\b|\bproject\s+completion\b|结项报告|完结报告|完成报告/gi, '');
  return progressUpdatePattern.test(attributable) || explicitProgressPattern.test(attributable)
    || isCompletedTestRun(observed) || hasObservedOperationalWork(text);
}
