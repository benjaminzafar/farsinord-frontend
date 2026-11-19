export const THEME_STORAGE_KEY = 'linksho_theme';

export function resolveInitialTheme({ savedTheme, prefersDark } = {}) {
  if (savedTheme === 'dark' || savedTheme === 'light') {
    return savedTheme;
  }
  return prefersDark ? 'dark' : 'light';
}

export function getInitialTheme() {
  if (typeof window === 'undefined') return 'light';
  let savedTheme = null;
  let prefersDark = false;
  try {
    savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  } catch {}
  try {
    prefersDark = Boolean(window.matchMedia?.('(prefers-color-scheme: dark)')?.matches);
  } catch {}
  return resolveInitialTheme({ savedTheme, prefersDark });
}

export function applyThemeToDocument(theme) {
  if (typeof document === 'undefined') return;
  const resolved = theme === 'dark' ? 'dark' : 'light';
  const root = document.documentElement;

  if (resolved === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
  root.style.colorScheme = resolved;

  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta) {
    themeMeta.setAttribute('content', resolved === 'dark' ? '#14171F' : '#F8F9FB');
  }

  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, resolved);
  } catch {}
}
