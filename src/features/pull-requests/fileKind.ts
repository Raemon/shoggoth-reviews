import { isImagePath } from './imageFiles';

const KIND_BY_EXTENSION: Record<string, string> = {
  ts: 'ts',
  mts: 'ts',
  cts: 'ts',
  tsx: 'tsx',
  jsx: 'tsx',
  js: 'js',
  mjs: 'js',
  cjs: 'js',
  json: 'data',
  lock: 'data',
  toml: 'data',
  yaml: 'data',
  yml: 'data',
  css: 'style',
  scss: 'style',
  md: 'prose',
  mdx: 'prose',
  txt: 'prose',
  html: 'markup',
  htm: 'markup',
  sh: 'shell',
  bash: 'shell',
  mk: 'shell',
};

const MARKDOWN_EXTENSIONS = new Set(['md', 'mdx', 'markdown']);

export function extensionOf(path: string): string {
  const name = path.slice(path.lastIndexOf('/') + 1);
  const dot = name.lastIndexOf('.');
  return dot <= 0 ? '' : name.slice(dot + 1).toLowerCase();
}

export function isMarkdownPath(path: string): boolean {
  return MARKDOWN_EXTENSIONS.has(extensionOf(path));
}

export function splitExtension(name: string): [string, string] {
  const dot = name.lastIndexOf('.');
  return dot <= 0 ? [name, ''] : [name.slice(0, dot), name.slice(dot)];
}

export function fileKindColor(path: string): string | undefined {
  const kind = isImagePath(path) ? 'image' : KIND_BY_EXTENSION[extensionOf(path)];
  return kind && `var(--kind-${kind})`;
}
