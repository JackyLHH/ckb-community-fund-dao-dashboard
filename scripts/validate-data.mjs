import { readFile } from 'node:fs/promises';

const dataset = JSON.parse(await readFile(new URL('../data/proposals.generated.json', import.meta.url), 'utf8'));
const knownStatuses = new Set(['discussion', 'voting', 'executing', 'paused']);
const slugs = new Set();

if (dataset.meta.proposalCount !== dataset.proposals.length) {
  throw new Error('proposalCount does not match proposal records.');
}
if (dataset.treasury.fundedProposalCount !== 17) {
  throw new Error('The verified funded proposal count must remain 17 until the source is updated.');
}
if (dataset.proposals.filter((proposal) => proposal.funded).length !== 17) {
  throw new Error('Funded overrides do not match the verified funded proposal list.');
}

for (const proposal of dataset.proposals) {
  if (!proposal.id || !proposal.slug || !proposal.title || !proposal.originalUrl) throw new Error(`Missing required fields: ${proposal.id}`);
  if (slugs.has(proposal.slug)) throw new Error(`Duplicate slug: ${proposal.slug}`);
  slugs.add(proposal.slug);
  if (!knownStatuses.has(proposal.status)) throw new Error(`Unknown status: ${proposal.status}`);
  if (!proposal.sources?.length) throw new Error(`Missing sources: ${proposal.slug}`);
  if (!proposal.lastVerifiedAt) throw new Error(`Missing verification date: ${proposal.slug}`);
}

console.log(`Validated ${dataset.proposals.length} proposals and ${slugs.size} unique routes.`);
