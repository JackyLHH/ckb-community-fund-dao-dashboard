// Forum workflow markers are not part of a proposal's display title. Remove
// every occurrence, including the second marker in bilingual source titles.
export function cleanProposalTitle(value = '') {
  return value.replace(/\[\s*DIS\s*\]|【\s*DIS\s*】|\(\s*DIS\s*\)/gi, ' ')
    .replace(/\s+/g, ' ').trim();
}

export function looksLikeProposal(title = '') {
  if (/^\s*(?:\[|【|\()\s*(?:status\s+update|ann|issue)\s*(?:\]|】|\))/i.test(title)) return false;
  return /^\s*(?:\[\s*DIS\s*\]|【\s*DIS\s*】|\(\s*DIS\s*\))/i.test(title)
    || /(grant|funding|sponsorship)\s+proposal|资助提案|赞助提案/i.test(title);
}
