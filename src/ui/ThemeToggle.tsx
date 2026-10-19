import { type ReactElement } from 'react';
import type { ThemeMode } from './useTheme';

export interface ThemeToggleProps {
  themeMode: ThemeMode;
  effectiveTheme: 'light' | 'dark';
  onThemeChange: (mode: ThemeMode) => void;
}

/**
 * Material Design 3 Theme Toggle Segmented Control.
 * Allows effortless switching between Light, Dark, and System Auto modes.
 */
export function ThemeToggle({
  themeMode,
  effectiveTheme,
  onThemeChange,
}: ThemeToggleProps): ReactElement {
  return (
    <div
      role="group"
      aria-label="Selector de tema visual"
      className="m3-segmented-button theme-toggle-group"
    >
      <button
        type="button"
        className={`m3-segmented-button__item ${themeMode === 'light' ? 'active' : ''}`}
        onClick={() => onThemeChange('light')}
        aria-pressed={themeMode === 'light'}
        title="Modo Claro"
      >
        <span aria-hidden="true">☀️</span>
        <span className="theme-toggle-label">Claro</span>
      </button>

      <button
        type="button"
        className={`m3-segmented-button__item ${themeMode === 'dark' ? 'active' : ''}`}
        onClick={() => onThemeChange('dark')}
        aria-pressed={themeMode === 'dark'}
        title="Modo Oscuro"
      >
        <span aria-hidden="true">🌙</span>
        <span className="theme-toggle-label">Oscuro</span>
      </button>

      <button
        type="button"
        className={`m3-segmented-button__item ${themeMode === 'system' ? 'active' : ''}`}
        onClick={() => onThemeChange('system')}
        aria-pressed={themeMode === 'system'}
        title={`Automático (del sistema: ${effectiveTheme === 'dark' ? 'oscuro' : 'claro'})`}
      >
        <span aria-hidden="true">💻</span>
        <span className="theme-toggle-label">Auto</span>
      </button>
    </div>
  );
}
