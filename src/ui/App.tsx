import type { ReactElement } from 'react';

/**
 * Main application component.
 * It shows the title and a welcome message.
 */
export function App(): ReactElement {
  return (
    <main>
      <h1>Mobilius</h1>
      <p>Furniture design progressive web application.</p>
    </main>
  );
}
