// Reviewed proposer statements only. A withdrawal closes this application;
// it neither establishes a vote result nor stops development of the project.
export const proposalWithdrawalsById = {
  '11228': {
    author: 'ebubedev',
    withdrawnAt: '2026-11-26T10:58:32.686Z',
    sourceUrl: 'https://talk.nervos.org/t/11228/34',
    noteZh: '提案人已撤回本次资助申请，将继续开发，待进一步完善后重新提出申请。这不代表停止开发、投票未通过或项目已完成。',
    noteEn: 'The proposer withdrew this funding application and will continue development, returning with a revised proposal when it is in better shape. This is not a development halt, a failed vote, or project completion.',
  },
};

export function reviewedProposalWithdrawal(id, now = Date.now()) {
  const evidence = proposalWithdrawalsById[id];
  return evidence && Date.parse(evidence.withdrawnAt) <= now ? evidence : null;
}
