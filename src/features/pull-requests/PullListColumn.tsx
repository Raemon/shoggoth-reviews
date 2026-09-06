'use client';

import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { AllPullRequestList } from './AllPullRequestList';
import { BranchesSection, useBranches } from './BranchesSection';
import { ColumnPreview, type PreviewToken } from './ColumnPreview';
import { useRegisterColumn } from './registerColumn';
import { PullFilterMenu } from './PullFilterMenu';
import { PullRequestList } from './PullRequestList';
import { collapsePullList, type PullListColumnName } from './collapsePullList';
import { ResizableColumn, useCollapsibleColumn, type ColumnSize } from './ResizableColumn';
import { branchListingRoute, allPullsRoute, pullRoute } from './pullPaths';
import type { PullRequestSummary } from './pullRequests';
import type { BranchSummary } from './branches';
import { useStickyOpen } from './stickyColumns';
import { useAllPullList, useRepoPullList } from './usePullLists';

const ICON = '⇅';

export interface PullColumn {
  owner: string;
  repo: string;
  note?: string;
  size: ColumnSize;
  onSize: (next: ColumnSize) => void;
}

interface PullNavTarget {
  route: string;
  href: string;
  label: string;
  title: string;
  pull: boolean;
}

export function RepoPullsColumn({ owner, repo, note, size, onSize }: PullColumn) {
  const { listed } = useRepoPullList(owner, repo);
  const [branchesOpen, setBranchesOpen] = useStickyOpen('branches');
  const listing = useBranches(owner, repo, size.open && branchesOpen);
  return (
    <PullsColumn
      column="pulls"
      note={note}
      targets={repoTargets(owner, repo, listed, listing.branches)}
      size={size}
      onSize={onSize}
      footer={
        <BranchesSection owner={owner} repo={repo} listing={listing} expanded={branchesOpen} onExpanded={setBranchesOpen} />
      }
    >
      <PullRequestList repo={{ owner, name: repo }} />
    </PullsColumn>
  );
}

export function AllPullsColumn({ size, onSize }: Pick<PullColumn, 'size' | 'onSize'>) {
  const { listed } = useAllPullList();
  return (
    <PullsColumn column="all-pulls" targets={listed.map((pull) => pullTarget(pull.owner, pull.repo, pull, true))} size={size} onSize={onSize}>
      <AllPullRequestList />
    </PullsColumn>
  );
}

function PullsColumn({
  column,
  note,
  targets,
  size,
  onSize,
  footer,
  children,
}: {
  column: PullListColumnName;
  note?: string;
  targets: PullNavTarget[];
  size: ColumnSize;
  onSize: (next: ColumnSize) => void;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const selected = targets.some((target) => target.route === pathname) ? pathname : null;
  const openTarget = (route: string) => {
    const target = targets.find((held) => held.route === route);
    if (!target || route === selected) return;
    router.push(target.href);
    if (target.pull) collapsePullList(column);
  };
  useRegisterColumn('pulls', {
    ...useCollapsibleColumn('pulls', size, onSize),
    items: targets.map((target) => target.route),
    selected,
    onActivate: openTarget,
  });
  return (
    <ResizableColumn
      navId="pulls"
      icon={ICON}
      title="pull requests"
      note={note}
      preview={<ColumnPreview column="pulls" tokens={targets.map((target) => pullToken(target, target.route === selected))} />}
      size={size}
      onSize={onSize}
      action={<PullFilterMenu />}
      footer={footer}
    >
      {children}
    </ResizableColumn>
  );
}

function pullTarget(owner: string, repo: string, pull: PullRequestSummary, acrossRepos: boolean): PullNavTarget {
  const route = pullRoute(owner, repo, pull.number);
  return {
    route,
    href: acrossRepos ? allPullsRoute(owner, repo, pull.number) : route,
    label: String(pull.number).slice(-2),
    title: `${owner}/${repo} #${pull.number} · ${pull.title}`,
    pull: true,
  };
}

function repoTargets(owner: string, repo: string, pulls: PullRequestSummary[], branches: BranchSummary[]): PullNavTarget[] {
  return [
    ...pulls.map((pull) => pullTarget(owner, repo, pull, false)),
    ...branches.map((branch) => branchTarget(owner, repo, branch)),
  ];
}

function branchTarget(owner: string, repo: string, branch: BranchSummary): PullNavTarget {
  const route = branchListingRoute(owner, repo, branch);
  const leaf = branch.name.split('/').pop() ?? branch.name;
  return { route, href: route, label: leaf.slice(0, 2), title: `${owner}/${repo} · ${branch.name}`, pull: false };
}

function pullToken(target: PullNavTarget, accent: boolean): PreviewToken {
  return { key: target.route, label: target.label, title: target.title, accent };
}
