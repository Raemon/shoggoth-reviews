/** Character classes from `partialTokenize`. */
export const CODE = 0;
export const LINE_COMMENT = 1;
export const BLOCK_COMMENT = 2;
export const STRING = 3;

export interface Syntax {
  lineComments: boolean;
  templates: boolean;
  regexLiterals: boolean;
}

export interface ScannedText {
  text: string;
  classes: Uint8Array;
  lineStarts: number[];
}

interface Scan {
  text: string;
  syntax: Syntax;
  classes: Uint8Array;
  braces: number;
  interpolations: number[];
}

export function scanText(lines: string[], syntax: Syntax): ScannedText {
  const text = lines.join('\n');
  const lineStarts: number[] = [];
  let offset = 0;
  for (const line of lines) {
    lineStarts.push(offset);
    offset += line.length + 1;
  }
  return { text, classes: partialTokenize(text, syntax), lineStarts };
}

/**
 * Marks which characters are inside comments and string literals, for delimiter matching and
 * comment detection that must survive syntax errors. Quotes that don't close on their own line
 * are left as code, so an apostrophe in JSX text doesn't swallow the rest of the file.
 */
export function partialTokenize(text: string, syntax: Syntax): Uint8Array {
  const scan: Scan = { text, syntax, classes: new Uint8Array(text.length), braces: 0, interpolations: [] };
  let at = 0;
  while (at < text.length) at = codeStep(scan, at);
  return scan.classes;
}

function codeStep(scan: Scan, at: number): number {
  const { text, syntax } = scan;
  const pair = text.slice(at, at + 2);
  if (syntax.lineComments && pair === '//') return mark(scan, at, lineEnd(text, at), LINE_COMMENT);
  if (pair === '/*') return mark(scan, at, blockCommentEnd(text, at), BLOCK_COMMENT);
  const char = text[at];
  if (char === '"' || char === "'") return markOrSkip(scan, at, quotedEnd(text, at));
  if (syntax.templates && char === '`') return templateStep(scan, mark(scan, at, at + 1, STRING));
  if (syntax.regexLiterals && char === '/' && regexCanStart(text, at)) return markOrSkip(scan, at, regexEnd(text, at));
  return braceStep(scan, at);
}

// Inside `${…}`, the brace that brings the depth back down resumes the template.
function braceStep(scan: Scan, at: number): number {
  const char = scan.text[at];
  if (char === '{') scan.braces += 1;
  if (char !== '}') return at + 1;
  if (scan.interpolations[scan.interpolations.length - 1] !== scan.braces) {
    scan.braces -= 1;
    return at + 1;
  }
  scan.interpolations.pop();
  return templateStep(scan, mark(scan, at, at + 1, STRING));
}

function templateStep(scan: Scan, at: number): number {
  const { text } = scan;
  for (let scanAt = at; scanAt < text.length; scanAt += 1) {
    if (text[scanAt] === '\\') scanAt += 1;
    else if (text[scanAt] === '`') return mark(scan, at, scanAt + 1, STRING);
    else if (text[scanAt] === '$' && text[scanAt + 1] === '{') {
      scan.interpolations.push(scan.braces);
      return mark(scan, at, scanAt + 2, STRING);
    }
  }
  return mark(scan, at, text.length, STRING);
}

function mark(scan: Scan, from: number, to: number, kind: number): number {
  scan.classes.fill(kind, from, to);
  return to;
}

// An unclosed quote or slash is left as code.
function markOrSkip(scan: Scan, at: number, end: number | null): number {
  return end === null ? at + 1 : mark(scan, at, end, STRING);
}

function lineEnd(text: string, at: number): number {
  const end = text.indexOf('\n', at);
  return end < 0 ? text.length : end;
}

function blockCommentEnd(text: string, at: number): number {
  const close = text.indexOf('*/', at + 2);
  return close < 0 ? text.length : close + 2;
}

function quotedEnd(text: string, at: number): number | null {
  const quote = text[at];
  for (let scanAt = at + 1; scanAt < text.length; scanAt += 1) {
    const char = text[scanAt];
    if (char === '\n') return null;
    if (char === '\\') scanAt += 1;
    else if (char === quote) return scanAt + 1;
  }
  return null;
}

function regexCanStart(text: string, at: number): boolean {
  const before = text.slice(text.lastIndexOf('\n', at - 1) + 1, at).trimEnd();
  if (before === '') return true;
  return '=(,:;!&|?[{'.includes(before[before.length - 1] ?? '') || /\breturn$/.test(before);
}

function regexEnd(text: string, at: number): number | null {
  let inClass = false;
  for (let scanAt = at + 1; scanAt < text.length; scanAt += 1) {
    const char = text[scanAt];
    if (char === '\n') return null;
    if (char === '\\') scanAt += 1;
    else if (char === '[') inClass = true;
    else if (char === ']') inClass = false;
    else if (char === '/' && !inClass) return scanAt + 1;
  }
  return null;
}
