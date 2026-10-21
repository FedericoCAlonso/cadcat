import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { App } from '../src/ui/App';

describe('App component', () => {
  it('renders heading with application title', () => {
    const html = renderToString(<App />);
    expect(html).toContain('CadCat');
    expect(html).toContain('Furniture design progressive web application.');
  });
});
