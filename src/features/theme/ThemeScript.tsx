import { LEGACY_THEME_KEY, SETTINGS_COOKIE } from '@/features/settings/settings';

// Mirrors settingsStore's reads; runs before first paint, before the bundle loads.
const applySavedTheme = `(() => {
  try {
    const prefix = ${JSON.stringify(`${SETTINGS_COOKIE}=`)};
    const cookie = document.cookie.split('; ').find((part) => part.startsWith(prefix));
    const desktop = window.reposcopeDesktop;
    const saved = desktop ? desktop.settings : cookie && JSON.parse(decodeURIComponent(cookie.slice(prefix.length)));
    const theme = (saved && saved.theme) || localStorage.getItem(${JSON.stringify(LEGACY_THEME_KEY)});
    if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme;
  } catch {}
})()`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: applySavedTheme }} />;
}
