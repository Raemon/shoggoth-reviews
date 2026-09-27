import type { ThemedToken } from './diffHighlight';
import type { CharRange } from './intralineDiff';

const LEADING_MARKS = /^(\s*)[/*#]+/u;
const TRAILING_MARKS = /\s([/*#]+)\s*$/u;

type Explanation = NonNullable<ThemedToken['explanation']>[number];

/** The comment marks framing a line that is nothing but comment, like `//` or ` * `. */
export function commentMargins(text: string, tokens: ThemedToken[] | null): CharRange[] {
  return tokens && allComment(tokens) ? marginRanges(text) : [];
}

function allComment(tokens: ThemedToken[]): boolean {
  return tokens.every((token) => !token.content.trim() || Boolean(token.explanation?.every(commentOrBlank)));
}

function commentOrBlank(piece: Explanation): boolean {
  return !piece.content.trim() || piece.scopes.some((scope) => scope.scopeName.startsWith('comment'));
}

// A line of nothing but marks has no margin: it is drawn as a semiblank line.
function marginRanges(text: string): CharRange[] {
  const leading = LEADING_MARKS.exec(text);
  if (!leading || !text.slice(leading[0].length).trim()) return [];
  const left = { start: leading[1]?.length ?? 0, end: leading[0].length };
  return [left, ...trailingMargin(text, left.end)];
}

function trailingMargin(text: string, after: number): CharRange[] {
  const trailing = TRAILING_MARKS.exec(text.slice(after));
  if (!trailing?.[1]) return [];
  const matchStart = after + trailing.index;
  const start = matchStart + trailing[0].indexOf(trailing[1]);
  return [{ start, end: start + trailing[1].length }];
}
