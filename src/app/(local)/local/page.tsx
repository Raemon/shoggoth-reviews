import { LocalOverviewPage } from '@/features/local-git/LocalPages';
import type { PageParams } from '@/features/local-git/pageParams';

export default async function LocalRepoPage({ searchParams }: { searchParams: Promise<PageParams> }) {
  return <LocalOverviewPage params={await searchParams} />;
}
