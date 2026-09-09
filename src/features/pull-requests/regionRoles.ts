import type { FoldDialect } from './foldDialects';

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

const FUNCTION_KINDS = new Set([
  'function_declaration', 'function_definition', 'function_expression', 'generator_function_declaration', 'arrow_function',
  'method_definition', 'method_declaration', 'constructor_declaration', 'abstract_method_signature', 'method', 'singleton_method',
  'class_declaration', 'class_definition', 'class_specifier', 'class', 'module', 'impl_item', 'function_item',
  'func_literal', 'lambda_expression', 'closure_expression', 'local_function_statement',
]);

const FUNCTION_MODIFIER = /(export|default|async|static|public|private|protected|internal|override|final|abstract|unsafe|pub(\([^)]*\))?|extern|virtual|inline)\s+/;
const FUNCTION_KEYWORD = /(function\*?|class|def|fn|func|sub|proc|impl|defp|defmodule)\s/;
const FUNCTION_ANCHOR = new RegExp(`^\\s*(${FUNCTION_MODIFIER.source})*${FUNCTION_KEYWORD.source}`);
const ARROW_ANCHOR = /^\s*(export\s+)?(const|let|var)\s+\w+\s*(:[^=]*)?=\s*(async\s*)?(\([^)]*\)|\w+)\s*(:[^=]*)?=>/;

export function functionLikeSpan(kind: string, anchorText: string): boolean {
  return FUNCTION_KINDS.has(kind) || FUNCTION_ANCHOR.test(anchorText) || ARROW_ANCHOR.test(anchorText);
}

export function commentSpan(kind: string): boolean {
  return /comment/.test(kind);
}

export function commentLine(text: string, dialect: FoldDialect): boolean {
  const line = text.trim();
  if (!dialect.tokens || dialect.markdown) return line.startsWith('<!--');
  if (dialect.slashComments && /^(\/\/|\/\*|\*\/)/.test(line)) return true;
  if (dialect.hashComments && !dialect.preprocessor && line.startsWith('#')) return true;
  if (dialect.dashComments && line.startsWith('--')) return true;
  return dialect.markup && /^(<!--|-->|\{\/\*)/.test(line);
}
