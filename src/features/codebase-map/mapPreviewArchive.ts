import { deflateSync, inflateSync } from 'node:zlib';
import { countTarballLines, type TarTextFile } from '../pull-requests/tarLineCounter';
import { foldedCodePreview } from './foldedCodePreview';
import { isMapAsset } from './mapFiles';
import type { CodePreview, MapPreviewPage } from './mapPreviewTypes';

interface PreviewIndex { files: Record<string, CodePreview>; tooLarge: boolean }
interface IndexBuilder { index: PreviewIndex; bytes: number }
interface PageBuilder { files: Record<string, CodePreview>; next: number; bytes: number }
const MAX_INDEX_BYTES = 24 * 1024 * 1024;
const MAX_CACHE_CHARS = 7_000_000;
const PAGE_BYTES = 768 * 1024;

export async function deriveMapPreviews(body: ReadableStream<Uint8Array> | null): Promise<string> {
  if (!body) throw new Error('The repository archive was empty.');
  const builder: IndexBuilder = { index: { files: Object.create(null), tooLarge: false }, bytes: 0 };
  const counts = await countTarballLines(body, (file) => addPreview(builder, file));
  builder.index.tooLarge ||= counts.tooLarge;
  return encodePreviewIndex(builder.index);
}

function addPreview(builder: IndexBuilder, file: TarTextFile): void {
  if (isMapAsset(file.path) || builder.index.tooLarge) return;
  const preview = foldedCodePreview(file.path, file.text, file.lines, file.truncated);
  builder.bytes += entryBytes(file.path, preview);
  if (builder.bytes > MAX_INDEX_BYTES) builder.index.tooLarge = true;
  else builder.index.files[file.path] = preview;
}

export function encodePreviewIndex(index: PreviewIndex): string {
  const encoded = deflateSync(JSON.stringify(index)).toString('base64');
  if (encoded.length <= MAX_CACHE_CHARS) return encoded;
  const entries = Object.entries(index.files);
  const files = Object.fromEntries(entries.slice(0, Math.floor(entries.length * 0.75)));
  return encodePreviewIndex({ files, tooLarge: true });
}

function decodePreviewIndex(encoded: string): PreviewIndex {
  return JSON.parse(inflateSync(Buffer.from(encoded, 'base64')).toString('utf8')) as PreviewIndex;
}

export function previewPage(encoded: string, cursor: number): MapPreviewPage {
  const index = decodePreviewIndex(encoded);
  const entries = Object.entries(index.files);
  const page: PageBuilder = { files: Object.create(null), next: cursor, bytes: 0 };
  while (page.next < entries.length && page.bytes < PAGE_BYTES) addPageEntry(page, entries[page.next++]!);
  return { files: page.files, next: page.next < entries.length ? page.next : null, total: entries.length, tooLarge: index.tooLarge };
}

function addPageEntry(page: PageBuilder, [path, preview]: [string, CodePreview]): void {
  page.files[path] = preview;
  page.bytes += entryBytes(path, preview);
}

function entryBytes(path: string, preview: CodePreview): number {
  return Buffer.byteLength(JSON.stringify([path, preview]), 'utf8');
}
