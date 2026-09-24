import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, realpath, rm, symlink, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const HOST_ENV = { ...process.env };
// Launched from a git alias, the app inherits GIT_DIR; the local git layer must ignore it.
process.env.GIT_DIR = '/nonexistent/reposcope-check.git';
const { canonicalArgs } = await import('../src/features/local-git/diffArgs.ts');
const { parseGitPatch } = await import('../src/features/local-git/gitPatch.ts');
const { describeLocalChange, listLocalCommitFiles } = await import('../src/features/local-git/localChange.ts');
const { countLocalLines, listLocalFiles, readLocalBlob, readLocalText } = await import('../src/features/local-git/localFiles.ts');
const { describeLocalRepo } = await import('../src/features/local-git/localOverview.ts');
const { INDEX_REF, WORKTREE_REF } = await import('../src/features/local-git/localRefs.ts');

const scratch = await realpath(await mkdtemp(join(tmpdir(), 'reposcope-local-git-')));
let checks = 0;

try {
  await checkDesktopGate();
  process.env.REPOSCOPE_DESKTOP = '1';
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
  await checkUserConfig(join(scratch, 'configured'));
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

function checkRejects(label, promise, pattern) {
  checks += 1;
  return assert.rejects(promise, pattern, label);
}

function git(repo, ...args) {
  return execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], env: HOST_ENV });
}

async function write(repo, path, text) {
  await mkdir(join(repo, path, '..'), { recursive: true });
  await writeFile(join(repo, path), text);
}

function byName(files) {
  return Object.fromEntries(files.map((file) => [file.filename, file]));
}

async function initRepo(repo) {
  await mkdir(repo);
  git(repo, 'init', '-q', '-b', 'main');
  git(repo, 'config', 'user.email', 'check@example.com');
  git(repo, 'config', 'user.name', 'Check');
}

function commitAll(repo, message) {
  git(repo, 'add', '-A');
  git(repo, 'commit', '-qm', message);
}

async function buildRepo(repo) {
  await initRepo(repo);
  await commitRoot(repo);
  await commitFeatureBranch(repo);
  await parkStash(repo);
  await dirtyWorktree(repo);
  return repo;
}

async function commitRoot(repo) {
  await write(repo, 'plain.txt', 'a\nb\nc\n');
  await write(repo, 'doomed.txt', 'bye\n');
  await write(repo, 'moving.txt', `${Array.from({ length: 40 }, (_, at) => at).join('\n')}\n`);
  await write(repo, 'with space.txt', 'x\n');
  await write(repo, 'quo"te.txt', 'q\n');
  await write(repo, 'src/deep/file.ts', 'export const one = 1;\n');
  commitAll(repo, 'root');
}

async function commitFeatureBranch(repo) {
  git(repo, 'checkout', '-qb', 'feature');
  await write(repo, 'feature.txt', 'feature one\n');
  commitAll(repo, 'feature one');
  await write(repo, 'feature.txt', 'feature one\nfeature two\n');
  commitAll(repo, 'feature two');
  git(repo, 'checkout', '-q', 'main');
  await write(repo, 'plain.txt', 'a\nMAIN\nc\n');
  commitAll(repo, 'main moves on');
}

async function parkStash(repo) {
  await write(repo, 'stashed.txt', 'kept for later\n');
  git(repo, 'add', 'stashed.txt');
  git(repo, 'stash', 'push', '-q', '-m', 'parked work');
}

async function dirtyWorktree(repo) {
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
}

async function checkDesktopGate() {
  await checkRejects('refused outside the desktop app', describeLocalRepo(scratch), /only available in the desktop app/);
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
  check('untracked symlink', () => assert.equal(files['link'].patch, '@@ -0,0 +1,1 @@\n+plain.txt\n\\ No newline at end of file'));
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
  await checkRejects('refuses unsafe options', describeLocalChange(repo, 'diff', ['--output=/tmp/x']), /Unsupported option/);
  await checkRejects('unknown words', describeLocalChange(repo, 'diff', ['no-such-thing']), /Unknown revision or path/);
  await checkRejects('show takes one commit', describeLocalChange(repo, 'show', ['HEAD~1..HEAD']), /single commit/);
  await checkRejects('cached with a range', describeLocalChange(repo, 'diff', ['--cached', 'main..feature']), /--cached/);
  const narrowed = await describeLocalChange(repo, 'diff', ['-w', '--', 'plain.txt']);
  check('pathspec', () => assert.deepEqual(narrowed.files.map((file) => file.filename), ['plain.txt']));
  const canonical = await canonicalArgs(repo, join(repo, 'src'), ['--staged', 'HEAD', 'deep/file.ts']);
  check('launch arguments from a subdirectory', () => assert.deepEqual(canonical, ['--cached', 'HEAD', '--', 'src/deep/file.ts']));
}

async function checkFileReads(repo) {
  const head = git(repo, 'rev-parse', 'HEAD').trim();
  await checkSideReads(repo, head);
  await checkUnsafeReads(repo);
  await checkListings(repo, head);
  await checkLineCounts(repo, head);
}

async function checkSideReads(repo, head) {
  const [worktree, index, committed] = await Promise.all([
    readLocalText(repo, WORKTREE_REF, 'plain.txt'),
    readLocalText(repo, INDEX_REF, 'plain.txt'),
    readLocalText(repo, head, 'plain.txt'),
  ]);
  check('reads each side', () => assert.deepEqual([worktree.text, index.text, committed.text], ['a\nMAIN\nc\nd\n', 'a\nMAIN\nc\n', 'a\nMAIN\nc\n']));
  const [link, escape] = await Promise.all([readLocalText(repo, WORKTREE_REF, 'link'), readLocalText(repo, WORKTREE_REF, 'escape')]);
  check('symlinks read as their targets', () => assert.deepEqual([link.text, escape.text], ['plain.txt', '/etc/hosts']));
  const blob = await readLocalBlob(repo, WORKTREE_REF, 'image.png');
  check('blob', () => assert.ok(blob.dataUrl?.startsWith('data:image/png;base64,')));
}

async function checkUnsafeReads(repo) {
  await checkRejects('parent path', readLocalText(repo, WORKTREE_REF, '../outside'), /outside the repository/);
  await checkRejects('symlinked folder', readLocalText(repo, WORKTREE_REF, 'dirlink/hosts'), /outside the repository/);
  await checkRejects('folder', readLocalText(repo, WORKTREE_REF, 'src'), /not a file/);
}

async function checkListings(repo, head) {
  const listed = await listLocalFiles(repo);
  check('worktree listing', () => {
    assert.ok(listed.files.includes('untracked.txt'));
    assert.ok(!listed.files.includes('doomed.txt'));
    assert.equal(listed.sha, WORKTREE_REF);
  });
  const atHead = await listLocalFiles(repo, head);
  check('tree listing', () => assert.ok(atHead.files.includes('doomed.txt') && atHead.files.includes('src/deep/file.ts')));
}

async function checkLineCounts(repo, head) {
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
  await initRepo(repo);
  await write(repo, 'clash.txt', 'a\nb\nc\n');
  commitAll(repo, 'root');
  git(repo, 'checkout', '-qb', 'other');
  await write(repo, 'clash.txt', 'a\nOTHER\nc\n');
  commitAll(repo, 'other');
  git(repo, 'checkout', '-q', 'main');
  await write(repo, 'clash.txt', 'a\nMAIN\nc\n');
  commitAll(repo, 'main');
  try {
    git(repo, 'merge', 'other');
  } catch {}
  const { files } = await describeLocalChange(repo, 'diff', []);
  check('conflicted file', () => {
    assert.deepEqual(files.map((file) => [file.filename, file.status]), [['clash.txt', 'conflicted']]);
    assert.match(files[0].patch, /^\+<<<<<<< HEAD$/m);
  });
  git(repo, 'tag', 'other', 'main');
  const overview = await describeLocalRepo(repo);
  check('conflict count', () => assert.equal(overview.worktree.conflicted, 1));
  check('branch named like a tag', () => assert.deepEqual(overview.branches.map((branch) => branch.name), ['other']));
}

async function checkUserConfig(repo) {
  await initRepo(repo);
  await write(repo, 'blank.txt', 'x\n\ny\n');
  commitAll(repo, 'root');
  git(repo, 'config', 'diff.suppressBlankEmpty', 'true');
  await write(repo, 'blank.txt', 'x\n\nY\n');
  const { files } = await describeLocalChange(repo, 'diff', []);
  check('blank context lines survive diff.suppressBlankEmpty', () => assert.equal(files[0].patch, '@@ -1,3 +1,3 @@\n x\n \n-y\n+Y'));
}
