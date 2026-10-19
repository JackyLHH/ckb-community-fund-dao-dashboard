import type { Metadata } from 'next';
import { LiveProjectDetail } from '@/components/live-project-detail';

export const metadata: Metadata = {
  title: 'Proposal',
  description: 'CKB Community Fund DAO proposal overview, budget, voting, milestones, and progress updates with original public sources.',
  openGraph: { images: [] },
  twitter: { images: [] },
};

export default function ProjectPage() {
  return <LiveProjectDetail />;
}
