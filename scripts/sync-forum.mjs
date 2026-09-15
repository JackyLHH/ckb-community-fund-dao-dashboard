import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const outputPath = resolve(here, '../data/proposals.generated.json');
const baseUrl = 'https://talk.nervos.org';
const categoryPath = '/c/daos-funding/ckb-community-fund-dao/65.json';
const checkedAt = new Date().toISOString();

const fundedOverrides = [
  ['Nervos Nation community grant proposal', '10,339,123 CKB'],
  ['CKBFans Community grant Proposal', '1,315,789 CKB'],
  ['AMA on r/Cryptocurrency subreddit', '107,917 CKB'],
  ['CKB Community DAO Proposal', '122,602 CKB', '项目未能继续；首笔款项中的 1,477,398 CKB 已退回。'],
  ['JoyGift Phase 1 Sponsorship Proposal', '2,386,635 CKB'],
  ['Build and Distribute Efficient Network Nodes', '1,477,429 CKB'],
  ['Spore Protocol Mainnet Launch Sponsorship Proposal', '507,364 CKB'],
  ['Omiga Inscription Protocol Sponsorship Proposal', '18,791,558 CKB', 'Milestone 7、8 尚未拨付。'],
  ['Telmo Talks', '702,954 CKB'],
  ['Palmyra: RWA Lending on Nervos', '5,966,943.14 CKB', '团队未达到原约定条件与时间表，已向 DAO 退回 656,363 CKB。'],
  ['iCKB & dCKB Rescuer Funding Proposal', '673,400 CKB'],
  ['CKBoost Gamified Community Engagement Platform Proposal', '$20,000 USD', 'Milestone 3 尚未拨付。'],
  ['Community Fund DAO v1.1 Web5', '$100,000 USD', '提案人决定终止项目，Milestone 2、3 未拨付。'],
  ['CKB Integration for Rosen Bridge', '$65,000 USD', '目前仅 Milestone 1 已拨付。'],
  ['Fiber Link: A CKB Fiber-based Pay Layer', '$20,000 USD', 'Milestone 1、2 已拨付。'],
  ['Mobile-Ready CKB Light Client', '$15,000 USD', 'Milestone 4 尚未拨付。'],
  ['Decentralized privacy order-book appchain', '$24,000 USD', '目前仅 Milestone 1 已拨付。'],
];

const statusOverrides = new Map([
  ['CKB Community DAO Proposal', 'paused'],
  ['Palmyra: RWA Lending on Nervos', 'paused'],
  ['Community Fund DAO v1.1 Web5', 'paused'],
]);

const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));

async function fetchJson(url, attempt = 0) {
  const response = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'CKB-Community-Fund-Dashboard/1.0' },
    signal: AbortSignal.timeout(25000),
  });
  if (!response.ok) {
    if (attempt < 5 && (response.status === 429 || response.status >= 500)) {
      const retryAfterSeconds = Number(response.headers.get('retry-after') ?? 0);
      await sleep(Math.max(retryAfterSeconds * 1000, 2000 * (attempt + 1)));
      return fetchJson(url, attempt + 1);
    }
    throw new Error(`${response.status} ${response.statusText}: ${url}`);
  }
  return response.json();
}

function decodeEntities(input = '') {
  return input
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function stripHtml(input = '') {
  return decodeEntities(
    input
      .replace(/<br\s*\/?\s*>/gi, ' ')
      .replace(/<\/p>/gi, ' ')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  );
}

function looksLikeProposal(title) {
  const normalized = title.trim();
  if (/^\s*(?:\[|\()\s*(?:status\s+update|ann|issue)\s*(?:\]|\))/i.test(normalized)) return false;
  if (/^\s*(?:\[|\()\s*DIS\s*(?:\]|\))/i.test(normalized)) return true;
  return /(grant|funding|sponsorship)\s+proposal|资助提案|赞助提案/i.test(normalized);
}

function cleanTitle(title) {
  return title
    .replace(/^\s*(?:\[|\()\s*DIS\s*(?:\]|\))\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function classify(title, tags = []) {
  const haystack = `${title} ${tags.join(' ')}`.toLowerCase();
  if (/rule|governance|dao v|规则|治理/.test(haystack)) return 'Governance';
  if (/content|media|campaign|talk show|translation|community|meetup|ama/.test(haystack)) return 'Community & Content';
  if (/fiber|bridge|light client|node|wallet|appchain|infrastructure|sdk|protocol/.test(haystack)) return 'Infrastructure';
  if (/art|nft|game|creator|studio/.test(haystack)) return 'Apps';
  return 'Ecosystem';
}

function extractBudget(text) {
  const patterns = [
    /(?:grant amount|amount requested|requested amount|total budget|budget requested|申请金额|申请资金|预算)\s*[:：-]?\s*((?:USD\s*)?\$?\s*[\d,.]+\s*(?:USD|USDT|CKB(?:s)?)?)/i,
    /(?:requesting|request)\s+(?:a\s+)?((?:USD\s*)?\$\s*[\d,.]+\s*(?:USD|USDT)?)/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].replace(/\s+/g, ' ').trim();
  }
  return null;
}

function extractLinks(html = '') {
  return [...html.matchAll(/href=["']([^"']+)["']/gi)]
    .map((match) => decodeEntities(match[1]))
    .filter((url) => /^https?:\/\//.test(url));
}

function findFundedOverride(title) {
  return fundedOverrides.find(([needle]) => title.toLowerCase().includes(needle.toLowerCase()));
}

async function mapWithConcurrency(items, limit, task) {
  const output = Array.from({ length: items.length });
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      output[index] = await task(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return output;
}

async function loadCategoryTopics() {
  const topicsById = new Map();
  for (let page = 0; page < 30; page += 1) {
    const data = await fetchJson(`${baseUrl}${categoryPath}?page=${page}`);
    const topics = data.topic_list?.topics ?? [];
    for (const topic of topics) topicsById.set(topic.id, topic);
    if (!data.topic_list?.more_topics_url || topics.length === 0) break;
  }
  return [...topicsById.values()].filter((topic) => looksLikeProposal(topic.title));
}

async function enrichTopic(topic) {
  let detail = null;
  try {
    detail = await fetchJson(`${baseUrl}/t/${topic.id}.json`);
  } catch (error) {
    console.warn(`Could not enrich topic ${topic.id}: ${error.message}`);
  }

  const firstPost = detail?.post_stream?.posts?.[0];
  const cooked = firstPost?.cooked ?? '';
  const text = stripHtml(cooked || topic.excerpt || '');
  const links = extractLinks(cooked);
  const votingUrl = links.find((url) => /dao\.ckb\.community|metaforo/i.test(url));
  const funded = findFundedOverride(topic.title);
  const clean = cleanTitle(topic.title);
  const explicitStatus = [...statusOverrides.entries()].find(([needle]) =>
    topic.title.toLowerCase().includes(needle.toLowerCase()),
  )?.[1];
  const status = explicitStatus ?? (funded ? 'executing' : votingUrl ? 'voting' : 'discussion');

  const updates = (detail?.post_stream?.posts ?? [])
    .filter((post) => post.post_number > 1 && /status update|milestone|progress update|进展|里程碑/i.test(stripHtml(post.cooked)))
    .slice(-6)
    .map((post) => ({
      title: stripHtml(post.cooked).slice(0, 130),
      date: post.created_at,
      url: `${baseUrl}/t/${topic.slug}/${topic.id}/${post.post_number}`,
      author: post.username,
    }));

  const author = firstPost?.username ?? topic.posters?.[0]?.user_id?.toString() ?? 'Unknown';
  const budgetLabel = funded?.[1] ?? extractBudget(text);
  const statusReason = funded
    ? funded[2] ?? '该项目列于社区维护的已资助提案清单中。'
    : votingUrl
      ? '原始讨论帖包含 Metaforo 投票链接；投票结果仍需在来源页核验。'
      : '已发现讨论提案；尚未发现可核验的投票或拨款证据。';

  return {
    id: String(topic.id),
    slug: topic.slug,
    title: clean,
    originalTitle: topic.title,
    summary: text.slice(0, 300) || '原帖未提供可提取的摘要。',
    author,
    originalUrl: `${baseUrl}/t/${topic.slug}/${topic.id}`,
    createdAt: topic.created_at,
    updatedAt: topic.last_posted_at ?? topic.bumped_at ?? topic.created_at,
    tags: topic.tags ?? [],
    projectType: classify(topic.title, topic.tags),
    budgetLabel,
    discussion: {
      likes: firstPost?.like_count ?? topic.like_count ?? null,
      replies: topic.reply_count ?? Math.max(0, (topic.posts_count ?? 1) - 1),
      views: topic.views ?? null,
    },
    voting: votingUrl ? { url: votingUrl, status: 'unknown' } : null,
    funded: Boolean(funded),
    fundingNote: funded?.[2] ?? null,
    updates,
    status,
    statusReason,
    lastVerifiedAt: checkedAt,
    sources: [
      { label: 'Nervos Talk proposal', url: `${baseUrl}/t/${topic.slug}/${topic.id}` },
      ...(funded
        ? [{ label: 'List of funded proposals', url: `${baseUrl}/t/list-of-funded-proposals/7793` }]
        : []),
      ...(votingUrl ? [{ label: 'Metaforo voting page', url: votingUrl }] : []),
    ],
  };
}

async function main() {
  const topics = await loadCategoryTopics();
  const proposals = await mapWithConcurrency(topics, 1, async (topic) => {
    const proposal = await enrichTopic(topic);
    await sleep(500);
    return proposal;
  });
  proposals.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  const usedSlugs = new Set();
  for (const proposal of proposals) {
    if (usedSlugs.has(proposal.slug)) proposal.slug = `${proposal.slug}-${proposal.id}`;
    usedSlugs.add(proposal.slug);
  }
  const payload = {
    meta: {
      generatedAt: checkedAt,
      categoryUrl: `${baseUrl}/c/daos-funding/ckb-community-fund-dao/65`,
      proposalCount: proposals.length,
      methodology: 'Discourse category + topic JSON, with evidence-based funded proposal overrides.',
    },
    treasury: {
      initialCkb: '276000000',
      remainingCkb: '194145794',
      remainingPercent: 70.34,
      fundedProposalCount: 17,
      asOf: '2026-05-15',
      sourceUrl: `${baseUrl}/t/list-of-funded-proposals/7793`,
    },
    proposals,
  };
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(`Saved ${proposals.length} proposals to ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
