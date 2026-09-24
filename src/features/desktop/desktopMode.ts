import { notFound } from 'next/navigation';
import { connection } from 'next/server';

// Set only by desktop/server.mjs, which also enforces a per-launch request secret.
export function desktopMode(): boolean {
  return process.env.REPOSCOPE_DESKTOP === '1';
}

// Waits for a request first; checked at build time, it would prerender a permanent 404.
export async function desktopOnly(): Promise<void> {
  await connection();
  if (!desktopMode()) notFound();
}
