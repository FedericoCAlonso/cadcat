import { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from '../src/ui/ErrorBoundary';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function ThrowingChild({ shouldThrow }: { shouldThrow: boolean }): ReactNode {
  if (shouldThrow) {
    throw new Error('Falla simulada de WebGL');
  }
  return <div data-testid="safe-child">Vista operativa</div>;
}

describe('ErrorBoundary component', () => {
  it('renders fallback alert on child error and resets when Retry is clicked', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    let shouldThrow = true;
    const onReset = vi.fn(() => {
      shouldThrow = false;
    });

    try {
      act(() => {
        root.render(
          <ErrorBoundary
            fallbackTitle="Error en Visor 3D"
            onReset={() => {
              onReset();
              root.render(
                <ErrorBoundary fallbackTitle="Error en Visor 3D">
                  <ThrowingChild shouldThrow={false} />
                </ErrorBoundary>,
              );
            }}
          >
            <ThrowingChild shouldThrow={shouldThrow} />
          </ErrorBoundary>,
        );
      });

      const alert = container.querySelector('[role="alert"]');
      expect(alert).not.toBeNull();
      expect(alert?.textContent).toContain('Error en Visor 3D');
      expect(alert?.textContent).toContain('Falla simulada de WebGL');

      const retryBtn = container.querySelector('button');
      expect(retryBtn?.textContent).toContain('Reintentar');

      act(() => {
        retryBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });

      expect(onReset).toHaveBeenCalledTimes(1);
      expect(container.querySelector('[role="alert"]')).toBeNull();
      expect(container.querySelector('[data-testid="safe-child"]')?.textContent).toBe('Vista operativa');
    } finally {
      act(() => {
        root.unmount();
      });
      container.remove();
      consoleSpy.mockRestore();
    }
  });
});
