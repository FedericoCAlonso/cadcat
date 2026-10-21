import { useState, useEffect, useCallback } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'cadcat_theme';
const LEGACY_STORAGE_KEY = 'mobilius_theme';

/**
 * Custom hook to manage Light / Dark / System themes.
 * Adheres strictly to Material Design 3 and WCAG 2.1 AA accessibility guidelines.
 */
export function useTheme() {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => {
    if (typeof window === 'undefined') return 'system';
    const saved = (localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY)) as ThemeMode | null;
    if (saved === 'light' || saved === 'dark' || saved === 'system') {
      return saved;
    }
    return 'system';
  });

  const [systemIsDark, setSystemIsDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      setSystemIsDark(e.matches);
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    } else {
      mediaQuery.addListener(handler);
      return () => mediaQuery.removeListener(handler);
    }
  }, []);

  const effectiveTheme: 'light' | 'dark' =
    themeMode === 'system' ? (systemIsDark ? 'dark' : 'light') : themeMode;

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.setAttribute('data-theme', effectiveTheme);
    // Also update meta theme-color to match icon and surfaces
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', effectiveTheme === 'dark' ? '#141815' : '#F6F3EC');
    }
  }, [effectiveTheme]);

  const setThemeMode = useCallback((mode: ThemeMode) => {
    setThemeModeState(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, mode);
    }
  }, []);

  const toggleTheme = useCallback(() => {
    // Convenience toggle between light and dark
    const next: ThemeMode = effectiveTheme === 'dark' ? 'light' : 'dark';
    setThemeMode(next);
  }, [effectiveTheme, setThemeMode]);

  return {
    themeMode,
    effectiveTheme,
    setThemeMode,
    toggleTheme,
  };
}
