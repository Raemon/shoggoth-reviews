const WORD_CHAR = /[A-Za-z0-9_$]/;
const WORD_RUN = /[A-Za-z0-9_$]+/g;

export const NON_SYMBOL_WORDS = new Set([
  'const', 'let', 'var', 'function', 'class', 'interface', 'type', 'enum', 'namespace', 'module',
  'import', 'export', 'from', 'default', 'return', 'if', 'else', 'for', 'while', 'do', 'switch',
  'case', 'break', 'continue', 'try', 'catch', 'finally', 'throw', 'new', 'delete', 'in', 'of',
  'typeof', 'instanceof', 'keyof', 'void', 'as', 'is', 'async', 'await', 'yield', 'static',
  'public', 'private', 'protected', 'readonly', 'abstract', 'extends', 'implements', 'declare',
  'get', 'set', 'this', 'super', 'null', 'undefined', 'true', 'false', 'string', 'number',
  'boolean', 'any', 'unknown', 'never', 'object', 'def', 'fn', 'func', 'struct', 'impl', 'trait',
  'pub', 'use', 'mod', 'end', 'then', 'elif', 'nil', 'not', 'and', 'or', 'lambda', 'self', 'pass',
  'raise', 'with', 'None', 'True', 'False',
]);

export interface ClickedIdentifier {
  word: string;
  column: number;
}

export interface PointedIdentifier extends ClickedIdentifier {
  range: Range;
}

export function identifierAtPoint(event: { clientX: number; clientY: number }, code: HTMLElement): PointedIdentifier | null {
  const selection = window.getSelection();
  if (selection && !selection.isCollapsed) return null;
  const caret = caretAt(event.clientX, event.clientY);
  if (!caret || !code.contains(caret.node)) return null;
  const offset = offsetWithin(code, caret);
  const found = offset === null ? null : identifierAround(code.textContent ?? '', offset);
  if (!found) return null;
  const range = wordRange(code, found.column, found.column + found.word.length);
  return spansX(range, event.clientX) ? { ...found, range } : null;
}

// The caret snaps to the nearest word, even from past the end of the line.
function spansX(range: Range, x: number): boolean {
  return Array.from(range.getClientRects()).some((rect) => x >= rect.left && x <= rect.right);
}

export function identifiersIn(text: string): ClickedIdentifier[] {
  const found: ClickedIdentifier[] = [];
  for (const match of text.matchAll(WORD_RUN)) {
    const identifier = asIdentifier(match[0], match.index);
    if (identifier) found.push(identifier);
  }
  return found;
}

function identifierAround(text: string, offset: number): ClickedIdentifier | null {
  const at = WORD_CHAR.test(text[offset] ?? '') ? offset : offset - 1;
  if (!WORD_CHAR.test(text[at] ?? '')) return null;
  let start = at;
  let end = at + 1;
  while (start > 0 && WORD_CHAR.test(text[start - 1] ?? '')) start -= 1;
  while (end < text.length && WORD_CHAR.test(text[end] ?? '')) end += 1;
  return asIdentifier(text.slice(start, end), start);
}

function asIdentifier(word: string, column: number): ClickedIdentifier | null {
  if (/^[0-9]/.test(word) || NON_SYMBOL_WORDS.has(word)) return null;
  return { word, column };
}

interface Caret {
  node: Node;
  offset: number;
}

function caretAt(x: number, y: number): Caret | null {
  const positioned = document.caretPositionFromPoint?.(x, y);
  if (positioned) return { node: positioned.offsetNode, offset: positioned.offset };
  const ranged = document.caretRangeFromPoint?.(x, y);
  return ranged ? { node: ranged.startContainer, offset: ranged.startOffset } : null;
}

function offsetWithin(code: HTMLElement, caret: Caret): number | null {
  for (const span of textSpans(code)) if (span.node === caret.node) return span.from + caret.offset;
  return null;
}

function wordRange(code: HTMLElement, start: number, end: number): Range {
  const range = document.createRange();
  for (const span of textSpans(code)) {
    if (start >= span.from && start < span.to) range.setStart(span.node, start - span.from);
    if (end > span.from && end <= span.to) {
      range.setEnd(span.node, end - span.from);
      break;
    }
  }
  return range;
}

interface TextSpan {
  node: Node;
  from: number;
  to: number;
}

function* textSpans(code: HTMLElement): Generator<TextSpan> {
  const walker = document.createTreeWalker(code, NodeFilter.SHOW_TEXT);
  let from = 0;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const to = from + (node.textContent?.length ?? 0);
    yield { node, from, to };
    from = to;
  }
}
