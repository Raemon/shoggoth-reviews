import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, realpath, rm, symlink, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { canonicalArgs } from '../src/features/local-git/diffArgs.ts';
import { parseGitPatch } from '../src/features/local-git/gitPatch.ts';
import { describeLocalChange, listLocalCommitFiles } from '../src/features/local-git/localChange.ts';
import { countLocalLines, listLocalFiles, readLocalBlob, readLocalText } from '../src/features/local-git/localFiles.ts';
import { describeLocalRepo } from '../src/features/local-git/localOverview.ts';
import { INDEX_REF, WORKTREE_REF } from '../src/features/local-git/localRefs.ts';

const scratch = await realpath(await mkdtemp(join(tmpdir(), 'reposcope-local-git-')));
let checks = 0;

try {
  await checkPatchParsing();
  const repo = await buildRepo(join(scratch, 'repo'));
  await checkWorktree(repo);
  await checkStaged(repo);
  await checkBranchRange(repo);
  await checkShow(repo);
  await checkArguments(repo);
  await checkFileReads(repo);
  await checkOverview(repo);
  await checkConflict(join(scratch, 'conflict'));
  console.log(`Local git checks passed (${checks}).`);
} finally {
  await rm(scratch, { recursive: true, force: true });
}

function check(label, run) {
  checks += 1;
  try {
    return run();
  } catch (error) {
    error.message = `${label}: ${error.message}`;
    throw error;
  }
}

function git(repo, ...args) {
  return execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
}

async function write(repo, path, text) {
  await mkdir(join(repo, path, '..'), { recursive: true });
  await writeFile(join(repo, path), text);
}

function byName(files) {
  return Object.fromEntries(files.map((file) => [file.filename, file]));
}

async function buildRepo(repo) {
  await mkdir(repo);
  git(repo, 'init', '-q', '-b', 'main');
  git(repo, 'config', 'user.email', 'check@example.com');
  git(repo, 'config', 'user.name', 'Check');
  await write(repo, 'plain.txt', 'a\nb\nc\n');
  await write(repo, 'doomed.txt', 'bye\n');
  await write(repo, 'moving.txt', `${Array.from({ length: 40 }, (_, at) => at).join('\n')}\n`);
  await write(repo, 'with space.txt', 'x\n');
  await write(repo, 'quo"te.txt', 'q\n');
  await write(repo, 'src/deep/file.ts', 'export const one = 1;\n');
  git(repo, 'add', '-A');
  git(repo, 'commit', '-qm', 'root');
  git(repo, 'checkout', '-qb', 'feature');
  await write(repo, 'feature.txt', 'feature one\n');
  git(repo, 'add', '-A');
  git(repo, 'commit', '-qm', 'feature one');
  await write(repo, 'feature.txt', 'feature one\nfeature two\n');
  git(repo, 'commit', '-qam', 'feature two');
  git(repo, 'checkout', '-q', 'main');
  await write(repo, 'plain.txt', 'a\nMAIN\nc\n');
  git(repo, 'commit', '-qam', 'main moves on');
  await write(repo, 'stashed.txt', 'kept for later\n');
  git(repo, 'add', 'stashed.txt');
  git(repo, 'stash', 'push', '-q', '-m', 'parked work');
  git(repo, 'mv', 'moving.txt', 'moved.txt');
  await write(repo, 'plain.txt', 'a\nMAIN\nc\nd\n');
  await unlink(join(repo, 'doomed.txt'));
  await write(repo, 'with space.txt', 'X\n');
  await write(repo, 'quo"te.txt', 'Q\n');
  await write(repo, 'untracked.txt', 'one\ntwo');
  await writeFile(join(repo, 'image.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 1, 2]));
  await symlink('plain.txt', join(repo, 'link'));
  await symlink('/etc/hosts', join(repo, 'escape'));
  await symlink('/etc', join(repo, 'dirlink'));
  return repo;
}

async function checkPatchParsing() {
  const typeChange = [
    'diff --git a/tool b/tool',
    'deleted file mode 100644',
    '--- a/tool',
    '+++ /dev/null',
    '@@ -1 +0,0 @@',
    '-echo hi',
    'diff --git a/tool b/tool',
    'new file mode 120000',
    '--- /dev/null',
    '+++ b/tool',
    '@@ -0,0 +1 @@',
    '+target',
    '\\ No newline at end of file',
    '* Unmerged path other',
    'diff --git "a/sp\\303\\251cial \\"x\\"" "b/sp\\303\\251cial \\"x\\""',
    'new file mode 100644',
    'index 0000000..e69de29',
  ].join('\n');
  const { files } = parseGitPatch(typeChange);
  check('type change merges into one file', () => {
    assert.equal(files.length, 2);
    assert.equal(files[0].status, 'changed');
    assert.equal(files[0].patch, '@@ -1 +0,0 @@\n-echo hi\n@@ -0,0 +1 @@\n+target\n\\ No newline at end of file');
  });
  check('quoted empty file', () => assert.deepEqual([files[1].filename, files[1].status, files[1].patch], ['spécial "x"', 'added', null]));
}

async function checkWorktree(repo) {
  const change = await describeLocalChange(repo, 'diff', []);
  const files = byName(change.files);
  check('worktree sides', () => assert.deepEqual([change.baseRef, change.headRef, change.commits], [INDEX_REF, WORKTREE_REF, []]));
  check('modified', () => assert.equal(files['plain.txt'].patch, '@@ -1,3 +1,4 @@\n a\n MAIN\n c\n+d'));
  check('removed', () => assert.deepEqual([files['doomed.txt'].status, files['doomed.txt'].deletions], ['removed', 1]));
  check('spaced name', () => assert.equal(files['with space.txt'].additions, 1));
  check('quoted name', () => assert.equal(files['quo"te.txt'].status, 'modified'));
  check('untracked text', () =>
    assert.equal(files['untracked.txt'].patch, '@@ -0,0 +1,2 @@\n+one\n+two\n\\ No newline at end of file'),
  );
  check('untracked binary', () => assert.deepEqual([files['image.png'].status, files['image.png'].patch], ['added', null]));
  check('untracked symlink', () => assert.equal(files['link'].patch, '@@ -0,0 +1 @@\n+plain.txt\n\\ No newline at end of file'));
  check('staged rename stays out', () => assert.equal(files['moved.txt'], undefined));
  check('totals', () => assert.equal(change.additions, change.files.reduce((sum, file) => sum + file.additions, 0)));
}

async function checkStaged(repo) {
  const change = await describeLocalChange(repo, 'diff', ['--staged']);
  check('staged rename', () => {
    assert.deepEqual(change.files.map((file) => [file.filename, file.previousFilename, file.status]), [['moved.txt', 'moving.txt', 'renamed']]);
    assert.equal(change.headRef, INDEX_REF);
    assert.equal(change.commits.length, 0);
  });
  const everything = byName((await describeLocalChange(repo, 'diff', ['HEAD'])).files);
  check('HEAD against worktree', () => assert.deepEqual([everything['moved.txt'].status, everything['untracked.txt'].status], ['renamed', 'added']));
}

async function checkBranchRange(repo) {
  const change = await describeLocalChange(repo, 'diff', ['main...feature']);
  check('branch commits', () => assert.deepEqual(change.commits.map((commit) => commit.message), ['feature one', 'feature two']));
  check('branch files', () => assert.deepEqual(change.files.map((file) => file.filename), ['feature.txt']));
  check('branch stats', () => assert.deepEqual([change.commits[1].additions, change.commits[1].fileCount], [1, 1]));
  const twoDot = await describeLocalChange(repo, 'diff', ['main..feature']);
  check('two-dot compares tips', () => assert.deepEqual(twoDot.files.map((file) => file.filename).sort(), ['feature.txt', 'plain.txt']));
}

async function checkShow(repo) {
  const root = git(repo, 'rev-list', '--max-parents=0', 'HEAD').trim();
  const shown = await describeLocalChange(repo, 'show', [root]);
  check('root commit', () => {
    assert.equal(shown.files.length, 6);
    assert.ok(shown.files.every((file) => file.status === 'added'));
    assert.deepEqual(shown.commits.map((commit) => commit.sha), [root]);
  });
  const stash = git(repo, 'rev-parse', 'stash@{0}').trim();
  const stashed = await listLocalCommitFiles(repo, stash);
  check('stash', () => assert.deepEqual(stashed.files.map((file) => file.filename), ['stashed.txt']));
}

async function checkArguments(repo) {
  await assert.rejects(describeLocalChange(repo, 'diff', ['--output=/tmp/x']), /Unsupported option/);
  await assert.rejects(describeLocalChange(repo, 'diff', ['no-such-thing']), /Unknown revision or path/);
  await assert.rejects(describeLocalChange(repo, 'show', ['HEAD~1..HEAD']), /single commit/);
  check('refused arguments', () => {});
  const narrowed = await describeLocalChange(repo, 'diff', ['-w', '--', 'plain.txt']);
  check('pathspec', () => assert.deepEqual(narrowed.files.map((file) => file.filename), ['plain.txt']));
  const canonical = await canonicalArgs(repo, join(repo, 'src'), ['--staged', 'HEAD', 'deep/file.ts']);
  check('launch arguments from a subdirectory', () => assert.deepEqual(canonical, ['--cached', 'HEAD', '--', 'src/deep/file.ts']));
}

async function checkFileReads(repo) {
  const head = git(repo, 'rev-parse', 'HEAD').trim();
  const [worktree, index, committed] = await Promise.all([
    readLocalText(repo, WORKTREE_REF, 'plain.txt'),
    readLocalText(repo, INDEX_REF, 'plain.txt'),
    readLocalText(repo, head, 'plain.txt'),
  ]);
  check('reads each side', () => assert.deepEqual([worktree.text, index.text, committed.text], ['a\nMAIN\nc\nd\n', 'a\nMAIN\nc\n', 'a\nMAIN\nc\n']));
  const [link, escape] = await Promise.all([readLocalText(repo, WORKTREE_REF, 'link'), readLocalText(repo, WORKTREE_REF, 'escape')]);
  check('symlinks read as their targets', () => assert.deepEqual([link.text, escape.text], ['plain.txt', '/etc/hosts']));
  await assert.rejects(readLocalText(repo, WORKTREE_REF, '../outside'), /outside the repository/);
  await assert.rejects(readLocalText(repo, WORKTREE_REF, 'dirlink/hosts'), /outside the repository/);
  await assert.rejects(readLocalText(repo, WORKTREE_REF, 'src'), /not a file/);
  const blob = await readLocalBlob(repo, WORKTREE_REF, 'image.png');
  check('blob', () => assert.ok(blob.dataUrl?.startsWith('data:image/png;base64,')));
  const listed = await listLocalFiles(repo);
  check('worktree listing', () => {
    assert.ok(listed.files.includes('untracked.txt'));
    assert.ok(!listed.files.includes('doomed.txt'));
    assert.equal(listed.sha, WORKTREE_REF);
  });
  const atHead = await listLocalFiles(repo, head);
  check('tree listing', () => assert.ok(atHead.files.includes('doomed.txt') && atHead.files.includes('src/deep/file.ts')));
  const counts = await countLocalLines(repo, head);
  check('line counts', () => assert.deepEqual([counts.lines['plain.txt'], counts.lines['moving.txt']], [3, 40]));
  const worktreeCounts = await countLocalLines(repo, WORKTREE_REF);
  check('worktree line counts', () => assert.deepEqual([worktreeCounts.lines['plain.txt'], worktreeCounts.lines['untracked.txt']], [4, 2]));
}

async function checkOverview(repo) {
  const overview = await describeLocalRepo(repo);
  check('overview', () => {
    assert.deepEqual([overview.root, overview.branch, overview.trunk, overview.hasHead], [repo, 'main', 'main', true]);
    assert.deepEqual(overview.branches.map((branch) => [branch.name, branch.ahead, branch.behind]), [['feature', 2, 1]]);
    assert.deepEqual(overview.stashes.map((stash) => [stash.name, stash.message]), [['stash@{0}', 'On main: parked work']]);
    assert.deepEqual(overview.worktree, { staged: 1, unstaged: 4, untracked: 5, conflicted: 0, uncommitted: 10 });
  });
}

async function checkConflict(repo) {
  await mkdir(repo);
  git(repo, 'init', '-q', '-b', 'main');
  git(repo, 'config', 'user.email', 'check@example.com');
  git(repo, 'config', 'user.name', 'Check');
  await write(repo, 'clash.txt', 'a\nb\nc\n');
  git(repo, 'add', '-A');
  git(repo, 'commit', '-qm', 'root');
  git(repo, 'checkout', '-qb', 'other');
  await write(repo, 'clash.txt', 'a\nOTHER\nc\n');
  git(repo, 'commit', '-qam', 'other');
  git(repo, 'checkout', '-q', 'main');
  await write(repo, 'clash.txt', 'a\nMAIN\nc\n');
  git(repo, 'commit', '-qam', 'main');
  try {
    git(repo, 'merge', 'other');
  } catch {}
  const { files } = await describeLocalChange(repo, 'diff', []);
  check('conflicted file', () => {
    assert.deepEqual(files.map((file) => [file.filename, file.status]), [['clash.txt', 'conflicted']]);
    assert.match(files[0].patch, /^\+<<<<<<< HEAD$/m);
  });
  const overview = await describeLocalRepo(repo);
  check('conflict count', () => assert.equal(overview.worktree.conflicted, 1));
}
