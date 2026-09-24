import { existsSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { gitSucceeds, LocalGitError } from './gitRun';

export interface DiffArgs {
  cached: boolean;
  options: string[];
  revs: string[];
  paths: string[];
}

const CACHED_OPTIONS = ['--cached', '--staged'];
// Options that only reshape the patch; anything else (--output, --ext-diff, ...) is refused.
const PATCH_OPTIONS = [
  /^-[wb]$/,
  /^--ignore-(?:all-space|space-change|space-at-eol|blank-lines|cr-at-eol)$/,
  /^(?:-U|--unified=)\d{1,4}$/,
];

export async function classifyArgs(root: string, cwd: string, args: string[]): Promise<DiffArgs> {
  const split = args.indexOf('--');
  const before = split === -1 ? args : args.slice(0, split);
  const flags = before.filter(isOption);
  const { revs, loose } = await splitRevisions(root, before.filter((arg) => !isOption(arg)));
  const paths = [...loose.map((path) => existing(cwd, path)), ...(split === -1 ? [] : args.slice(split + 1))];
  return {
    cached: flags.some((flag) => CACHED_OPTIONS.includes(flag)),
    options: flags.filter((flag) => !CACHED_OPTIONS.includes(flag)).map(supported),
    revs,
    paths: paths.map((path) => fromRoot(root, cwd, path)),
  };
}

export async function canonicalArgs(root: string, cwd: string, args: string[]): Promise<string[]> {
  const { cached, options, revs, paths } = await classifyArgs(root, cwd, args);
  return [...(cached ? ['--cached'] : []), ...options, ...revs, ...(paths.length > 0 ? ['--', ...paths] : [])];
}

export function rangeEnds(rev: string): string[] {
  const [left = '', right = ''] = rev.split(isSymmetric(rev) ? '...' : '..');
  return isRange(rev) ? [left || 'HEAD', right || 'HEAD'] : [rev];
}

export function isRange(rev: string): boolean {
  return rev.includes('..');
}

export function isSymmetric(rev: string): boolean {
  return rev.includes('...');
}

function isOption(arg: string): boolean {
  return arg.startsWith('-') && arg !== '-';
}

function supported(option: string): string {
  if (PATCH_OPTIONS.some((pattern) => pattern.test(option))) return option;
  throw new LocalGitError(400, `Unsupported option: ${option}`);
}

// Like git: leading words are revisions until one isn't, and the rest must be existing paths.
async function splitRevisions(root: string, words: string[]): Promise<{ revs: string[]; loose: string[] }> {
  for (const [at, word] of words.entries()) {
    if (!(await isRevision(root, word))) return { revs: words.slice(0, at), loose: words.slice(at) };
  }
  return { revs: words, loose: [] };
}

async function isRevision(root: string, word: string): Promise<boolean> {
  const ends = rangeEnds(word).map((end) => gitSucceeds(root, ['rev-parse', '--verify', '--quiet', `${end}^{commit}`]));
  return (await Promise.all(ends)).every(Boolean);
}

function existing(cwd: string, path: string): string {
  if (existsSync(resolve(cwd, path))) return path;
  throw new LocalGitError(400, `Unknown revision or path not in the working tree: ${path}`);
}

function fromRoot(root: string, cwd: string, path: string): string {
  if (path.startsWith(':')) return path;
  return relative(root, resolve(cwd, path)) || '.';
}
