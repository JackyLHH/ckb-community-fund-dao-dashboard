import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { extractProgressUpdateTitle, isManualProposalUpdate } from '../lib/proposal-update-title.ts';
import { isProposalProgressUpdate } from '../lib/proposal-progress.ts';

// This targeted migration changes only saved automatic update titles and their
// verified forum provenance. It never regenerates proposal facts, drops old
// records, or edits human-reviewed overrides. Run with --check for a dry run.
const outputPath = fileURLToPath(new URL('../data/proposals.generated.json', import.meta.url));
const checkOnly = process.argv.slice(2).includes('--check');
if (process.argv.slice(2).some((argument) => argument !== '--check')) {
  throw new Error('Usage: node --experimental-strip-types scripts/backfill-update-titles.mjs [--check]');
}
const dataset = JSON.parse(await readFile(outputPath, 'utf8'));
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const failures = [];
const changedTitles = [];
let requests = 0;
let skippedManual = 0;
let successfulRows = 0;
let preservedUnqualified = 0;
let verifiedForumRows = 0;
let provenanceAdded = 0;

function sourceLocation(value) {
  try {
    const url = new URL(value);
    if (url.origin !== 'https://talk.nervos.org') return null;
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.shift() !== 't') return null;
    if (!/^\d+$/.test(parts[0] ?? '')) parts.shift();
    const [topicId, postNumber = '1'] = parts;
    if (!/^\d+$/.test(topicId ?? '') || !/^\d+$/.test(postNumber)) return null;
    return { topicId, postNumber: Number(postNumber) };
  } catch {
    return null;
  }
}

function unquotedText(cooked = '') {
  return cooked
    .replace(/<aside\b[^>]*>[\s\S]*?<\/aside>/gi, ' ')
    .replace(/<blockquote\b[^>]*>[\s\S]*?<\/blockquote>/gi, ' ')
    .replace(/<\/(?:p|h[1-6]|li)>|<br\b[^>]*>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchTopic(topicId, postNumber, attempt = 0) {
  const url = new URL(`https://talk.nervos.org/t/${topicId}.json`);
  if (postNumber !== undefined) url.searchParams.set('post_number', String(postNumber));
  requests++;
  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'CKB-Community-Fund-Dashboard/1.0' },
      signal: AbortSignal.timeout(25_000),
    });
    if (!response.ok) {
      if (attempt < 3 && (response.status === 429 || response.status >= 500)) {
        const retryAfter = Number(response.headers.get('retry-after'));
        await delay(Math.min(30_000, Math.max((retryAfter || 0) * 1000, 1500 * (attempt + 1))));
        return fetchTopic(topicId, postNumber, attempt + 1);
      }
      throw new Error(`HTTP ${response.status}`);
    }
    const result = await response.json();
    if (!Array.isArray(result.post_stream?.posts)) throw new Error('Missing public post stream');
    return result;
  } finally {
    // Two topic workers, plus a pause after every request, avoid a burst of
    // independent per-post reads against the public community forum.
    await delay(300);
  }
}

const groups = new Map();
for (const proposal of dataset.proposals) {
  for (const update of proposal.updates ?? []) {
    if (isManualProposalUpdate(String(proposal.id), update)) {
      skippedManual++;
      continue;
    }
    const location = sourceLocation(update.url);
    if (!location) {
      failures.push({ proposalId: proposal.id, url: update.url, error: 'Unsupported source URL; preserved original record' });
      continue;
    }
    const entries = groups.get(location.topicId) ?? [];
    entries.push({ proposal, update, ...location });
    groups.set(location.topicId, entries);
  }
}

const queue = [...groups.entries()];
let cursor = 0;
async function worker() {
  while (cursor < queue.length) {
    const [topicId, entries] = queue[cursor++];
    let detail;
    try {
      detail = await fetchTopic(topicId);
    } catch (error) {
      failures.push(...entries.map(({ proposal, update }) => ({ proposalId: proposal.id, url: update.url, error: error.message })));
      continue;
    }
    const posts = new Map(detail.post_stream.posts.map((post) => [post.post_number, post]));
    const proposer = posts.get(1)?.username;
    for (const { proposal, update, postNumber } of entries) {
      if (!posts.has(postNumber)) {
        try {
          const window = await fetchTopic(topicId, postNumber);
          for (const post of window.post_stream.posts) posts.set(post.post_number, post);
        } catch (error) {
          failures.push({ proposalId: proposal.id, url: update.url, error: error.message });
          continue;
        }
      }
      const post = posts.get(postNumber);
      if (!post || typeof post.cooked !== 'string' || !proposer) {
        failures.push({ proposalId: proposal.id, url: update.url, error: 'Requested post or original proposer missing; preserved original record' });
        continue;
      }
      successfulRows++;
      const sameAuthor = typeof post.username === 'string'
        && post.username.trim().toLocaleLowerCase() === proposer.trim().toLocaleLowerCase();
      if (!sameAuthor || postNumber <= 1 || !isProposalProgressUpdate(unquotedText(post.cooked))) {
        preservedUnqualified++;
        continue;
      }
      verifiedForumRows++;
      const title = extractProgressUpdateTitle(post.cooked, update.title);
      // A full report may contain progress words deep in a conversational
      // response. Preserve the previous fallback exclusion unless this
      // migration found a real report title or its prior title qualified.
      const preservePriorExclusion = title === update.title
        && !isProposalProgressUpdate(update.title);
      if (title && title !== update.title) {
        changedTitles.push({ proposalId: proposal.id, url: update.url, previousTitle: update.title, title });
        update.title = title;
        // Automatically produced translations of the old combined excerpt
        // cannot be reused for a new title. Reviewed URLs were excluded above.
        delete update.titleZh;
        delete update.titleEn;
      }
      if (preservePriorExclusion) continue;
      if (update.source !== 'forum') provenanceAdded++;
      update.source = 'forum';
    }
  }
}
await Promise.all(Array.from({ length: Math.min(2, queue.length) }, worker));

if (!checkOnly && (changedTitles.length || provenanceAdded)) {
  await writeFile(outputPath, `${JSON.stringify(dataset, null, 2)}\n`);
}
console.log(JSON.stringify({
  checkOnly,
  proposals: dataset.proposals.length,
  rawUpdateRows: dataset.proposals.reduce((count, proposal) => count + (proposal.updates?.length ?? 0), 0),
  skippedManual,
  sourceTopics: queue.length,
  requests,
  successfulRows,
  verifiedForumRows,
  preservedUnqualified,
  provenanceAdded,
  changedTitleCount: changedTitles.length,
  failedRows: failures.length,
  changedTitles,
  failures,
}, null, 2));
if (failures.length) process.exitCode = 1;
