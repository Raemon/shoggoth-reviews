import { readFile } from 'node:fs/promises';
import { collapseRegions } from '../src/features/pull-requests/collapseRegions.ts';
import { columnLines, shownLines } from '../src/features/pull-requests/diffLines.ts';
import { NO_TRUNCATION } from '../src/features/pull-requests/truncateRows.ts';
import { allLinesDeleted } from '../src/features/pull-requests/foldSpan.ts';
import { revealedRegions } from '../src/features/pull-requests/foldReveals.ts';
import { overrideWasmSource, treeCollapseRegions } from '../src/features/pull-requests/treeSitterFolds.ts';

const WASM = 'node_modules/@vscode/tree-sitter-wasm/wasm';
overrideWasmSource({
  module: async () => (await import(`${process.cwd()}/${WASM}/tree-sitter.js`)).default,
  runtime: () => ({ locateFile: (file, folder) => `${folder}${file}` }),
  grammar: async (name) => new Uint8Array(await readFile(`${WASM}/tree-sitter-${name}.wasm`)),
});

let failures = 0;
function check(name, actual, expected) {
  const got = JSON.stringify(actual);
  const want = JSON.stringify(expected);
  if (got === want) return;
  failures += 1;
  console.error(`FAIL ${name}\n  got  ${got}\n  want ${want}`);
}

function rowsOf(lines) {
  return lines.map((text, i) => ({ kind: 'context', label: '', left: { line: i + 1, text }, right: { line: i + 1, text } }));
}

function spansOf(lines, filename, contiguous = true) {
  return collapseRegions(rowsOf(lines), contiguous, filename).map((r) => [r.start, r.end, r.imports ? 'imp' : 'br']);
}

function boundsOf(lines, filename) {
  return collapseRegions(rowsOf(lines), true, filename).map((r) => [r.start, r.end]);
}
function mixedRows() {
  return [
    { kind: 'context', label: '', left: { line: 1, text: 'function foo() {' }, right: { line: 1, text: 'function foo() {' } },
    { kind: 'change', label: '', left: { line: 2, text: '  old(' }, right: { line: 2, text: '  newCall()' } },
    { kind: 'change', label: '', left: { line: 3, text: '  )' }, right: null },
    { kind: 'context', label: '', left: { line: 4, text: '  more();' }, right: { line: 3, text: '  more();' } },
    { kind: 'context', label: '', left: { line: 5, text: '}' }, right: { line: 4, text: '}' } },
  ];
}

// --- detection across languages -------------------------------------------------
check("ts function", spansOf([
  'function foo(a, b) {',
  '  const x = 1;',
  '  return x;',
  '}',
  '',
  'const y = 2;',
], 'x.ts', true), [[0,3,"br"]]);
check("imports block", spansOf([
  "import a from 'a';",
  "import b from 'b';",
  '',
  "import { c,",
  "  d,",
  "} from 'cd';",
  '',
  'const x = 1;',
], 'x.ts', true), [[0,5,"imp"],[3,5,"br"]]);
check("string with brace", spansOf([
  "const s = 'has { brace';",
  'function f() {',
  "  const t = \"also } brace\";",
  '  return t;',
  '}',
], 'x.ts', true), [[1,4,"br"]]);
check("line comment", spansOf([
  'function f() { // opens {{{',
  '  return 1; # not comment? no ws before # is there',
  '}',
], 'x.ts', true), [[0,2,"br"]]);
check("template literal beside a function", spansOf([
  'const q = `',
  '  select { thing }',
  '`;',
  'function g() {',
  '  return 1;',
  '  // extra',
  '}',
], 'x.ts', true), [[0,2,"br"],[3,6,"br"]]);
check("block comment", spansOf([
  '/*',
  ' * function fake() {',
  ' */',
  'function real() {',
  '  return { a: 1 };',
  '  return 2;',
  '}',
], 'x.ts', true), [[0,2,"br"],[3,6,"br"]]);
check("mismatch bails", spansOf([
  'function f() {',
  '  weird ) close',
  '  return 1;',
  '}',
  'function g() {',
  '  ok();',
  '  more();',
  '}',
], 'x.ts', true), [[4,7,"br"]]);
check("nested", spansOf([
  'class C {',
  '  method() {',
  '    if (x) {',
  '      go();',
  '    }',
  '  }',
  '}',
], 'x.ts', true), [[0,6,"br"],[1,5,"br"],[2,4,"br"]]);
check("python-ish?", spansOf([
  'import os',
  'import sys',
  'from x import y',
  '',
  'def f():',
  '    return {',
  '        "a": 1,',
  '        "b": 2,',
  '    }',
], 'x.ts', true), [[0,1,"imp"],[5,8,"br"]]);
check("jsx return paren", spansOf([
  'return (',
  '  <div>',
  '    <span>hi</span>',
  '  </div>',
  ');',
], 'x.ts', true), [[0,4,"br"]]);
check("prose md", spansOf([
  'use the helper when you can.',
  'using a cache makes this fast.',
  'use consistent naming.',
], 'notes.md', true), []);
check("py imports", spansOf([
  'import os',
  'import sys',
  'from x import y',
], 'a.py', true), [[0,2,"imp"]]);
check("jsx element", spansOf([
  '<div className="a">',
  '  <span>hi</span>',
  '  text',
  '</div>',
], 'x.tsx', true), [[0,3,"br"]]);
check("jsx multiline open tag", spansOf([
  '<PlacedCard',
  '  top={top}',
  '  onToggle={() => toggle()}',
  '>',
  '  {children}',
  '</PlacedCard>',
], 'x.tsx', true), [[0,5,"br"]]);
check("jsx multiline self-closing", spansOf([
  '<SectionHeader',
  '  icon="x"',
  '  onActivate={go}',
  '/>',
], 'x.tsx', true), [[0,3,"br"]]);
check("jsx fragment", spansOf([
  '<>',
  '  <div>a</div>',
  '  <div>b</div>',
  '</>',
], 'x.tsx', true), [[0,3,"br"]]);
check("generics are not tags", spansOf([
  'const x: Array<Foo> = [',
  '  make<Bar>(1),',
  '];',
  'const y: Map<string, number> = new Map();',
], 'x.tsx', true), [[0,2,"br"]]);
check("comparisons are not tags", spansOf([
  'if (a < b) {',
  '  go();',
  '  while (i<n) { step(); }',
  '}',
], 'x.tsx', true), [[0,3,"br"]]);
check("html unclosed li", spansOf([
  '<ul>',
  '  <li>one',
  '  <li>two',
  '</ul>',
], 'x.html', true), [[0,3,"br"]]);
check("nested components", spansOf([
  'return (',
  '  <Outer>',
  '    <Inner a={1}>',
  '      <div>deep</div>',
  '    </Inner>',
  '  </Outer>',
  ');',
], 'x.tsx', true), [[0,6,"br"],[1,5,"br"],[2,4,"br"]]);
check("python def bodies", spansOf([
  'def f():',
  '    a = 1',
  '    return a',
  '',
  'class C:',
  '    def m(self):',
  '        return 2',
], 'a.py', true), [[0,2,"br"],[4,6,"br"]]);
check("yaml nesting", spansOf([
  'server:',
  '  host: localhost',
  '  ports:',
  '    - 80',
  '    - 443',
  'client:',
  '  retry: true',
], 'a.yaml', true), [[0,4,"br"],[2,4,"br"]]);
check("ruby blocks", spansOf([
  'def greet(name)',
  '  if name',
  '    puts name',
  '    puts "!"',
  '  end',
  'end',
  'x = 1 if y',
  'def tiny; end',
  'items.each do |item|',
  '  puts item',
  '  puts item',
  'end',
], 'a.rb', true), [[0,5,"br"],[1,4,"br"],[8,11,"br"]]);
check("bash blocks", spansOf([
  'if [ -f x ]; then',
  '  echo yes',
  '  echo more',
  'fi',
  'case $1 in',
  '  a) echo a ;;',
  '  b) echo b ;;',
  'esac',
  'for i in 1 2; do echo $i; done',
], 'a.sh', true), [[0,3,"br"],[4,7,"br"]]);
check("elixir do end", spansOf([
  'defmodule Foo do',
  '  def bar do',
  '    :ok',
  '  end',
  'end',
], 'a.ex', true), [[0,4,"br"],[1,3,"br"]]);
check("lua blocks", spansOf([
  'function f(x)',
  '  if x then',
  '    go()',
  '    stop()',
  '  end',
  'end',
], 'a.lua', true), [[0,5,"br"],[1,4,"br"]]);
check("sql begin end", spansOf([
  'CREATE PROCEDURE p AS',
  'BEGIN',
  '  SELECT 1;',
  '  SELECT 2;',
  'END;',
], 'a.sql', true), [[1,4,"br"]]);
check("region markers", spansOf([
  '// #region helpers',
  'const a = 1;',
  'const b = 2;',
  '// #endregion',
  'const region = "not a marker";',
], 'a.ts', true), [[0,3,"br"]]);
check("c preprocessor", spansOf([
  '#ifdef DEBUG',
  'int log_level = 3;',
  'int verbose = 1;',
  '#endif',
], 'a.c', true), [[0,3,"br"]]);
check("jsdoc comment", spansOf([
  '/**',
  ' * Does the thing.',
  ' * @param x the thing',
  ' */',
  'function f(x) {}',
], 'a.ts', true), [[0,3,"br"]]);
check("template literal", spansOf([
  'const q = `',
  '  SELECT *',
  '  FROM t',
  '`;',
], 'a.ts', true), [[0,3,"br"]]);
check("interpolation contents fold", spansOf([
  'const s = `head ${items.map((item) => {',
  '  return item.name;',
  '  // etc',
  '}).join(", ")} tail`;',
], 'a.ts', true), [[0,3,"br"]]);
check("python docstring", spansOf([
  'def f():',
  '    """Long docs.',
  '    More docs.',
  '    Even more.',
  '    """',
  '    return 1',
], 'a.py', true), [[0,5,"br"],[1,4,"br"]]);
check("bash heredoc", spansOf([
  'cat <<EOF',
  'line one',
  'line two',
  'EOF',
  'echo done',
], 'a.sh', true), [[0,3,"br"]]);
check("markdown sections", spansOf([
  '# Title',
  'intro',
  '## Section A',
  'a body',
  'a more',
  '```',
  '# not a heading',
  '```',
  '## Section B',
  'b body',
], 'notes.md', true), [[0,9,"br"],[2,7,"br"]]);
check("element in attribute keeps outer fold", spansOf([
  '<Button',
  '  icon={<Star />}',
  '  label="go"',
  '>',
  '  {children}',
  '</Button>',
], 'x.tsx', true), [[0,5,"br"]]);

function changedOpenerRows() {
  const rows = rowsOf(['<div>', '  <span className="a">', '    {hash}', '  </span>', '</div>']);
  rows[1] = { ...rows[1], kind: 'change', left: { line: 2, text: '  <span className="a b">' } };
  return rows;
}

check(
  'a region whose opening line changed is marked anchorChanged',
  collapseRegions(changedOpenerRows(), true, 'x.tsx').map((r) => [r.start, r.end, r.addedLines, r.anchorChanged]),
  [[0, 4, 1, false], [1, 3, 0, true]],
);

check(
  'deletion-only rows keep the enclosing fold',
  collapseRegions(mixedRows(), true, 'a.ts').map((r) => [r.start, r.end, r.addedLines, r.deletedLines]),
  [[0, 4, 1, 2]],
);

function deletedRows(lines, hunk = true) {
  const header = hunk ? [{ kind: 'hunk', label: '@@ -1 +0,0 @@', left: null, right: null }] : [];
  const body = lines.map((text, index) => ({ kind: 'change', label: '', left: { line: index + 1, text }, right: null }));
  return [...header, ...body];
}

const deletedTwoFunctions = [
  'function foo() {',
  '  return 1;',
  '}',
  '',
  'function bar() {',
  '  return 2;',
  '}',
];
const deletedTwoFunctionRows = deletedRows(deletedTwoFunctions);
const deletedTwoFunctionRegions = collapseRegions(deletedTwoFunctionRows, false, 'a.ts');
check('a fully deleted file is allLinesDeleted', allLinesDeleted(deletedTwoFunctionRows), true);
check('a mixed file is not allLinesDeleted', allLinesDeleted(mixedRows()), false);
check(
  'a fully deleted file wraps all code in one fold',
  deletedTwoFunctionRegions.map((r) => [r.start, r.end, r.kind]),
  [[1, 7, 'file'], [5, 7, 'block']],
);
check(
  'a fully deleted unstructured file still folds',
  collapseRegions(deletedRows(['const a = 1;', 'const b = 2;', 'const c = 3;']), false, 'a.ts').map((r) => [r.start, r.end, r.kind]),
  [[1, 3, 'file']],
);
check(
  'a two-line deleted file is too short to wrap',
  collapseRegions(deletedRows(['const a = 1;', 'const b = 2;']), false, 'a.ts').map((r) => r.kind),
  [],
);

const deletedHidden = new Set();
for (const region of deletedTwoFunctionRegions) {
  for (let row = region.start + 1; row <= region.end; row += 1) deletedHidden.add(row);
}
check(
  'collapsing a deleted file leaves only the first code line',
  shownLines(columnLines(deletedTwoFunctionRows, 'left'), deletedHidden, NO_TRUNCATION).map((line) => line.kind),
  ['hunk', 'change'],
);

// --- region roles: comment groups, types, functions ------------------------------
function rolesOf(lines, filename) {
  return collapseRegions(rowsOf(lines), true, filename).map((r) => [r.start, r.end, r.kind, r.comment, r.functionLike]);
}
check("line comment group folds as one region", rolesOf([
  '// first line',
  '// second line',
  '// third line',
  'const a = 1;',
], 'x.ts'), [[0,2,'comment_group',true,false]]);
check("two-line hash comment group folds", rolesOf([
  '# one',
  '# two',
  'x = 1',
], 'x.py'), [[0,1,'comment_group',true,false]]);
check("a lone comment line is not a group", rolesOf([
  '// only',
  'const a = 1;',
  'const b = 2;',
], 'x.ts'), []);
check("blank line splits comment groups", rolesOf([
  '// a',
  '// b',
  '',
  '// c',
  '// d',
], 'x.ts'), [[0,1,'comment_group',true,false],[3,4,'comment_group',true,false]]);
check("function and arrow anchors are function-like", collapseRegions(rowsOf([
  'export async function foo() {',
  '  return 1;',
  '}',
  'const bar = async (a) => {',
  '  return a;',
  '};',
  'interface Shape {',
  '  x: number;',
  '}',
]), true, 'x.ts').map((r) => [r.start, r.functionLike, r.typeLike]), [[0,true,false],[3,true,false],[6,false,true]]);
check("python def and class are function-like", collapseRegions(rowsOf([
  'def foo():',
  '    return 1',
  '    pass',
  'class Bar:',
  '    x = 1',
  '    y = 2',
]), true, 'x.py').map((r) => [r.start, r.functionLike]), [[0,true],[3,true]]);

check("comment-looking lines inside a template literal are not a comment group", rolesOf([
  'const snippet = `',
  '// not a comment',
  '// still not',
  '`;',
], 'x.ts').map((r) => r[2]), ['template']);

// --- reveal toggles ---------------------------------------------------------------
const nestedCommentLines = [
  'function outer() {',
  '  // why this',
  '  // matters',
  '  return 1;',
  '}',
  'const other = 2;',
];
function revealOf(lines, filename, command) {
  const rows = rowsOf(lines);
  const regions = collapseRegions(rows, true, filename);
  const reveal = revealedRegions(regions, rows, { mode: 'collapseCode', reveals: new Set(), search: '', epoch: 0, wholeFile: true, ...command });
  return { blocks: [...reveal.blocks].map((r) => r.start), ancestors: [...reveal.ancestors].map((r) => r.start) };
}
check("a revealed comment inside a function opens the function too", revealOf(nestedCommentLines, 'x.ts', { reveals: new Set(['comments']) }),
  { blocks: [1], ancestors: [0] });
check("search opens the enclosing block and everything in it", revealOf(nestedCommentLines, 'x.ts', { search: 'MATTERS' }),
  { blocks: [0, 1], ancestors: [] });
check("no reveal without a match", revealOf(nestedCommentLines, 'x.ts', { search: 'absent' }), { blocks: [], ancestors: [] });

// --- regressions for confirmed wrong-fold bugs ----------------------------------
function check2(name, lines, filename, expected) { check(name, boundsOf(lines, filename), expected); }
check2('ruby << operator does not swallow file', [
  'def f',
  '  queue<<job',
  '  errors<<"bad"',
  '  step',
  'end',
], 'a.rb', [[0, 4]]);

check2('shell heredoc hides fake fi', [
  'if x; then',
  '  cat <<EOF',
  'fi',
  'EOF',
  '  echo after',
  '  echo more',
  'fi',
], 'a.sh', [[0, 6], [1, 3]]);

check2('ruby heredoc hides fake end', [
  'def f',
  '  x = <<~TEXT',
  '    end of story',
  '    another line',
  '  TEXT',
  'end',
], 'a.rb', [[0, 5], [1, 4]]);

check2('ruby comment do is not an opener', [
  'class Job',
  '  # things we plan to do',
  '  def run',
  '    step1',
  '    step2',
  '  end',
  'end',
], 'a.rb', [[0, 6], [2, 5]]);

check2('ruby if: kwarg is not an opener', [
  'class User',
  '  validates :name,',
  '    if: :active?',
  '  def greet',
  '    puts "hi"',
  '    puts "yo"',
  '  end',
  'end',
], 'a.rb', [[0, 7], [3, 6]]);

check2('ruby end.each do chains', [
  'def f',
  '  items.map do |x|',
  '    x + 1',
  '    x + 2',
  '  end.each do |y|',
  '    puts y',
  '    puts y',
  '  end',
  'end',
], 'a.rb', [[0, 8], [1, 4], [4, 7]]);

check2('lua anonymous function', [
  'if c then',
  '  local f = function(x)',
  '    return x',
  '  end',
  'end',
], 'a.lua', [[0, 4], [1, 3]]);

check2('sql case does not pop begin', [
  'BEGIN',
  '  SELECT CASE WHEN x THEN 1',
  '    ELSE 0',
  '  END',
  '  FROM t;',
  'END;',
], 'a.sql', [[0, 5], [1, 3]]);

check2('regex literal with brace', [
  'function f() {',
  '  const open = /{/;',
  '  more();',
  '  stuff();',
  '}',
], 'a.ts', [[0, 4]]);

check2('scss id selector', [
  '.wrap {',
  '  #inner {',
  '    color: red;',
  '  }',
  '  margin: 0;',
  '}',
], 'a.scss', [[0, 5], [1, 3]]);

check2('python dedented string keeps def fold', [
  'def f():',
  '    x = 1',
  '    y = 2',
  '    msg = """',
  'col zero',
  '"""',
  '    return x',
], 'a.py', [[0, 6], [3, 5]]);

check2('python column-0 comment inside def', [
  'def f():',
  '    a = 1',
  '    b = 2',
  '# TODO revisit',
  '    c = 3',
  '    d = 4',
  '',
  'def g():',
  '    e = 5',
], 'a.py', [[0, 5]]);

check2('c if-0 braces are dead', [
  'void f(void) {',
  '  setup();',
  '#if 0',
  '}',
  '#endif',
  '  teardown();',
  '  more();',
  '}',
], 'a.c', [[0, 7], [2, 4]]);

check2('rust lifetime keeps struct fold', [
  "struct Foo<'a> {",
  '  name: &&x,',
  '  other: u8,',
  '}',
], 'a.rs', [[0, 3]]);

check2('division is not a regex', [
  'function f() {',
  '  const x = a / b / c;',
  '  const y = (n) / 2;',
  '  return x + y;',
  '}',
], 'a.ts', [[0, 4]]);


// --- fold controls survive collapsing ------------------------------------------

const acrossHunk = [
  { kind: 'context', label: '', left: { line: 1, text: 'export function foo() {' }, right: { line: 1, text: 'export function foo() {' } },
  { kind: 'context', label: '', left: { line: 2, text: '  a();' }, right: { line: 2, text: '  a();' } },
  { kind: 'hunk', label: '@@ -3,2 +3,2 @@', left: null, right: null },
  { kind: 'change', label: '', left: { line: 3, text: '  old();' }, right: { line: 3, text: '  new();' } },
  { kind: 'context', label: '', left: { line: 4, text: '  b();' }, right: { line: 4, text: '  b();' } },
  { kind: 'context', label: '', left: { line: 5, text: '}' }, right: { line: 5, text: '}' } },
];
const acrossHunkHidden = new Set();
for (const region of collapseRegions(acrossHunk, true, 'a.ts')) {
  for (let row = region.start + 1; row <= region.end; row += 1) acrossHunkHidden.add(row);
}
check(
  'a collapsed region never hides its hunk header',
  shownLines(columnLines(acrossHunk, 'right'), acrossHunkHidden, NO_TRUNCATION).map((line) => line.kind),
  ['context', 'hunk'],
);

// --- tree-sitter parse trees ----------------------------------------------------

async function checkTree(name, lines, filename, expected, { contiguous = true, rows = null } = {}) {
  const regions = await treeCollapseRegions(rows ?? rowsOf(lines), contiguous, filename);
  check(name, regions?.map((r) => [r.start, r.end, r.kind, r.depth]) ?? null, expected);
}

await checkTree('tsx function and jsx', [
  'function foo(a) {',
  '  return (',
  '    <div>',
  '      <span>hi</span>',
  '      text',
  '    </div>',
  '  );',
  '}',
], 'a.tsx', [
  [0, 7, 'function_declaration', 0],
  [1, 6, 'return_statement', 1],
  [2, 5, 'jsx_element', 2],
]);

await checkTree('ts imports grouped and function', [
  "import a from 'a';",
  "import b from 'b';",
  "import { c,",
  "  d,",
  "} from 'cd';",
  '',
  'export function go() {',
  '  step();',
  '  more();',
  '}',
], 'a.ts', [
  [0, 4, 'imports', 0],
  [2, 4, 'import_statement', 1],
  [6, 9, 'export_statement', 0],
]);

await checkTree('python defs and docstring', [
  'def f():',
  '    """Docs.',
  '    More.',
  '    """',
  '    return 1',
  '',
  'class C:',
  '    def m(self):',
  '        a = 1',
  '        return a',
], 'a.py', [
  [0, 4, 'function_definition', 0],
  [1, 4, 'block', 1],
  [6, 9, 'class_definition', 0],
  [7, 9, 'function_definition', 1],
]);

await checkTree('ruby method and block', [
  'def greet(name)',
  '  items.each do |item|',
  '    puts item',
  '    puts item',
  '  end',
  'end',
], 'a.rb', [
  [0, 5, 'method', 0],
  [1, 4, 'call', 1],
]);

await checkTree('go func', [
  'func main() {',
  '\tsetup()',
  '\trun()',
  '}',
], 'a.go', [[0, 3, 'function_declaration', 0]]);

await checkTree('region markers merge with tree spans', [
  '// #region helpers',
  'function pad() {',
  '  a();',
  '  b();',
  '}',
  '// #endregion',
], 'a.ts', [
  [0, 5, 'region', 0],
  [1, 4, 'function_declaration', 1],
]);

await checkTree('marker-only file falls back to heuristic', [
  '// #region helpers',
  'const a = 1;',
  'const b = 2;',
  '// #endregion',
], 'a.ts', null);

await checkTree('unsupported language returns null', ['x'], 'a.zig', null);

const patchRows = [
  { kind: 'hunk', label: '@@', left: null, right: null },
  { kind: 'context', label: '', left: { line: 1, text: 'function a() {' }, right: { line: 1, text: 'function a() {' } },
  { kind: 'context', label: '', left: { line: 2, text: '  one();' }, right: { line: 2, text: '  one();' } },
  { kind: 'context', label: '', left: { line: 3, text: '  two();' }, right: { line: 3, text: '  two();' } },
  { kind: 'hunk', label: '@@', left: null, right: null },
  { kind: 'context', label: '', left: { line: 40, text: '  tail();' }, right: { line: 40, text: '  tail();' } },
  { kind: 'context', label: '', left: { line: 41, text: '}' }, right: { line: 41, text: '}' } },
];
await checkTree('patch mode stays conservative on broken fragments', [], 'a.ts', null, { contiguous: false, rows: patchRows });

const brokenRows = rowsOf([
  '  weird ) fragment',
  'function ok() {',
  '  fine();',
  '  good();',
  '}',
]);
await checkTree('error tolerance keeps valid folds', [], 'a.ts', [[1, 4, 'function_declaration', 0]], { rows: brokenRows });

await checkTree(
  'fully deleted file wraps all code',
  [],
  'a.ts',
  [
    [1, 7, 'file', 0],
    [5, 7, 'function_declaration', 1],
  ],
  { contiguous: false, rows: deletedRows(deletedTwoFunctions) },
);

await checkTree('jsx fragment folds', [
  'const x = (',
  '  <>',
  '    <div>a</div>',
  '    <div>b</div>',
  '  </>',
  ');',
], 'a.tsx', [
  [0, 5, 'lexical_declaration', 0],
  [1, 4, 'jsx_element', 1],
]);


if (failures > 0) {
  console.error(`\n${failures} fold check(s) failed`);
  process.exit(1);
}
console.log('Fold checks passed.');
