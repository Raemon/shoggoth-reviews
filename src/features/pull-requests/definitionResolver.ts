import type { Node, Tree } from '@vscode/tree-sitter-wasm';
import { lastLineOf } from './treeSitter';

export interface DefinitionQuery {
  path: string;
  ref: string;
  line: number;
  column: number;
  word: string;
}

export interface DefinitionSite {
  path: string;
  ref: string;
  nameLine: number;
  startLine: number;
  endLine: number;
  rough?: boolean;
}

export interface Resolution {
  sites: DefinitionSite[];
  note: string | null;
}

export interface ResolverFiles {
  readFile(ref: string, path: string): Promise<string | null>;
  hasFile(ref: string, path: string): Promise<boolean>;
  parsed(ref: string, path: string): Promise<ParsedFile | null>;
}

export interface Located {
  key: string;
  literal: boolean;
}

export class ParsedFile {
  private index: Map<string, Binding[]> | null = null;
  private exports: ExportSpecifier[] | null = null;

  constructor(private readonly tree: Tree) {}

  get root(): Node {
    return this.tree.rootNode;
  }

  bindings(word: string): Binding[] {
    this.index ??= bindingIndex(this.root);
    return this.index.get(word) ?? [];
  }

  exportSpecifiers(): ExportSpecifier[] {
    this.exports ??= exportSpecifiers(this.root);
    return this.exports;
  }

  delete() {
    this.tree.delete();
  }
}

const MAX_EXPORT_HOPS = 4;
const NAMESPACE_PREVIEW_LINES = 25;
export const MAX_ROUGH_SITES = 5;

export function roughSite(path: string, ref: string, line: number): DefinitionSite {
  return { path, ref, nameLine: line, startLine: line, endLine: line, rough: true };
}

export async function resolveDefinition(query: DefinitionQuery, files: ResolverFiles): Promise<Resolution> {
  const text = await files.readFile(query.ref, query.path);
  if (text === null) return { sites: [], note: 'file unavailable' };
  const parsed = await files.parsed(query.ref, query.path);
  const resolved = parsed ? await resolveInTree(parsed, query, files) : null;
  if (resolved && (resolved.sites.length > 0 || resolved.note !== null)) return resolved;
  return { sites: scanText(text, query.path, query.ref, query.word), note: null };
}

export async function locateDefinition(query: DefinitionQuery, files: ResolverFiles): Promise<Located> {
  const parsed = await files.parsed(query.ref, query.path);
  const pointed = parsed ? nodeAt(parsed, query) : null;
  const chosen = parsed ? chooseBinding(parsed, query, pointed) : null;
  const at = chosen ? chosen.name.startIndex : 'scan';
  const key = `${query.ref}\0${query.path}\0${query.word}\0${at}`;
  const literal = pointed !== null && insideLiteral(pointed);
  return { key, literal };
}

export async function refineSite(site: DefinitionSite, word: string, files: ResolverFiles): Promise<DefinitionSite> {
  const parsed = await files.parsed(site.ref, site.path);
  return (parsed && nearestBinding(parsed, word, site)) ?? site;
}

async function resolveInTree(parsed: ParsedFile, query: DefinitionQuery, files: ResolverFiles): Promise<Resolution> {
  const chosen = chooseBinding(parsed, query, nodeAt(parsed, query));
  if (!chosen) return { sites: [], note: null };
  if (chosen.source) return followImport(chosen, query, files);
  return { sites: [siteOf(chosen.name, query.path, query.ref)], note: null };
}

function nodeAt(parsed: ParsedFile, query: DefinitionQuery): Node | null {
  return parsed.root.descendantForPosition({ row: query.line - 1, column: query.column });
}

function chooseBinding(parsed: ParsedFile, query: DefinitionQuery, pointed: Node | null): Binding | null {
  const bindings = parsed.bindings(query.word);
  const imported = bindings.find((held) => held.source !== null);
  const local = bestLocal(bindings, pointed);
  if (local && shadowsImport(local, imported, pointed)) return local;
  return imported ?? local;
}

const LITERAL_NODE = /comment|string|heredoc|jsx_text/;

function insideLiteral(node: Node): boolean {
  return LITERAL_NODE.test(node.type) || LITERAL_NODE.test(node.parent?.type ?? '');
}

function shadowsImport(local: Binding, imported: Binding | undefined, clicked: Node | null): boolean {
  if (!imported || !clicked) return imported === undefined;
  return commonDepth(local.name, clicked) > commonDepth(imported.name, clicked);
}

export interface Binding {
  name: Node;
  source: string | null;
  kind: 'named' | 'default' | 'namespace';
  original: string;
}

function bindingIndex(root: Node): Map<string, Binding[]> {
  const index = new Map<string, Binding[]>();
  visit(root, (node) => {
    if (node.type === 'export_specifier') return;
    const name = bindingName(node);
    if (!name) return;
    const binding = {
      name,
      source: importSourceOf(name),
      kind: importKindOf(node),
      original: node.childForFieldName('name')?.text ?? name.text,
    };
    const held = index.get(name.text) ?? [];
    held.push(binding);
    index.set(name.text, held);
  });
  return index;
}

function visit(root: Node, see: (node: Node) => void) {
  const pending: Node[] = [root];
  while (pending.length > 0) {
    const node = pending.pop();
    if (!node) continue;
    see(node);
    for (const child of node.namedChildren) if (child) pending.push(child);
  }
}

const NAME_TYPE = /identifier$|_name$/;

function bindingName(node: Node): Node | null {
  const name = node.childForFieldName('alias') ?? node.childForFieldName('name') ?? node.childForFieldName('pattern');
  if (name && NAME_TYPE.test(name.type)) return name;
  if (node.type === 'namespace_import' || node.type === 'import_clause') return directIdentifier(node);
  if (destructuredLeaf(node)) return node;
  return null;
}

function destructuredLeaf(node: Node): boolean {
  return /identifier/.test(node.type) && /pattern$/.test(node.parent?.type ?? '');
}

function directIdentifier(node: Node): Node | null {
  for (const child of node.namedChildren) {
    if (child && child.type === 'identifier') return child;
  }
  return null;
}

function importKindOf(node: Node): Binding['kind'] {
  if (node.type === 'namespace_import') return 'namespace';
  if (node.type === 'import_clause') return 'default';
  return 'named';
}

function importSourceOf(name: Node): string | null {
  for (let held: Node | null = name; held; held = held.parent) {
    if (held.type !== 'import_statement') continue;
    const source = held.childForFieldName('source')?.text;
    return source ? unquote(source) : null;
  }
  return null;
}

function unquote(text: string): string {
  return text.replace(/^['"`]|['"`]$/g, '');
}

function bestLocal(bindings: Binding[], clicked: Node | null): Binding | null {
  const locals = bindings.filter((held) => held.source === null);
  if (!clicked) return locals[0] ?? null;
  const scored = locals.map((held) => ({ held, depth: commonDepth(held.name, clicked) }));
  scored.sort((a, b) => b.depth - a.depth || a.held.name.startPosition.row - b.held.name.startPosition.row);
  return scored[0]?.held ?? null;
}

function commonDepth(a: Node, b: Node): number {
  const chain = rootChain(a);
  const shared = new Set(rootChain(b));
  let depth = 0;
  while (depth < chain.length && shared.has(chain[depth] ?? -1)) depth += 1;
  return depth;
}

function rootChain(node: Node): number[] {
  const ids: number[] = [];
  for (let held: Node | null = node; held; held = held.parent) ids.unshift(held.id);
  return ids;
}

async function followImport(binding: Binding, query: DefinitionQuery, files: ResolverFiles): Promise<Resolution> {
  const spec = binding.source ?? '';
  const target = await resolveModulePath(spec, query.path, query.ref, files);
  if (!target) return { sites: [], note: `imported from ${spec}` };
  const site = await siteInModule(binding, binding.original, target, query.ref, files, MAX_EXPORT_HOPS);
  if (site) return { sites: [site], note: null };
  return { sites: [], note: `no export named ${binding.original} found in ${target}` };
}

async function siteInModule(
  binding: Binding,
  word: string,
  path: string,
  ref: string,
  files: ResolverFiles,
  hops: number,
): Promise<DefinitionSite | null> {
  if (binding.kind === 'namespace') return { path, ref, nameLine: 1, startLine: 1, endLine: NAMESPACE_PREVIEW_LINES };
  if (binding.kind === 'default') return findDefaultExport(path, ref, files, hops);
  return findExported(word, path, ref, files, hops);
}

async function findExported(
  word: string,
  path: string,
  ref: string,
  files: ResolverFiles,
  hops: number,
): Promise<DefinitionSite | null> {
  if (hops <= 0) return null;
  const parsed = await files.parsed(ref, path);
  const found = parsed ? await exportedSite(parsed, word, path, ref, files, hops) : null;
  if (found !== null) return found;
  const text = await files.readFile(ref, path);
  return text === null ? null : scanText(text, path, ref, word)[0] ?? null;
}

async function exportedSite(
  parsed: ParsedFile,
  word: string,
  path: string,
  ref: string,
  files: ResolverFiles,
  hops: number,
): Promise<DefinitionSite | null> {
  if (hops <= 0) return null;
  const local = moduleBinding(parsed, word);
  if (local && local.source === null) return siteOf(local.name, path, ref);
  if (local?.source) return followBinding(local, path, ref, files, hops);
  const viaClause = await reExportedName(parsed, word, path, ref, files, hops);
  if (viaClause) return viaClause;
  return starExportedName(parsed.root, word, path, ref, files, hops);
}

function moduleBinding(parsed: ParsedFile, word: string): Binding | null {
  const bindings = [...parsed.bindings(word)];
  bindings.sort((a, b) => exportedRank(b.name) - exportedRank(a.name) || a.name.startPosition.row - b.name.startPosition.row);
  return bindings[0] ?? null;
}

function exportedRank(name: Node): number {
  return declarationOf(name).parent?.type === 'export_statement' ? 1 : 0;
}

async function followBinding(
  binding: Binding,
  path: string,
  ref: string,
  files: ResolverFiles,
  hops: number,
): Promise<DefinitionSite | null> {
  const target = await resolveModulePath(binding.source ?? '', path, ref, files);
  if (!target) return null;
  return siteInModule(binding, binding.original, target, ref, files, hops - 1);
}

async function reExportedName(
  parsed: ParsedFile,
  word: string,
  path: string,
  ref: string,
  files: ResolverFiles,
  hops: number,
): Promise<DefinitionSite | null> {
  for (const held of parsed.exportSpecifiers()) {
    if ((held.alias ?? held.original) !== word) continue;
    if (held.source === null) {
      if (held.original === word) continue;
      return exportedSite(parsed, held.original, path, ref, files, hops - 1);
    }
    const target = await resolveModulePath(held.source, path, ref, files);
    if (target) return findExported(held.original, target, ref, files, hops - 1);
  }
  return null;
}

interface ExportSpecifier {
  original: string;
  alias: string | null;
  source: string | null;
}

function exportSpecifiers(root: Node): ExportSpecifier[] {
  const found: ExportSpecifier[] = [];
  visit(root, (node) => {
    if (node.type !== 'export_specifier') return;
    const original = node.childForFieldName('name')?.text;
    if (!original) return;
    found.push({ original, alias: node.childForFieldName('alias')?.text ?? null, source: exportSourceOf(node) });
  });
  return found;
}

function exportSourceOf(node: Node): string | null {
  for (let held: Node | null = node; held; held = held.parent) {
    if (held.type !== 'export_statement') continue;
    const source = held.childForFieldName('source')?.text;
    return source ? unquote(source) : null;
  }
  return null;
}

async function starExportedName(
  root: Node,
  word: string,
  path: string,
  ref: string,
  files: ResolverFiles,
  hops: number,
): Promise<DefinitionSite | null> {
  for (const source of starExportSources(root)) {
    const target = await resolveModulePath(source, path, ref, files);
    const found = target ? await findExported(word, target, ref, files, hops - 1) : null;
    if (found) return found;
  }
  return null;
}

function starExportSources(root: Node): string[] {
  const sources: string[] = [];
  visit(root, (node) => {
    if (node.type !== 'export_statement' || !/^export\s+\*\s+from/.test(node.text)) return;
    const source = node.childForFieldName('source')?.text;
    if (source) sources.push(unquote(source));
  });
  return sources;
}

async function findDefaultExport(
  path: string,
  ref: string,
  files: ResolverFiles,
  hops: number,
): Promise<DefinitionSite | null> {
  if (hops <= 0) return null;
  const parsed = await files.parsed(ref, path);
  return parsed ? defaultExportSite(parsed.root, path, ref) : null;
}

function defaultExportSite(root: Node, path: string, ref: string): DefinitionSite | null {
  let found: DefinitionSite | null = null;
  visit(root, (node) => {
    if (found || node.type !== 'export_statement' || !/^export\s+default\b/.test(node.text)) return;
    const value = node.childForFieldName('declaration') ?? node.childForFieldName('value') ?? node;
    found = spanSite(value.childForFieldName('name') ?? value, node, path, ref);
  });
  return found;
}

function siteOf(name: Node, path: string, ref: string): DefinitionSite {
  return spanSite(name, declarationOf(name), path, ref);
}

function spanSite(name: Node, decl: Node, path: string, ref: string): DefinitionSite {
  return {
    path,
    ref,
    nameLine: name.startPosition.row + 1,
    startLine: startWithComments(decl),
    endLine: lastLineOf(decl) + 1,
  };
}

const CONTAINER = /program|source_file|statement_block|class_body|declaration_list|block|suite|body|compilation_unit|translation_unit/;

function declarationOf(name: Node): Node {
  let node = name;
  while (node.parent && !CONTAINER.test(node.parent.type)) node = node.parent;
  return node;
}

function startWithComments(decl: Node): number {
  let start = decl;
  for (let held = decl.previousNamedSibling; held; held = held.previousNamedSibling) {
    if (!held.type.includes('comment') || held.endPosition.row < start.startPosition.row - 1) break;
    start = held;
  }
  return start.startPosition.row + 1;
}

function nearestBinding(parsed: ParsedFile, word: string, site: DefinitionSite): DefinitionSite | null {
  const bindings = parsed.bindings(word).filter((held) => held.source === null);
  bindings.sort((a, b) => lineDistance(a, site) - lineDistance(b, site));
  const best = bindings[0];
  return best ? siteOf(best.name, site.path, site.ref) : null;
}

function lineDistance(binding: Binding, site: DefinitionSite): number {
  return Math.abs(binding.name.startPosition.row + 1 - site.nameLine);
}

const MODULE_SUFFIXES = ['', '.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs', '.d.ts', '/index.ts', '/index.tsx', '/index.js'];

async function resolveModulePath(spec: string, fromPath: string, ref: string, files: ResolverFiles): Promise<string | null> {
  const bases = spec.startsWith('.')
    ? [joinPath(dirOf(fromPath), spec)]
    : await aliasTargets(spec, ref, files);
  for (const base of withoutJsSuffix(bases)) {
    const found = await probeModule(base, ref, files);
    if (found) return found;
  }
  return null;
}

function withoutJsSuffix(bases: string[]): string[] {
  return bases.flatMap((base) => (/\.[cm]?jsx?$/.test(base) ? [base, base.replace(/\.[cm]?jsx?$/, '')] : [base]));
}

async function probeModule(base: string, ref: string, files: ResolverFiles): Promise<string | null> {
  for (const suffix of MODULE_SUFFIXES) {
    if (await files.hasFile(ref, base + suffix)) return base + suffix;
  }
  return null;
}

function dirOf(path: string): string {
  return path.split('/').slice(0, -1).join('/');
}

function joinPath(dir: string, spec: string): string {
  const kept: string[] = [];
  for (const part of [...dir.split('/'), ...spec.split('/')]) {
    if (part === '' || part === '.') continue;
    if (part === '..') kept.pop();
    else kept.push(part);
  }
  return kept.join('/');
}

async function aliasTargets(spec: string, ref: string, files: ResolverFiles): Promise<string[]> {
  const out: string[] = [];
  for (const [pattern, targets] of await tsconfigPaths(ref, files)) {
    const matched = matchAlias(pattern, spec);
    if (matched === null) continue;
    for (const target of targets) out.push(joinPath('', target.replace('*', matched)));
  }
  return out;
}

function matchAlias(pattern: string, spec: string): string | null {
  const star = pattern.indexOf('*');
  if (star === -1) return pattern === spec ? '' : null;
  const prefix = pattern.slice(0, star);
  const suffix = pattern.slice(star + 1);
  if (!spec.startsWith(prefix) || !spec.endsWith(suffix)) return null;
  return spec.slice(prefix.length, spec.length - suffix.length);
}

async function tsconfigPaths(ref: string, files: ResolverFiles): Promise<[string, string[]][]> {
  const text = await files.readFile(ref, 'tsconfig.json');
  if (text === null) return [];
  try {
    return pathsOf(JSON.parse(stripJsonc(text)) as TsconfigShape);
  } catch {
    return [];
  }
}

interface TsconfigShape {
  compilerOptions?: { baseUrl?: string; paths?: Record<string, string[]> };
}

function pathsOf(config: TsconfigShape): [string, string[]][] {
  const base = config.compilerOptions?.baseUrl ?? '.';
  const paths = config.compilerOptions?.paths ?? {};
  return Object.entries(paths).map(([pattern, targets]) => [
    pattern,
    targets.map((target) => joinPath('', `${base}/${target}`)),
  ]);
}

function stripJsonc(text: string): string {
  let out = '';
  for (let at = 0; at < text.length; at += 1) {
    const skipped = skipStringOrComment(text, at);
    out += skipped.kept;
    at = skipped.at;
  }
  return out.replace(/,\s*([}\]])/g, '$1');
}

function skipStringOrComment(text: string, at: number): { kept: string; at: number } {
  if (text[at] === '"') return skipString(text, at);
  if (text.startsWith('//', at)) return { kept: '', at: lineEnd(text, at) - 1 };
  if (text.startsWith('/*', at)) return { kept: '', at: blockCommentEnd(text, at) };
  return { kept: text[at] ?? '', at };
}

function skipString(text: string, at: number): { kept: string; at: number } {
  let end = at + 1;
  while (end < text.length && text[end] !== '"') end += text[end] === '\\' ? 2 : 1;
  return { kept: text.slice(at, end + 1), at: end };
}

function lineEnd(text: string, at: number): number {
  const newline = text.indexOf('\n', at);
  return newline === -1 ? text.length : newline;
}

function blockCommentEnd(text: string, at: number): number {
  const end = text.indexOf('*/', at + 2);
  return end === -1 ? text.length : end + 1;
}

const DECL_KEYWORD =
  '(?:function|class|interface|type|enum|const|let|var|def|fn|func|struct|trait|module|namespace)';

export function declarationPattern(word: string): RegExp {
  const name = word.replace(/\$/g, '\\$');
  const modifiers = '(?:(?:public|private|protected|static|abstract|override|async|readonly|export|get|set)\\s+)*';
  const memberish = `^\\s*${modifiers}${name}\\s*(?:=[^=]|:|\\([^)]*\\)[^;]*\\{)`;
  return new RegExp(`(?:\\b${DECL_KEYWORD}\\s+(?:mut\\s+)?${name}\\b|${memberish})`);
}

export function scanText(text: string, path: string, ref: string, word: string): DefinitionSite[] {
  const pattern = declarationPattern(word);
  const sites: DefinitionSite[] = [];
  const lines = text.split('\n');
  for (let at = 0; at < lines.length && sites.length < MAX_ROUGH_SITES; at += 1) {
    if (pattern.test(lines[at] ?? '')) sites.push(roughSite(path, ref, at + 1));
  }
  return sites;
}
