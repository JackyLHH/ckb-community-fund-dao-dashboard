import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { proposalOverridesById } from '../lib/proposal-overrides.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const proposalsPath = path.join(root, 'data/proposals.generated.json');
const outputPath = path.join(root, 'data/proposal-title-translations.json');
const dataset = JSON.parse(fs.readFileSync(proposalsPath, 'utf8'));
const existing = fs.existsSync(outputPath)
  ? JSON.parse(fs.readFileSync(outputPath, 'utf8')).translations ?? {}
  : {};

const additionalHistoricalTitles = {
  '10739': '[DIS] RIVET: Decentralized GitHub Backup, Timestamping and Restore on CKB',
};

// Reviewed historical translations are kept here so repeatable backfills do
// not rewrite project names or technical terms. Titles not listed here use the
// automatic translation service below.
const reviewedChineseTitles = {
  '10712': 'FNN Safeguard——Fiber 节点恢复验证与升级前资格检查',
  '9879': '面向移动端的 CKB 轻客户端（Android Pocket Node）',
  '10015': '基于 CKB L1 的去中心化隐私订单簿应用链——2026 第一阶段',
  '10685': 'Bitcoin Renegade 线下聚会与媒体宣传活动',
  '10317': 'Fiber Desktop v1 从零重构与发布——FNN 桌面应用',
  '10414': 'FiberLatch Access——面向 Fiber 支付的开源访问控制',
  '10583': 'iOS Pocket Node：Apple 端自托管 CKB 轻客户端及 CCC Web 应用身份与签名器',
  '10613': 'Vellum：did:ckb 信誉扩展',
  '10678': 'Corven——面向 CKB 生态的云端开发基础设施',
  '9756': 'Rosen Bridge 的 CKB 集成',
  '10604': 'fiber-payjoin-kit：Nervos Fiber Network 的协作式通道注资隐私方案 RES',
  '10364': 'Rypto——CKB 内容与推广活动',
  '10609': 'CrowdCell：CKB 上无须信任的“全有或全无”众筹主网上线',
  '10296': 'fiber-payjoin-kit：Nervos Fiber Network 的协作式隐私方案',
  '10522': 'CKB Anywhere Card——通过 Apple 与 Google Wallet 轻触支付并保持自托管',
  '8369': 'iCKB 与 dCKB Rescuer 资助提案（非编码费用）',
  '10419': 'Vellum：did:ckb 信誉扩展',
  '10453': 'Werra：为创作者商业构建信任基础设施',
  '10462': 'Fiber Python SDK——面向 Fiber Network 支付的原生 Python 库',
  '10400': 'Luxvoid Protocol：首个可用的 BTC→CKB→EVM 管线——寻求 DAO 支持与生产扩展合作',
  '9845': 'Fiber Link：面向社区的 CKB Fiber 支付层（打赏与小额支付）',
  '8832': 'CKBoost 游戏化社区参与平台提案',
  '10239': 'Bitcoin Renegade CKB 媒体宣传活动',
  '10218': '面向 CKB 生态与跨链监控的 Quantir 风险情报',
  '10179': 'CryptoMondays London × Nervos（CKB）——英国教育与生态系列活动',
  '10119': 'CKB Anywhere Card：Nervos 即时消费层',
  '10100': 'WarSpore · Saga——面向 CKB 与 BTC 的全链上卡牌游戏',
  '8539': 'Rosen Bridge——连接 CKB、Cardano、Ergo 及更多网络',
  '8918': 'Spore Studio：CKB 生态数字艺术平台开发与部署',
  '8150': 'Palmyra：Nervos 上的 RWA 借贷',
  '8249': 'DAO 付款使用美元金额并按付款日价格计算',
  '7727': 'Telmo Talks——Nervos 访谈节目提案',
  '7594': '构建并分发高效网络节点',
  '7757': '元规则修改：使用 30 日移动平均价计算 CKB/USD 付款',
  '7636': 'motoDEX 资助提案',
  '7633': '在 Binance Feed 与 CMC Community 发布内容',
  '7524': 'Nervos.Land——在线 NFT 策略游戏开发',
  '7366': 'Infinity Wallet 集成 Nervos',
  '7449': 'Nervos Network 西语社区：拉丁美洲社区与生态资助提案——2023 年第四季度',
  '7136': '在 r/Cryptocurrency 子版块举办 AMA',
  '7396': '印度那格浦尔大众市场推广活动',
  '7317': 'Nervos 社区主题曲',
  '7194': 'CKB Community DAO 提案',
  '7242': '元规则修改：提案重新提交前设置 30 天等待期',
  '7241': '元规则修改：交易所持有的 CKB 按 1% 权重投票',
  '7201': 'CKB 教科书：Computing Common Knowledge 社区资助提案',
  '7205': 'Etherion',
  '6968': 'Nervos Nation 社区资助提案',
  '7125': '暂停所有 CKB Community Fund DAO 提案投票 30 天',
  '7069': '关于激励投票流程的考虑',
  '7065': 'HuntingNFT 项目资助提案',
  '6891': '让巴西加密社区全面融入 Nervos 生态',
  '10739': 'RIVET：基于 CKB 的去中心化 GitHub 备份、时间戳与恢复',
};

function normalizeTitle(value = '') {
  return value.replace(/^\s*\[DIS\]\s*/i, '').replace(/\s+/g, ' ').trim();
}

function containsChinese(value = '') {
  return /[\u3400-\u9fff]/u.test(value);
}

function splitBilingualTitle(source) {
  const parts = normalizeTitle(source).split(/\s*(?:\||｜|\s\/\s|\s—\s|\s–\s)\s*/u).filter(Boolean);
  if (parts.length < 2) return { zh: '', en: '' };
  return {
    zh: parts.find((part) => containsChinese(part)) ?? '',
    en: parts.find((part) => !containsChinese(part) && /[A-Za-z]/u.test(part)) ?? '',
  };
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
  if (!proposalsById.has(id) && (override.titleZh || override.titleEn || additionalHistoricalTitles[id])) {
    proposalsById.set(id, { id, title: additionalHistoricalTitles[id] ?? override.titleEn ?? override.titleZh });
  }
}
for (const [id, title] of Object.entries(additionalHistoricalTitles)) {
  if (!proposalsById.has(id)) proposalsById.set(id, { id, title });
}

const translations = {};
let generated = 0;
for (const [id, proposal] of [...proposalsById].sort(([left], [right]) => Number(left) - Number(right))) {
  const override = proposalOverridesById[id];
  const sourceTitle = normalizeTitle(proposal.title || additionalHistoricalTitles[id] || override?.titleEn || override?.titleZh || '');
  const split = splitBilingualTitle(sourceTitle);
  const hasBilingualSource = Boolean(split.zh && split.en);
  const saved = existing[id];
  const savedForCurrentSource = saved && normalizeTitle(saved.sourceTitle) === sourceTitle ? saved : undefined;
  let en = override?.titleEn?.trim()
    || (hasBilingualSource ? split.en : '')
    || (!containsChinese(sourceTitle) ? sourceTitle : '')
    || savedForCurrentSource?.en?.trim()
    || '';
  let zh = override?.titleZh?.trim()
    || (hasBilingualSource ? split.zh : '')
    || (containsChinese(sourceTitle) && !hasBilingualSource ? sourceTitle : '')
    || savedForCurrentSource?.zh?.trim()
    || (!saved ? reviewedChineseTitles[id] : '')
    || '';

  if (!en && zh) {
    en = await translate(zh, 'en');
    generated += 1;
  }
  if (!zh && en) {
    zh = await translate(en, 'zh');
    generated += 1;
  }
  if (!sourceTitle || !en || !zh) throw new Error(`Proposal ${id} does not have a complete title to backfill`);
  translations[id] = { sourceTitle, zh, en };
}

fs.writeFileSync(outputPath, `${JSON.stringify({ version: 1, translations }, null, 2)}\n`);
console.log(`Saved ${Object.keys(translations).length} bilingual proposal titles (${generated} machine translations generated).`);
