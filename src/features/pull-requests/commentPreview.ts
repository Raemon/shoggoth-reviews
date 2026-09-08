const MAX_CHARS = 240;

export function commentPreview(body: string): string {
  const text = plainText(body);
  return text.length > MAX_CHARS ? `${text.slice(0, MAX_CHARS)}…` : text;
}

function plainText(body: string): string {
  return body
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s*[>#\-*+]+\s*/gm, ' ')
    .replace(/[`*_~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
