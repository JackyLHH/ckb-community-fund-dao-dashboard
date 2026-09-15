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
