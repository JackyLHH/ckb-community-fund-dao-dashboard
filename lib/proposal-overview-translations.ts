import rawTranslations from '../data/proposal-overview-translations.json' with { type: 'json' };

export type ProposalOverviewTranslation = { zh: string; en: string };

export const proposalOverviewTranslationsById = rawTranslations.translations as Record<
  string,
  ProposalOverviewTranslation
>;
