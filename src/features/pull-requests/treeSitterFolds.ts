import type { Language, Node, Parser, Tree } from '@vscode/tree-sitter-wasm';
import { assembleRegions, type CollapseRegion } from './collapseRegions';
import { extensionOf, foldDialect, regionMarkerRules } from './foldDialects';
import { lineRuleSpans } from './foldLineSpans';
import { scanSegments, scanSide, type ScanSegment, type Side, type Span } from './foldSpan';
import type { DiffRow } from './splitDiff';

const GRAMMAR_BY_EXTENSION: Record<string, string> = {
  ts: 'typescript',
  mts: 'typescript',
  cts: 'typescript',
  tsx: 'tsx',
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  py: 'python',
  pyi: 'python',
  rb: 'ruby',
  rake: 'ruby',
  go: 'go',
  rs: 'rust',
  java: 'java',
  c: 'cpp',
  h: 'cpp',
  cc: 'cpp',
  cpp: 'cpp',
  cxx: 'cpp',
  hpp: 'cpp',
  hh: 'cpp',
  cs: 'c-sharp',
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  php: 'php',
  css: 'css',
};

const LITERAL_KIND = /comment|string|template|heredoc|doc/;

interface TreeSitterModule {
  Parser: {
    init(options: { locateFile: (file: string, folder: string) => string }): Promise<void>;
    new (): Parser;
  };
  Language: {
    load(input: string | Uint8Array): Promise<Language>;
  };
}

declare global {
  // eslint-disable-next-line no-var
  var Parser: TreeSitterModule | undefined;
}

interface WasmSource {
  module: () => Promise<TreeSitterModule>;
  runtime: () => { locateFile: (file: string, folder: string) => string };
  grammar: (name: string) => string | Promise<Uint8Array>;
}

let wasmSource: WasmSource = {
  module: browserRuntimeScript,
  runtime: () => ({ locateFile: (file: string) => `/tree-sitter/${file}` }),
  grammar: (name) => `/tree-sitter/tree-sitter-${name}.wasm`,
};

export function overrideWasmSource(source: WasmSource) {
  wasmSource = source;
}

function browserRuntimeScript(): Promise<TreeSitterModule> {
  return new Promise((resolve, reject) => {
    const held = globalThis.Parser;
    if (held) {
      resolve(held);
      return;
    }
    const script = document.createElement('script');
    script.src = '/tree-sitter/tree-sitter.js';
    script.onload = () => (globalThis.Parser ? resolve(globalThis.Parser) : reject(new Error('tree-sitter runtime missing')));
    script.onerror = () => reject(new Error('tree-sitter runtime failed to load'));
    document.head.appendChild(script);
  });
}

let modulePromise: Promise<TreeSitterModule> | null = null;
let parserPromise: Promise<Parser> | null = null;
const languages = new Map<string, Promise<Language | null>>();

function sharedModule(): Promise<TreeSitterModule> {
  modulePromise ??= retryable(wasmSource.module(), () => (modulePromise = null));
  return modulePromise;
}

function sharedParser(): Promise<Parser> {
  parserPromise ??= retryable(startParser(), () => (parserPromise = null));
  return parserPromise;
}

function retryable<T>(pending: Promise<T>, forget: () => void): Promise<T> {
  return pending.catch((error) => {
    forget();
    throw error;
  });
}

async function startParser(): Promise<Parser> {
  const loaded = await sharedModule();
  await loaded.Parser.init(wasmSource.runtime());
  return new loaded.Parser();
}

function grammarLanguage(name: string): Promise<Language | null> {
  const held = languages.get(name);
  if (held) return held;
  const loading = loadGrammar(name);
  languages.set(name, loading);
  return loading;
}

async function loadGrammar(name: string): Promise<Language | null> {
  try {
    const loaded = await sharedModule();
    await sharedParser();
    return await loaded.Language.load(await wasmSource.grammar(name));
  } catch {
    languages.delete(name);
    return null;
  }
}

export function grammarNameFor(filename: string): string | null {
  return GRAMMAR_BY_EXTENSION[extensionOf(filename)] ?? null;
}

export async function parseSource(text: string, filename: string): Promise<Tree | null> {
  const grammar = grammarNameFor(filename);
  if (!grammar) return null;
  const language = await grammarLanguage(grammar);
  if (!language) return null;
  const parser = await sharedParser();
  parser.setLanguage(language);
  return parser.parse(text);
}

export async function treeCollapseRegions(
  rows: DiffRow[],
  contiguous: boolean,
  filename: string,
): Promise<CollapseRegion[] | null> {
  const extension = extensionOf(filename);
  const grammar = grammarNameFor(filename);
  if (!grammar) return null;
  const language = await grammarLanguage(grammar);
  if (!language) return null;
  const side = scanSide(rows);
  const spans = await parsedSpans(rows, side, contiguous, language);
  if (spans === null || spans.length === 0) return null;
  const literal = literalRows(spans);
  const markers = lineRuleSpans(rows, side, contiguous, regionMarkerRules(extension), literal);
  return assembleRegions(rows, side, contiguous, [...spans, ...markers], spans, literal, foldDialect(extension));
}

async function parsedSpans(rows: DiffRow[], side: Side, contiguous: boolean, language: Language): Promise<Span[] | null> {
  const parser = await sharedParser();
  parser.setLanguage(language);
  const spans: Span[] = [];
  for (const segment of scanSegments(rows, side, contiguous)) {
    if (!segmentSpans(parser, segment, contiguous, spans)) return null;
  }
  return spans;
}

function segmentSpans(parser: Parser, segment: ScanSegment, contiguous: boolean, spans: Span[]): boolean {
  const tree = parser.parse(segment.text);
  if (!tree) return false;
  try {
    collectFolds(tree.rootNode, segment.lineRows, contiguous, spans);
  } finally {
    tree.delete();
  }
  return true;
}

const TEXT_LEAF = /(_text|content|string_fragment)$/;

function collectFolds(root: Node, lineRows: number[], contiguous: boolean, spans: Span[]) {
  const pending: Node[] = [];
  for (const child of root.namedChildren) if (child) pending.push(child);
  while (pending.length > 0) {
    const node = pending.pop();
    if (!node || lastLineOf(node) - node.startPosition.row < 2) continue;
    foldFromNode(node, lineRows, contiguous, spans);
    for (const child of node.namedChildren) if (child) pending.push(child);
  }
}

function foldFromNode(node: Node, lineRows: number[], contiguous: boolean, spans: Span[]) {
  if (node.type === 'ERROR' || TEXT_LEAF.test(node.type)) return;
  if (!contiguous && node.hasError) return;
  const start = lineRows[node.startPosition.row];
  const end = lineRows[lastLineOf(node)];
  if (start !== undefined && end !== undefined && end > start) {
    spans.push({ start, end, kind: node.type, imports: false });
  }
}

export function lastLineOf(node: Node): number {
  return node.endPosition.column === 0 ? node.endPosition.row - 1 : node.endPosition.row;
}

function literalRows(spans: Span[]): Set<number> {
  const covered = new Set<number>();
  for (const span of spans) {
    if (!LITERAL_KIND.test(span.kind)) continue;
    for (let row = span.start + 1; row <= span.end; row += 1) covered.add(row);
  }
  return covered;
}
