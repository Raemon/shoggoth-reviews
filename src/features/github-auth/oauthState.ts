import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { parseGithubAccess, type GithubAccess } from './githubAccess';

const STATE_COOKIE = 'reposcope-oauth-state';
const STATE_PATH = '/api/github';
const MAX_AGE = 10 * 60;

export interface OauthSignIn {
  access: GithubAccess;
  next: string | null;
}

export async function issueOauthState({ access, next }: OauthSignIn, returnOrigin: string | null): Promise<string> {
  const state = [access, randomBytes(16).toString('hex'), encodeSegment(returnOrigin), encodeSegment(next)].join('.');
  (await cookies()).set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: STATE_PATH,
    maxAge: MAX_AGE,
  });
  return state;
}

export async function consumeOauthState(): Promise<string | null> {
  const jar = await cookies();
  const state = jar.get(STATE_COOKIE)?.value ?? null;
  jar.delete({ name: STATE_COOKIE, path: STATE_PATH });
  return state;
}

export function parseOauthState(state: string): OauthSignIn & { returnTo: string | null } {
  const [access, , encodedReturn, encodedNext] = state.split('.');
  return { access: parseGithubAccess(access), next: decodeSegment(encodedNext), returnTo: decodeSegment(encodedReturn) };
}

function encodeSegment(value: string | null): string {
  return value ? Buffer.from(value).toString('base64url') : '';
}

function decodeSegment(segment: string | undefined): string | null {
  return segment ? Buffer.from(segment, 'base64url').toString() : null;
}
