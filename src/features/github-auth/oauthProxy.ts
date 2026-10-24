import { createHmac, timingSafeEqual } from 'node:crypto';
import { normalizeOrigin, requestOrigin } from './requestOrigin';

export function oauthProxy(request?: Request): string | null {
  const configured = process.env.GITHUB_OAUTH_PROXY_ORIGIN;
  const proxy = configured ? normalizeOrigin(configured) : null;
  return proxy && request && proxy === requestOrigin(request) ? null : proxy;
}

export function signReturn(origin: string): string | null {
  const secret = process.env.GITHUB_OAUTH_RELAY_SECRET;
  return secret ? signature(normalizeOrigin(origin), secret) : null;
}

export function verifiedReturn(origin: string | null, signature: string | null): string | null {
  if (!origin || !signature) return null;
  const normalized = safelyNormalize(origin);
  const expected = normalized === origin ? signReturn(normalized) : null;
  return expected && sameSignature(expected, signature) ? normalized : null;
}

export function forwardRefresh(proxy: string, refreshToken: string): Promise<Response> {
  const body = JSON.stringify({ refreshToken });
  return fetch(`${proxy}/api/github/refresh`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body })
    .catch(() => Response.json({ error: 'GitHub refresh proxy failed' }, { status: 502 }));
}

function signature(origin: string, secret: string): string {
  return createHmac('sha256', secret).update(origin).digest('base64url');
}

function safelyNormalize(origin: string): string | null {
  try {
    return normalizeOrigin(origin);
  } catch {
    return null;
  }
}

function sameSignature(expected: string, given: string): boolean {
  const [want, received] = [Buffer.from(expected), Buffer.from(given)];
  return want.length === received.length && timingSafeEqual(want, received);
}
