import { NextResponse } from 'next/server';
import { parseGithubAccess, oauthScope } from '@/features/github-auth/githubAccess';
import { oauthConfig } from '@/features/github-auth/githubOAuthConfig';
import { oauthProxy, signReturn, verifiedReturn } from '@/features/github-auth/oauthProxy';
import { callbackUrl, failHome, NOT_CONFIGURED, RELAY_UNVERIFIED, type Fail } from '@/features/github-auth/oauthRoute';
import { issueOauthState, type OauthSignIn } from '@/features/github-auth/oauthState';
import { requestOrigin } from '@/features/github-auth/requestOrigin';
import { returnPath } from '@/features/github-auth/returnPath';

function relayToProxy(proxy: string, origin: string, signIn: OauthSignIn, fail: Fail) {
  const sig = signReturn(origin);
  if (!sig) return fail(RELAY_UNVERIFIED);
  const relay = new URLSearchParams({ access: signIn.access, return: origin, sig });
  if (signIn.next) relay.set('next', signIn.next);
  return NextResponse.redirect(`${proxy}/api/github/connect?${relay}`);
}

async function authorizeUrl(origin: string, signIn: OauthSignIn, returnTo: string | null, clientId: string) {
  const query = new URLSearchParams({
    client_id: clientId,
    redirect_uri: callbackUrl(origin),
    scope: oauthScope(signIn.access),
    state: await issueOauthState(signIn, returnTo),
  });
  return `https://github.com/login/oauth/authorize?${query}`;
}

async function startSignIn(origin: string, params: URLSearchParams, signIn: OauthSignIn, fail: Fail) {
  const config = oauthConfig();
  if (!config) return fail(NOT_CONFIGURED);
  const returnTo = verifiedReturn(params.get('return'), params.get('sig'));
  if (params.has('return') && !returnTo) return fail(RELAY_UNVERIFIED);
  return NextResponse.redirect(await authorizeUrl(origin, signIn, returnTo, config.clientId));
}

export async function GET(request: Request) {
  const origin = requestOrigin(request);
  const params = new URL(request.url).searchParams;
  const signIn = { access: parseGithubAccess(params.get('access')), next: returnPath(params.get('next')) };
  const fail = failHome(origin);
  const proxy = oauthProxy(request);
  return proxy ? relayToProxy(proxy, origin, signIn, fail) : startSignIn(origin, params, signIn, fail);
}
