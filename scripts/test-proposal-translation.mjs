import assert from 'node:assert/strict';
import {
  needsProposalOverviewTranslation,
  translateMissingProposalOverview,
} from '../lib/proposal-translation.ts';

function proposalWith(overview) {
  return {
    id: '99999',
    overview,
  };
}

const englishOnly = proposalWith({
  objective: 'An English proposal overview.',
  objectiveEn: 'An English proposal overview.',
  milestones: [],
});
assert.equal(needsProposalOverviewTranslation(englishOnly), true);

let requests = 0;
const translatedToChinese = await translateMissingProposalOverview(englishOnly, async (_url, init) => {
  requests += 1;
  assert.equal(typeof init?.body, 'string');
  const body = JSON.parse(init.body);
  assert.equal(body.target, 'zh');
  assert.equal(body.text, 'An English proposal overview.');
  return Response.json({ ok: true, translation: '一段英文提案概览。' });
});
assert.equal(translatedToChinese.overview.objectiveEn, 'An English proposal overview.');
assert.equal(translatedToChinese.overview.objectiveZh, '一段英文提案概览。');

const humanBilingual = proposalWith({
  objective: 'Human English.',
  objectiveEn: 'Human English.',
  objectiveZh: '人工中文。',
  milestones: [],
});
const unchanged = await translateMissingProposalOverview(humanBilingual, async () => {
  throw new Error('A bilingual editorial overview must not call automatic translation.');
});
assert.equal(unchanged, humanBilingual);
assert.equal(requests, 1);

const chineseOnly = proposalWith({ objective: '人工提供的中文概览。', milestones: [] });
const translatedToEnglish = await translateMissingProposalOverview(chineseOnly, async (_url, init) => {
  assert.equal(typeof init?.body, 'string');
  const body = JSON.parse(init.body);
  assert.equal(body.target, 'en');
  return Response.json({ ok: true, translation: 'A manually supplied Chinese overview.' });
});
assert.equal(translatedToEnglish.overview.objectiveZh, '人工提供的中文概览。');
assert.equal(translatedToEnglish.overview.objectiveEn, 'A manually supplied Chinese overview.');

console.log('Validated automatic proposal overview translation fallbacks.');
