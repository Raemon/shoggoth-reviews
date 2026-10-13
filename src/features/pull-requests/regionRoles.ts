import type { FoldTag } from './foldModel';

const TYPE_KINDS = new Set([
  'interface_declaration', 'type_alias_declaration', 'enum_declaration', 'object_type', 'enum_body', 'annotation_type_declaration',
  'struct_item', 'enum_item', 'trait_item', 'type_item', 'union_item', 'trait_declaration',
  'type_declaration', 'type_spec', 'struct_type', 'interface_type',
  'struct_specifier', 'enum_specifier', 'union_specifier', 'type_definition',
  'record_declaration', 'record_struct_declaration',
]);

const TYPE_MODIFIER = /(export|default|declare|pub(\([^)]*\))?|public|internal|private|protected|sealed|readonly|partial|typedef|abstract)\s+/;
const TYPE_KEYWORD = /@?(interface|type|enum|struct|trait|union|record|protocol)\b(?!\s*[:=.,;(\[])/;
const TYPE_ANCHOR = new RegExp(`^\\s*(${TYPE_MODIFIER.source})*${TYPE_KEYWORD.source}`);
const PYTHON_TYPE_CLASS = /^\s*class\s+\w+\s*\([^)]*\b(TypedDict|Protocol|NamedTuple|Enum|IntEnum|StrEnum|Flag|IntFlag|BaseModel)\b/;

export function typeLikeSpan(kind: string, anchorText: string): boolean {
  return TYPE_KINDS.has(kind) || TYPE_ANCHOR.test(anchorText) || PYTHON_TYPE_CLASS.test(anchorText);
}

export function commentSpan(kind: string): boolean {
  return /comment/.test(kind);
}

export function foldTags(kind: string, handleText: string): FoldTag[] {
  const tags: FoldTag[] = [];
  if (kind === 'imports') tags.push('imports');
  if (commentSpan(kind)) tags.push('comment');
  if (typeLikeSpan(kind, handleText)) tags.push('type');
  return tags;
}
