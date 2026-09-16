const VOID_TAGS = new Set(['br', 'hr', 'img', 'source', 'input']);
const URL_ATTRIBUTES = new Set(['href', 'src', 'srcset']);
const SAFE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);
const DROPPED_ELEMENTS = /<(script|style|iframe|object|embed|form)\b[\s\S]*?(?:<\/\1\s*>|$)/gi;
const COMMENT = /<!--[\s\S]*?(?:-->|$)/g;
const TAG = /<\/?([A-Za-z][\w-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)\/?>/g;
const ATTRIBUTE = /([\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;

const SHARED_ATTRIBUTES = ['align', 'title'];
const ALLOWED_TAGS = new Map<string, string[]>([
  ['a', ['href', 'rel']],
  ['img', ['src', 'alt', 'width', 'height']],
  ['source', ['srcset', 'media', 'type']],
  ['th', ['colspan', 'rowspan']],
  ['td', ['colspan', 'rowspan']],
  ...['p', 'div', 'span', 'br', 'hr', 'blockquote', 'pre', 'code', 'kbd', 'samp'].map(plain),
  ...['b', 'strong', 'i', 'em', 'u', 's', 'del', 'ins', 'mark', 'sub', 'sup', 'small'].map(plain),
  ...['ul', 'ol', 'li', 'dl', 'dt', 'dd', 'details', 'summary', 'picture'].map(plain),
  ...['table', 'thead', 'tbody', 'tfoot', 'tr', 'caption'].map(plain),
  ...['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].map(plain),
]);

function plain(tag: string): [string, string[]] {
  return [tag, []];
}

export interface UrlBases {
  href: string;
  src: string;
}

export function safeUrl(href: string, base: string): string | null {
  return urlWithProtocol(href, SAFE_PROTOCOLS, base);
}

export function urlWithProtocol(href: string, allowed: Set<string>, base?: string): string | null {
  try {
    const url = new URL(href.trim(), base);
    return allowed.has(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

export function sanitizeHtml(html: string, bases: UrlBases): string {
  return html.replace(COMMENT, '').replace(DROPPED_ELEMENTS, '').replace(TAG, (tag, rawName: string, rawAttributes: string) => {
    const name = rawName.toLowerCase();
    const allowed = ALLOWED_TAGS.get(name);
    if (!allowed) return '';
    return tag.startsWith('</') ? `</${name}>` : openTag(name, rawAttributes, allowed, bases);
  });
}

function openTag(name: string, rawAttributes: string, allowed: string[], bases: UrlBases): string {
  const kept = keptAttributes(rawAttributes, [...allowed, ...SHARED_ATTRIBUTES], bases);
  return `<${name}${kept}${VOID_TAGS.has(name) ? ' /' : ''}>`;
}

function keptAttributes(rawAttributes: string, allowed: string[], bases: UrlBases): string {
  const kept: string[] = [];
  for (const [, rawName, quoted, single, bare] of rawAttributes.matchAll(ATTRIBUTE)) {
    const name = rawName?.toLowerCase() ?? '';
    if (!allowed.includes(name)) continue;
    const value = attributeValue(name, quoted ?? single ?? bare ?? '', bases);
    const outputName = name === 'title' ? 'data-hovercard' : name;
    if (value !== null) kept.push(` ${outputName}="${value}"`);
  }
  return kept.join('');
}

function attributeValue(name: string, value: string, bases: UrlBases): string | null {
  if (!URL_ATTRIBUTES.has(name)) return escapeAttribute(value);
  const base = name === 'href' ? bases.href : bases.src;
  const resolved = name === 'srcset' ? safeSrcset(value, base) : safeUrl(value, base);
  return resolved === null ? null : escapeAttribute(resolved);
}

function safeSrcset(value: string, base: string): string | null {
  const candidates = value.split(',').map((candidate) => safeCandidate(candidate.trim(), base));
  return candidates.every((candidate) => candidate !== null) ? candidates.join(', ') : null;
}

function safeCandidate(candidate: string, base: string): string | null {
  const [url, ...descriptor] = candidate.split(/\s+/);
  const resolved = url ? safeUrl(url, base) : null;
  return resolved && [resolved, ...descriptor].join(' ');
}

function escapeAttribute(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
}
