export interface LineRule {
  kind: string;
  open: RegExp;
  close: RegExp;
  selfClosed?: RegExp;
  skip?: RegExp;
}

export const JAVASCRIPT_EXTENSIONS = new Set(['js', 'cjs', 'mjs', 'jsx', 'ts', 'mts', 'cts', 'tsx']);

export function extensionOf(filename: string): string {
  return filename.slice(filename.lastIndexOf('.') + 1).toLowerCase();
}

export interface FoldDialect {
  tokens: boolean;
  markup: boolean;
  heredocs: boolean;
  triples: boolean;
  markdown: boolean;
  indent: boolean;
  hashComments: boolean;
  slashComments: boolean;
  dashComments: boolean;
  regexLiterals: boolean;
  preprocessor: boolean;
  importLine: RegExp | null;
  lineRules: LineRule[];
}

const JS_IMPORT = /^\s*(import[\s({"']|export\s.*\sfrom\s|require\s*\(|\w[\w.]*\s*=\s*require\s*\()/;
const PY_IMPORT = /^\s*(import\s|from\s+\S+\s+import[\s(])/;
const C_INCLUDE = /^\s*#\s*include[\s<"]/;
const PLAIN_IMPORT = /^\s*import\s/;

const IMPORT_BY_EXTENSION: Record<string, RegExp> = {
  ts: JS_IMPORT,
  tsx: JS_IMPORT,
  js: JS_IMPORT,
  jsx: JS_IMPORT,
  mjs: JS_IMPORT,
  cjs: JS_IMPORT,
  mts: JS_IMPORT,
  cts: JS_IMPORT,
  vue: JS_IMPORT,
  svelte: JS_IMPORT,
  py: PY_IMPORT,
  pyi: PY_IMPORT,
  go: /^\s*import[\s(]/,
  java: PLAIN_IMPORT,
  kt: PLAIN_IMPORT,
  kts: PLAIN_IMPORT,
  swift: PLAIN_IMPORT,
  scala: PLAIN_IMPORT,
  c: C_INCLUDE,
  h: C_INCLUDE,
  cc: C_INCLUDE,
  cpp: C_INCLUDE,
  hpp: C_INCLUDE,
  m: C_INCLUDE,
  mm: C_INCLUDE,
  rs: /^\s*(use\s+[\w:{*]|extern\s+crate\s)/,
  php: /^\s*(use\s+[\w\\]|require|include)/,
  cs: /^\s*(using\s+\w|global\s+using\s)/,
  rb: /^\s*require/,
};

const HASH_SKIP = /^\s*#/;
const DASH_SKIP = /^\s*--/;

const RUBY_BLOCK: LineRule = {
  kind: 'block',
  open: /^\s*(def|class|module|case|begin|if|unless|while|until)\b(?!:)|\bdo(\s*\|[^|]*\|)?\s*$/,
  close: /^\s*end\b/,
  selfClosed: /\bend\s*$/,
  skip: HASH_SKIP,
};
const ELIXIR_BLOCK: LineRule = { kind: 'block', open: /\bdo\s*$/, close: /^\s*end\b/, skip: HASH_SKIP };
const LUA_BLOCK: LineRule = {
  kind: 'block',
  open: /^\s*(local\s+)?function\b|^\s*(if|for|while|repeat)\b|[=(,{]\s*function\s*[(\s]/,
  close: /^\s*(end|until)\b/,
  selfClosed: /\bend\s*$/,
  skip: DASH_SKIP,
};
const SHELL_IF: LineRule = { kind: 'block', open: /^\s*if\b/, close: /^\s*fi\b/, selfClosed: /\bfi;?\s*$/, skip: HASH_SKIP };
const SHELL_LOOP: LineRule = { kind: 'block', open: /^\s*(for|while|until|select)\b/, close: /^\s*done\b/, selfClosed: /\bdone;?\s*$/, skip: HASH_SKIP };
const SHELL_CASE: LineRule = { kind: 'block', open: /^\s*case\b/, close: /^\s*esac\b/, selfClosed: /\besac;?\s*$/, skip: HASH_SKIP };
const SQL_BLOCK: LineRule = {
  kind: 'block',
  open: /^\s*begin\b|\bcase\s+when\b|\bcase\s*$/i,
  close: /^\s*end(\s+case)?\s*;?\s*$/i,
  selfClosed: /\bend\b(\s+as\s+\w+)?\s*[,;)]*\s*$/i,
  skip: DASH_SKIP,
};
const REGION_MARKER: LineRule = {
  kind: 'region',
  open: /^\s*(\/\/|--|<!--)?\s*#\s*(pragma\s+)?region\b/i,
  close: /^\s*(\/\/|--|<!--)?\s*#\s*(pragma\s+)?endregion\b/i,
};
const PREPROCESSOR: LineRule = { kind: 'preprocessor', open: /^\s*#\s*if(n?def)?\b/, close: /^\s*#\s*endif\b/ };

const SHELL_RULES = [SHELL_IF, SHELL_LOOP, SHELL_CASE];

const LINE_RULES: Record<string, LineRule[]> = {
  rb: [RUBY_BLOCK],
  rake: [RUBY_BLOCK],
  ex: [ELIXIR_BLOCK],
  exs: [ELIXIR_BLOCK],
  lua: [LUA_BLOCK],
  sh: SHELL_RULES,
  bash: SHELL_RULES,
  zsh: SHELL_RULES,
  sql: [SQL_BLOCK],
};

const MARKUP_EXTENSIONS = new Set(['tsx', 'jsx', 'js', 'mjs', 'cjs', 'html', 'htm', 'xml', 'svg', 'vue', 'svelte', 'mdx', 'astro']);
const PREPROCESSOR_EXTENSIONS = new Set(['c', 'h', 'cc', 'cpp', 'cxx', 'hpp', 'hh', 'm', 'mm', 'cs']);
const PROSE_EXTENSIONS = new Set(['md', 'markdown', 'mdx', 'txt', 'rst', 'adoc']);
const TOKENLESS_EXTENSIONS = new Set(['md', 'markdown', 'txt', 'rst', 'adoc']);
const MARKDOWN_EXTENSIONS = new Set(['md', 'markdown', 'mdx']);
const INDENT_EXTENSIONS = new Set(['py', 'pyi', 'yaml', 'yml', 'coffee', 'nim', 'hs', 'sass', 'styl', 'haml', 'slim', 'pug', 'jade']);
const TRIPLE_EXTENSIONS = new Set(['py', 'pyi', 'kt', 'kts', 'scala']);
const HEREDOC_EXTENSIONS = new Set(['sh', 'bash', 'zsh', 'rb', 'rake', 'pl', 'pm', 'php']);
const HASHLESS_EXTENSIONS = new Set([
  'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'mts', 'cts', 'vue', 'svelte', 'astro',
  'css', 'scss', 'less', 'sass', 'styl',
  'html', 'htm', 'xml', 'svg',
  'java', 'kt', 'kts', 'swift', 'scala', 'go', 'rs', 'json',
]);
const SLASHLESS_EXTENSIONS = new Set([
  'py', 'pyi', 'rb', 'rake', 'sh', 'bash', 'zsh', 'yaml', 'yml',
  'pl', 'pm', 'ex', 'exs', 'coffee', 'nim', 'r', 'lua', 'sql', 'hs', 'tf', 'toml',
]);
const DASH_COMMENT_EXTENSIONS = new Set(['lua', 'sql', 'hs', 'elm']);
const REGEX_LITERAL_EXTENSIONS = new Set(['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'mts', 'cts', 'vue', 'svelte']);

export function foldDialect(extension: string): FoldDialect {
  return {
    tokens: !TOKENLESS_EXTENSIONS.has(extension),
    markup: MARKUP_EXTENSIONS.has(extension),
    heredocs: HEREDOC_EXTENSIONS.has(extension),
    triples: TRIPLE_EXTENSIONS.has(extension),
    markdown: MARKDOWN_EXTENSIONS.has(extension),
    indent: INDENT_EXTENSIONS.has(extension),
    hashComments: !HASHLESS_EXTENSIONS.has(extension),
    slashComments: !SLASHLESS_EXTENSIONS.has(extension),
    dashComments: DASH_COMMENT_EXTENSIONS.has(extension),
    regexLiterals: REGEX_LITERAL_EXTENSIONS.has(extension),
    preprocessor: PREPROCESSOR_EXTENSIONS.has(extension),
    importLine: IMPORT_BY_EXTENSION[extension] ?? null,
    lineRules: lineRulesFor(extension),
  };
}

export function regionMarkerRules(extension: string): LineRule[] {
  return PROSE_EXTENSIONS.has(extension) ? [] : [REGION_MARKER];
}

function lineRulesFor(extension: string): LineRule[] {
  return [
    ...(LINE_RULES[extension] ?? []),
    ...(PREPROCESSOR_EXTENSIONS.has(extension) ? [PREPROCESSOR] : []),
    ...regionMarkerRules(extension),
  ];
}
