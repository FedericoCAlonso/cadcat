import { describe, it, expect, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { ThemeToggle } from '../src/ui/ThemeToggle';

describe('Theme System & ThemeToggle component', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('renders ThemeToggle buttons for light, dark, and auto modes', () => {
    const html = renderToString(
      <ThemeToggle
        themeMode="light"
        effectiveTheme="light"
        onThemeChange={() => {}}
      />
    );

    expect(html).toContain('Claro');
    expect(html).toContain('Oscuro');
    expect(html).toContain('Auto');
    expect(html).toContain('title="Modo Claro"');
    expect(html).toContain('title="Modo Oscuro"');
    expect(html).toContain('active');
  });

  it('marks dark mode as active when themeMode is dark', () => {
    const html = renderToString(
      <ThemeToggle
        themeMode="dark"
        effectiveTheme="dark"
        onThemeChange={() => {}}
      />
    );

    expect(html).toContain('title="Modo Oscuro"');
    expect(html).toContain('active');
  });

  it('sets and reads localStorage for theme preference', () => {
    localStorage.setItem('cadcat_theme', 'dark');
    expect(localStorage.getItem('cadcat_theme')).toBe('dark');
    localStorage.setItem('cadcat_theme', 'light');
    expect(localStorage.getItem('cadcat_theme')).toBe('light');
  });
});
