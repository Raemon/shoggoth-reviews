import { NextResponse, type NextRequest } from 'next/server';
import { githubLinkRoute } from '@/features/sources/githubLinkRoute';

export function proxy(request: NextRequest) {
  const route = githubLinkRoute(request.nextUrl.pathname);
  return route === null ? NextResponse.next() : NextResponse.redirect(new URL(route, request.url));
}

export const config = {
  matcher: ['/((?:https?:/+)?(?:www\\.)?github\\.com(?:/.*)?)'],
};
