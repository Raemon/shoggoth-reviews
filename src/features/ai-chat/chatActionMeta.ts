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
  return TOOL_MATCH.find(([, parts]) => parts.some((part) => key.includes(part)))?.[0] ?? 'tool';
}

export function toolSummary(name: string, detail: string): string {
  const kind = kindForTool(name);
  if (kind === 'image') return detail === '' ? 'Viewed an image' : `Viewed ${detail}`;
  const prefix = TOOL_PREFIX[kind];
  if (prefix === '') return [name, detail].filter(Boolean).join(' ');
  return `${prefix} ${detail || name}`;
}

export function thinkingSummary(text: string): string {
  const preview = text.trim().split('\n')[0] ?? '';
  return preview === '' ? 'Thinking' : `Thinking ${preview}`;
}
