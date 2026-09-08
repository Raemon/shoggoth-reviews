'use client';

import { usePathname } from 'next/navigation';
import type { BranchSummary } from './branches';
import { NavListRow } from './NavListRow';
import { branchListingRoute, repoBranchesPath } from './pullPaths';
import { SectionHeader } from './ResizableColumn';
import { useGithubToken, useStoreReady } from '@/features/sources/sourceStore';
import { useCachedJson } from '@/features/sources/useCachedJson';
import { RelativeTime } from '@/features/surface-ui/RelativeTime';

export interface BranchListing {
  branches: BranchSummary[];
  loading: boolean;
  error: string | null;
}

export function useBranches(owner: string, repo: string, wanted: boolean): BranchListing {
  const ready = useStoreReady();
  const token = useGithubToken();
  const path = wanted ? repoBranchesPath(owner, repo) : null;
  const { data, fresh, error } = useCachedJson<BranchSummary[]>(path, token, ready);
  return { branches: data ?? [], loading: wanted && data === null && !fresh, error };
}

export function BranchesSection({
  owner,
  repo,
  listing,
  expanded,
  onExpanded,
}: {
  owner: string;
  repo: string;
  listing: BranchListing;
  expanded: boolean;
  onExpanded: (next: boolean) => void;
}) {
  return (
    <section className={`flex shrink-0 flex-col border-t border-panel-edge ${expanded ? 'h-1/2 min-h-0' : ''}`}>
      <SectionHeader
        icon="⑂"
        title="branches"
        titleTone="text-ink-dim"
        chevron={expanded ? '⌄' : '⌃'}
        className="w-full bg-panel hover:bg-btn-hover"
        label={`${expanded ? 'Collapse' : 'Expand'} branches`}
        expanded={expanded}
        onActivate={() => onExpanded(!expanded)}
      />
      {expanded && <BranchList owner={owner} repo={repo} listing={listing} />}
    </section>
  );
}

function BranchList({ owner, repo, listing }: { owner: string; repo: string; listing: BranchListing }) {
  const pathname = usePathname();
  if (listing.branches.length === 0) return <BranchNote listing={listing} />;
  return (
    <nav className="min-h-0 flex-1 overflow-auto py-[1px]">
      {listing.branches.map((branch) => {
        const href = branchListingRoute(owner, repo, branch);
        return <BranchRow key={branch.name} branch={branch} href={href} current={pathname === href} />;
      })}
    </nav>
  );
}

function BranchNote({ listing }: { listing: BranchListing }) {
  const note = listing.error ?? (listing.loading ? 'Loading…' : 'No branches.');
  return <p className={`px-2 py-1 text-[11px] leading-4 ${listing.error ? 'text-error-ink' : 'text-ink-dim'}`}>{note}</p>;
}

function BranchRow({ branch, href, current }: { branch: BranchSummary; href: string; current: boolean }) {
  return (
    <NavListRow route={href} href={href} current={current} dimmed={branch.mergedAndUnchanged}>
      <span className="min-w-0 flex-1 truncate">{branch.name}</span>
      {branch.pull && <span className="shrink-0 text-[9px] text-ink-dim">#{branch.pull.number}</span>}
      <RelativeTime iso={branch.updatedAt} className="shrink-0 text-[9px] text-ink-dim" />
    </NavListRow>
  );
}
