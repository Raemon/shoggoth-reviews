import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const cache = await mkdtemp(join(tmpdir(), 'render-preview-check-'));
process.env.REPOSCOPE_CACHE_DIR = cache;
const { commitPreview } = await import('../src/features/pull-requests/previewDeployment.ts');
const { withGithubToken } = await import('../src/features/codebases/githubToken.ts');
const originalFetch = globalThis.fetch;
const createdAt = '2026-09-15T12:00:00Z';
const deployedAt = '2026-09-15T12:01:00Z';
let checks = 0;

function deployment(id, creator = 'render[bot]', extra = {}) {
  return { id, creator: { login: creator }, environment: 'feature - app PR #1', production_environment: false, created_at: createdAt, ...extra };
}

function status(state, environment_url = '', extra = {}) {
  return { state, environment_url, target_url: 'https://dashboard.render.com/deploys/example', created_at: deployedAt, ...extra };
}

async function check(label, deployments, statuses, expected) {
  const sha = String(++checks).padStart(40, '0');
  const calls = [];
  globalThis.fetch = async (input) => answer(input, sha, deployments, statuses, calls);
  await assertOutcome(sha, expected, label);
  assert.ok(calls.every((url) => url.origin === 'https://api.github.com'));
  console.log(`✓ ${label}`);
}

async function assertOutcome(sha, expected, label) {
  const read = () => withGithubToken('preview-test-token', () => commitPreview('test', 'previews', sha, true));
  if ('error' in expected) return assert.rejects(read, { status: expected.error }, label);
  assert.deepEqual(await read(), { sha, ...expected }, label);
}

function answer(input, sha, deployments, statuses, calls) {
  const url = new URL(String(input));
  calls.push(url);
  return url.pathname.endsWith('/deployments') ? answerDeployments(url, sha, deployments) : answerStatuses(url, statuses);
}

function answerDeployments(url, sha, deployments) {
  assert.equal(url.searchParams.get('sha'), sha);
  return Response.json(deployments);
}

function answerStatuses(url, statuses) {
  const id = url.pathname.match(/\/deployments\/(\d+)\/statuses$/)?.[1];
  assert.ok(id && Object.hasOwn(statuses, id), `Unexpected status request: ${url.pathname}`);
  const result = statuses[id];
  return result.httpStatus ? Response.json({ message: 'Unavailable' }, { status: result.httpStatus }) : Response.json(result);
}

const none = { state: 'none', url: null, deployedAt: null };
const unfinished = (state) => ({ state, url: null, deployedAt: createdAt });
const ready = (url) => ({ state: 'ready', url, deployedAt });
const renderUrl = 'https://example-pr-1.onrender.com/';
const vercelUrl = 'https://example.vercel.app/';
const render = deployment(1);
const vercel = deployment(2, 'vercel[bot]');
const actions = deployment(3, 'github-actions[bot]', { environment: 'render-preview' });

try {
  await check('Render uses its app URL, not its dashboard target', [render], { 1: [status('success', renderUrl)] }, ready(renderUrl));
  await check('Render permits custom app domains', [render], { 1: [status('success', 'https://preview.example.com/app')] }, ready('https://preview.example.com/app'));
  await check('Render never treats its dashboard target as the preview', [render], { 1: [status('success')] }, none);
  await check('Render rejects unsafe app URLs', [render], { 1: [status('success', 'javascript:alert(1)')] }, none);
  await check('Render pending deployments remain building', [render], { 1: [status('in_progress', renderUrl)] }, unfinished('building'));
  await check('Render deployments without statuses remain building', [render], { 1: [] }, unfinished('building'));
  await check('Render errors are failed', [render], { 1: [status('error')] }, unfinished('failed'));
  await check('Render failures are failed', [render], { 1: [status('failure')] }, unfinished('failed'));
  await check('Deleted Render previews do not resurrect older success URLs', [render], { 1: [status('inactive'), status('success', renderUrl)] }, none);
  await check('Render failures supersede older success statuses', [render], { 1: [status('failure'), status('success', renderUrl)] }, unfinished('failed'));
  await check('Render rebuilds supersede older success statuses', [render], { 1: [status('in_progress'), status('success', renderUrl)] }, unfinished('building'));
  await check('GitHub Actions deployments resolve from their latest status', [actions], { 3: [status('success', renderUrl)] }, ready(renderUrl));
  await check('GitHub Actions deployments retired by a newer push are gone', [actions], { 3: [status('inactive'), status('success', renderUrl)] }, none);
  await check('GitHub Actions deployments still waiting are building', [actions], { 3: [status('in_progress')] }, unfinished('building'));
  await check('Production Render services are excluded', [deployment(1, 'render[bot]', { production_environment: true })], {}, none);
  await check('Production environment names are excluded case-insensitively', [deployment(1, 'render[bot]', { environment: 'PrOdUcTiOn' })], {}, none);
  await check('Unknown deployment creators are excluded', [deployment(1, 'untrusted-bot')], {}, none);
  await check('Missing creators are excluded', [deployment(1, 'render[bot]', { creator: null })], {}, none);
  await check('Vercel app URLs still resolve', [vercel], { 2: [status('success', vercelUrl)] }, ready(vercelUrl));
  await check('Vercel target URL fallback still works', [vercel], { 2: [status('success', null, { target_url: vercelUrl })] }, ready(vercelUrl));
  await check('Historical Vercel previews retain their immutable success URLs', [vercel], { 2: [status('inactive'), status('success', vercelUrl)] }, ready(vercelUrl));
  await check('A failed Vercel deployment cannot hide a ready Render preview', [vercel, render], { 2: [status('failure')], 1: [status('success', renderUrl)] }, ready(renderUrl));
  await check('A deleted Render preview cannot hide a ready Vercel preview', [render, vercel], { 1: [status('inactive')], 2: [status('success', vercelUrl)] }, ready(vercelUrl));
  await check('A building provider takes precedence over another provider’s failure', [vercel, render], { 2: [status('failure')], 1: [status('pending')] }, unfinished('building'));
  await check('A missing secondary deployment cannot hide a ready preview', [render, vercel], { 1: [status('success', renderUrl)], 2: { httpStatus: 404 } }, ready(renderUrl));
  await check('A secondary provider outage cannot hide a ready preview', [vercel, render], { 2: { httpStatus: 503 }, 1: [status('success', renderUrl)] }, ready(renderUrl));
  await check('A resolved absence is not overridden by another deployment’s outage', [render, vercel], { 1: [status('inactive')], 2: { httpStatus: 503 } }, none);
  await check('An unresolved lookup still reports errors when no preview is available', [render], { 1: { httpStatus: 503 } }, { error: 503 });
  await check('An absent deployment stays absent', [], {}, none);
} finally {
  globalThis.fetch = originalFetch;
  await rm(cache, { recursive: true, force: true });
}
console.log(`${checks} preview deployment checks passed.`);
