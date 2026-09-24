import type { CommitRange } from './diffPlan';
import { gitText } from './gitRun';
import type { CommitSummary } from '@/features/pull-requests/pullRequests';

interface LineCounts {
  additions: number;
  deletions: number;
}

const MAX_COMMITS = 250;
const RECORD = '\x1e';
const FIELD = '\x1f';
const LOG_FORMAT = '--format=%x1e%H%x1f%an%x1f%aI%x1f%s';

export async function listCommits(root: string, range: CommitRange | null): Promise<CommitSummary[]> {
  if (range === null) return [];
  const spec = range.exclude === null ? range.include : `${range.exclude}..${range.include}`;
  const flags = [`--max-count=${MAX_COMMITS}`, LOG_FORMAT, '--numstat', '--diff-merges=first-parent', '--no-show-signature'];
  const output = await gitText(root, ['log', ...flags, spec, '--']);
  return output.split(RECORD).slice(1).map(summarizeCommit).reverse();
}

function summarizeCommit(record: string): CommitSummary {
  const [header = '', ...stats] = record.split('\n');
  const [sha = '', author = '', date = '', message = ''] = header.split(FIELD);
  const counts = stats.map(numstatOf).filter((count) => count !== null);
  return { sha, author, date, message, fileCount: counts.length, ...totals(counts) };
}

// Binary files count as "-" in numstat, and as no lines here.
function numstatOf(line: string): LineCounts | null {
  const match = line.match(/^(\d+|-)\t(\d+|-)\t/);
  return match ? { additions: Number(match[1]) || 0, deletions: Number(match[2]) || 0 } : null;
}

function totals(counts: LineCounts[]): LineCounts {
  return counts.reduce((sum, count) => ({ additions: sum.additions + count.additions, deletions: sum.deletions + count.deletions }), {
    additions: 0,
    deletions: 0,
  });
}
