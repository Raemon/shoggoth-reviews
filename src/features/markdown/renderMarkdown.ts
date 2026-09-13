import { Marked, type Tokens } from 'marked';
import { safeUrl, sanitizeHtml, type UrlBases } from './sanitizeHtml';
import { githubUrlRoute } from '@/features/codebases/githubUrlRoutes';

export interface RepoRef {
  owner: string;
  repo: string;
}

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };

function escapeHtml(text: string): string {
  return text.replace(/[&<>"]/g, (character) => ESCAPES[character] ?? character);
}

function urlBases({ owner, repo }: RepoRef): UrlBases {
  return {
    href: `https://github.com/${owner}/${repo}/blob/HEAD/`,
    src: `https://github.com/${owner}/${repo}/raw/HEAD/`,
  };
}

function hovercardAttribute(title: string | null | undefined): string {
  return title ? ` data-hovercard="${escapeHtml(title)}"` : '';
}

function renderLink(href: string | null, title: string | null | undefined, inner: string): string {
  if (!href) return inner;
  const onSite = githubUrlRoute(href);
  const offSite = onSite === null ? ' target="_blank" rel="noopener noreferrer"' : '';
  return `<a href="${escapeHtml(onSite ?? href)}"${hovercardAttribute(title)}${offSite}>${inner}</a>`;
}

function renderImage(src: string | null, title: string | null | undefined, alt: string): string {
  if (!src) return escapeHtml(alt);
  return `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}"${hovercardAttribute(title)} loading="lazy" />`;
}

function createMarked(repo: RepoRef): Marked {
  const bases = urlBases(repo);
  const marked = new Marked({ gfm: true, breaks: true });
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
  const existing = markedByRepo.get(key) ?? createMarked(repo);
  markedByRepo.set(key, existing);
  return existing;
}

export function renderMarkdown(body: string, repo: RepoRef): string {
  return markedFor(repo).parse(body, { async: false });
}
