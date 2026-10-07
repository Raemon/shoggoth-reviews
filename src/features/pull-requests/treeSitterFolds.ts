import type { Node } from '@vscode/tree-sitter-wasm';
import { extensionOf, regionMarkerRules } from './foldDialects';
import { lineRuleSpans } from './foldLineSpans';
import type { FoldMethod, FoldSource, SideFold } from './foldModel';
import type { Span } from './foldSpan';
import { heuristicFolds } from './heuristicFolds';
import { assembleSideFolds } from './sideFolds';
import { lastLineOf, parseSource } from './treeSitter';

const LITERAL_KIND = /comment|string|template|heredoc|doc/;
const TEXT_LEAF = /(_text|content|string_fragment)$/;

/** Every named syntax node of three or more lines; the heuristic stands in when no grammar loads. */
export const treeSitterFoldMethod: FoldMethod = { id: 'tree-sitter', folds: treeSitterFolds };

async function treeSitterFolds(source: FoldSource): Promise<SideFold[]> {
  const tree = await parseSource(source.lines.join('\n'), source.filename);
  if (!tree) return heuristicFolds(source);
  let spans: Span[];
  try {
    spans = nodeSpans(tree.rootNode);
  } finally {
    tree.delete();
  }
  const markers = lineRuleSpans(source.lines, regionMarkerRules(extensionOf(source.filename)), literalLines(spans));
  return assembleSideFolds(source, [...spans, ...markers], spans);
}

function nodeSpans(root: Node): Span[] {
  const spans: Span[] = [];
  const pending: Node[] = [];
  for (const child of root.namedChildren) if (child) pending.push(child);
  while (pending.length > 0) {
    const node = pending.pop();
    if (!node || lastLineOf(node) - node.startPosition.row < 2) continue;
    if (node.type !== 'ERROR' && !TEXT_LEAF.test(node.type)) {
      spans.push({ start: node.startPosition.row, end: lastLineOf(node), kind: node.type, imports: false });
    }
    for (const child of node.namedChildren) if (child) pending.push(child);
  }
  return spans;
}

function literalLines(spans: Span[]): Set<number> {
  const covered = new Set<number>();
  for (const span of spans) {
    if (!LITERAL_KIND.test(span.kind)) continue;
    for (let line = span.start + 1; line <= span.end; line += 1) covered.add(line);
  }
  return covered;
}
