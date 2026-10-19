import { readFile, writeFile } from 'node:fs/promises';
import { parseMetaforoVoteCard, sourceProposalId } from '../lib/metaforo-voting.ts';
import { voteEvidenceByProposalId } from '../lib/status-evidence.ts';

const output = new URL('../data/votes.generated.json', import.meta.url);
const saved = JSON.parse(await readFile(output, 'utf8'));
const next = structuredClone(saved);
const lifecycle = JSON.parse(await readFile(new URL('../data/lifecycle.generated.json', import.meta.url), 'utf8'));
const enabledAt = Date.parse(lifecycle.enabledAt || new Date().toISOString());
const domain = 'https://dao.ckb.community';
const knownByThread = new Map(Object.entries({ ...saved.votes, ...voteEvidenceByProposalId })
  .map(([id, vote]) => [vote.url.match(/-(\d+)$/)?.[1], { id, vote }]));
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true });
let failures = 0;
const seen = new Set();
try {
  for (let page = 1; page <= 30; page += 1) {
    const params = new URLSearchParams({ page: String(page), per_page: '20', filter: 'all', category_index_id: '1', tag_id: '0', sort: 'latest', group_name: 'neurontest' });
    const response = await fetch(`${domain}/api/thread/list?${params}`, {
      headers: { api_key: 'metaforo_website', Accept: 'application/json' },
      signal: AbortSignal.timeout(20_000),
    });
    const result = await response.json();
    if (!response.ok || result.code !== 20000 || !Array.isArray(result.data?.threads)) throw new Error('Metaforo directory unavailable');
    const threads = result.data.threads;
    let newThreads = 0;
    for (const thread of threads) {
      if (seen.has(thread.id)) continue;
      seen.add(thread.id);
      newThreads += 1;
      if (!/^\s*\[VOT\]/i.test(thread.title) || !['on', 'expire'].includes(thread.poll_status)) continue;
      const known = knownByThread.get(String(thread.id));
      // Closed, reviewed historical votes include committee corrections. Never
      // replace those with the uncorrected Metaforo tally.
      if (known?.vote.closed && known.vote.status !== 'active') continue;
      // Preserve legacy/manual history; automatically discover recent and all
      // future voting threads without repeatedly scraping years-old polls.
      if (!known && Date.parse(thread.updated_at) < Date.now() - 90 * 86400000) continue;
      const id = known?.id || sourceProposalId(thread.first_post?.content || '');
      if (!id) { failures += 1; console.error(`No unambiguous source proposal for vote ${thread.id}`); continue; }
      const tab = await browser.newPage();
      try {
        const url = `${domain}/thread/${thread.slug}`;
        await tab.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
        const card = tab.locator('.poll-card-style').filter({ hasText: 'quorum' });
        await card.waitFor({ state: 'visible', timeout: 45_000 });
        await card.getByText('Votes required to pass', { exact: true }).waitFor({ state: 'visible', timeout: 20_000 });
        if (thread.poll_status === 'on') {
          await card.getByText(/Voting ends in\s+\d/i).waitFor({ state: 'visible', timeout: 20_000 });
        }
        const vote = parseMetaforoVoteCard(await card.innerText(), url);
        if ((thread.poll_status === 'expire') !== vote.closed) throw new Error('Directory/card closure mismatch; retry next run');
        if (!vote.closed && !vote.closesAt) throw new Error('Voting deadline unavailable; retain the previous verified snapshot');
        const previous = next.votes[id]?.url === url ? next.votes[id] : undefined;
        vote.openedAt = previous?.openedAt || new Date(thread.updated_at).toISOString();
        if (vote.closed && (previous?.status === 'active' || Date.parse(vote.openedAt) >= enabledAt)) {
          // The public card does not expose a reliable historical close time.
          // Retain the first *observed* closure, never the latest recheck time.
          vote.closedAt = previous?.closedAt || vote.verifiedAt;
        }
        // Refresh active observations so stale-data detection remains useful;
        // closed results are written once and no longer polled.
        if (JSON.stringify(previous) !== JSON.stringify(vote)) next.votes[id] = vote;
        console.log(`Proposal ${id}: ${vote.status}, ${vote.totalVotes} votes, ${vote.yesPercent}% yes`);
      } catch (error) {
        failures += 1;
        console.error(`Vote ${thread.id}: ${error.message}`);
      } finally { await tab.close(); }
    }
    if (threads.length < 20 || !newThreads) break;
  }
} finally { await browser.close(); }
await writeFile(output, `${JSON.stringify(next, null, 2)}\n`);
if (failures) process.exitCode = 1;
