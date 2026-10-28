'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { createHighlighter, type Highlighter, type ThemedToken } from 'shiki';
import { LARGE_FILE_BYTES } from './sizeLimits';

export type { ThemedToken };

const EXTENSION_LANGS: [string, string][] = [
  ['.tsx', 'tsx'], ['.mts', 'typescript'], ['.cts', 'typescript'], ['.ts', 'typescript'],
  ['.jsx', 'jsx'], ['.mjs', 'javascript'], ['.cjs', 'javascript'], ['.js', 'javascript'],
  ['.vue', 'vue'], ['.svelte', 'svelte'], ['.astro', 'astro'],
  ['.py', 'python'], ['.rb', 'ruby'], ['.go', 'go'], ['.rs', 'rust'], ['.php', 'php'],
  ['.java', 'java'], ['.kts', 'kotlin'], ['.kt', 'kotlin'], ['.cs', 'csharp'], ['.swift', 'swift'],
  ['.scala', 'scala'], ['.cpp', 'cpp'], ['.hpp', 'cpp'], ['.cc', 'cpp'], ['.hh', 'cpp'],
  ['.c', 'c'], ['.h', 'c'], ['.mm', 'objective-c'], ['.m', 'objective-c'],
  ['.sh', 'shellscript'], ['.bash', 'shellscript'], ['.zsh', 'shellscript'],
  ['.sql', 'sql'], ['.graphql', 'graphql'], ['.gql', 'graphql'], ['.prisma', 'prisma'], ['.proto', 'proto'],
  ['.css', 'css'], ['.scss', 'scss'], ['.less', 'less'],
  ['.yml', 'yaml'], ['.yaml', 'yaml'], ['.toml', 'toml'],
  ['.jsonc', 'jsonc'], ['.json', 'jsonc'],
  ['.html', 'html'], ['.xml', 'xml'], ['.mdx', 'markdown'], ['.md', 'markdown'],
];

export function langForPath(path: string): string | null {
  const lower = path.toLowerCase();
  for (const [extension, lang] of EXTENSION_LANGS) {
    if (lower.endsWith(extension)) return lang;
  }
  if (/(?:^|\/)dockerfile$/.test(lower)) return 'docker';
  if (/(?:^|\/)makefile$/.test(lower)) return 'make';
  return null;
}

let highlighterPromise: Promise<Highlighter> | null = null;
const loadedLangs = new Set<string>();

// Cut by length, not lines: one long generated line costs as much as a hundred.
const CHUNK_CHARS = 4096;
const SLICE_MS = 12;

type GrammarState = ReturnType<Highlighter['codeToTokens']>['grammarState'];

/** Yields to the page between slices, and resolves null if cancelled meanwhile. */
export async function tokenizeCode(text: string, lang: string, cancelled = () => false): Promise<ThemedToken[][] | null> {
  // Beyond this, tokens alone would take tens of megabytes (~170 bytes per character).
  if (text.length > LARGE_FILE_BYTES) return null;
  try {
    return await tokenizeInSlices(await highlighterFor(lang), text.split('\n'), lang, cancelled);
  } catch {
    return null;
  }
}

async function highlighterFor(lang: string): Promise<Highlighter> {
  highlighterPromise ??= createHighlighter({ themes: ['github-light', 'github-dark'], langs: [] });
  const highlighter = await highlighterPromise;
  if (!loadedLangs.has(lang)) {
    await highlighter.loadLanguage(lang as Parameters<Highlighter['loadLanguage']>[0]);
    loadedLangs.add(lang);
  }
  return highlighter;
}

// Each chunk resumes the last one's grammar state, so chunking never changes colours.
async function tokenizeInSlices(highlighter: Highlighter, lines: string[], lang: string, cancelled: () => boolean) {
  const tokens: ThemedToken[][] = [];
  const keepGoing = slicePacer(cancelled);
  let state: GrammarState;
  for (const [from, to] of chunkRanges(lines)) {
    const chunk = highlighter.codeToTokens(lines.slice(from, to).join('\n'), tokenOptions(lang, state));
    tokens.push(...chunk.tokens);
    state = chunk.grammarState;
    if (!(await keepGoing())) return null;
  }
  return tokens;
}

function slicePacer(cancelled: () => boolean): () => Promise<boolean> {
  let sliceStart = performance.now();
  return async () => {
    if (performance.now() - sliceStart < SLICE_MS) return true;
    await yieldToPage();
    sliceStart = performance.now();
    return !cancelled();
  };
}

function* chunkRanges(lines: string[]): Generator<[number, number]> {
  for (let from = 0, to = 0; from < lines.length; from = to) {
    to = chunkEnd(lines, from);
    yield [from, to];
  }
}

function chunkEnd(lines: string[], from: number): number {
  let end = from;
  for (let chars = 0; end < lines.length && chars < CHUNK_CHARS; end += 1) chars += (lines[end]?.length ?? 0) + 1;
  return end;
}

function tokenOptions(lang: string, grammarState: GrammarState): Parameters<Highlighter['codeToTokens']>[1] {
  return {
    lang: lang as Parameters<Highlighter['codeToTokens']>[1]['lang'],
    themes: { light: 'github-light', dark: 'github-dark' },
    defaultColor: false,
    includeExplanation: 'scopeName',
    grammarState,
  };
}

function yieldToPage(): Promise<void> {
  const scheduler = (globalThis as { scheduler?: { yield?: () => Promise<void> } }).scheduler;
  if (scheduler?.yield) return scheduler.yield();
  return new Promise((resolve) => setTimeout(resolve, 0));
}

export function useTokenized(text: string, lang: string | null): ThemedToken[][] | null {
  const [done, setDone] = useState<{ text: string; lines: ThemedToken[][] } | null>(null);
  useEffect(() => {
    if (!lang) return;
    let cancelled = false;
    tokenizeCode(text, lang, () => cancelled).then((lines) => {
      if (!cancelled && lines) setDone({ text, lines });
    });
    return () => {
      cancelled = true;
    };
  }, [text, lang]);
  return done?.text === text ? done.lines : null;
}

export function CodeTokens({ tokens, text }: { tokens: ThemedToken[] | null; text: string }) {
  if (!tokens?.length) return <>{text || ' '}</>;
  return (
    <>
      {tokens.map((token, index) => (
        <span key={index} style={token.htmlStyle as CSSProperties}>
          {token.content}
        </span>
      ))}
    </>
  );
}
