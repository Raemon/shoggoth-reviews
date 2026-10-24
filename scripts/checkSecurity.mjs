import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const cache = await mkdtemp(join(tmpdir(), 'reposcope-security-check-'));
process.env.REPOSCOPE_CACHE_DIR = cache;

const originalFetch = globalThis.fetch;
const originalEnvironment = savedEnvironment([
  'GITHUB_TOKEN',
  'GH_TOKEN',
  'GITHUB_OAUTH_RELAY_SECRET',
  'GITHUB_OAUTH_PROXY_ORIGIN',
  'REPOSCOPE_ORIGIN',
  'RENDER_EXTERNAL_URL',
  'VERCEL_PROJECT_PRODUCTION_URL',
  'VERCEL_URL',
]);

try {
  await checkCredentials();
  await checkOauthOrigins();
  await checkSvgIsolation();
  await checkBoundedDownloads();
  console.log('Security regression checks passed.');
} finally {
  globalThis.fetch = originalFetch;
  restoreEnvironment(originalEnvironment);
  await rm(cache, { recursive: true, force: true });
}

async function checkCredentials() {
  const { githubToken, withGithubToken } = await import('../src/features/codebases/githubToken.ts');
  process.env.GITHUB_TOKEN = 'deployment-secret';
  process.env.GH_TOKEN = 'deployment-secret-two';
  await withGithubToken(null, async () => assert.equal(githubToken(), null));
  await withGithubToken('user-secret', async () => assert.equal(githubToken(), 'user-secret'));
}

async function checkOauthOrigins() {
  const { normalizeOrigin, requestOrigin } = await import('../src/features/github-auth/requestOrigin.ts');
  const { signReturn, verifiedReturn } = await import('../src/features/github-auth/oauthProxy.ts');
  clearDeploymentOrigins();
  process.env.REPOSCOPE_ORIGIN = 'https://review.example';
  const forged = new Request('https://internal.example/api/github/connect', {
    headers: { 'x-forwarded-host': 'attacker.example', 'x-forwarded-proto': 'https' },
  });
  assert.equal(requestOrigin(forged), 'https://review.example');
  delete process.env.REPOSCOPE_ORIGIN;
  assert.equal(requestOrigin(new Request('http://localhost:2111/api/github/connect')), 'http://localhost:2111');
  assert.throws(() => requestOrigin(new Request('https://attacker.example/api/github/connect')));
  assert.throws(() => normalizeOrigin('https://review.example/path'));
  process.env.GITHUB_OAUTH_RELAY_SECRET = 'relay-secret';
  const signature = signReturn('https://review.example');
  assert.equal(verifiedReturn('https://review.example', signature), 'https://review.example');
  assert.equal(verifiedReturn('https://attacker.example', signature), null);
}

async function checkSvgIsolation() {
  const { imageTabBlob } = await import('../src/features/pull-requests/openImageTab.ts');
  const payload = btoa('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(document.domain)</script></svg>');
  const preview = imageTabBlob(`data:image/svg+xml;base64,${payload}`);
  assert.equal(preview.type, 'text/html');
  const html = await preview.text();
  assert.match(html, /Content-Security-Policy/);
  assert.match(html, /default-src 'none'/);
  assert.doesNotMatch(html, /<script>/);
  assert.equal(imageTabBlob(`data:image/png;base64,${btoa('png')}`).type, 'image/png');
}

async function checkBoundedDownloads() {
  const { githubBytes } = await import('../src/features/codebases/githubRequest.ts');
  const requests = [];
  globalThis.fetch = async (input, init) => {
    requests.push(init);
    const path = new URL(String(input)).pathname;
    if (path.endsWith('/declared')) return new Response('x', { headers: { 'content-length': '100' } });
    if (path.endsWith('/streamed')) return new Response(streamOf(['abc', 'def']));
    return new Response('safe');
  };
  const root = 'https://api.github.com/repos/test/security/contents';
  assert.deepEqual(await githubBytes(`${root}/declared`, 'application/octet-stream', 5), { bytes: null, byteSize: 100 });
  assert.deepEqual(await githubBytes(`${root}/streamed`, 'application/octet-stream', 5), { bytes: null, byteSize: 6 });
  const safe = await githubBytes(`${root}/safe`, 'application/octet-stream', 5);
  assert.equal(new TextDecoder().decode(safe.bytes), 'safe');
  assert.ok(requests.every((init) => !new Headers(init?.headers).has('authorization')));
}

function streamOf(chunks) {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

function clearDeploymentOrigins() {
  for (const name of ['REPOSCOPE_ORIGIN', 'RENDER_EXTERNAL_URL', 'VERCEL_PROJECT_PRODUCTION_URL', 'VERCEL_URL']) {
    delete process.env[name];
  }
}

function savedEnvironment(names) {
  return new Map(names.map((name) => [name, process.env[name]]));
}

function restoreEnvironment(saved) {
  for (const [name, value] of saved) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
}
