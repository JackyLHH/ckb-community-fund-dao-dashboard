// Classify the complete, unquoted source post before extracting its display
// title. A concise report title may not itself contain every progress keyword.
const progressUpdatePattern = /(?:\b(?:status|project|development|progress|product delivery|delivery|completion|final|weekly|monthly|month\s*\d+)\s+(?:updates?|reports?)\b|\b(?:update|report)\s*[:：#-]|\bmilestone\s*#?\s*\d+[^.!?]{0,100}\b(?:complete|completed|delivered|report|update|testing)\b|\b(?:is|are|was|were|has been|have been)\s+(?:now\s+)?(?:completed|delivered|deployed|launched|released)\b|\b(?:we|i)\s+(?:have\s+)?(?:completed|delivered|deployed|launched|released|shipped)\b|\b(?:game|project|product|platform|development)\s+(?:is|remains)\s+still\s+(?:in|under)\s+development\b|项目(?:进展|更新|交付|完结)(?:报告|说明|更新)?|周报|(?:进展|状态|交付|完工|完成|最终|月度|周度)(?:更新|报告)|里程碑\s*[#第]?\s*[\d一二三四五六七八九十]+[^。！？]{0,80}(?:完成|交付|报告|更新|测试)|(?:游戏|项目|产品|平台)[^。！？]{0,16}(?:仍在|正在)开发)/i;
const nonProgressReplyPattern = /^(?:\s*(?:\[DIS\]|中文版|a quick housekeeping note\b|meeting minutes\b|会议纪要|持续问答更新|ongoing q\s*&\s*a updates?\b|thanks?\s+for\b|thank you\b|hi\s+(?!(?:everyone|community|nervos)\b)@?[^,，!！]{1,100}[,，!！]|in regards to\b))/i;
const governanceOnlyUpdatePattern = /^(?:\s*(?:\d{4}[/.-]\d{1,2}[/.-]\d{1,2}\s*)?(?:update\s*[:：-]\s*)?(?:(?:the|our|this)\s+)?(?:proposal|poll|vote|voting)\b.{0,180}\b(?:passed|approved|rejected|live|open|closed|restarted|quorum)|\s*(?:更新\s*[:：-]?\s*)?(?:投票|提案投票).{0,180}(?:开始|进行|通过|未通过|结束|关闭|作废|重启|门槛)|\s*[^。！？\n]{0,50}(?:投票更新|投票同步|提案通过)|\s*[^。！？\n]{0,90}(?:投票提案|voting proposal).{0,180}(?:关闭|作废|重启|closed|invalid|restarted))/i;
const proposalEditOnlyPattern = /^(?:\s*(?:proposal update|proposal amendment|提案更新)|\s*update\s*[:：-]\s*(?:i|we)\s+(?:have\s+)?changed\s+the\s+timeline\b)/i;

export function isProposalProgressUpdate(text = '') {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (nonProgressReplyPattern.test(normalized) || governanceOnlyUpdatePattern.test(normalized) || proposalEditOnlyPattern.test(normalized)) return false;
  return progressUpdatePattern.test(normalized);
}
