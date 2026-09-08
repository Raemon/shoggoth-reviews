export type ActionKind =
  | 'thinking'
  | 'notice'
  | 'error'
  | 'shell'
  | 'read'
  | 'edit'
  | 'search'
  | 'web'
  | 'image'
  | 'delete'
  | 'tool';

const TOOL_MATCH: [ActionKind, string[]][] = [
  ['shell', ['shell', 'terminal', 'bash', 'cmd']],
  ['image', ['image', 'screenshot']],
  ['delete', ['delete', 'unlink']],
  ['edit', ['edit', 'write', 'strreplace', 'searchreplace', 'applypatch']],
  ['search', ['grep', 'glob', 'search']],
  ['web', ['web', 'fetch', 'http']],
  ['read', ['read', 'view']],
];

const TOOL_PREFIX: Record<ActionKind, string> = {
  thinking: 'Thinking',
  notice: '',
  error: '',
  shell: 'Ran',
  read: 'Read',
  edit: 'Edited',
  search: 'Searched',
  web: 'Fetched',
  image: 'Viewed',
  delete: 'Deleted',
  tool: '',
};

export function kindForTool(name: string): ActionKind {
  const key = name.toLowerCase().replace(/[_-]/g, '');
  return TOOL_MATCH.find(([, parts]) => keyIncludesAny(key, parts))?.[0] ?? 'tool';
}

export function toolSummary(kind: ActionKind, name: string, detail: string): string {
  if (kind === 'image') return detail === '' ? `${TOOL_PREFIX.image} an image` : `${TOOL_PREFIX.image} ${detail}`;
  const prefix = TOOL_PREFIX[kind];
  if (prefix === '') return [name, detail].filter(Boolean).join(' ');
  return `${prefix} ${detail || name}`;
}

export function thinkingSummary(text: string): string {
  const preview = text.trim().split('\n')[0] ?? '';
  return preview === '' ? TOOL_PREFIX.thinking : `${TOOL_PREFIX.thinking} ${preview}`;
}

function keyIncludesAny(key: string, parts: string[]): boolean {
  return parts.some((part) => key.includes(part));
}
