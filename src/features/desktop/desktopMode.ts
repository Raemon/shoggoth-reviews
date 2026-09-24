// Set only by desktop/server.mjs, which also refuses requests lacking its per-launch secret.
export function desktopMode(): boolean {
  return process.env.REPOSCOPE_DESKTOP === '1';
}
