import { Marked, type Tokens } from 'marked';
import { safeUrl, sanitizeHtml, type UrlBases } from './sanitizeHtml';

export interface RepoRef {
  owner: string;
  repo: string;
}

export interface MarkdownFile {
  ref: string;
  path: string;
}

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };

function escapeHtml(text: string): string {
  return text.replace(/[&<>"]/g, (character) => ESCAPES[character] ?? character);
}

function urlBases({ owner, repo }: RepoRef, location: string): UrlBases {
  return {
    href: `https://github.com/${owner}/${repo}/blob/${location}`,
    src: `https://github.com/${owner}/${repo}/raw/${location}`,
  };
}

function fileLocation({ ref, path }: MarkdownFile): string {
  return `${ref}/${path}`.split('/').map(encodeURIComponent).join('/');
}

function hovercardAttribute(title: string | null | undefined): string {
  return title ? ` data-hovercard="${escapeHtml(title)}"` : '';
}

function renderLink(href: string | null, title: string | null | undefined, inner: string): string {
  if (!href) return inner;
  return `<a href="${escapeHtml(href)}"${hovercardAttribute(title)} target="_blank" rel="noopener noreferrer">${inner}</a>`;
}

function renderImage(src: string | null, title: string | null | undefined, alt: string): string {
  if (!src) return escapeHtml(alt);
  return `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}"${hovercardAttribute(title)} loading="lazy" />`;
}

function createMarked(bases: UrlBases, breaks: boolean): Marked {
  const marked = new Marked({ gfm: true, breaks });
  marked.use({
    renderer: {
      html: ({ text }: Tokens.HTML | Tokens.Tag) => sanitizeHtml(text, bases),
      link(token: Tokens.Link) {
        return renderLink(safeUrl(token.href, bases.href), token.title, this.parser.parseInline(token.tokens));
      },
      image: (token: Tokens.Image) => renderImage(safeUrl(token.href, bases.src), token.title, token.text),
    },
  });
  return marked;
}

const markedByRepo = new Map<string, Marked>();

function markedFor(repo: RepoRef): Marked {
  const key = `${repo.owner}/${repo.repo}`;
  const existing = markedByRepo.get(key) ?? createMarked(urlBases(repo, 'HEAD/'), true);
  markedByRepo.set(key, existing);
  return existing;
}

export function renderMarkdown(body: string, repo: RepoRef): string {
  return markedFor(repo).parse(body, { async: false });
}

// Files are often hard-wrapped, so unlike comments their newlines are not line breaks.
export function renderMarkdownFile(text: string, repo: RepoRef, file: MarkdownFile): string {
  return createMarked(urlBases(repo, fileLocation(file)), false).parse(text, { async: false });
}
