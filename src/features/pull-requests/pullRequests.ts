import {
  dropGithubCache,
  githubBytes,
  githubGraphql,
  githubJson,
  githubJsonPages,
  githubPageUrl,
  GithubRequestError,
  githubSend,
  PAGE_SIZE,
} from '@/features/codebases/githubRequest';
import { requireGithubUser } from '@/features/github-auth/requireGithubUser';
import { imageTypeOf } from './imageFiles';
import type { PullState } from './pullPaths';
import { mapWithWorkers } from './workerPool';
import type { RepoRef } from '@/features/sources/parseRepoLink';
import { errorMessage } from '@/features/sources/errorMessage';

export interface PullRequestSummary {
  number: number;
  title: string;
  author: string;
  updatedAt: string;
  draft: boolean;
  state: string;
  merged: boolean;
}

export interface CrossRepoPull extends PullRequestSummary {
  owner: string;
  repo: string;
}

export interface CrossRepoPulls {
  pulls: CrossRepoPull[];
  failures: { repo: string; message: string }[];
}

export interface CommitSummary {
  sha: string;
  message: string;
  author: string;
  date: string;
  additions: number;
  deletions: number;
  fileCount: number;
}

export interface ChangedFile {
  filename: string;
  previousFilename: string | null;
  status: string;
  additions: number;
  deletions: number;
  patch: string | null;
}

export interface ChangedFileSet {
  baseRef: string;
  headRef: string;
  files: ChangedFile[];
}

export interface CommitDetail extends ChangedFileSet {
  message: string;
  author: string;
  avatarUrl: string;
  date: string;
  parents: string[];
  additions: number;
  deletions: number;
}

export interface FileBlob {
  dataUrl: string | null;
  byteSize: number;
}

export interface FileText {
  text: string | null;
  byteSize: number;
}

export interface ChangeSummary {
  additions: number;
  deletions: number;
  commits: CommitSummary[];
}

export interface PullRequestCommits extends ChangeSummary {
  pull: PullRequestSummary;
  body: string | null;
  baseRef: string;
  headRef: string;
  conflicted: boolean;
}

export interface FileEdit {
  path: string;
  headRef: string;
  startLine: number;
  endLine: number;
  original: string;
  updated: string;
  message: string;
}

export interface FileDeletion {
  path: string;
  headRef: string;
  message: string;
}

export interface EditResult {
  sha: string;
  branch: string;
}

export interface MergeResult {
  merged: boolean;
  message: string;
}

export interface CloseResult {
  closed: boolean;
}

export interface PullComment {
  id: number;
  author: string;
  avatarUrl: string;
  createdAt: string;
  body: string;
  url: string;
  path: string | null;
}

interface GithubPull {
  number: number;
  node_id: string;
  title: string;
  body?: string | null;
  user: { login: string } | null;
  updated_at: string;
  draft?: boolean;
  state: string;
  merged?: boolean;
  base: { ref: string; sha: string };
  head: { ref: string; sha: string; repo?: { full_name: string } | null };
  additions?: number;
  deletions?: number;
  mergeable?: boolean | null;
  mergeable_state?: string;
  changed_files?: number;
}

interface GithubComment {
  id: number;
  user: { login: string; avatar_url?: string } | null;
  created_at: string;
  body?: string;
  html_url: string;
  path?: string;
}

interface GithubFileContents {
  sha: string;
  content?: string;
  encoding?: string;
}

export interface GithubChangedFile {
  filename: string;
  previous_filename?: string;
  status: string;
  additions: number;
  deletions: number;
  patch?: string;
}

export interface GithubCommit {
  sha: string;
  commit: { message: string; author: { name: string; date: string } | null };
  author: { login: string; avatar_url?: string } | null;
  parents?: { sha: string }[];
  files?: GithubChangedFile[];
  stats?: { additions: number; deletions: number };
}

const API = 'https://api.github.com';
const MAX_FILE_PAGES = 10;
const MAX_BLOB_BYTES = 6 * 1024 * 1024;
const MAX_TEXT_BYTES = 2 * 1024 * 1024;
export const MAX_SCANNED_REPOS = 60;
const SCAN_WORKERS = 6;
const COMMIT_STAT_WORKERS = 12;

export async function listPullRequests(
  owner: string,
  name: string,
  state: PullState = 'open',
): Promise<PullRequestSummary[]> {
  const pulls = await githubJson<GithubPull[]>(
    `${API}/repos/${owner}/${name}/pulls?state=${state}&sort=updated&direction=desc&per_page=50`,
  );
  return pulls.map(summarizePull);
}

export async function listPullRequestsAcross(repos: RepoRef[], state: PullState = 'open'): Promise<CrossRepoPulls> {
  const queue = repos.slice(0, MAX_SCANNED_REPOS);
  const pulls: CrossRepoPull[] = [];
  const failures: { repo: string; message: string }[] = [];
  const scan = async () => {
    for (let repo = queue.shift(); repo; repo = queue.shift()) {
      try {
        const found = await listPullRequests(repo.owner, repo.name, state);
        pulls.push(...found.map((pull) => ({ ...pull, owner: repo.owner, repo: repo.name })));
      } catch (error) {
        failures.push({
          repo: `${repo.owner}/${repo.name}`,
          message: errorMessage(error),
        });
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(SCAN_WORKERS, queue.length) }, scan));
  pulls.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return { pulls, failures };
}

export async function describePullRequest(
  owner: string,
  name: string,
  number: number,
  fresh = false,
): Promise<PullRequestCommits> {
  const [pull, commits] = await Promise.all([
    githubJson<GithubPull>(`${API}/repos/${owner}/${name}/pulls/${number}`, fresh),
    githubJson<GithubCommit[]>(`${API}/repos/${owner}/${name}/pulls/${number}/commits?per_page=100`),
  ]);
  const summaries = await summarizeCommits(owner, name, commits);
  return {
    pull: summarizePull(pull),
    body: pull.body ?? null,
    baseRef: pull.base.ref,
    headRef: pull.head.ref,
    additions: pull.additions ?? 0,
    deletions: pull.deletions ?? 0,
    conflicted: hasConflicts(pull),
    commits: summaries,
  };
}

export async function mergePullRequest(owner: string, name: string, number: number): Promise<MergeResult> {
  requireGithubUser('merging');
  const pull = await githubJson<GithubPull>(`${API}/repos/${owner}/${name}/pulls/${number}`);
  if (pull.draft) await markReadyForReview(pull.node_id);
  const result = await githubSend<{ merged?: boolean; message?: string }>(
    `${API}/repos/${owner}/${name}/pulls/${number}/merge`,
    'PUT',
    {},
  );
  return { merged: result.merged ?? false, message: result.message ?? '' };
}

export async function retargetPullRequest(owner: string, name: string, number: number, base: string): Promise<{ baseRef: string }> {
  requireGithubUser('changing the base branch');
  const pull = await githubSend<GithubPull>(`${API}/repos/${owner}/${name}/pulls/${number}`, 'PATCH', { base });
  await dropGithubCache(owner, name);
  return { baseRef: pull.base.ref };
}

export async function closePullRequest(owner: string, name: string, number: number): Promise<CloseResult> {
  requireGithubUser('closing pull requests');
  const pull = await githubSend<GithubPull>(`${API}/repos/${owner}/${name}/pulls/${number}`, 'PATCH', { state: 'closed' });
  return { closed: pull.state === 'closed' };
}

async function markReadyForReview(pullId: string): Promise<void> {
  try {
    await githubGraphql(
      'mutation($pullId: ID!) { markPullRequestReadyForReview(input: { pullRequestId: $pullId }) { pullRequest { isDraft } } }',
      { pullId },
    );
  } catch (error) {
    if (!alreadyReady(error)) throw error;
  }
}

function alreadyReady(error: unknown): boolean {
  return error instanceof Error && /not a draft/i.test(error.message);
}

export async function listPullRequestFiles(
  owner: string,
  name: string,
  number: number,
  fresh = false,
): Promise<ChangedFileSet> {
  const pull = await githubJson<GithubPull>(`${API}/repos/${owner}/${name}/pulls/${number}`, fresh);
  const files = await changedFilePages(owner, name, number, pageCount(pull.changed_files), fresh);
  return { baseRef: pull.base.sha, headRef: pull.head.sha, files };
}

// The pull request already counted its files, so every page can be asked for at once.
function pageCount(changedFiles: number | undefined): number | null {
  if (changedFiles === undefined) return null;
  return Math.min(MAX_FILE_PAGES, Math.max(1, Math.ceil(changedFiles / PAGE_SIZE)));
}

async function changedFilePages(
  owner: string,
  name: string,
  number: number,
  pages: number | null,
  fresh = false,
): Promise<ChangedFile[]> {
  if (pages === null) return countedFilePages(owner, name, number, fresh);
  const batches = await Promise.all(
    Array.from({ length: pages }, (_, at) => filePage(owner, name, number, at + 1, fresh)),
  );
  return batches.flat().map(changedFile);
}

async function countedFilePages(owner: string, name: string, number: number, fresh: boolean): Promise<ChangedFile[]> {
  const files = await githubJsonPages<GithubChangedFile>(filesUrl(owner, name, number), MAX_FILE_PAGES, fresh);
  return files.map(changedFile);
}

function filePage(owner: string, name: string, number: number, page: number, fresh: boolean): Promise<GithubChangedFile[]> {
  return githubJson<GithubChangedFile[]>(githubPageUrl(filesUrl(owner, name, number), page), fresh);
}

function filesUrl(owner: string, name: string, number: number): string {
  return `${API}/repos/${owner}/${name}/pulls/${number}/files`;
}

export async function commitFileEdit(
  owner: string,
  name: string,
  number: number,
  edit: FileEdit,
): Promise<EditResult> {
  const { contents, branch } = await editableFile(owner, name, number, edit.path, edit.headRef);
  const held = await githubJson<GithubFileContents>(`${contents}?ref=${encodeURIComponent(branch)}`, true);
  return commitContents(owner, name, branch, contents, 'PUT', {
    message: edit.message,
    content: Buffer.from(spliceLines(decodeContents(held), edit), 'utf8').toString('base64'),
    sha: held.sha,
    branch,
  });
}

export async function commitFileDeletion(
  owner: string,
  name: string,
  number: number,
  deletion: FileDeletion,
): Promise<EditResult> {
  const { contents, branch } = await editableFile(owner, name, number, deletion.path, deletion.headRef);
  const held = await githubJson<GithubFileContents>(`${contents}?ref=${encodeURIComponent(branch)}`, true);
  return commitContents(owner, name, branch, contents, 'DELETE', {
    message: deletion.message,
    sha: held.sha,
    branch,
  });
}

async function editableFile(
  owner: string,
  name: string,
  number: number,
  path: string,
  headRef: string,
): Promise<{ contents: string; branch: string }> {
  requireGithubUser('committing');
  const pull = await openPullAtHead(owner, name, number, headRef, path);
  const target = pull.head.repo?.full_name;
  if (!target) throw new GithubRequestError(422, `The head repository for #${number} is gone`);
  const changed = await changedFilePages(owner, name, number, null);
  if (!changed.some((file) => file.filename === path)) {
    throw new GithubRequestError(422, `${path} is not among the files this pull request changes`);
  }
  return { contents: `${API}/repos/${target}/contents/${encodePath(path)}`, branch: pull.head.ref };
}

export async function openPullAtHead(
  owner: string,
  name: string,
  number: number,
  headRef: string,
  path: string,
): Promise<GithubPull> {
  const pull = await githubJson<GithubPull>(`${API}/repos/${owner}/${name}/pulls/${number}`, true);
  if (pull.state !== 'open') throw new GithubRequestError(409, `Pull request #${number} is ${pull.state}`);
  if (pull.head.sha !== headRef) throw new GithubRequestError(409, staleMessage(path));
  return pull;
}

async function commitContents(
  owner: string,
  name: string,
  branch: string,
  contents: string,
  method: 'PUT' | 'DELETE',
  body: Record<string, string>,
): Promise<EditResult> {
  const commit = await githubSend<{ commit?: { sha?: string } }>(contents, method, body);
  await dropGithubCache(owner, name);
  return { sha: commit.commit?.sha ?? '', branch };
}

function decodeContents(held: GithubFileContents): string {
  if (held.encoding !== 'base64' || typeof held.content !== 'string') {
    throw new GithubRequestError(422, 'That file is too large to edit from here');
  }
  return Buffer.from(held.content, 'base64').toString('utf8');
}

function spliceLines(text: string, edit: FileEdit): string {
  const lines = text.split('\n');
  if (edit.endLine > lines.length) throw new GithubRequestError(409, staleMessage(edit.path));
  const standing = lines.slice(edit.startLine - 1, edit.endLine);
  if (standing.map(stripReturn).join('\n') !== edit.original) throw new GithubRequestError(409, staleMessage(edit.path));
  const ending = standing.some((line) => line.endsWith('\r')) ? '\r' : '';
  const replacement = edit.updated.split('\n').map((line) => stripReturn(line) + ending);
  return [...lines.slice(0, edit.startLine - 1), ...replacement, ...lines.slice(edit.endLine)].join('\n');
}

function stripReturn(line: string): string {
  return line.endsWith('\r') ? line.slice(0, -1) : line;
}

function staleMessage(path: string): string {
  return `${path} has changed on the branch since this diff loaded; reload before continuing`;
}

function encodePath(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/');
}

export async function listPullComments(owner: string, name: string, number: number): Promise<PullComment[]> {
  const [conversation, review] = await Promise.all([
    githubJson<GithubComment[]>(`${API}/repos/${owner}/${name}/issues/${number}/comments?per_page=100`),
    githubJson<GithubComment[]>(`${API}/repos/${owner}/${name}/pulls/${number}/comments?per_page=100`),
  ]);
  return [...conversation, ...review].map(pullComment).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function describeCommit(owner: string, name: string, sha: string): Promise<CommitDetail> {
  const commit = await githubJson<GithubCommit>(`${API}/repos/${owner}/${name}/commits/${sha}`);
  return {
    baseRef: commit.parents?.[0]?.sha ?? commit.sha,
    headRef: commit.sha,
    files: (commit.files ?? []).map(changedFile),
    message: commit.commit.message,
    author: commitAuthor(commit),
    avatarUrl: commit.author?.avatar_url ?? '',
    date: commitDate(commit),
    parents: (commit.parents ?? []).map((parent) => parent.sha),
    additions: commit.stats?.additions ?? 0,
    deletions: commit.stats?.deletions ?? 0,
  };
}

export async function readFileBlob(owner: string, name: string, ref: string, path: string): Promise<FileBlob> {
  const bytes = await readRawFile(owner, name, ref, path);
  if (bytes.byteLength > MAX_BLOB_BYTES) return { dataUrl: null, byteSize: bytes.byteLength };
  const type = imageTypeOf(path) ?? 'application/octet-stream';
  return {
    dataUrl: `data:${type};base64,${Buffer.from(bytes).toString('base64')}`,
    byteSize: bytes.byteLength,
  };
}

export async function readFileText(owner: string, name: string, ref: string, path: string): Promise<FileText> {
  const bytes = await readRawFile(owner, name, ref, path);
  if (bytes.byteLength > MAX_TEXT_BYTES) return { text: null, byteSize: bytes.byteLength };
  return { text: new TextDecoder().decode(bytes), byteSize: bytes.byteLength };
}

function readRawFile(owner: string, name: string, ref: string, path: string): Promise<Uint8Array> {
  const encoded = path.split('/').map(encodeURIComponent).join('/');
  return githubBytes(
    `${API}/repos/${owner}/${name}/contents/${encoded}?ref=${encodeURIComponent(ref)}`,
    'application/vnd.github.raw',
  );
}

export function changedFile(file: GithubChangedFile): ChangedFile {
  return {
    filename: file.filename,
    previousFilename: file.previous_filename ?? null,
    status: file.status,
    additions: file.additions,
    deletions: file.deletions,
    patch: file.patch ?? null,
  };
}

function pullComment(comment: GithubComment): PullComment {
  return {
    id: comment.id,
    author: comment.user?.login ?? '',
    avatarUrl: comment.user?.avatar_url ?? '',
    createdAt: comment.created_at,
    body: comment.body ?? '',
    url: comment.html_url,
    path: comment.path ?? null,
  };
}

function hasConflicts(pull: GithubPull): boolean {
  return pull.mergeable === false || pull.mergeable_state === 'dirty';
}

function summarizePull(pull: GithubPull): PullRequestSummary {
  return {
    number: pull.number,
    title: pull.title,
    author: pull.user?.login ?? '',
    updatedAt: pull.updated_at,
    draft: pull.draft ?? false,
    state: pull.state,
    merged: pull.merged ?? false,
  };
}

export function commitTitle(commit: GithubCommit): string {
  return commit.commit.message.split('\n')[0] ?? '';
}

export function commitDate(commit: GithubCommit): string {
  return commit.commit.author?.date ?? '';
}

function commitAuthor(commit: GithubCommit): string {
  return commit.author?.login ?? commit.commit.author?.name ?? '';
}

function summarizeCommit(commit: GithubCommit): CommitSummary {
  return {
    sha: commit.sha,
    message: commitTitle(commit),
    author: commitAuthor(commit),
    date: commitDate(commit),
    additions: commit.stats?.additions ?? 0,
    deletions: commit.stats?.deletions ?? 0,
    fileCount: commit.files?.length ?? 0,
  };
}

export async function summarizeCommits(owner: string, name: string, commits: GithubCommit[]): Promise<CommitSummary[]> {
  const summaries = commits.map(summarizeCommit);
  const totals = await mapWithWorkers(summaries, COMMIT_STAT_WORKERS, (held) => commitTotals(owner, name, held.sha));
  return summaries.map((summary, at) => ({ ...summary, ...totals[at] }));
}

interface CommitTotals {
  additions: number;
  deletions: number;
  fileCount: number;
}

async function commitTotals(owner: string, name: string, sha: string): Promise<CommitTotals> {
  try {
    const commit = await githubJson<GithubCommit>(`${API}/repos/${owner}/${name}/commits/${sha}`);
    return {
      additions: commit.stats?.additions ?? 0,
      deletions: commit.stats?.deletions ?? 0,
      fileCount: commit.files?.length ?? 0,
    };
  } catch {
    return { additions: 0, deletions: 0, fileCount: 0 };
  }
}
