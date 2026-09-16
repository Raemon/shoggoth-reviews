import { githubJson } from '@/features/codebases/githubRequest';
import { urlWithProtocol } from '@/features/markdown/sanitizeHtml';
import { mapWithWorkers } from './workerPool';

interface GithubDeployment {
  id: number;
  environment?: string;
  production_environment?: boolean;
  creator: { login: string } | null;
  created_at: string;
}

interface GithubDeploymentStatus {
  state: string;
  environment_url: string | null;
  target_url: string | null;
  created_at: string;
}

export type PreviewState = 'ready' | 'building' | 'failed' | 'none';

export interface CommitPreview {
  sha: string;
  state: PreviewState;
  url: string | null;
  deployedAt: string | null;
}

type DeploymentPreview = Omit<CommitPreview, 'sha'>;
type PreviewLookup = DeploymentPreview | { error: unknown };
const API = 'https://api.github.com';
const LATEST_STATUS_BOTS = new Set(['render[bot]', 'github-actions[bot]']);
const PREVIEW_BOTS = new Set(['vercel[bot]', ...LATEST_STATUS_BOTS]);
const FAILED_STATES = new Set(['failure', 'error']);
const WEB_PROTOCOLS = new Set(['https:', 'http:']);
const NO_PREVIEW: DeploymentPreview = { state: 'none', url: null, deployedAt: null };

export async function commitPreview(owner: string, name: string, sha: string, fresh = false): Promise<CommitPreview> {
  const query = new URLSearchParams({ sha, per_page: '20' });
  const deployments = await githubJson<GithubDeployment[]>(`${API}/repos/${owner}/${name}/deployments?${query}`, fresh);
  const supported = deployments.filter(isSupportedPreview);
  const previews = await mapWithWorkers(supported, 3, (deployment) => describeDeploymentSafely(owner, name, deployment, fresh));
  return { sha, ...preferredPreview(previews) };
}

function isSupportedPreview(deployment: GithubDeployment): boolean {
  if (!PREVIEW_BOTS.has(deployment.creator?.login ?? '')) return false;
  return deployment.production_environment !== true && deployment.environment?.toLowerCase() !== 'production';
}

function describeDeploymentSafely(owner: string, name: string, deployment: GithubDeployment, fresh: boolean): Promise<PreviewLookup> {
  return describeDeployment(owner, name, deployment, fresh).catch((error: unknown) => ({ error }));
}

function preferredPreview(results: PreviewLookup[]): DeploymentPreview {
  const resolved = results.filter(isResolved);
  const failure = results.find(isFailure);
  if (resolved.length === 0 && failure) throw failure.error;
  return firstAvailable(resolved);
}

function isResolved(result: PreviewLookup): result is DeploymentPreview {
  return !('error' in result);
}

function isFailure(result: PreviewLookup): result is { error: unknown } {
  return 'error' in result;
}

function firstAvailable(previews: DeploymentPreview[]): DeploymentPreview {
  return previews.find((preview) => preview.state === 'ready')
    ?? previews.find((preview) => preview.state === 'building')
    ?? previews.find((preview) => preview.state === 'failed')
    ?? NO_PREVIEW;
}

async function describeDeployment(owner: string, name: string, deployment: GithubDeployment, fresh: boolean): Promise<DeploymentPreview> {
  const url = `${API}/repos/${owner}/${name}/deployments/${deployment.id}/statuses?per_page=20`;
  const statuses = await githubJson<GithubDeploymentStatus[]>(url, fresh);
  return LATEST_STATUS_BOTS.has(deployment.creator?.login ?? '')
    ? latestStatusPreview(statuses[0], deployment.created_at)
    : vercelPreview(statuses, deployment.created_at);
}

function latestStatusPreview(latest: GithubDeploymentStatus | undefined, createdAt: string): DeploymentPreview {
  if (latest?.state === 'inactive') return NO_PREVIEW;
  if (latest?.state === 'success') return readyPreview(webUrl(latest.environment_url), latest.created_at);
  return unfinishedPreview(latest ? [latest] : [], createdAt);
}

function vercelPreview(statuses: GithubDeploymentStatus[], createdAt: string): DeploymentPreview {
  const live = statuses.find((status) => status.state === 'success');
  return live ? readyPreview(vercelLiveUrl(live), live.created_at) : unfinishedPreview(statuses, createdAt);
}

function vercelLiveUrl(status: GithubDeploymentStatus): string | null {
  return webUrl(status.environment_url) ?? webUrl(status.target_url);
}

function readyPreview(url: string | null, deployedAt: string): DeploymentPreview {
  return url ? { state: 'ready', url, deployedAt } : NO_PREVIEW;
}

function unfinishedPreview(statuses: GithubDeploymentStatus[], deployedAt: string): DeploymentPreview {
  const failed = statuses.some((status) => FAILED_STATES.has(status.state));
  return { state: failed ? 'failed' : 'building', url: null, deployedAt };
}

function webUrl(value: string | null | undefined): string | null {
  return value ? urlWithProtocol(value, WEB_PROTOCOLS) : null;
}
