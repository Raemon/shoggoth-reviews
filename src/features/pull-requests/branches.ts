import { githubGraphql, githubJson, PAGE_SIZE } from '@/features/codebases/githubRequest';
import { defaultBranch } from '@/features/codebases/repoDirectory';
import {
  changedFile,
  summarizeCommits,
  type ChangedFileSet,
  type ChangeSummary,
  type GithubChangedFile,
  type GithubCommit,
} from './pullRequests';

export interface BranchPull {
  number: number;
  state: string;
  merged: boolean;
}

export interface BranchOption {
  name: string;
  updatedAt: string;
}

export interface BranchSummary {
  name: string;
  headSha: string;
  updatedAt: string;
  pull: BranchPull | null;
  mergedAndUnchanged: boolean;
  isDefault: boolean;
}

interface DatedBranch {
  name: string;
  headSha: string;
  updatedAt: string;
}

interface GraphqlRef {
  name: string;
  target: { oid: string; committedDate?: string } | null;
}

interface BranchQuery {
  repository: {
    defaultBranchRef: GraphqlRef | null;
    refs: { nodes: (GraphqlRef | null)[] } | null;
  } | null;
}

interface GithubRefPull {
  number: number;
  state: string;
  updated_at: string;
  merged_at: string | null;
  head: { ref: string; sha: string; repo?: { full_name: string } | null };
}

interface GithubCompare {
  merge_base_commit: { sha: string };
  commits: GithubCommit[];
  files?: GithubChangedFile[];
}

const API = 'https://api.github.com';
const PICKER_LIMIT = 50;
const LISTING_LIMIT = 100;
const COMMIT_LIMIT = 100;

const BRANCH_QUERY = `
query BranchOptions($owner: String!, $name: String!, $filter: String, $first: Int!) {
  repository(owner: $owner, name: $name) {
    defaultBranchRef { ...BranchRef }
    refs(refPrefix: "refs/heads/", query: $filter, first: $first, orderBy: { field: TAG_COMMIT_DATE, direction: DESC }) {
      nodes { ...BranchRef }
    }
  }
}
fragment BranchRef on Ref { name target { oid ... on Commit { committedDate } } }
`;

export async function listBranches(owner: string, name: string): Promise<BranchSummary[]> {
  const [{ trunk, branches }, pulls] = await Promise.all([recentBranches(owner, name, '', LISTING_LIMIT), recentPulls(owner, name)]);
  return branches
    .map((branch) => summarizeBranch(branch, pulls.get(branch.name) ?? null, trunk))
    .sort(byTrunkThenUnsettledThenRecent);
}

export async function listBranchOptions(owner: string, name: string, filter: string): Promise<BranchOption[]> {
  const { branches } = await recentBranches(owner, name, filter, PICKER_LIMIT);
  return branches.map(({ name: branch, updatedAt }) => ({ name: branch, updatedAt }));
}

async function recentBranches(owner: string, name: string, rawFilter: string, first: number): Promise<RecentBranches> {
  const filter = rawFilter.trim();
  const data = await githubGraphql<BranchQuery>(BRANCH_QUERY, { owner, name, filter: filter || null, first });
  const trunk = data.repository?.defaultBranchRef ? datedBranch(data.repository.defaultBranchRef) : null;
  const listed = (data.repository?.refs?.nodes ?? []).flatMap((ref) => (ref ? [datedBranch(ref)] : []));
  return { trunk: trunk?.name ?? null, branches: withTrunk(trunk, listed, filter).sort(byRecent) };
}

interface RecentBranches {
  trunk: string | null;
  branches: DatedBranch[];
}

// The list is capped at the newest heads, so an old trunk is pinned back in.
function withTrunk(trunk: DatedBranch | null, listed: DatedBranch[], filter: string): DatedBranch[] {
  if (!trunk || !nameMatches(trunk.name, filter) || listed.some((branch) => branch.name === trunk.name)) return listed;
  return [trunk, ...listed];
}

function nameMatches(name: string, filter: string): boolean {
  return name.toLowerCase().includes(filter.toLowerCase());
}

function datedBranch(ref: GraphqlRef): DatedBranch {
  return { name: ref.name, headSha: ref.target?.oid ?? '', updatedAt: ref.target?.committedDate ?? '' };
}

export async function describeBranch(owner: string, name: string, branch: string, fresh = false): Promise<ChangeSummary> {
  const compare = await compareWithDefault(owner, name, branch, fresh);
  const files = compare.files ?? [];
  const commits = await branchCommits(owner, name, branch, compare);
  return {
    additions: totalOf(files, (file) => file.additions),
    deletions: totalOf(files, (file) => file.deletions),
    commits: await summarizeCommits(owner, name, commits),
  };
}

// The trunk is never ahead of itself, so show its own history rather than nothing.
async function branchCommits(owner: string, name: string, branch: string, compare: GithubCompare): Promise<GithubCommit[]> {
  const ahead = compare.commits.slice(0, COMMIT_LIMIT);
  return ahead.length > 0 ? ahead : branchHistory(owner, name, branch);
}

function branchHistory(owner: string, name: string, branch: string): Promise<GithubCommit[]> {
  const query = `sha=${encodeURIComponent(branch)}&per_page=${COMMIT_LIMIT}`;
  return githubJson<GithubCommit[]>(`${API}/repos/${owner}/${name}/commits?${query}`);
}

export async function listBranchFiles(owner: string, name: string, branch: string, fresh = false): Promise<ChangedFileSet> {
  const compare = await compareWithDefault(owner, name, branch, fresh);
  return {
    baseRef: compare.merge_base_commit.sha,
    headRef: branch,
    files: (compare.files ?? []).map(changedFile),
  };
}

async function compareWithDefault(owner: string, name: string, branch: string, fresh: boolean): Promise<GithubCompare> {
  const trunk = await defaultBranch(owner, name, fresh);
  const range = `${encodeURIComponent(trunk)}...${encodeURIComponent(branch)}`;
  return githubJson<GithubCompare>(`${API}/repos/${owner}/${name}/compare/${range}`, fresh);
}

async function recentPulls(owner: string, name: string): Promise<Map<string, GithubRefPull>> {
  const pulls = await githubJson<GithubRefPull[]>(
    `${API}/repos/${owner}/${name}/pulls?state=all&sort=updated&direction=desc&per_page=${PAGE_SIZE}`,
  );
  const here = `${owner}/${name}`.toLowerCase();
  const byRef = new Map<string, GithubRefPull>();
  for (const pull of pulls) {
    if (pull.head.repo?.full_name.toLowerCase() === here && !byRef.has(pull.head.ref)) byRef.set(pull.head.ref, pull);
  }
  return byRef;
}

function summarizeBranch(branch: DatedBranch, pull: GithubRefPull | null, trunk: string | null): BranchSummary {
  const merged = pull?.merged_at != null;
  return {
    name: branch.name,
    headSha: branch.headSha,
    updatedAt: branch.updatedAt,
    pull: pull && { number: pull.number, state: pull.state, merged },
    mergedAndUnchanged: merged && pull?.head.sha === branch.headSha,
    isDefault: branch.name === trunk,
  };
}

function byTrunkThenUnsettledThenRecent(a: BranchSummary, b: BranchSummary): number {
  return Number(b.isDefault) - Number(a.isDefault) || byUnsettledThenRecent(a, b);
}

function byUnsettledThenRecent(a: BranchSummary, b: BranchSummary): number {
  return Number(a.mergedAndUnchanged) - Number(b.mergedAndUnchanged) || byRecent(a, b);
}

function byRecent(a: { updatedAt: string }, b: { updatedAt: string }): number {
  return b.updatedAt.localeCompare(a.updatedAt);
}

function totalOf<T>(items: T[], count: (item: T) => number): number {
  return items.reduce((held, item) => held + count(item), 0);
}
