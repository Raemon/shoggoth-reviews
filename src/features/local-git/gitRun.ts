import { execFile, type ExecFileException } from 'node:child_process';

export class LocalGitError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

const MAX_OUTPUT_BYTES = 512 * 1024 * 1024;
// Polling must never hold index.lock, or the user's own git commands would fail mid-refresh.
const GIT_ENV = { ...process.env, GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0' };

export function gitBytes(root: string, args: string[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const options = { encoding: 'buffer' as const, maxBuffer: MAX_OUTPUT_BYTES, env: GIT_ENV };
    execFile('git', ['-C', root, '-c', 'core.quotePath=false', ...args], options, (error, stdout, stderr) => {
      if (error) reject(gitFailure(error, stderr.toString('utf8')));
      else resolve(stdout);
    });
  });
}

export async function gitText(root: string, args: string[]): Promise<string> {
  return (await gitBytes(root, args)).toString('utf8');
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

function gitFailure(error: ExecFileException, stderr: string): LocalGitError {
  if (error.code === 'ENOENT') return new LocalGitError(500, 'git is not installed or not on PATH');
  const message = stderr.trim().split('\n')[0]?.replace(/^(?:fatal|error): /, '');
  return new LocalGitError(400, message || error.message);
}
