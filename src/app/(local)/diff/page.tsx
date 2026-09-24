import { LocalChangePage } from '@/features/local-git/LocalPages';
import type { PageParams } from '@/features/local-git/pageParams';

export default async function LocalDiffPage({ searchParams }: { searchParams: Promise<PageParams> }) {
  return <LocalChangePage params={await searchParams} command="diff" />;
}
