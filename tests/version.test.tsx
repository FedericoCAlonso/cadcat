import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { APP_VERSION } from '../src/version';
import packageJson from '../package.json';
import { App } from '../src/ui/App';

describe('Application Version Management', () => {
  it('follows pre-production semantic versioning starting with 0.x.y', () => {
    expect(APP_VERSION).toMatch(/^0\.\d+\.\d+$/);
  });

  it('keeps APP_VERSION in sync with package.json version', () => {
    expect(packageJson.version).toBe(APP_VERSION);
  });

  it('renders current version and brand logo in the App header without hardcoding', () => {
    const html = renderToString(<App />);
    expect(html).toContain(`v${APP_VERSION}`);
    expect(html).toContain('alt="Mobilius Icon"');
  });
});
