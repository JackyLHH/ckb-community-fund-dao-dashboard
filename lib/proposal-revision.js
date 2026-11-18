// Shared by website progress selection and the digest.
export function isProposalScopeRevision(text = '') {
  // Evidence of an actual delivered report wins over a passing scope note.
  const reportHeading = /^(?:[^\n]{0,90}[:：]\s*)?(?:(?:weekly|bi[ -]?weekly|monthly|quarterly|annual|status|progress|completion)\s+(?:report|update)|milestone\s*[.#:]?\s*\d+\s+(?:completion\s+)?report|周报|双周报|月报|季报|年报|里程碑\s*\d+\s*(?:完成)?报告)/im;
  if (reportHeading.test(text)) return false;
  const feedbackEdit = /\b(?:i|we)\s+(?:(?:have|has|am|are|just|now)\s+)*(?:edited|revised|amended|updated)\s+(?:(?:the|this|our|my)\s+)?proposal\s+(?:to\s+(?:answer|respond|address|clarify|incorporate)|in\s+response\s+to|based\s+on)\b/i;
  if (feedbackEdit.test(text)) return true;
  return /\b(?:milestone\s*[.#:]?\s*\d+|proposal|scope|acceptance criteria)\s+(?:(?:is|has been|was)\s+)?(?:now\s+)?(?:updated|revised|amended|expanded)\s+to\s+(?:cover|include|address|clarify)\b|\b(?:updated|revised|amended|expanded)\s+(?:(?:the|our)\s+)?(?:proposal|scope|milestone\s*\d+)\s+to\s+(?:cover|include|address|clarify)\b|里程碑\s*\d+\s*(?:现已|已经|已)?\s*(?:更新|修改|调整)|(?:修改|调整|修订)(?:了)?(?:提案|里程碑|验收标准|范围)/i.test(text);
}
