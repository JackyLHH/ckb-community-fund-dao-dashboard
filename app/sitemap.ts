import type { MetadataRoute } from 'next';
import { proposals } from '@/lib/proposals';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ckbcommunityfunddao.xyz';
  return [
    { url: baseUrl, changeFrequency: 'weekly', priority: 1 },
    { url: `${baseUrl}/projects`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${baseUrl}/methodology`, changeFrequency: 'monthly', priority: 0.5 },
    ...proposals.map((proposal) => ({
      url: `${baseUrl}/projects/${proposal.slug}`,
      lastModified: new Date(proposal.updatedAt),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
  ];
}
