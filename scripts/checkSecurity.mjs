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
  'VERCEL_ENV',
]);

try {
  await checkCredentials();
  await checkOauthOrigins();
  await checkSvgIsolation();
  await checkBoundedDownloads();
  await checkConcurrentTextDownloads();
  await checkMemoryBudget();
  await checkHeadResponses();
  await checkResponseLifetime();
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
  checkCanonicalOrigin(requestOrigin);
  checkPlatformOrigin(requestOrigin);
  checkLocalOrigin(requestOrigin, normalizeOrigin);
  checkRelaySignature(signReturn, verifiedReturn);
}

function checkCanonicalOrigin(requestOrigin) {
  clearDeploymentOrigins();
  process.env.REPOSCOPE_ORIGIN = 'https://review.example';
  const forged = new Request('https://internal.example/api/github/connect', {
    headers: { 'x-forwarded-host': 'attacker.example', 'x-forwarded-proto': 'https' },
  });
  assert.equal(requestOrigin(forged), 'https://review.example');
}

function checkPlatformOrigin(requestOrigin) {
  delete process.env.REPOSCOPE_ORIGIN;
  process.env.VERCEL_PROJECT_PRODUCTION_URL = 'production.example';
  process.env.VERCEL_URL = 'preview.example';
  process.env.VERCEL_ENV = 'preview';
  assert.equal(requestOrigin(new Request('https://internal.example')), 'https://preview.example');
  process.env.VERCEL_ENV = 'production';
  assert.equal(requestOrigin(new Request('https://internal.example')), 'https://production.example');
}

function checkLocalOrigin(requestOrigin, normalizeOrigin) {
  clearDeploymentOrigins();
  delete process.env.REPOSCOPE_ORIGIN;
  assert.equal(requestOrigin(new Request('http://localhost:2111/api/github/connect')), 'http://localhost:2111');
  assert.throws(() => requestOrigin(new Request('https://attacker.example/api/github/connect')));
  assert.throws(() => normalizeOrigin('https://review.example/path'));
  assert.throws(() => normalizeOrigin('http://review.example'));
}

function checkRelaySignature(signReturn, verifiedReturn) {
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
  assert.ok(html.includes(`<img src="data:image/svg+xml;base64,${payload}"`));
  assert.equal(html.match(/data:image\/svg\+xml/g)?.length, 1);
  assert.equal(imageTabBlob(`data:image/png;base64,${btoa('png')}`).type, 'image/png');
}

async function checkBoundedDownloads() {
  const { githubBytes } = await import('../src/features/codebases/githubRequest.ts');
  const requests = [];
  let exactLimitRequests = 0;
  globalThis.fetch = async (input, init) => {
    requests.push(init);
    const path = new URL(String(input)).pathname;
    if (path.endsWith('/declared')) return new Response('x', { headers: { 'content-length': '100' } });
    if (path.endsWith('/streamed')) return new Response(streamOf(['abc', 'def']));
    if (path.endsWith('/limit')) {
      exactLimitRequests += 1;
      return new Response(new Uint8Array(6 * 1024 * 1024));
    }
    return new Response('safe');
  };
  const root = 'https://api.github.com/repos/test/security/contents';
  assert.deepEqual(await githubBytes(`${root}/declared`, 'application/octet-stream', 5), { bytes: null, byteSize: 100 });
  assert.deepEqual(await githubBytes(`${root}/streamed`, 'application/octet-stream', 5), { bytes: null, byteSize: 6 });
  const safe = await githubBytes(`${root}/safe`, 'application/octet-stream', 5);
  assert.equal(new TextDecoder().decode(safe.bytes), 'safe');
  await checkExactLimitCache(githubBytes, `${root}/limit`);
  assert.equal(exactLimitRequests, 1);
  assert.ok(requests.every((init) => !new Headers(init?.headers).has('authorization')));
  assert.ok(requests.every((init) => new Headers(init?.headers).get('accept-encoding') === 'identity'));
}

async function checkExactLimitCache(githubBytes, url) {
  const limit = 6 * 1024 * 1024;
  const first = await githubBytes(url, 'application/octet-stream', limit);
  const second = await githubBytes(url, 'application/octet-stream', limit);
  assert.equal(first.bytes?.byteLength, limit);
  assert.equal(second.bytes?.byteLength, limit);
}

async function checkConcurrentTextDownloads() {
  const { readFileText } = await import('../src/features/pull-requests/pullRequests.ts');
  const reads = Array.from({ length: 8 }, (_, at) => readFileText('test', 'security', 'main', `concurrent-${at}`));
  const timeout = deferredTimeout(1000, 'Concurrent bounded downloads deadlocked');
  try {
    const files = await Promise.race([Promise.all(reads), timeout.promise]);
    assert.ok(files.every((file) => file.text === 'safe'));
  } finally {
    timeout.clear();
  }
}

async function checkMemoryBudget() {
  const { withGithubMemoryBudget } = await import('../src/features/codebases/githubMemoryBudget.ts');
  await checkQueuedBudget(withGithubMemoryBudget);
  await checkBudgetRelease(withGithubMemoryBudget);
  await assert.rejects(() => withGithubMemoryBudget(129 * 1024 * 1024, async () => undefined), { status: 429 });
}

async function checkQueuedBudget(withGithubMemoryBudget) {
  const firstStarted = deferred();
  const finishFirst = deferred();
  const started = [];
  const first = withGithubMemoryBudget(96 * 1024 * 1024, async () => {
    started.push('first');
    firstStarted.resolve();
    await finishFirst.promise;
  });
  await firstStarted.promise;
  const second = withGithubMemoryBudget(64 * 1024 * 1024, async () => started.push('second'));
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(started, ['first']);
  finishFirst.resolve();
  await Promise.all([first, second]);
  assert.deepEqual(started, ['first', 'second']);
}

async function checkBudgetRelease(withGithubMemoryBudget) {
  const failure = new Error('expected');
  await assert.rejects(() => withGithubMemoryBudget(128 * 1024 * 1024, async () => Promise.reject(failure)), failure);
  let admitted = false;
  await withGithubMemoryBudget(128 * 1024 * 1024, async () => {
    admitted = true;
  });
  assert.equal(admitted, true);
}

async function checkResponseLifetime() {
  const { apiRoute } = await import('../src/features/github-auth/apiRoute.ts');
  const request = new Request('http://localhost/api/github/test');
  const held = await Promise.all(Array.from({ length: 8 }, () => apiRoute(request, async () => ({ ok: true }))));
  let ninthReady = false;
  const ninthPromise = apiRoute(request, async () => ({ ok: true })).then((response) => {
    ninthReady = true;
    return response;
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(ninthReady, false);
  await held[0].text();
  const ninth = await ninthPromise;
  assert.equal(ninthReady, true);
  await Promise.all([...held.slice(1), ninth].map((response) => response.text()));
}

async function checkHeadResponses() {
  const { apiRoute } = await import('../src/features/github-auth/apiRoute.ts');
  const request = new Request('http://localhost/api/github/test', { method: 'HEAD' });
  const responses = await Promise.all(Array.from({ length: 9 }, () => apiRoute(request, async () => ({ ok: true }))));
  assert.ok(responses.every((response) => response.body === null && response.status === 200));
}

function deferred() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function deferredTimeout(milliseconds, message) {
  let timer;
  const promise = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), milliseconds);
  });
  return { promise, clear: () => clearTimeout(timer) };
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
  for (const name of ['REPOSCOPE_ORIGIN', 'RENDER_EXTERNAL_URL', 'VERCEL_PROJECT_PRODUCTION_URL', 'VERCEL_URL', 'VERCEL_ENV']) {
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
