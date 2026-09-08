const MAX_CHARS = 240;

export function commentPreview(body: string): string {
  const text = collapseSpace(stripInlineMarkup(stripBlockMarkup(body)));
  return text.length > MAX_CHARS ? `${text.slice(0, MAX_CHARS)}…` : text;
}

function stripBlockMarkup(body: string): string {
  return body
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/^\s*(?:[-*+]\s+|#{1,6}\s+|>\s?)/gm, ' ')
    .replace(/^\s*\[[ xX]\]\s*/gm, ' ');
}

// Emphasis is stripped only at word edges: a review comment is mostly snake_case and paths.
function stripInlineMarkup(body: string): string {
  return body
    .replace(/`+([^`\n]+)`+/g, '$1')
    .replace(/!?\[([^\]\n]{0,300})\]\([^)\n]{0,300}\)/g, '$1')
    .replace(/(?<![\w`])(\*\*|__|\*|_|~~)(?=\S)([\s\S]{0,300}?\S)\1(?!\w)/g, '$2');
}

function collapseSpace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}
