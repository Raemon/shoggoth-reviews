import { redirect } from 'next/navigation';
import { desktopOnly } from '@/features/desktop/desktopMode';
import { launchRoute } from '@/features/local-git/launchRoute';
import { paramList, paramValue, type PageParams } from '@/features/local-git/pageParams';

export default async function LaunchPage({ searchParams }: { searchParams: Promise<PageParams> }) {
  await desktopOnly();
  const params = await searchParams;
  redirect(await launchRoute(paramValue(params, 'cwd'), paramList(params, 'arg')));
}
