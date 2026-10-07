import type { Language, Node, Parser, Tree } from '@vscode/tree-sitter-wasm';
import { extensionOf } from './foldDialects';

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

export function lastLineOf(node: Node): number {
  return node.endPosition.column === 0 ? node.endPosition.row - 1 : node.endPosition.row;
}
