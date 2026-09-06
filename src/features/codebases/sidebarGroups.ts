import type { RepoSummary } from './repoDirectory';
import { sourceKey, type CodebaseSource } from '@/features/sources/sourceTypes';

export type SourceResult =
  | { state: 'loading' }
  | { state: 'error'; message: string }
  | { state: 'ready'; repos: RepoSummary[]; login: string | null };

export interface SidebarRepo extends RepoSummary {
  source: CodebaseSource | null;
}

export interface SidebarGroup {
  owner: string;
  you: boolean;
  loading: boolean;
  source: CodebaseSource | null;
  error: string | null;
  repos: SidebarRepo[];
}

export function sidebarGroups(sources: CodebaseSource[], results: Map<string, SourceResult>): SidebarGroup[] {
  const groups = new Map<string, SidebarGroup>();
  for (const source of sources) {
    for (const group of groupsFor(source, results.get(sourceKey(source)) ?? { state: 'loading' })) {
      mergeGroup(groups, group);
    }
  }
  return [...groups.values()];
}

function groupsFor(source: CodebaseSource, result: SourceResult): SidebarGroup[] {
  const owner = source.kind === 'owner' ? source.login : source.kind === 'repo' ? source.owner : 'connected account';
  if (result.state === 'loading') return [group(owner, { loading: true, you: source.kind === 'viewer', source: removable(source) })];
  if (result.state === 'error') {
    const repos = source.kind === 'repo' ? [{ ...placeholder(source.owner, source.name), source }] : [];
    return [group(owner, { error: result.message, you: source.kind === 'viewer', source: removable(source), repos })];
  }
  switch (source.kind) {
    case 'owner':
      return [group(result.repos[0]?.owner ?? owner, { source, repos: result.repos.map((repo) => ({ ...repo, source: null })) })];
    case 'repo':
      return [group(result.repos[0]?.owner ?? owner, { repos: result.repos.map((repo) => ({ ...repo, source })) })];
    case 'viewer': {
      const login = result.login ?? owner;
      const byOwner = new Map<string, SidebarRepo[]>([[login, []]]);
      for (const repo of result.repos) byOwner.set(repo.owner, [...(byOwner.get(repo.owner) ?? []), { ...repo, source: null }]);
      return [...byOwner].map(([groupOwner, repos]) => group(groupOwner, { you: groupOwner === login, repos }));
    }
  }
}

function removable(source: CodebaseSource): CodebaseSource | null {
  return source.kind === 'owner' ? source : null;
}

function group(owner: string, fields: Partial<Omit<SidebarGroup, 'owner'>>): SidebarGroup {
  return { owner, you: false, loading: false, source: null, error: null, repos: [], ...fields };
}

function mergeGroup(groups: Map<string, SidebarGroup>, group: SidebarGroup): void {
  const key = group.owner.toLowerCase();
  const held = groups.get(key);
  if (!held) {
    groups.set(key, group);
    return;
  }
  const byName = new Map(held.repos.map((repo) => [repo.name.toLowerCase(), repo]));
  for (const repo of group.repos) {
    const existing = byName.get(repo.name.toLowerCase());
    if (!existing) held.repos.push(repo);
    else existing.source ??= repo.source;
  }
  held.you ||= group.you;
  held.loading ||= group.loading;
  held.source ??= group.source;
  held.error ??= group.error;
  held.repos.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function placeholder(owner: string, name: string): RepoSummary {
  return { owner, name, description: '', language: '', updatedAt: '', private: false, defaultBranch: '' };
}

export function sidebarRepos(groups: SidebarGroup[]): SidebarRepo[] {
  return groups.flatMap((group) => group.repos).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function sidebarNotices(groups: SidebarGroup[]): SidebarGroup[] {
  return groups.filter((group) => group.loading || group.error !== null || group.source !== null);
}
