# CKB Community Fund DAO Dashboard

A bilingual, evidence-first dashboard for CKB Community Fund DAO rules, treasury snapshots, proposals, votes, and project progress.

## Local development

Requires Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

## Data

The committed `data/proposals.generated.json` snapshot is the production fallback. Refresh it with:

```bash
npm run sync:data
npm test
```

The sync script reads the public Nervos Talk Discourse JSON endpoints and combines them with evidence-based overrides from the funded proposal list. Review override notes before publishing a new snapshot. Missing or conflicting values must stay visibly unverified.

### Automatic vote results

`.github/workflows/sync-votes.yml` checks the public Metaforo Poll directory approximately every 30 minutes (GitHub may delay scheduled jobs). It matches each vote to its `[DIS]` source link and reads the rendered quorum card in Chromium, since the unauthenticated thread JSON endpoint is unreliable. Active votes remain active even when their provisional tally meets the thresholds; passed/rejected is published only after observing “Voting Closed”, checking both quorum and approval percentage.

Results are committed to `data/votes.generated.json` and loaded by both the directory and detail pages through `/live/metaforo/votes`, with a five-minute CDN cache. Open pages refresh every five minutes and when focused. Closed human-reviewed evidence, including committee recounts, takes priority. Failed reads preserve the previous snapshot and fail the workflow visibly; observations of an active poll older than two hours become unverified instead of continuing to claim voting is open. A newly discovered link alone never establishes an active or final result.

Display titles, translated titles, data sync, email, and Telegram all use `lib/proposal-title.js` to remove `[DIS]` and `【DIS】` markers. The digest classifier requires actual report/completion evidence next to a milestone number; proposal-scope revisions and review acknowledgements do not qualify as milestone reports or delivery updates.

## Deployment

The project exports a static build to `dist/client` and includes `vercel.json`. Set `NEXT_PUBLIC_SITE_URL` to the final trusted origin so canonical metadata, Open Graph fields, sitemap, and robots use the correct URL.

The `main` branch is connected to the production Vercel project. Pushing to `main` deploys the live site, while pull requests and other branches receive Vercel preview deployments.

## Proposal overview translations

Human-reviewed `objectiveZh` and `objectiveEn` values always take precedence. When a live proposal supplies only one language, `/api/translation` translates that exact overview into the missing language. Production uses the public MyMemory Translation API by default, which requires no browser-exposed credential or payment method. If `AI_GATEWAY_API_KEY` is configured, Vercel AI Gateway is preferred and the public service becomes the fallback.

Generated translations are cached at Vercel's CDN, in the browser, and in warm function instances. Adding a reviewed translation later replaces the generated value automatically.

Historical bilingual overviews are persisted in `data/proposal-overview-translations.json`. Run `npm run backfill:translations` after refreshing the proposal snapshot to fill any missing language and then review the generated result before committing it. Rendering priority is: reviewed proposal override, reviewed card summary, persisted historical translation, then live automatic translation.

## Daily digest delivery

The production cron calls `/api/cron/digest` at `08:00 UTC` (`16:00` China Standard Time). The same detected proposal changes are delivered to confirmed email subscribers and, when configured, to separate Chinese and English Telegram channels.

Digest activity is limited to the preceding 24 hours. A new proposal must be a newly created proposal topic in the category. A progress update must be a new reply from the original proposal author and must either use a recognizable update/report heading (for example, weekly, monthly, milestone, status, delivery, or completion report) or contain multiple concrete delivery signals. Ordinary community replies, likes, bumps, formatting-only timestamp differences, and historical topics missing from state do not trigger a digest. The topic cursor is still advanced when non-qualifying replies appear, so the same discussion activity is not reconsidered on later days.

Telegram delivery uses one Bot API token in Vercel:

```text
TELEGRAM_BOT_TOKEN
```

The production defaults are `@CKBCommunityFundDAO_CN` for Chinese and `@CKBCommunityFundDAO` for English. They can be overridden with `TELEGRAM_CHANNEL_ZH` and `TELEGRAM_CHANNEL_EN`. The website derives public `https://t.me/...` subscription links automatically. For private channels or custom invite links, also set:

```text
TELEGRAM_CHANNEL_URL_ZH
TELEGRAM_CHANNEL_URL_EN
```

The bot must be a channel administrator with permission to post messages. Never commit the bot token to the repository.
