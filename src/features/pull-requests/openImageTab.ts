const REVOKE_DELAY_MS = 60_000;
const SVG_CSP = "default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'";
const SVG_STYLE = 'html,body{height:100%;margin:0}body{display:grid;place-items:center;background:#111}img{max-width:100%;max-height:100%}';

export function openImageTab(dataUrl: string) {
  const url = URL.createObjectURL(imageTabBlob(dataUrl));
  window.open(url, '_blank', 'noopener,noreferrer');
  window.setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS);
}

export function imageTabBlob(dataUrl: string): Blob {
  const [header = '', base64 = ''] = dataUrl.split(',', 2);
  const type = header.slice('data:'.length).replace(';base64', '');
  if (type === 'image/svg+xml') return svgViewer(dataUrl);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type });
}

function svgViewer(dataUrl: string): Blob {
  const source = escapeAttribute(dataUrl);
  const html = `<!doctype html><meta http-equiv="Content-Security-Policy" content="${SVG_CSP}"><style>${SVG_STYLE}</style><img src="${source}" alt="SVG preview">`;
  return new Blob([html], { type: 'text/html' });
}

function escapeAttribute(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
