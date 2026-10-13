import { readFile } from 'node:fs/promises';
import { computeDiffFolds, diffFolds, sideFile } from '../src/features/pull-requests/diffFolds.ts';
import { asOrdinaryLines, columnLines, shownLines, unifiedLines, withFoldSeparators } from '../src/features/pull-requests/diffLines.ts';
import { foldMethodFor } from '../src/features/pull-requests/foldMethods.ts';
import { summaryText } from '../src/features/pull-requests/foldSummary.ts';
import { heuristicFolds } from '../src/features/pull-requests/heuristicFolds.ts';
import { overrideWasmSource } from '../src/features/pull-requests/treeSitter.ts';
import { treeSitterFoldMethod } from '../src/features/pull-requests/treeSitterFolds.ts';
import { classifyImportLine, findImportEndLine, javascriptFolds, moduleOfImport } from '../src/features/pull-requests/javascriptFolds.ts';
import { nestedFolds } from '../src/features/pull-requests/sideFolds.ts';
import { NO_TRUNCATION } from '../src/features/pull-requests/truncateRows.ts';

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

function foldsOf(lines, filename) {
  return heuristicFolds({ filename, lines });
}

function spansOf(lines, filename) {
  return foldsOf(lines, filename).map((f) => [f.first, f.last, f.tags.includes('imports') ? 'imp' : 'br']);
}

function boundsOf(lines, filename) {
  return foldsOf(lines, filename).map((f) => [f.first, f.last]);
}

// --- detection across languages -------------------------------------------------
check("ts function", spansOf([
  'function foo(a, b) {',
  '  const x = 1;',
  '  return x;',
  '}',
  '',
  'const y = 2;',
], 'x.ts'), [[0,3,"br"]]);
check("imports block", spansOf([
  "import a from 'a';",
  "import b from 'b';",
  '',
  "import { c,",
  "  d,",
  "} from 'cd';",
  '',
  'const x = 1;',
], 'x.ts'), [[0,5,"imp"],[3,5,"br"]]);
check("string with brace", spansOf([
  "const s = 'has { brace';",
  'function f() {',
  "  const t = \"also } brace\";",
  '  return t;',
  '}',
], 'x.ts'), [[1,4,"br"]]);
check("line comment", spansOf([
  'function f() { // opens {{{',
  '  return 1; # not comment? no ws before # is there',
  '}',
], 'x.ts'), [[0,2,"br"]]);
check("template literal beside a function", spansOf([
  'const q = `',
  '  select { thing }',
  '`;',
  'function g() {',
  '  return 1;',
  '  // extra',
  '}',
], 'x.ts'), [[0,2,"br"],[3,6,"br"]]);
check("block comment", spansOf([
  '/*',
  ' * function fake() {',
  ' */',
  'function real() {',
  '  return { a: 1 };',
  '  return 2;',
  '}',
], 'x.ts'), [[0,2,"br"],[0,6,"br"]]);
check("mismatch bails", spansOf([
  'function f() {',
  '  weird ) close',
  '  return 1;',
  '}',
  'function g() {',
  '  ok();',
  '  more();',
  '}',
], 'x.ts'), [[4,7,"br"]]);
check("nested", spansOf([
  'class C {',
  '  method() {',
  '    if (x) {',
  '      go();',
  '    }',
  '  }',
  '}',
], 'x.ts'), [[0,6,"br"],[1,5,"br"],[2,4,"br"]]);
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
], 'x.ts'), [[0,1,"imp"],[5,8,"br"]]);
check("jsx return paren", spansOf([
  'return (',
  '  <div>',
  '    <span>hi</span>',
  '  </div>',
  ');',
], 'x.ts'), [[0,4,"br"]]);
check("prose md", spansOf([
  'use the helper when you can.',
  'using a cache makes this fast.',
  'use consistent naming.',
], 'notes.md'), []);
check("py imports", spansOf([
  'import os',
  'import sys',
  'from x import y',
], 'a.py'), [[0,2,"imp"]]);
check("jsx element", spansOf([
  '<div className="a">',
  '  <span>hi</span>',
  '  text',
  '</div>',
], 'x.tsx'), [[0,3,"br"]]);
check("jsx multiline open tag", spansOf([
  '<PlacedCard',
  '  top={top}',
  '  onToggle={() => toggle()}',
  '>',
  '  {children}',
  '</PlacedCard>',
], 'x.tsx'), [[0,5,"br"]]);
check("jsx multiline self-closing", spansOf([
  '<SectionHeader',
  '  icon="x"',
  '  onActivate={go}',
  '/>',
], 'x.tsx'), [[0,3,"br"]]);
check("jsx fragment", spansOf([
  '<>',
  '  <div>a</div>',
  '  <div>b</div>',
  '</>',
], 'x.tsx'), [[0,3,"br"]]);
check("generics are not tags", spansOf([
  'const x: Array<Foo> = [',
  '  make<Bar>(1),',
  '];',
  'const y: Map<string, number> = new Map();',
], 'x.tsx'), [[0,2,"br"]]);
check("comparisons are not tags", spansOf([
  'if (a < b) {',
  '  go();',
  '  while (i<n) { step(); }',
  '}',
], 'x.tsx'), [[0,3,"br"]]);
check("html unclosed li", spansOf([
  '<ul>',
  '  <li>one',
  '  <li>two',
  '</ul>',
], 'x.html'), [[0,3,"br"]]);
check("nested components", spansOf([
  'return (',
  '  <Outer>',
  '    <Inner a={1}>',
  '      <div>deep</div>',
  '    </Inner>',
  '  </Outer>',
  ');',
], 'x.tsx'), [[0,6,"br"],[1,5,"br"],[2,4,"br"]]);
check("python def bodies", spansOf([
  'def f():',
  '    a = 1',
  '    return a',
  '',
  'class C:',
  '    def m(self):',
  '        return 2',
], 'a.py'), [[0,2,"br"],[4,6,"br"]]);
check("yaml nesting", spansOf([
  'server:',
  '  host: localhost',
  '  ports:',
  '    - 80',
  '    - 443',
  'client:',
  '  retry: true',
], 'a.yaml'), [[0,4,"br"],[2,4,"br"]]);
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
], 'a.rb'), [[0,5,"br"],[1,4,"br"],[8,11,"br"]]);
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
], 'a.sh'), [[0,3,"br"],[4,7,"br"]]);
check("elixir do end", spansOf([
  'defmodule Foo do',
  '  def bar do',
  '    :ok',
  '  end',
  'end',
], 'a.ex'), [[0,4,"br"],[1,3,"br"]]);
check("lua blocks", spansOf([
  'function f(x)',
  '  if x then',
  '    go()',
  '    stop()',
  '  end',
  'end',
], 'a.lua'), [[0,5,"br"],[1,4,"br"]]);
check("sql begin end", spansOf([
  'CREATE PROCEDURE p AS',
  'BEGIN',
  '  SELECT 1;',
  '  SELECT 2;',
  'END;',
], 'a.sql'), [[1,4,"br"]]);
check("region markers", spansOf([
  '// #region helpers',
  'const a = 1;',
  'const b = 2;',
  '// #endregion',
  'const region = "not a marker";',
], 'a.ts'), [[0,3,"br"]]);
check("c preprocessor", spansOf([
  '#ifdef DEBUG',
  'int log_level = 3;',
  'int verbose = 1;',
  '#endif',
], 'a.c'), [[0,3,"br"]]);
check("jsdoc comment", spansOf([
  '/**',
  ' * Does the thing.',
  ' * @param x the thing',
  ' */',
  'function f(x) {}',
], 'a.ts'), [[0,3,"br"]]);
check("template literal", spansOf([
  'const q = `',
  '  SELECT *',
  '  FROM t',
  '`;',
], 'a.ts'), [[0,3,"br"]]);
check("interpolation contents fold", spansOf([
  'const s = `head ${items.map((item) => {',
  '  return item.name;',
  '  // etc',
  '}).join(", ")} tail`;',
], 'a.ts'), [[0,3,"br"]]);
check("python docstring", spansOf([
  'def f():',
  '    """Long docs.',
  '    More docs.',
  '    Even more.',
  '    """',
  '    return 1',
], 'a.py'), [[0,5,"br"],[1,4,"br"]]);
check("bash heredoc", spansOf([
  'cat <<EOF',
  'line one',
  'line two',
  'EOF',
  'echo done',
], 'a.sh'), [[0,3,"br"]]);
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
], 'notes.md'), [[0,9,"br"],[2,7,"br"]]);
check("element in attribute keeps outer fold", spansOf([
  '<Button',
  '  icon={<Star />}',
  '  label="go"',
  '>',
  '  {children}',
  '</Button>',
], 'x.tsx'), [[0,5,"br"]]);

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
], 'a.rb', [[0, 6], [1, 5]]);

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
], 'a.rb', [[0, 8], [1, 3], [4, 7]]);

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


// --- header comments and touching folds ------------------------------------------

const documented = [
  'function a() {',
  '  x();',
  '  y();',
  '}',
  '// About b.',
  '// More about b.',
  'function b() {',
  '  z();',
  '  w();',
  '}',
];
check(
  'comments directly above a fold join it, and the handle stays on the declaration',
  foldsOf(documented, 'a.ts').map((f) => [f.first, f.handle, f.last]),
  [[0, 0, 3], [4, 6, 9]],
);
check(
  'the summary skips the header comment',
  foldsOf(documented, 'a.ts')[1].summary,
  [{ kind: 'source', line: 6, start: 0, end: 14 }],
);
check(
  'a blank line keeps a comment out of the fold below',
  foldsOf(['// Loose note.', '', 'function b() {', '  z();', '  w();', '}'], 'a.ts').map((f) => [f.first, f.handle]),
  [[2, 2]],
);
check(
  'a comment fold keeps its own handle, inside the declaration it documents',
  foldsOf(['/**', ' * Docs.', ' */', 'function f() {', '  a();', '  b();', '}'], 'a.ts').map((f) => [f.first, f.handle, f.last, f.tags]),
  [[0, 0, 2, ['comment']], [0, 3, 6, []]],
);
check2('} else { stays visible as the else fold\'s handle', [
  'if (a) {',
  '  one();',
  '  two();',
  '} else {',
  '  three();',
  '  four();',
  '}',
], 'a.ts', [[0, 2], [3, 6]]);
check(
  'type-like folds are tagged',
  foldsOf(['export interface Props {', '  a: string;', '  b: number;', '}'], 'a.ts').map((f) => f.tags),
  [['type']],
);

// --- tree-sitter parse trees ----------------------------------------------------

async function checkTree(name, lines, filename, expected) {
  const folds = await treeSitterFoldMethod.folds({ filename, lines });
  check(name, folds.map((f) => [f.first, f.last, f.kind]), expected);
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
  [0, 7, 'function_declaration'],
  [1, 6, 'return_statement'],
  [2, 5, 'jsx_element'],
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
  [0, 4, 'imports'],
  [2, 4, 'import_statement'],
  [6, 9, 'export_statement'],
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
  [0, 4, 'function_definition'],
  [1, 4, 'block'],
  [6, 9, 'class_definition'],
  [7, 9, 'function_definition'],
]);

await checkTree('ruby method and block', [
  'def greet(name)',
  '  items.each do |item|',
  '    puts item',
  '    puts item',
  '  end',
  'end',
], 'a.rb', [
  [0, 5, 'method'],
  [1, 4, 'call'],
]);

await checkTree('go func', [
  'func main() {',
  '\tsetup()',
  '\trun()',
  '}',
], 'a.go', [[0, 3, 'function_declaration']]);

await checkTree('region markers merge with tree spans', [
  '// #region helpers',
  'function pad() {',
  '  a();',
  '  b();',
  '}',
  '// #endregion',
], 'a.ts', [
  [0, 5, 'region'],
  [1, 4, 'function_declaration'],
]);

await checkTree('a file with only markers folds its markers', [
  '// #region helpers',
  'const a = 1;',
  'const b = 2;',
  '// #endregion',
], 'a.ts', [[0, 3, 'region']]);

await checkTree('error tolerance keeps valid folds', [
  '  weird ) fragment',
  'function ok() {',
  '  fine();',
  '  good();',
  '}',
], 'a.ts', [[1, 4, 'function_declaration']]);

await checkTree('jsx fragment folds', [
  'const x = (',
  '  <>',
  '    <div>a</div>',
  '    <div>b</div>',
  '  </>',
  ');',
], 'a.tsx', [
  [0, 5, 'lexical_declaration'],
  [1, 4, 'jsx_element'],
]);

await checkTree('python comments join the def below', [
  '# Says hello.',
  'def hello():',
  '    print("hi")',
  '    print("!")',
], 'a.py', [[0, 3, 'function_definition']]);

check('tree-sitter languages fold with tree-sitter', foldMethodFor('a.go').id, 'tree-sitter');
check('JavaScript and TypeScript fold with the Vanadium method', ['a.js', 'a.mjs', 'a.ts', 'a.tsx'].map((name) => foldMethodFor(name).id), ['javascript', 'javascript', 'javascript', 'javascript']);
check('other languages fold with the heuristic', foldMethodFor('a.zig').id, 'heuristic');

// --- linking folds across the diff -------------------------------------------------

// Each pair is [left text, right text]; null leaves that side's cell out of the row.
function pairedRows(pairs) {
  let left = 0;
  let right = 0;
  return pairs.map(([before, after]) => {
    const kind = before === after ? 'context' : 'change';
    return {
      kind,
      label: '',
      left: before === null ? null : { line: ++left, text: before },
      right: after === null ? null : { line: ++right, text: after },
    };
  });
}

async function linkedFolds(pairs, filename = 'a.kt') {
  return computeDiffFolds(pairedRows(pairs), filename);
}

function same(text) {
  return [text, text];
}

const bodyChanged = await linkedFolds([
  same('function foo() {'),
  same('  a();'),
  ['  old();', '  new();'],
  same('  b();'),
  same('}'),
]);
check(
  'a fold whose body changed links across the diff',
  bodyChanged.map((f) => [f.first, f.last, Boolean(f.left), Boolean(f.right), f.summaryChanged, f.deletedLines, f.addedLines]),
  [[0, 4, true, true, false, 1, 1]],
);

const docChanged = await linkedFolds([
  ['// Old docs.', '// New docs.'],
  same('function foo() {'),
  same('  a();'),
  same('  b();'),
  same('}'),
]);
check(
  'a changed header comment still links, and the summaries match',
  docChanged.map((f) => [f.first, f.handle, f.last, Boolean(f.left), f.summaryChanged]),
  [[0, 1, 4, true, false]],
);

const signatureChanged = await linkedFolds([
  ['function foo(a) {', 'function foo(a, b) {'],
  same('  a();'),
  same('  b();'),
  same('}'),
]);
check(
  'a changed signature diffs the two summary lines',
  signatureChanged.map((f) => [f.summaryChanged, f.summaries.left.text, f.summaries.right.text, f.summaries.right.emphasis]),
  [[true, 'function foo(a) {', 'function foo(a, b) {', [{ start: 14, end: 17 }]]],
);

const added = await linkedFolds([
  same('const x = 1;'),
  [null, 'function bar() {'],
  [null, '  one();'],
  [null, '  two();'],
  [null, '}'],
]);
check(
  'an added function folds on the right only',
  added.map((f) => [f.first, f.last, f.side, Boolean(f.left), f.summaries.left, f.summaryChanged]),
  [[1, 4, 'right', false, null, true]],
);

const deletedFile = await linkedFolds([
  ['function foo() {', null],
  ['  return 1;', null],
  ['}', null],
  ['', null],
  ['function bar() {', null],
  ['  return 2;', null],
  ['}', null],
]);
check(
  'a deleted file wraps all of its code in one fold',
  deletedFile.map((f) => [f.first, f.last, f.kind, f.side]),
  [[0, 6, 'file', 'left'], [4, 6, 'block', 'left']],
);

check(
  'a side with missing lines folds nothing',
  sideFile([{ kind: 'context', label: '', left: { line: 3, text: 'x' }, right: { line: 3, text: 'x' } }], 'left'),
  null,
);

function sideFoldAt(first, last) {
  return { first, last, handle: first, kind: 'block', tags: [], summary: [{ kind: 'source', line: first, start: 0, end: 1 }] };
}

const contextRows = pairedRows(['a', 'b', 'c', 'd', 'e', 'f'].map(same));
const contextFiles = { left: sideFile(contextRows, 'left'), right: sideFile(contextRows, 'right') };
check(
  'a left-only fold that cuts across a right fold gives way',
  diffFolds(contextRows, contextFiles, [sideFoldAt(0, 3)], [sideFoldAt(2, 5)]).map((f) => [f.first, f.last, f.side]),
  [[2, 5, 'right']],
);
check(
  'a left-only fold nested in a right fold stays',
  diffFolds(contextRows, contextFiles, [sideFoldAt(1, 3)], [sideFoldAt(0, 5)]).map((f) => [f.first, f.last, f.side]),
  [[0, 5, 'right'], [1, 3, 'left']],
);

// --- summary lines in each column ----------------------------------------------------

function collapsedAll(rows, folds) {
  const folded = new Map();
  for (const fold of folds) {
    const control = { fold, collapsed: true, hiddenThreads: 0, toggle() {} };
    for (let row = fold.first; row <= fold.last; row += 1) if (!folded.has(row)) folded.set(row, control);
  }
  return folded;
}

function drawn(lines) {
  return lines.map((line) => (line.fold ? `fold:${line.side}:${line.fold.summary?.text ?? '-'}` : `${line.kind}:${line.side}`));
}

const bodyRows = pairedRows([same('function foo() {'), same('  a();'), ['  old();', '  new();'], same('}'), same('after();')]);
const bodyFolded = collapsedAll(bodyRows, await computeDiffFolds(bodyRows, 'a.kt'));
check(
  'unified: matching summaries draw one line',
  drawn(shownLines(unifiedLines(bodyRows), 'unified', bodyFolded, NO_TRUNCATION)),
  ['fold:right:function foo() {', 'context:right'],
);
check(
  'split: each column draws its own summary',
  [drawn(shownLines(columnLines(bodyRows, 'left'), 'left', bodyFolded, NO_TRUNCATION)), drawn(shownLines(columnLines(bodyRows, 'right'), 'right', bodyFolded, NO_TRUNCATION))],
  [['fold:left:function foo() {', 'context:left'], ['fold:right:function foo() {', 'context:right']],
);

const signatureRows = pairedRows([['function foo(a) {', 'function foo(a, b) {'], same('  a();'), same('  b();'), same('}')]);
const signatureFolded = collapsedAll(signatureRows, await computeDiffFolds(signatureRows, 'a.kt'));
check(
  'unified: differing summaries draw a removed/added pair',
  drawn(shownLines(unifiedLines(signatureRows), 'unified', signatureFolded, NO_TRUNCATION)),
  ['fold:left:function foo(a) {', 'fold:right:function foo(a, b) {'],
);

const addedRows = pairedRows([same('const x = 1;'), [null, 'function bar() {'], [null, '  one();'], [null, '  two();'], [null, '}']]);
const addedFolded = collapsedAll(addedRows, await computeDiffFolds(addedRows, 'a.kt'));
const addedLeft = shownLines(columnLines(addedRows, 'left'), 'left', addedFolded, NO_TRUNCATION);
check('split: a right-only fold pads the left column', drawn(addedLeft), ['context:left', 'fold:left:-']);
check('split: only the owning side carries the chevron', addedLeft[1].fold.primary, false);

const twoFunctionRows = pairedRows(['fun a() {', '  x()', '}', '', 'fun b() {', '  y()', '}', '', 'tail()'].map(same));
const twoFolded = collapsedAll(twoFunctionRows, await computeDiffFolds(twoFunctionRows, 'a.kt'));
const separated = withFoldSeparators(shownLines(columnLines(twoFunctionRows, 'right'), 'right', twoFolded, NO_TRUNCATION));
check('a blank line between two folds thins to a separator; one after the last fold doesn\'t', separated.map((line) => line.betweenFolds), [false, true, false, false, false]);
check('full-height blank lines leave the separator thin', asOrdinaryLines(separated).map((line) => line.blank), [false, true, false, false, false]);

// --- the Vanadium JavaScript/TypeScript method ------------------------------------

// Folds must cover less than half the file, so short examples get filler below them.
const FILLER = Array.from({ length: 20 }, (_, index) => `const filler${index} = ${index};`);

function jsFolds(lines, filler = true) {
  const all = filler ? [...lines, ...FILLER] : lines;
  return javascriptFolds({ filename: 'a.ts', lines: all }).map((fold) => ({ ...fold, text: summaryText(fold.summary, all) }));
}

function jsFoldsOfKind(kind, lines) {
  return jsFolds(lines, false).filter((fold) => fold.kind === kind);
}

const importBounds = (lines) => jsFoldsOfKind('imports', lines).map((fold) => [fold.first, fold.last]);

// Ported from Vanadium's JavascriptImportFoldingTest.
check('js imports: a simple block', importBounds(["import foo from 'foo';", "import bar from 'bar';", '', 'const x = 1;']), [[0, 1]]);
check(
  'js imports: a directive and blank lines above fold in and lead the summary',
  jsFoldsOfKind('imports', ['"use client";', '', "import foo from 'foo';", "import bar from 'bar';", '', 'const x = 1;']).map((f) => [f.first, f.last, f.text]),
  [[0, 3, '"use client"; import 2 (foo, bar)']],
);
check(
  'js imports: the directive folds in, the shebang doesn\'t',
  jsFoldsOfKind('imports', ['#!/usr/bin/env node', "'use strict'", "import foo from 'foo';", "import bar from 'bar';", 'foo();']).map((f) => [f.first, f.last, f.text]),
  [[1, 3, "'use strict' import 2 (foo, bar)"]],
);
check(
  'js imports: a comment between directive and imports keeps the directive out',
  jsFoldsOfKind('imports', ["'use client';", '// setup', "import foo from 'foo';", "import bar from 'bar';", 'foo();']).map((f) => [f.first, f.last, f.text]),
  [[2, 3, 'import 2 (foo, bar)']],
);
check('js imports: a directive and one import don\'t fold', importBounds(["'use strict';", "import foo from 'foo';", 'foo();']), []);
check('js imports: one multi-line import folds', importBounds(['import {', '  foo,', '  bar', "} from 'examplelib';", '', 'const x = 1;']), [[0, 3]]);
check(
  'js imports: a multi-line import among single-line ones',
  importBounds(["import a from 'a';", 'import {', '  foo,', "} from 'b';", "import c from 'c';", '', 'const x = 1;']),
  [[0, 4]],
);
check('js imports: a trailing comma continues an import', importBounds(['import foo,', "  { bar } from 'lib';", "import z from 'z';", 'z();']), [[0, 2]]);
check('js imports: a single import doesn\'t fold', importBounds(["import foo from 'foo';", '', 'const x = 1;']), []);
check('js imports: no imports, no fold', importBounds(['const x = 1;', 'const y = 2;']), []);
check('js imports: the block stops at code', importBounds(["import a from 'a';", "import b from 'b';", 'const x = 1;', "import late from 'late';"]), [[0, 1]]);
check('js imports: a bracket in a trailing comment doesn\'t end the import', findImportEndLine(['import {', '  foo, // trailing comment with }', '  bar', "} from 'examplelib';", 'next();'], 0), 3);
check('js imports: an unterminated import is one line', findImportEndLine(['import {', '  foo,'], 0), 0);
check(
  'js imports: identifiers starting with "import" aren\'t imports',
  ['importantThing();', 'imports.foo();', "import 'side-effect';", "import type { T } from 'mod';"].map((text) => classifyImportLine(0, text)),
  ['other', 'other', 'import', 'import'],
);
check(
  'js imports: the module is the last string literal',
  ["import foo from 'foo';", 'import {\n  a,\n  b\n} from "./relative/path";', "import 'side-effect';"].map(moduleOfImport),
  ['foo', './relative/path', 'side-effect'],
);
const headerBounds = (lines) => jsFoldsOfKind('comment', lines).map((fold) => [fold.first, fold.last]);
check(
  'js header: a comment after a directive is a header comment',
  headerBounds(["'use client';", '', '// This file contains widgets.', '// They are excellent widgets.', 'const x = 1;']),
  [[2, 3]],
);
check(
  'js header: so is one after a shebang and a directive',
  headerBounds(['#!/usr/bin/env node', "'use strict';", '// This file contains widgets.', '// They are excellent widgets.', 'main();']),
  [[2, 3]],
);
check('js header: a comment after code isn\'t a header comment', headerBounds(['const x = 1;', '// not a header comment', '// really not', 'const y = 2;']), []);

const documentedFunction = jsFolds([
  'const before = 0;',
  '',
  '/**',
  ' * Adds things.',
  ' */',
  'export function add(a,  b) {',
  '  // TODO: overflow',
  '  return a + b; // TODO: types, FIXME',
  '}',
]).find((fold) => fold.kind === 'function');
check(
  'js: a function folds with its doc comment, and its chevron stays on the declaration',
  [documentedFunction.first, documentedFunction.handle, documentedFunction.last],
  [2, 5, 8],
);
check('js: the summary collapses whitespace and counts special comments', documentedFunction.text, 'export function add(a, b) { //2xTODO FIXME');

const bounds = (lines) => jsFolds(lines).filter((fold) => fold.kind !== 'comment').map((fold) => [fold.first, fold.last, fold.kind]);
check(
  'js: an arrow widens over the brackets its line opens',
  bounds(['const names = items.map((item) => {', '  return item.name;', '  // more', '});']),
  [[0, 3, 'lambda']],
);
check('js: a class can open its brace on the next line', bounds(['class Foo', '{', '  bar() {}', '  baz() {}', '}']), [[0, 4, 'class']]);
check('js: className is not a class', bounds(['<div className="a">', '  <span>hi</span>', '  <b>x</b>', '</div>']), []);
check(
  'js: a fold covering half the file or more is dropped',
  jsFolds(['function big() {', '  a();', '  b();', '  c();', '}', 'x();'], false).map((fold) => fold.kind),
  [],
);
check(
  'js: {{{ and }}} markers fold what they enclose, summarized by the first code line',
  jsFolds(['// helpers {{{', 'const a = 1;', 'const b = 2;', '// }}}']).filter((f) => f.kind === 'marker').map((f) => [f.first, f.last, f.kind, f.text]),
  [[0, 3, 'marker', 'const a = 1;']],
);
check(
  'js: a {{_}} line folds the brackets it opens',
  bounds(['const config = { //{{_}}', '  a: 1,', '  b: 2,', '};']),
  [[0, 3, 'marker']],
);
const bigTable = ['const table = {', ...Array.from({ length: 12 }, (_, index) => [`  k${index}: [`, '    1,', '    2,', '  ],']).flat(), '};'];
check(
  'js: each child of a top-level block of 50+ lines folds',
  jsFolds(bigTable).filter((fold) => fold.kind === 'block').slice(0, 2).map((fold) => [fold.first, fold.last]),
  [[1, 4], [5, 8]],
);
const longComment = ['const a = 1;', ...Array.from({ length: 10 }, (_, index) => `// Note ${index}.`), 'const b = 2;'];
check(
  'js: ten loose comment lines fold on their own',
  jsFolds(longComment).filter((fold) => fold.kind === 'comment').map((fold) => [fold.first, fold.last, fold.text]),
  [[1, 10, '// Note 0.']],
);
check(
  'js: a block comment summary turns its leading * into /*',
  jsFolds(['const a = 1;', '/**', ...Array.from({ length: 9 }, (_, index) => ` * Explains ${index}.`), ' */', 'const b = 2;'])
    .filter((fold) => fold.kind === 'comment')
    .map((fold) => fold.text),
  ['/* Explains 0.'],
);
check(
  'js: a //# comment is excluded from the fold below it',
  jsFolds(['const x = 1;', '//# Section', 'function f() {', '  a();', '  b();', '}']).filter((f) => f.kind === 'function').map((f) => f.first),
  [2],
);
check(
  'js: brackets in strings, regexes, templates and comments don\'t count',
  bounds(['const s = "}";', 'function f() {', '  const r = /}/;', '  const t = `${"}"} }`;', '  // }', '  return s;', '}']),
  [[1, 6, 'function']],
);
check(
  'js: a glob in a string doesn\'t open a comment',
  jsFolds(['const glob = "src/**/*.ts";', 'function f() {', '  a();', '  b();', '}']).filter((f) => f.kind === 'function').map((f) => f.first),
  [1],
);

const fold = (first, last, handle = first) => ({ first, last, handle, kind: 'block', tags: [], summary: [] });
check(
  'every method\'s folds nest, span two lines, and get one chevron per handle',
  nestedFolds([fold(0, 5), fold(3, 8), fold(0, 3), fold(6, 6), fold(1, 2)]).map((f) => [f.first, f.last, f.handle]),
  [[0, 5, 0], [1, 2, 1]],
);

if (failures > 0) {
  console.error(`\n${failures} fold check(s) failed`);
  process.exit(1);
}
console.log('Fold checks passed.');
