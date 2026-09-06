import { githubJson, GithubRequestError } from './githubRequest';
import { userGithubToken } from './githubToken';
import type { GithubAccess } from '@/features/github-auth/githubAccess';

export interface RepoSummary {
  owner: string;
  name: string;
  description: string;
  language: string;
  updatedAt: string;
  private: boolean;
  defaultBranch: string;
}

export interface ViewerRepos {
  login: string;
  repos: RepoSummary[];
}

interface GithubRepo {
  name: string;
  owner: { login: string };
  description: string | null;
  language: string | null;
  pushed_at: string;
  private: boolean;
  default_branch: string;
}

const API = 'https://api.github.com';
const PAGE = 'per_page=100&sort=pushed';
const MAX_PAGES = 5;

export async function listOwnerRepos(login: string): Promise<RepoSummary[]> {
  return fetchPages(await ownerListUrl(login));
}

export async function describeViewer(): Promise<{ login: string }> {
  if (!userGithubToken()) throw new GithubRequestError(401, 'GitHub is not connected');
  const { login } = await githubJson<{ login: string }>(`${API}/user`);
  return { login };
}

export async function listViewerRepos(access: GithubAccess): Promise<ViewerRepos> {
  const { login } = await describeViewer();
  const visibility = access === 'public' ? 'public' : 'all';
  const repos = await fetchPages(
    `${API}/user/repos?${PAGE}&affiliation=owner,collaborator,organization_member&visibility=${visibility}`,
  );
  return { login, repos };
}

export async function describeRepo(owner: string, name: string): Promise<RepoSummary> {
  return summarize(await githubJson<GithubRepo>(`${API}/repos/${owner}/${name}`));
}

export async function defaultBranch(owner: string, name: string, fresh = false): Promise<string> {
  const repo = await githubJson<{ default_branch: string }>(`${API}/repos/${owner}/${name}`, fresh);
  return repo.default_branch;
}

async function fetchPages(source: string): Promise<RepoSummary[]> {
  const repos: RepoSummary[] = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const batch = await githubJson<GithubRepo[]>(`${source}&page=${page}`);
    repos.push(...batch.map(summarize));
    if (batch.length < 100) break;
  }
  return repos;
}

async function ownerListUrl(login: string): Promise<string> {
  const organization = await githubJson<{ login: string }>(`${API}/orgs/${login}`).catch(() => null);
  return organization
    ? `${API}/orgs/${login}/repos?${PAGE}&type=public`
    : `${API}/users/${login}/repos?${PAGE}&type=owner`;
}

function summarize(repo: GithubRepo): RepoSummary {
  return {
    owner: repo.owner.login,
    name: repo.name,
    description: repo.description ?? '',
    language: repo.language ?? '',
    updatedAt: repo.pushed_at,
    private: repo.private,
    defaultBranch: repo.default_branch,
  };
}
