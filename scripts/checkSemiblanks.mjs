import assert from 'node:assert/strict';
import { commentMargins } from '../src/features/pull-requests/commentMargins.ts';
import { tokenizeCode } from '../src/features/pull-requests/diffHighlight.tsx';
import { columnLines, unifiedLines } from '../src/features/pull-requests/diffLines.ts';
import { semiblankKind, withSemiblanks } from '../src/features/pull-requests/semiblankLines.ts';
import { splitDiff } from '../src/features/pull-requests/splitDiff.ts';

const NOTHING_KEPT = { anchors: new Map(), edited: null };

function check(label, actual, expected) {
  assert.deepEqual(actual, expected, label);
  console.log(`✓ ${label}`);
}

function split(patch, whole = NOTHING_KEPT) {
  const rows = splitDiff(patch);
  const [right, left] = withSemiblanks(columnLines(rows, 'right'), columnLines(rows, 'left'), whole);
  return { left: left.map((line) => line.semiblank), right: right.map((line) => line.semiblank) };
}

function unified(patch) {
  const [lines] = withSemiblanks(unifiedLines(splitDiff(patch)), [], NOTHING_KEPT);
  return lines.map((line) => line.semiblank);
}

check('a closer tucks up into an indented line', semiblankKind('}', '  return 1;', null), 'up');
check('an opener tucks down into an indented line', semiblankKind('  {', null, '    strict: true,'), 'down');
check('separators ride along with closers', semiblankKind('  });', '      done();', null), 'up');
check('a closer wider than the indent stays whole', semiblankKind('  });', '    strict: true,', null), null);
check('trailing spaces take no room', semiblankKind('}   ', '  x', null), 'up');
check('tabs advance to the next stop', semiblankKind('\t}', '\t\tx', null), 'up');
check('a blank neighbor has no indent to lend', semiblankKind('}', '', null), null);
check('mixed brackets stay whole', semiblankKind(')(', '    x', '    x'), null);
check('separators alone stay whole', semiblankKind(' ;', '    x', '    x'), null);
check('a lone star flattens inside a block comment', semiblankKind(' *', ' * Reads a tree.', null), 'comment');
check('a lone star outside a comment stays whole', ['  *', '***', '**'].map((text) => semiblankKind(text, 'SELECT', null)), [null, null, null]);
check('comment marks flatten on their own', ['/**', ' */', '#', '////////////'].map((text) => semiblankKind(text, null, null)), [
  'comment',
  'comment',
  'comment',
  'comment',
]);

const CONTEXT = '@@ -1,3 +1,3 @@\n function a() {\n   return 1;\n }';
check('split: a context closer tucks on both sides', split(CONTEXT), { left: [null, null, null, 'up'], right: [null, null, null, 'up'] });
check('split: a folded row keeps its whole height', split(CONTEXT, { anchors: new Map([[3, { collapsed: true }]]), edited: null }).right[3], null);
check('split: an unfolded anchor still tucks', split(CONTEXT, { anchors: new Map([[3, { collapsed: false }]]), edited: null }).right[3], 'up');
check('split: nothing tucks into a folded row', split(CONTEXT, { anchors: new Map([[2, { collapsed: true }]]), edited: null }).right[3], null);
const editing = (firstRow, lastRow) => ({ anchors: new Map(), edited: { firstRow, lastRow, startLine: 0, endLine: 0, caretLine: 0, text: '' } });
check('split: nothing tucks into a row under the editor', split(CONTEXT, editing(2, 2)).right[3], null);
check('split: rows inside the editor still tuck into each other', split(CONTEXT, editing(1, 3)).right[3], 'up');
const OPENER = '@@ -1,3 +1,3 @@\n x = [\n   {\n     a: 1,';
check('split: an opener tucks down into the line below', split(OPENER).right[2], 'down');
check('split: nothing tucks out past the editor', split(OPENER, editing(1, 2)).right[2], null);

const ADDED_BEFORE = '@@ -1,3 +1,4 @@\n function a() {\n   return 1;\n+  // done\n }';
check('split: a closer below a filler stays whole on both sides', split(ADDED_BEFORE), { left: [null, null, null, null, null], right: [null, null, null, null, null] });
check('unified: no overhang into a differently tinted line', unified(ADDED_BEFORE), [null, null, null, null, null]);

const ADDED_BLOCK = '@@ -1,1 +1,4 @@\n const a = 1;\n+if (a) {\n+  go();\n+}';
check('split: a filler follows the cell across from it', split(ADDED_BLOCK), { left: [null, null, null, null, 'up'], right: [null, null, null, null, 'up'] });

const DISAGREE = '@@ -1,2 +1,2 @@\n-    a = 1;\n-  }\n+  a = 2;\n+  }';
check('split: both cells must agree', split(DISAGREE), { left: [null, null, null], right: [null, null, null] });
check('unified: each line judges its own neighbor', unified(DISAGREE), [null, null, 'up', null, null]);

async function margins(code, lang) {
  const tokens = await tokenizeCode(code, lang);
  return code.split('\n').map((text, index) => marginTexts(text, tokens[index]));
}

function marginTexts(text, tokens) {
  return commentMargins(text, tokens).map(({ start, end }) => text.slice(start, end));
}

check('margins: a line comment and a doc block', await margins('  // Reads it.\n/**\n * Reads it.\n */', 'typescript'), [['//'], [], ['*'], []]);
check('margins: both ends of a one-line block comment', await margins('/* Reads it. */', 'typescript'), [['/*', '*/']]);
check('margins: a slash inside the text is not a margin', await margins('// see a/b/', 'typescript'), [['//']]);
check('margins: code before a comment rules it out', await margins('go(); // Reads it.', 'typescript'), [[]]);
check('margins: hash comments count', await margins('# Reads it.', 'python'), [['#']]);
check('margins: directives and headings are not comments', [await margins('#include <x.h>', 'c'), await margins('# Heading', 'markdown')], [[[]], [[]]]);
