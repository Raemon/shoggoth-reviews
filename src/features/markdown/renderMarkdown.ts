import { Marked, type Tokens } from 'marked';
import { safeUrl, sanitizeHtml, type UrlBase, type UrlBases } from './sanitizeHtml';
import { encodePath } from '@/features/codebases/repoPaths';
import { isLocalRepo } from '@/features/local-git/localRefs';

export interface RepoRef {
  owner: string;
  repo: string;
}

const GITHUB = 'https://github.com';

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };

function escapeHtml(text: string): string {
  return text.replace(/[&<>"]/g, (character) => ESCAPES[character] ?? character);
}

// An empty path means a comment, where GitHub reads a leading slash as the site root.
function urlBases({ owner, repo }: RepoRef, ref: string, path: string): UrlBases {
  if (isLocalRepo(owner)) return {};
  const at = (view: string): UrlBase => {
    const tree = `${GITHUB}/${owner}/${repo}/${view}/${encodePath(ref)}/`;
    return { file: tree + encodePath(path), root: path ? tree : `${GITHUB}/` };
  };
  return { href: at('blob'), src: at('raw') };
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

function createMarked(bases: UrlBases, options: { breaks: boolean }): Marked {
  const marked = new Marked({ gfm: true, ...options });
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
  const existing = markedByRepo.get(key) ?? createMarked(urlBases(repo, 'HEAD', ''), { breaks: true });
  markedByRepo.set(key, existing);
  return existing;
}

export function renderMarkdown(body: string, repo: RepoRef): string {
  return markedFor(repo).parse(body, { async: false });
}

// Files are often hard-wrapped, so unlike comments their newlines are not line breaks.
export function renderMarkdownFile(text: string, repo: RepoRef, ref: string, path: string): string {
  return createMarked(urlBases(repo, ref, path), { breaks: false }).parse(text, { async: false });
}
