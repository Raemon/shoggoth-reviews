import { extensionOf, JAVASCRIPT_EXTENSIONS } from './foldDialects';
import { BLOCK_COMMENT, scanText, STRING, type ScannedText, type Syntax } from './partialTokenizer';

/** Port of Vanadium's CommentLineClassifier. An excluded comment (`//#`, `#!`) is never folded in. */
export type CommentClass = 'code' | 'blank' | 'comment' | 'excluded';

export interface CommentStyle {
  startMarker: string;
  endMarker: string;
  /** Set when classifying needs to know where block comments and strings run. */
  syntax: Syntax | null;
  classifyLine: (text: string, index: number, scan: ScannedText | null) => CommentClass;
}

const C_SYNTAX: Syntax = { lineComments: true, templates: false, regexLiterals: false };
const JS_SYNTAX: Syntax = { lineComments: true, templates: true, regexLiterals: true };
const CSS_SYNTAX: Syntax = { lineComments: false, templates: false, regexLiterals: false };

const NO_COMMENTS: CommentStyle = { startMarker: '//', endMarker: '', syntax: null, classifyLine: () => 'code' };

const C_STYLE_EXTENSIONS = new Set([
  'c', 'h', 'cc', 'cpp', 'cxx', 'hpp', 'hh', 'hxx', 'm', 'mm', 'cs', 'java', 'kt', 'kts', 'zig', 'rs', 'go',
  'swift', 'scala', 'dart', 'php',
]);
const SLASH_STAR_EXTENSIONS = new Set(['css', 'scss', 'less']);
const LINE_MARKER_BY_EXTENSION: Record<string, string> = {
  sh: '#', bash: '#', zsh: '#', py: '#', pyi: '#', rb: '#', rake: '#', mk: '#', yaml: '#', yml: '#', toml: '#',
  pl: '#', pm: '#', r: '#', ex: '#', exs: '#', nim: '#', coffee: '#', tf: '#',
  lua: '--', sql: '--', hs: '--', elm: '--',
  lisp: ';', el: ';', clj: ';', scm: ';',
};

export function commentStyleFor(filename: string): CommentStyle {
  const extension = extensionOf(filename);
  if (JAVASCRIPT_EXTENSIONS.has(extension)) return cStyleComments(JS_SYNTAX);
  if (C_STYLE_EXTENSIONS.has(extension)) return cStyleComments(C_SYNTAX);
  if (SLASH_STAR_EXTENSIONS.has(extension)) return slashStarComments(CSS_SYNTAX);
  if (/(^|\/)makefile$/i.test(filename)) return lineMarkerComments('#');
  const marker = LINE_MARKER_BY_EXTENSION[extension];
  return marker ? lineMarkerComments(marker) : NO_COMMENTS;
}

export function classifyCommentLines(lines: string[], style: CommentStyle): { comments: CommentClass[]; scan: ScannedText | null } {
  const scan = style.syntax ? scanText(lines, style.syntax) : null;
  return { comments: lines.map((text, index) => style.classifyLine(text, index, scan)), scan };
}

/** The first line of the unbroken run of comment lines directly above `line`, or `line` itself. */
export function backtrackOverComments(comments: CommentClass[], line: number): number {
  let start = line;
  while (start > 0 && comments[start - 1] === 'comment') start -= 1;
  return start;
}

export function commentOrBlank(comment: CommentClass | undefined): boolean {
  return comment === 'comment' || comment === 'blank';
}

function slashStarComments(syntax: Syntax): CommentStyle {
  return { startMarker: '/*', endMarker: '*/', syntax, classifyLine: (text, index, scan) => slashStarLine(text, startsInComment(scan, index)) };
}

function slashStarLine(text: string, inComment: boolean): CommentClass {
  const trimmed = text.trim();
  if (trimmed === '') return inComment ? 'comment' : 'blank';
  if (inComment) return trimmed.includes('*/') && !trimmed.endsWith('*/') ? 'code' : 'comment';
  return trimmed.startsWith('/*') ? 'comment' : 'code';
}

function cStyleComments(syntax: Syntax): CommentStyle {
  return { startMarker: '//', endMarker: '', syntax, classifyLine: cStyleLine };
}

// A line inside a string (a template literal's, say) is code whatever it starts with.
function cStyleLine(text: string, index: number, scan: ScannedText | null): CommentClass {
  const trimmed = text.trimStart();
  const inComment = startsInComment(scan, index);
  if (startsInString(scan, index, text.length - trimmed.length)) return 'code';
  if (trimmed.startsWith('//')) return /^\/{2,3}#/.test(trimmed) ? 'excluded' : 'comment';
  if (inComment && trimmed.startsWith('*')) return trimmed.startsWith('*#') ? 'excluded' : 'comment';
  if (trimmed.startsWith('/*')) return /^\/\*\*?#/.test(trimmed) ? 'excluded' : 'comment';
  return slashStarLine(text, inComment);
}

function startsInComment(scan: ScannedText | null, index: number): boolean {
  const lineStart = scan?.lineStarts[index] ?? 0;
  return lineStart > 0 && scan?.classes[lineStart - 1] === BLOCK_COMMENT;
}

function startsInString(scan: ScannedText | null, index: number, indent: number): boolean {
  const lineStart = scan?.lineStarts[index];
  return lineStart !== undefined && scan?.classes[lineStart + indent] === STRING;
}

// `#!` is a shebang on the first line, and excluded from folding anywhere else.
function lineMarkerComments(marker: string): CommentStyle {
  return {
    startMarker: marker,
    endMarker: '',
    syntax: null,
    classifyLine: (text, index) => {
      const trimmed = text.trimStart();
      if (trimmed === '') return 'blank';
      if (!trimmed.startsWith(marker)) return 'code';
      if (!trimmed.startsWith(`${marker}!`)) return 'comment';
      return index === 0 && text.startsWith('#!') ? 'comment' : 'excluded';
    },
  };
}
