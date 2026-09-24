import { DesktopHome } from '@/features/desktop/DesktopHome';
import { desktopMode } from '@/features/desktop/desktopMode';
import { oauthConfigured } from '@/features/github-auth/githubOAuthConfig';
import { HomeLanding } from '@/features/sources/HomeLanding';

export default async function HomePage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <div className="p-6">
      {desktopMode() ? (
        <DesktopHome error={error ?? null} />
      ) : (
        <HomeLanding error={error ?? null} oauthConfigured={oauthConfigured()} />
      )}
    </div>
  );
}
