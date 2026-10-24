export function requestOrigin(request: Request): string {
  const configured = deploymentOrigin();
  if (configured) return configured;
  const origin = normalizeOrigin(new URL(request.url).origin);
  if (isLoopback(new URL(origin).hostname)) return origin;
  throw new Error('Set REPOSCOPE_ORIGIN to the public origin before enabling GitHub OAuth');
}

export function normalizeOrigin(value: string): string {
  const candidate = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  const url = new URL(candidate);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw invalidOrigin(value);
  if ((url.pathname && url.pathname !== '/') || url.search || url.hash) throw invalidOrigin(value);
  if (url.protocol === 'http:' && !isLoopback(url.hostname)) throw invalidOrigin(value);
  return url.origin;
}

function deploymentOrigin(): string | null {
  const configured = process.env.REPOSCOPE_ORIGIN;
  if (configured) return normalizeOrigin(configured);
  const vercel = process.env.VERCEL_ENV === 'production'
    ? process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL
    : process.env.VERCEL_URL ?? process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const platform = vercel ?? process.env.RENDER_EXTERNAL_URL;
  return platform ? normalizeOrigin(platform) : null;
}

function isLoopback(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

function invalidOrigin(value: string): TypeError {
  return new TypeError(`Invalid OAuth origin: ${value}`);
}
