import type { Metadata } from 'next';
import { LiveProjectDetail } from '@/components/live-project-detail';
import { cleanSummary, findProposal, proposals } from '@/lib/proposals';

export function generateStaticParams() {
  return proposals.map((proposal) => ({ slug: proposal.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const proposal = findProposal(slug);
  if (!proposal) return { title: 'Project not found' };
  const description = cleanSummary(proposal, 155);
  return {
    title: `${proposal.title} | CKB Community Fund DAO`,
    description,
    openGraph: { title: proposal.title, description, images: [] },
    twitter: { card: 'summary', title: proposal.title, description, images: [] },
  };
}

export default async function LegacyProjectDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const proposal = findProposal(slug);
  return <LiveProjectDetail id={proposal?.id} initialProposal={proposal} />;
}
