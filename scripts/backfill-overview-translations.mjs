import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { proposalCardSummariesById } from '../lib/proposal-card-summaries.ts';
import { proposalOverridesById } from '../lib/proposal-overrides.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const proposalsPath = path.join(root, 'data/proposals.generated.json');
const outputPath = path.join(root, 'data/proposal-overview-translations.json');
const dataset = JSON.parse(fs.readFileSync(proposalsPath, 'utf8'));
const existing = fs.existsSync(outputPath)
  ? JSON.parse(fs.readFileSync(outputPath, 'utf8')).translations ?? {}
  : {};

function containsChinese(value = '') {
  return /[\u3400-\u9fff]/u.test(value);
}

function sourceObjective(proposal, override) {
  return String(override?.overview?.objective ?? proposal?.overview?.objective ?? proposal?.summary ?? '').trim();
}

async function translate(text, target) {
  const url = new URL('https://api.mymemory.translated.net/get');
  url.searchParams.set('q', text);
  url.searchParams.set('langpair', target === 'zh' ? 'en|zh-CN' : 'zh-CN|en');
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Translation request failed with ${response.status}`);
  const result = await response.json();
  const value = result.responseData?.translatedText?.trim();
  if (!value || result.quotaFinished || result.responseStatus !== 200) {
    throw new Error(`Translation service did not return ${target} text`);
  }
  return value;
}

const proposalsById = new Map(dataset.proposals.map((proposal) => [String(proposal.id), proposal]));
for (const [id, override] of Object.entries(proposalOverridesById)) {
  if (override.overview && !proposalsById.has(id)) proposalsById.set(id, { id });
}

const translations = {};
let generated = 0;
for (const [id, proposal] of [...proposalsById].sort(([left], [right]) => Number(left) - Number(right))) {
  const override = proposalOverridesById[id];
  const card = proposalCardSummariesById[id];
  const generic = sourceObjective(proposal, override);
  let en = override?.overview?.objectiveEn?.trim()
    || card?.en?.trim()
    || existing[id]?.en?.trim()
    || proposal.overview?.objectiveEn?.trim()
    || (!containsChinese(generic) ? generic : '');
  let zh = override?.overview?.objectiveZh?.trim()
    || card?.zh?.trim()
    || existing[id]?.zh?.trim()
    || proposal.overview?.objectiveZh?.trim()
    || (containsChinese(generic) ? generic : '');

  if (!en && zh) {
    en = await translate(zh, 'en');
    generated += 1;
  }
  if (!zh && en) {
    zh = await translate(en, 'zh');
    generated += 1;
  }
  if (!en || !zh) throw new Error(`Proposal ${id} does not have a complete overview to backfill`);
  translations[id] = { zh, en };
}

fs.writeFileSync(outputPath, `${JSON.stringify({ version: 1, translations }, null, 2)}\n`);
console.log(`Saved ${Object.keys(translations).length} bilingual proposal overviews (${generated} newly translated).`);
