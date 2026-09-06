import { githubJson } from '@/features/codebases/githubRequest';
import { defaultBranch } from '@/features/codebases/repoDirectory';
import {
  changedFile,
  summarizeCommits,
  type ChangedFileSet,
  type ChangeSummary,
  type GithubChangedFile,
  type GithubCommit,
} from './pullRequests';
import { encodePath } from './repoFiles';
import { mapWithWorkers } from './workerPool';

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

interface GithubBranch {
  name: string;
  commit: { sha: string };
}

type DatedBranch = GithubBranch & { updatedAt: string };

interface GithubRefPull {
  number: number;
  state: string;
  updated_at: string;
  merged_at: string | null;
  head: { ref: string; sha: string; repo?: { full_name: string } | null };
}

interface GithubGitCommit {
  committer?: { date?: string } | null;
  author?: { date?: string } | null;
}

interface GithubCompare {
  merge_base_commit: { sha: string };
  commits: GithubCommit[];
  files?: GithubChangedFile[];
}

const API = 'https://api.github.com';
const BRANCH_LIMIT = 100;
const BRANCH_DATE_WORKERS = 8;
const COMMIT_LIMIT = 100;

export async function listBranches(owner: string, name: string): Promise<BranchSummary[]> {
  const trunk = await defaultBranch(owner, name);
  const [branches, pulls] = await Promise.all([datedBranches(owner, name, trunk), recentPulls(owner, name)]);
  return branches
    .map((branch) => summarizeBranch(branch, pulls.get(branch.name) ?? null, trunk))
    .sort(byTrunkThenUnsettledThenRecent);
}

export async function listBranchOptions(owner: string, name: string): Promise<BranchOption[]> {
  const branches = await datedBranches(owner, name, await defaultBranch(owner, name));
  return branches.map(({ name: branch, updatedAt }) => ({ name: branch, updatedAt })).sort(byRecent);
}

async function datedBranches(owner: string, name: string, trunk: string): Promise<DatedBranch[]> {
  const branches = await withTrunk(owner, name, trunk, await allBranches(owner, name));
  const dates = await branchDates(owner, name, branches);
  return branches.map((branch) => ({ ...branch, updatedAt: dates.get(branch.commit.sha) ?? '' }));
}

function allBranches(owner: string, name: string): Promise<GithubBranch[]> {
  return githubJson<GithubBranch[]>(`${API}/repos/${owner}/${name}/branches?per_page=${BRANCH_LIMIT}`);
}

// /branches pages alphabetically, so past 100 branches the trunk falls off the page.
async function withTrunk(owner: string, name: string, trunk: string, listed: GithubBranch[]): Promise<GithubBranch[]> {
  if (listed.some((branch) => branch.name === trunk)) return listed;
  const held = await githubJson<GithubBranch>(`${API}/repos/${owner}/${name}/branches/${encodePath(trunk)}`);
  return [held, ...listed];
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
    `${API}/repos/${owner}/${name}/pulls?state=all&sort=updated&direction=desc&per_page=${BRANCH_LIMIT}`,
  );
  const here = `${owner}/${name}`.toLowerCase();
  const byRef = new Map<string, GithubRefPull>();
  for (const pull of pulls) {
    if (pull.head.repo?.full_name.toLowerCase() === here && !byRef.has(pull.head.ref)) byRef.set(pull.head.ref, pull);
  }
  return byRef;
}

// /branches omits dates; /git/commits/<sha> caches immutably, so one fetch per new head
async function branchDates(owner: string, name: string, branches: GithubBranch[]): Promise<Map<string, string>> {
  const shas = branches.map((branch) => branch.commit.sha);
  const dates = await mapWithWorkers(shas, BRANCH_DATE_WORKERS, (sha) => commitDate(owner, name, sha));
  return new Map(shas.map((sha, at) => [sha, dates[at] ?? '']));
}

async function commitDate(owner: string, name: string, sha: string): Promise<string> {
  try {
    const commit = await githubJson<GithubGitCommit>(`${API}/repos/${owner}/${name}/git/commits/${sha}`);
    return commit.committer?.date ?? commit.author?.date ?? '';
  } catch {
    return '';
  }
}

function summarizeBranch(branch: DatedBranch, pull: GithubRefPull | null, trunk: string): BranchSummary {
  const merged = pull?.merged_at != null;
  return {
    name: branch.name,
    headSha: branch.commit.sha,
    updatedAt: branch.updatedAt,
    pull: pull && { number: pull.number, state: pull.state, merged },
    mergedAndUnchanged: merged && pull?.head.sha === branch.commit.sha,
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
