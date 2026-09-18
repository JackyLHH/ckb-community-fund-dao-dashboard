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

## Deployment

The project exports a static build to `dist/client` and includes `vercel.json`. Set `NEXT_PUBLIC_SITE_URL` to the final trusted origin so canonical metadata, Open Graph fields, sitemap, and robots use the correct URL.

The `main` branch is connected to the production Vercel project. Pushing to `main` deploys the live site, while pull requests and other branches receive Vercel preview deployments.

## Daily digest delivery

The production cron calls `/api/cron/digest` at `08:00 UTC` (`16:00` China Standard Time). The same detected proposal changes are delivered to confirmed email subscribers and, when configured, to separate Chinese and English Telegram channels.

Telegram delivery uses one Bot API token and the following Vercel environment variables:

```text
TELEGRAM_BOT_TOKEN
TELEGRAM_CHANNEL_ZH
TELEGRAM_CHANNEL_EN
```

For public channels, set the channel targets to usernames such as `@CKBCommunityFundDAO_CN`; the website derives the corresponding `https://t.me/...` subscription links automatically. For private channels or custom invite links, also set:

```text
TELEGRAM_CHANNEL_URL_ZH
TELEGRAM_CHANNEL_URL_EN
```

The bot must be a channel administrator with permission to post messages. Never commit the bot token to the repository.
