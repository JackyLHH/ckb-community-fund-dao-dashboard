import { proposalOverridesById } from './proposal-overrides.ts';
import { isProposalProgressUpdate } from './proposal-progress.ts';

type LeadingBlock = {
  text: string;
  leadingBold: string;
  heading: boolean;
};

// Keep this independent of DOMParser: both the browser's live reads and the
// Node snapshot synchronizer use exactly the same title-selection rules.
const ignoredTags = new Set(['aside', 'blockquote', 'pre', 'script', 'style', 'template', 'svg']);
const blockTags = new Set(['p', 'div', 'section', 'article', 'li', 'ul', 'ol', 'table', 'tr', 'td', 'figure', 'figcaption']);
const headingTag = /^h[1-6]$/;

function decodeEntities(value: string) {
  const named: Record<string, string> = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
    ndash: '–', mdash: '—', hellip: '…', lsquo: '‘', rsquo: '’',
    ldquo: '“', rdquo: '”', bull: '•', middot: '·', colon: ':',
  };
  return value.replace(/&(#(?:x[\da-f]+|\d+)|[a-z]+);/gi, (entity, key: string) => {
    if (!key.startsWith('#')) return named[key.toLowerCase()] ?? entity;
    const code = key[1]?.toLowerCase() === 'x' ? Number.parseInt(key.slice(2), 16) : Number(key.slice(1));
    return Number.isInteger(code) && code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff)
      ? String.fromCodePoint(code)
      : '\uFFFD';
  });
}

function normalizeText(value: string) {
  return decodeEntities(value).replace(/[\u200b-\u200d\ufeff]/g, '').replace(/\s+/g, ' ').trim();
}

function cleanTitle(value: string) {
  return normalizeText(value)
    .replace(/^#{1,6}\s+/, '')
    .replace(/\s*#{1,6}\s*$/, '')
    .replace(/^(?:\*\*|__)([\s\S]+?)(?:\*\*|__)$/, '$1')
    .trim();
}

function isStandaloneGreeting(value: string) {
  const greeting = cleanTitle(value).replace(/^[\p{P}\p{S}\s]+|[\p{P}\p{S}\s]+$/gu, '').trim();
  return /^(?:(?:hi|hello|hey)(?:\s+(?:everyone|everybody|all|friends|community|(?:the\s+)?(?:ckb|nervos)\s+community))?|大家好|各位好|各位朋友好|社区朋友们好|(?:CKB\s*)?社区的朋友们?好)$/i.test(greeting);
}

// Tokenization also handles attributes containing ">" and incomplete quote /
// code blocks. Text from those blocks must not become an apparent report title.
function htmlParts(cooked: string) {
  // Inline code is meaningful in titles such as "Pocket Node v1.0.3 release
  // notes". Only isolated code paragraphs (and pre blocks below) are excluded.
  const html = cooked.replace(/<(p|h[1-6])\b(?:[^>"']|"[^"]*"|'[^']*')*>\s*<code\b(?:[^>"']|"[^"]*"|'[^']*')*>(?:(?!<\/code\b)[\s\S])*<\/code>\s*<\/\1>/gi, ' ');
  const tokens = /<!--[\s\S]*?(?:-->|$)|<\/?([a-z][\w:-]*)\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi;
  const parts: Array<{ tag?: string; closing?: boolean; text?: string }> = [];
  const ignored: string[] = [];
  const inlineContainers: string[] = [];
  let cursor = 0;
  for (const match of html.matchAll(tokens)) {
    if (!ignored.length && match.index > cursor) parts.push({ text: html.slice(cursor, match.index) });
    cursor = match.index + match[0].length;
    const tag = match[1]?.toLowerCase();
    if (!tag) continue;
    const closing = /^<\//.test(match[0]);
    const selfClosing = /\/\s*>$/.test(match[0]);
    if (ignored.length) {
      if (!closing && !selfClosing && (ignoredTags.has(tag) || tag === 'code')) ignored.push(tag);
      else if (closing && ignored.includes(tag)) ignored.splice(ignored.lastIndexOf(tag));
      continue;
    }
    if (!closing && (ignoredTags.has(tag) || (tag === 'code' && !inlineContainers.length))) {
      if (!selfClosing) ignored.push(tag);
      continue;
    }
    if (tag === 'p' || headingTag.test(tag)) {
      if (!closing) inlineContainers.push(tag);
      else if (inlineContainers.includes(tag)) inlineContainers.splice(inlineContainers.lastIndexOf(tag));
    }
    parts.push({ tag, closing });
  }
  if (!ignored.length && cursor < html.length) parts.push({ text: html.slice(cursor) });
  return parts;
}

function firstHtmlBlock(cooked: string): LeadingBlock {
  const parts = htmlParts(cooked);
  let text = '';
  let heading = false;
  let leadingBold = '';
  let boldDepth = 0;
  let collectBold = false;
  for (const part of parts) {
    if (part.text !== undefined) {
      text += part.text;
      if (collectBold && boldDepth) leadingBold += part.text;
      continue;
    }
    const tag = part.tag!;
    const hasText = normalizeText(text).length > 0;
    if (headingTag.test(tag) || blockTags.has(tag)) {
      if (hasText) {
        if (!isStandaloneGreeting(text)) break;
        text = '';
        leadingBold = '';
        boldDepth = 0;
        collectBold = false;
        heading = false;
      }
      if (!part.closing) heading = headingTag.test(tag);
    } else if (tag === 'br') {
      if (hasText && !heading) {
        if (!isStandaloneGreeting(text)) break;
        text = '';
        leadingBold = '';
        boldDepth = 0;
        collectBold = false;
      }
      text += ' ';
      if (collectBold && boldDepth) leadingBold += ' ';
    } else if (tag === 'strong' || tag === 'b') {
      if (!part.closing) {
        if (!hasText && !leadingBold) collectBold = true;
        boldDepth++;
      } else {
        boldDepth = Math.max(0, boldDepth - 1);
        if (!boldDepth) collectBold = false;
      }
    }
  }
  return { text: normalizeText(text), leadingBold: normalizeText(leadingBold), heading };
}

function readableText(cooked: string) {
  // Preserve word boundaries between blocks but never include HTML markup or
  // quoted/code content in the fallback excerpt.
  return normalizeText(htmlParts(cooked).map((part) => part.text ?? (part.tag && (headingTag.test(part.tag) || blockTags.has(part.tag) || part.tag === 'br') ? ' ' : '')).join(''));
}

function isSectionLabel(title: string) {
  const unnumbered = title.replace(/^(?:(?:section|part|第)?\s*[\d一二三四五六七八九十]+[\s.、:：)）-]*)/i, '').replace(/[:：.!。！]+$/, '').trim();
  if (/^(?:acceptance criteria|acceptance tests?|scope of work|验收标准|验收条件|工作范围)(?:\b|[：:，,（(])/i.test(unnumbered)) return true;
  return /^(?:acceptance criteria|acceptance tests?|scope(?: of work)?|roadmap(?:\s*(?:&|and)\s*milestones)?|milestones?|deliverables?|summary|overview|introduction|background|objectives?|goals?|budget|timeline|next steps?|what(?:'s| is)? next|what (?:shipped|changed|was delivered)|verification|how (?:it was|to) verif(?:y|ied)|links?|references?|resources?|results?|implementation|验收标准|验收条件|范围|工作范围|路线图(?:与里程碑)?|里程碑|交付物|交付内容|摘要|概述|概览|简介|背景|目标|预算|时间表|下一步(?:计划)?|验证|参考(?:资料)?|链接|本周(?:完成|工作内容)|本月(?:完成|工作内容))$/i.test(unnumbered);
}

function isNumberedSectionPrefix(value: string) {
  const title = cleanTitle(value).replace(/[:：]\s*$/, '').trim();
  return /^(?:(?:milestone|stage|phase|week)\s*[#№]?\s*[\dIVX]+(?:\s*[–—-]\s*\d+)?|(?:里程碑|阶段|第)\s*[\d一二三四五六七八九十]+\s*(?:阶段|周)?)$/i.test(title);
}

function withoutMarkdownQuotesOrCode(value: string) {
  return value.replace(/^\s*>.*$/gm, '').replace(/```[\s\S]*?(?:```|$)/g, '').replace(/~~~[\s\S]*?(?:~~~|$)/g, '');
}

function isMeaningfulTitle(value: string, explicit: boolean) {
  const title = cleanTitle(value);
  if (!title || isSectionLabel(title) || /^[\s\p{P}\p{S}\d]+$/u.test(title) || /^https?:\/\//i.test(title)) return false;
  // Ordinary narrative may mention a report without being the report's title.
  // Never jump to a later heading to compensate: that commonly yields Scope or
  // Acceptance criteria instead of the actual update.
  if (/^(?:this (?:post|report|update)|we(?:'ve| have| are| will| completed| shipped| continue| released| added| updated)|i(?:'ve| have| am| will)|our (?:team|project)|the team|hello\b|hi\b|thanks\b|thank you\b|here(?:'s| is| are)\b|as (?:of|part|a result)|following\b|since\b|due to\b|after\b|本(?:帖|次更新|报告)(?:介绍|汇总|包含|将|主要)|我们(?:已|将|正在|完成|继续|发布)|大家好|感谢|以下是)/i.test(title)) return false;
  if (explicit) return true;
  // A standalone plain paragraph/line needs recognizable report-title wording;
  // HTML alone does not make the first paragraph a title.
  if (title.length > 240 || /[.!?。！？]\s+\S/.test(title)) return false;
  if (/^(?:milestone\s+[\w.-]+\s+(?:of\b|is\b|has\b|was\b|will\b|now\b)|里程碑\s*[\d一二三四五六七八九十]+\s*(?:现已|已经|已被|将会|将于))/.test(title.toLowerCase()) && !/(?:\breport\b|报告)/i.test(title)) return false;
  return /(?:\b(?:report|updates?|recap|changelog|release(?: notes)?|sprint)\b|周报|双周报|月报|季报|年报|进展(?:报告|更新)|进度(?:报告|更新)|状态更新|维护更新|交付报告|结项报告|完结报告|里程碑\s*[\d一二三四五六七八九十]+.*报告)/i.test(title)
    || /^(?:weeks?\s*\d+(?:\s*[–—-]\s*\d+)?(?:\s*[:：–—-]|\s+(?:report|update|development|progress)\b|$)|第\s*[\d一二三四五六七八九十]+\s*周\s*[:：–—-])/i.test(title);
}

/** Extract only a leading, explicit update title; otherwise retain the prior excerpt behavior. */
export function extractProgressUpdateTitle(cooked: string, fallbackText?: string): string {
  const source = typeof cooked === 'string' ? cooked : '';
  const hasHtml = /<\/?[a-z][\w:-]*\b[^>]*>/i.test(source);
  if (hasHtml) {
    const block = firstHtmlBlock(source);
    if (block.heading && isMeaningfulTitle(block.text, true)) return cleanTitle(block.text);
    const boldIsPrefix = isNumberedSectionPrefix(block.leadingBold);
    if (block.leadingBold && !boldIsPrefix && isMeaningfulTitle(block.leadingBold, true)) return cleanTitle(block.leadingBold);
    // "Milestone 1:" is a label, not the report's complete title. Conversely,
    // "Weekly update" followed by ordinary body text remains a valid title.
    const boldIsGenericSection = block.leadingBold && isSectionLabel(block.leadingBold);
    if (!boldIsGenericSection && isMeaningfulTitle(block.text, false)) return cleanTitle(block.text);
  } else {
    const lines = withoutMarkdownQuotesOrCode(source).split(/\r?\n/);
    const firstLineIndex = lines.findIndex((line) => line.trim() && !isStandaloneGreeting(line));
    const firstLine = lines[firstLineIndex] ?? '';
    const markdownHeading = /^\s*#{1,6}\s+/.test(firstLine) || /^\s*(?:\*\*|__)[\s\S]+(?:\*\*|__)\s*$/.test(firstLine) || /^\s*(?:=+|-+)\s*$/.test(lines[firstLineIndex + 1] ?? '');
    if (isMeaningfulTitle(firstLine, markdownHeading)) return cleanTitle(firstLine);
  }
  const fallback = normalizeText(fallbackText ?? readableText(hasHtml ? source : withoutMarkdownQuotesOrCode(source)));
  return fallback.length > 240 ? `${fallback.slice(0, 240).trim()}…` : fallback;
}

type ForumUpdatePost = { post_number: number; username: string; cooked?: string; created_at?: string };

/** Source classification precedes display extraction, so a short heading can
 * never cause an already verified progress report to disappear. */
export function selectForumProgressUpdates(posts: ForumUpdatePost[], proposer: string, id: string, slug: string) {
  return posts
    .filter((post) => post.post_number > 1 && post.username.trim().toLocaleLowerCase() === proposer.trim().toLocaleLowerCase())
    .map((post) => ({ post, text: readableText(post.cooked ?? '') }))
    .filter(({ text }) => isProposalProgressUpdate(text))
    .sort((a, b) => a.post.post_number - b.post.post_number)
    .map(({ post, text }) => ({
      title: extractProgressUpdateTitle(post.cooked ?? '', text),
      date: post.created_at,
      url: `https://talk.nervos.org/t/${slug}/${id}/${post.post_number}`,
      author: post.username,
      source: 'forum' as const,
    }));
}

function canonicalUpdateUrl(value: string) {
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname.replace(/\/+$/, '')}`;
  } catch {
    return value.replace(/[?#].*$/, '').replace(/\/+$/, '');
  }
}

/** Manual corrections are identified by provenance and source URL, not text shape. */
export function isManualProposalUpdate(proposalId: string, update: { url: string; source?: 'manual' | 'forum' }) {
  if (update.source === 'manual') return true;
  const url = canonicalUpdateUrl(update.url);
  return (proposalOverridesById[proposalId]?.updates ?? []).some((manual) => canonicalUpdateUrl(manual.url) === url);
}
