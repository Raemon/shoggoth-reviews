import { existsSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { LocalGitError } from './gitRun';
import { commitSha } from './localRevs';

export interface DiffArgs {
  cached: boolean;
  options: string[];
  revs: string[];
  paths: string[];
}

const CACHED_OPTIONS = ['--cached', '--staged'];
// Allowlist: others like --output or --ext-diff could write files or run programs.
const PATCH_OPTIONS = [
  /^-[wb]$/,
  /^--ignore-(?:all-space|space-change|space-at-eol|blank-lines|cr-at-eol)$/,
  /^(?:-U|--unified=)\d{1,4}$/,
];

export async function classifyArgs(root: string, cwd: string, args: string[]): Promise<DiffArgs> {
  const { before, after } = splitAtDashes(args);
  const flags = before.filter(isOption);
  const { revs, loose } = await splitRevisions(root, before.filter((arg) => !isOption(arg)));
  const paths = [...loose.map((path) => existing(cwd, path)), ...after];
  return {
    cached: flags.some(isCachedFlag),
    options: flags.filter((flag) => !isCachedFlag(flag)).map(supported),
    revs,
    paths: paths.map((path) => fromRoot(root, cwd, path)),
  };
}

export async function canonicalArgs(root: string, cwd: string, args: string[]): Promise<string[]> {
  const { cached, options, revs, paths } = await classifyArgs(root, cwd, args);
  const cachedFlag = cached ? ['--cached'] : [];
  const pathArgs = paths.length > 0 ? ['--', ...paths] : [];
  return [...cachedFlag, ...options, ...revs, ...pathArgs];
}

export function rangeEnds(rev: string): string[] {
  if (!isRange(rev)) return [rev];
  const [left, right] = rev.split(isSymmetric(rev) ? '...' : '..');
  return [left || 'HEAD', right || 'HEAD'];
}

export function isRange(rev: string): boolean {
  return rev.includes('..');
}

export function isSymmetric(rev: string): boolean {
  return rev.includes('...');
}

function splitAtDashes(args: string[]): { before: string[]; after: string[] } {
  const at = args.indexOf('--');
  return at === -1 ? { before: args, after: [] } : { before: args.slice(0, at), after: args.slice(at + 1) };
}

function isOption(arg: string): boolean {
  return arg.startsWith('-') && arg !== '-';
}

function isCachedFlag(flag: string): boolean {
  return CACHED_OPTIONS.includes(flag);
}

function supported(option: string): string {
  if (PATCH_OPTIONS.some((pattern) => pattern.test(option))) return option;
  throw new LocalGitError(400, `Unsupported option: ${option}`);
}

async function splitRevisions(root: string, words: string[]): Promise<{ revs: string[]; loose: string[] }> {
  for (const [at, word] of words.entries()) {
    if (!(await isRevision(root, word))) return { revs: words.slice(0, at), loose: words.slice(at) };
  }
  return { revs: words, loose: [] };
}

async function isRevision(root: string, word: string): Promise<boolean> {
  const shas = await Promise.all(rangeEnds(word).map((end) => commitSha(root, end)));
  return shas.every((sha) => sha !== null);
}

function existing(cwd: string, path: string): string {
  if (existsSync(resolve(cwd, path))) return path;
  throw new LocalGitError(400, `Unknown revision or path not in the working tree: ${path}`);
}

function fromRoot(root: string, cwd: string, path: string): string {
  if (path.startsWith(':')) return path;
  return relative(root, resolve(cwd, path)) || '.';
}
