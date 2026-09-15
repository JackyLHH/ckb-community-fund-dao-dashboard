import type { Metadata } from 'next';
import { LiveProjectDetail } from '@/components/live-project-detail';

export const metadata: Metadata = {
  title: 'Project details',
  description: 'Live CKB Community Fund DAO project details, discussion, voting, and delivery evidence.',
  openGraph: { images: [] },
  twitter: { images: [] },
};

export default function ProjectPage() {
  return <LiveProjectDetail />;
}
