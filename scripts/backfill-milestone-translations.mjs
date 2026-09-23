import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { proposalOverridesById } from '../lib/proposal-overrides.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const proposalsPath = path.join(root, 'data/proposals.generated.json');
const outputPath = path.join(root, 'data/proposal-milestone-translations.json');
const dataset = JSON.parse(fs.readFileSync(proposalsPath, 'utf8'));
const existing = fs.existsSync(outputPath)
  ? JSON.parse(fs.readFileSync(outputPath, 'utf8')).translations ?? {}
  : {};

function containsChinese(value = '') {
  return /[\u3400-\u9fff]/u.test(value);
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

async function bilingual(generic, explicitZh, explicitEn, savedZh, savedEn) {
  const source = String(generic ?? '').trim();
  let zh = String(explicitZh ?? '').trim()
    || (containsChinese(source) ? source : '')
    || String(savedZh ?? '').trim();
  let en = String(explicitEn ?? '').trim()
    || (!containsChinese(source) ? source : '')
    || String(savedEn ?? '').trim();
  let generated = 0;
  if (!zh && en) {
    zh = await translate(en, 'zh');
    generated += 1;
  }
  if (!en && zh) {
    en = await translate(zh, 'en');
    generated += 1;
  }
  return { zh, en, generated };
}

const proposalsById = new Map(dataset.proposals.map((proposal) => [String(proposal.id), proposal]));
for (const [id, override] of Object.entries(proposalOverridesById)) {
  if (override.overview?.milestones?.length && !proposalsById.has(id)) proposalsById.set(id, { id });
}

const translations = {};
let generated = 0;
let milestoneCount = 0;
for (const [id, proposal] of [...proposalsById].sort(([left], [right]) => Number(left) - Number(right))) {
  const override = proposalOverridesById[id];
  const milestones = override?.overview?.milestones?.length
    ? override.overview.milestones
    : proposal.overview?.milestones ?? [];
  if (!milestones.length) continue;
  translations[id] = [];
  for (let index = 0; index < milestones.length; index += 1) {
    const milestone = milestones[index];
    const saved = existing[id]?.[index];
    const title = await bilingual(
      milestone.title,
      milestone.titleZh,
      milestone.titleEn,
      saved?.titleZh,
      saved?.titleEn,
    );
    const description = await bilingual(
      milestone.description,
      milestone.descriptionZh,
      milestone.descriptionEn,
      saved?.descriptionZh,
      saved?.descriptionEn,
    );
    if (!title.zh || !title.en || !description.zh || !description.en) {
      throw new Error(`Proposal ${id} milestone ${index + 1} does not have complete bilingual content`);
    }
    generated += title.generated + description.generated;
    milestoneCount += 1;
    translations[id].push({
      titleZh: title.zh,
      titleEn: title.en,
      descriptionZh: description.zh,
      descriptionEn: description.en,
      budgetZh: milestone.budgetZh ?? saved?.budgetZh ?? milestone.budget ?? null,
      budgetEn: milestone.budgetEn ?? saved?.budgetEn ?? milestone.budget ?? null,
      etaZh: milestone.etaZh ?? saved?.etaZh ?? milestone.eta ?? null,
      etaEn: milestone.etaEn ?? saved?.etaEn ?? milestone.eta ?? null,
    });
  }
}

fs.writeFileSync(outputPath, `${JSON.stringify({ version: 1, translations }, null, 2)}\n`);
console.log(`Saved ${milestoneCount} bilingual milestones for ${Object.keys(translations).length} proposals (${generated} newly translated).`);
