import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';

export interface CachedResponse {
  status: number;
  etag: string | null;
  lastModified: string | null;
  storedAt: number;
  encoding: 'utf8' | 'base64';
  body: string;
}

const DIRECTORY = process.env.REPOSCOPE_CACHE_DIR ?? join(tmpdir(), 'reposcope-github-cache');
const MAX_MEMORY_ENTRIES = 512;
const MAX_MEMORY_BYTES = 64 * 1024 * 1024;
const MAX_STORED_BYTES = 8_000_000;
const MAX_DIRECTORY_BYTES = 256_000_000;
const WRITES_BETWEEN_PRUNES = 50;

const memory = new Map<string, CachedResponse>();
let memoryBytes = 0;
let writesSincePrune = 0;

export function cacheKey(parts: readonly string[]): string {
  return createHash('sha256').update(parts.join('\n')).digest('hex').slice(0, 32);
}

export async function readCachedResponse(scope: string, key: string): Promise<CachedResponse | null> {
  const held = memory.get(scope + key);
  if (held) return held;
  try {
    const packed = await readFile(entryPath(scope, key));
    const entry = JSON.parse(gunzipSync(packed).toString('utf8')) as CachedResponse;
    rememberInMemory(scope + key, entry);
    return entry;
  } catch {
    return null;
  }
}

export async function writeCachedResponse(scope: string, key: string, entry: CachedResponse): Promise<void> {
  const heldKey = scope + key;
  forgetInMemory(heldKey);
  if (storedBytes(entry) > MAX_STORED_BYTES) {
    await rm(entryPath(scope, key), { force: true }).catch(() => undefined);
    return;
  }
  rememberInMemory(heldKey, entry);
  try {
    await mkdir(DIRECTORY, { recursive: true });
    await writeFile(entryPath(scope, key), gzipSync(JSON.stringify(entry)));
    await pruneWhenDue();
  } catch {
    return;
  }
}

export async function dropCachedScope(scope: string): Promise<void> {
  const prefix = scopeHash(scope);
  for (const held of memory.keys()) if (held.startsWith(scope)) forgetInMemory(held);
  try {
    for (const name of await readdir(/*turbopackIgnore: true*/ DIRECTORY)) {
      if (name.startsWith(`${prefix}~`)) await rm(join(DIRECTORY, name), { force: true });
    }
  } catch {
    return;
  }
}

function rememberInMemory(key: string, entry: CachedResponse): void {
  forgetInMemory(key);
  memory.set(key, entry);
  memoryBytes += memorySize(entry);
  while (memory.size > MAX_MEMORY_ENTRIES || memoryBytes > MAX_MEMORY_BYTES) {
    forgetInMemory(memory.keys().next().value as string);
  }
}

function forgetInMemory(key: string): void {
  const held = memory.get(key);
  if (!held) return;
  memoryBytes -= memorySize(held);
  memory.delete(key);
}

function storedBytes(entry: CachedResponse): number {
  return Buffer.byteLength(entry.body, entry.encoding === 'base64' ? 'ascii' : 'utf8');
}

function memorySize(entry: CachedResponse): number {
  return entry.body.length * 2 + 256;
}

function entryPath(scope: string, key: string): string {
  return join(DIRECTORY, `${scopeHash(scope)}~${key}.json.gz`);
}

function scopeHash(scope: string): string {
  return createHash('sha256').update(scope).digest('hex').slice(0, 16);
}

async function pruneWhenDue(): Promise<void> {
  writesSincePrune += 1;
  if (writesSincePrune < WRITES_BETWEEN_PRUNES) return;
  writesSincePrune = 0;
  const entries = await Promise.all(
    (await readdir(/*turbopackIgnore: true*/ DIRECTORY)).map(async (name) => {
      const path = join(DIRECTORY, name);
      const info = await stat(path).catch(() => null);
      return { path, size: info?.size ?? 0, usedAt: info?.mtimeMs ?? 0 };
    }),
  );
  let total = entries.reduce((sum, entry) => sum + entry.size, 0);
  for (const entry of entries.sort((a, b) => a.usedAt - b.usedAt)) {
    if (total <= MAX_DIRECTORY_BYTES) return;
    await rm(entry.path, { force: true });
    total -= entry.size;
  }
}
