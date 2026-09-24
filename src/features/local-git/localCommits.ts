import type { CommitRange } from './diffPlan';
import { FIELD, gitText } from './gitRun';
import type { CommitSummary } from '@/features/pull-requests/pullRequests';

export interface LineCounts {
  additions: number;
  deletions: number;
}

const MAX_COMMITS = 250;
const RECORD = '\x1e';
const LOG_FORMAT = '--format=%x1e%H%x1f%an%x1f%aI%x1f%s';

export async function listCommits(root: string, range: CommitRange | null): Promise<CommitSummary[]> {
  if (range === null) return [];
  const spec = range.exclude === null ? range.include : `${range.exclude}..${range.include}`;
  const flags = [`--max-count=${MAX_COMMITS}`, LOG_FORMAT, '--numstat', '--diff-merges=first-parent', '--no-show-signature'];
  const output = await gitText(root, ['log', ...flags, spec, '--']);
  return output.split(RECORD).slice(1).map(summarizeCommit).reverse();
}

export function lineTotals(counts: LineCounts[]): LineCounts {
  return { additions: sumOf(counts, 'additions'), deletions: sumOf(counts, 'deletions') };
}

function sumOf(counts: LineCounts[], field: keyof LineCounts): number {
  return counts.reduce((sum, count) => sum + count[field], 0);
}

function summarizeCommit(record: string): CommitSummary {
  const [header = '', ...stats] = record.split('\n');
  const [sha = '', author = '', date = '', message = ''] = header.split(FIELD);
  const counts = stats.map(numstatOf).filter((count) => count !== null);
  return { sha, author, date, message, fileCount: counts.length, ...lineTotals(counts) };
}

function numstatOf(line: string): LineCounts | null {
  const match = line.match(/^(\d+|-)\t(\d+|-)\t/);
  return match ? { additions: countOf(match[1]), deletions: countOf(match[2]) } : null;
}

function countOf(field: string | undefined): number {
  return field === '-' ? 0 : Number(field);
}
