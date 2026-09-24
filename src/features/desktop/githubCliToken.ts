import { execFile, type ExecFileException } from 'node:child_process';
import { GithubRequestError } from '@/features/codebases/githubRequest';

const CLI_TIMEOUT_MS = 10_000;

export function githubCliToken(): Promise<{ token: string }> {
  return new Promise((resolve, reject) => {
    execFile('gh', ['auth', 'token', '--hostname', 'github.com'], { timeout: CLI_TIMEOUT_MS }, (error, stdout) => {
      const token = stdout.trim();
      if (error || !token) reject(cliFailure(error));
      else resolve({ token });
    });
  });
}

function cliFailure(error: ExecFileException | null): GithubRequestError {
  if (error?.code === 'ENOENT') return new GithubRequestError(404, 'The GitHub CLI (gh) is not installed or not on PATH');
  return new GithubRequestError(401, 'The GitHub CLI is not signed in; run `gh auth login` first');
}
