import { execFile, type ExecFileException } from 'node:child_process';

export class LocalGitError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export const FIELD = '\x1f';
const MAX_OUTPUT_BYTES = 512 * 1024 * 1024;
// Stops polling from taking index.lock and breaking the user's own git commands.
const QUIET_ENV = { GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0' };
// Set when launched from a git alias or hook; they would point every repo at that one.
const REPO_ENV = /^GIT_(?:DIR|WORK_TREE|COMMON_DIR|INDEX_FILE|OBJECT_DIRECTORY|ALTERNATE_OBJECT_DIRECTORIES|CONFIG.*|GRAFT_FILE|IMPLICIT_WORK_TREE|NO_REPLACE_OBJECTS|REPLACE_REF_BASE|PREFIX|SHALLOW_FILE)$/;
const GIT_ENV: NodeJS.ProcessEnv = { ...withoutRepoEnv(process.env), ...QUIET_ENV };
const PINNED_CONFIG = ['-c', 'core.quotePath=false', '-c', 'diff.suppressBlankEmpty=false'];

export function gitBytes(root: string, args: string[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const options = { encoding: 'buffer' as const, maxBuffer: MAX_OUTPUT_BYTES, env: GIT_ENV };
    execFile('git', ['-C', root, ...PINNED_CONFIG, ...args], options, (error, stdout, stderr) => {
      if (error) reject(gitFailure(error, stderr.toString('utf8')));
      else resolve(stdout);
    });
  });
}

export async function gitText(root: string, args: string[]): Promise<string> {
  return (await gitBytes(root, args)).toString('utf8');
}

export async function gitLine(root: string, args: string[]): Promise<string | null> {
  return (await gitText(root, args).catch(() => '')).trim() || null;
}

export async function gitSucceeds(root: string, args: string[]): Promise<boolean> {
  return gitBytes(root, args).then(
    () => true,
    () => false,
  );
}

export function nulSeparated(output: string): string[] {
  return output.split('\0').filter((entry) => entry !== '');
}

export function lineSeparated(output: string): string[] {
  return output.split('\n').filter((line) => line !== '');
}

function withoutRepoEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const kept = { ...env };
  for (const name of Object.keys(kept)) if (REPO_ENV.test(name)) delete kept[name];
  return kept;
}

function gitFailure(error: ExecFileException, stderr: string): LocalGitError {
  if (error.code === 'ENOENT') return new LocalGitError(500, 'git is not installed or not on PATH');
  const message = stderr.trim().split('\n')[0]?.replace(/^(?:fatal|error): /, '');
  return new LocalGitError(400, message || error.message);
}
