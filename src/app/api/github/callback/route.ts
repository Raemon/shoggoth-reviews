import { NextResponse } from 'next/server';
import { oauthConfig } from '@/features/github-auth/githubOAuthConfig';
import { exchangeCode } from '@/features/github-auth/githubOAuthTokens';
import { grantToParams } from '@/features/github-auth/grantParams';
import { callbackUrl, failHome, NOT_CONFIGURED } from '@/features/github-auth/oauthRoute';
import { consumeOauthState, parseOauthState } from '@/features/github-auth/oauthState';
import { requestOrigin } from '@/features/github-auth/requestOrigin';
import { errorMessage } from '@/features/sources/errorMessage';

export async function GET(request: Request) {
  const origin = requestOrigin(request);
  const fail = failHome(origin);
  const config = oauthConfig();
  if (!config) return fail(NOT_CONFIGURED);
  const query = new URL(request.url).searchParams;
  const denied = query.get('error_description') ?? query.get('error');
  if (denied) return fail(`GitHub sign-in failed: ${denied}`);
  const code = query.get('code');
  const state = query.get('state');
  const expected = await consumeOauthState();
  if (!code || !state || !expected || state !== expected) return fail('GitHub sign-in state mismatch; try again');
  try {
    const grant = await exchangeCode(code, callbackUrl(origin), config);
    const { access, next, returnTo } = parseOauthState(state);
    const granted = grantToParams(grant, access);
    if (next) granted.set('next', next);
    return NextResponse.redirect(`${returnTo ?? origin}/connect#${granted}`);
  } catch (error) {
    return fail(errorMessage(error, 'GitHub sign-in failed'));
  }
}
