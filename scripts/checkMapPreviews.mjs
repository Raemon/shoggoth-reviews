import './codeMapTestLoader.mjs';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { Readable } from 'node:stream';
const { foldedCodePreview } = await import('../src/features/codebase-map/foldedCodePreview.ts');
const { deriveMapPreviews, previewPage, encodePreviewIndex } = await import('../src/features/codebase-map/mapPreviewArchive.ts');
const { countTarballLines } = await import('../src/features/pull-requests/tarLineCounter.ts');

const typescript = [
  'export async function load(', '  name: string,', '  count: number,', ') {',
  '  const result = count + 1;', '  return result;', '}', '',
  'export class Service {', '  run() {', '    first();', '    second();', '  }',
  '  stop() {', '    first();', '    second();', '  }', '}',
].join('\n');
const ts = foldedCodePreview('service.ts', typescript);
assert.deepEqual(ts.lineNumbers, [1, 9, 10, 14, 18]);
assert.match(ts.lines[0], /load\(.*\[6 lines\]/);
assert.match(ts.lines[2], /run\(\).*\[3 lines\]/);
assert(!ts.lines.some((line) => line.includes('first()')));
assert.equal(ts.lineCount, 18);
assert.equal(ts.truncated, false);

for (const [path, source, names] of [
  ['widget.rs', 'impl Widget {\n  pub fn show(&self) {\n    first();\n    second();\n  }\n  pub fn hide(&self) {\n    first();\n    second();\n  }\n}\n', ['impl Widget', 'fn show', 'fn hide']],
  ['widget.py', 'class Widget:\n    def show(self):\n        first()\n        second()\n\n    def hide(self):\n        first()\n        second()\n', ['class Widget', 'def show', 'def hide']],
]) {
  const preview = foldedCodePreview(path, source);
  for (const name of names) assert(preview.lines.some((line) => line.includes(name)), name);
  assert(!preview.lines.some((line) => line.includes('first()')));
  assert.equal(preview.truncated, false);
}
const allman = foldedCodePreview('Service.cs', 'public class Service\n{\n  public void Run()\n  {\n    First();\n    Second();\n  }\n  public void Stop()\n  {\n    First();\n    Second();\n  }\n}');
assert(allman.lines.some((line) => line.includes('Run()')));
assert(allman.lines.some((line) => line.includes('Stop()')));
assert(!allman.lines.some((line) => line.includes('First()')));
const genericImpl = foldedCodePreview('widget.rs', 'impl<T> Widget<T>\nwhere\n  T: Display,\n{\n  pub fn show(&self) {\n    first();\n    second();\n  }\n  pub fn hide(&self) {\n    first();\n    second();\n  }\n}');
assert(genericImpl.lines.some((line) => line.includes('fn show')));
assert(genericImpl.lines.some((line) => line.includes('fn hide')));
const nested = foldedCodePreview('deep.ts', '{\n'.repeat(50_000) + '}\n'.repeat(50_000));
assert(nested.truncated);
assert(nested.lines.length <= 120);
const minified = foldedCodePreview('min.js', 'x'.repeat(512_000), 1, true);
assert(minified.truncated);
assert(minified.lines[0].endsWith('…'));
assert.deepEqual(foldedCodePreview('empty.ts', '').lines, []);
const long = foldedCodePreview('long.txt', 'readable\n'.repeat(150));
assert.equal(long.lines.length, 120);
assert.equal(long.truncated, true);
const prefix = foldedCodePreview('prefix.ts', 'complete\npartial', 1000, true);
assert.deepEqual(prefix.lines, ['complete']);
assert.equal(prefix.lineCount, 1000);
assert.equal(prefix.truncated, true);

function tarEntry(path, content, flag = '0') {
  const data = Buffer.from(content);
  const header = Buffer.alloc(512);
  header.write(path, 0, 100);
  header.write(`${data.length.toString(8).padStart(11, '0')}\0`, 124, 12);
  header.write(flag, 156, 1);
  return Buffer.concat([header, data, Buffer.alloc((512 - data.length % 512) % 512)]);
}
function compressedStream(entries, chunkSize = 29) {
  const compressed = gzipSync(Buffer.concat([...entries, Buffer.alloc(1024)]));
  const chunks = [];
  for (let at = 0; at < compressed.length; at += chunkSize) chunks.push(compressed.subarray(at, at + chunkSize));
  return Readable.toWeb(Readable.from(chunks));
}
const longPath = 'root/src/' + 'long-directory/'.repeat(10) + 'service.ts';
const entries = [
  tarEntry('root/service.ts', typescript),
  tarEntry('root/empty.ts', ''),
  tarEntry('root/data.bin', Buffer.from([0, 1, 2, 3])),
  tarEntry('root/image.png', 'an asset even without a NUL byte'),
  tarEntry('root/link', '', '2'),
  tarEntry('root/metadata', `180 path=${longPath}\n`, 'x'),
  tarEntry('root/placeholder', 'export const value = 1;\n'),
  tarEntry('root/large.txt', 'long line\n'.repeat(60_000)),
];
const index = await deriveMapPreviews(compressedStream(entries));
const decoded = previewPage(index, 0).files;
assert.deepEqual(Object.keys(decoded), ['service.ts', 'empty.ts', longPath.slice(5), 'large.txt']);
assert.deepEqual(decoded['service.ts'], ts);
assert.equal(decoded['large.txt'].lineCount, 60_000);
assert.equal(decoded['large.txt'].truncated, true);
assert.equal(previewPage(index, 0).tooLarge, false);
assert(index.length < 7_000_000);
const counts = await countTarballLines(compressedStream(entries, 7));
assert.equal(counts.lines['service.ts'], 18);
assert.equal(counts.lines['large.txt'], 60_000);
assert.equal(counts.lines['empty.ts'], 0);
assert(!('data.bin' in counts.lines));
assert(!('link' in counts.lines));
await assert.rejects(deriveMapPreviews(null), /empty/);
await assert.rejects(deriveMapPreviews(Readable.toWeb(Readable.from([Buffer.from('not gzip')]))));
const failedStream = new ReadableStream({ start(controller) { controller.error(new Error('download failed')); } });
await assert.rejects(deriveMapPreviews(failedStream), /download failed/);

const many = { files: {}, tooLarge: true };
for (let i = 0; i < 3000; i++) many.files[`folder/file${i}.ts`] = { lines: ['x'.repeat(180)].flatMap((line) => Array(10).fill(line)) };
const encodedMany = encodePreviewIndex(many);
let cursor = 0;
let pages = 0;
const seen = new Set();
while (cursor !== null) {
  const page = previewPage(encodedMany, cursor);
  assert(Buffer.byteLength(JSON.stringify(page)) < 800_000);
  assert.equal(page.total, 3000);
  assert.equal(page.tooLarge, true);
  for (const path of Object.keys(page.files)) { assert(!seen.has(path)); seen.add(path); }
  assert(page.next === null || page.next > cursor);
  cursor = page.next;
  pages++;
}
assert.equal(seen.size, 3000);
assert(pages > 1);
assert.equal(previewPage(encodedMany, 3000).next, null);
console.log(`Map preview checks passed: folding, archive streaming, binary/empty/large files, download errors, ${pages} bounded pages.`);
