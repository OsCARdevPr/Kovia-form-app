import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'kovia-admin-theme';
const THEMES = {
  dark: 'dark',
  light: 'light',
};

function resolveTheme(rawTheme) {
  return rawTheme === 'light' ? 'light' : 'dark';
}

function getStoredTheme() {
  if (typeof window === 'undefined') {
    return 'dark';
  }

  return resolveTheme(String(window.localStorage.getItem(STORAGE_KEY) || '').toLowerCase());
}

function applyTheme(nextTheme) {
  if (typeof document === 'undefined') {
    return;
  }

  const resolvedTheme = resolveTheme(nextTheme);
  const root = document.documentElement;

  root.classList.remove(THEMES.dark, THEMES.light);
  root.classList.add(THEMES[resolvedTheme]);
  root.setAttribute('data-theme', resolvedTheme);
  root.style.colorScheme = resolvedTheme;
}

export function useThemeMode() {
  const [theme, setTheme] = useState(getStoredTheme);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const resolvedTheme = getStoredTheme();

    setTheme(resolvedTheme);
    applyTheme(resolvedTheme);
    setReady(true);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((currentTheme) => {
      const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';

      applyTheme(nextTheme);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(STORAGE_KEY, nextTheme);
      }

      return nextTheme;
    });
  }, []);

  return {
    theme,
    isDarkMode: theme === 'dark',
    ready,
    toggleTheme,
  };
}
