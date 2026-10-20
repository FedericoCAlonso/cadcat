import { act } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { createRoot } from 'react-dom/client';
import { ModoObraWizard } from '../src/ui/ModoObraWizard';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('ModoObraWizard Component (Modo Obra Navigation & Gestures)', () => {
  it('renders initial step (Ancho) and persistent 3D inspection button', () => {
    const html = renderToString(
      <ModoObraWizard
        width={900}
        height={750}
        depth={580}
        thickness={18}
        onWidthChange={vi.fn()}
        onHeightChange={vi.fn()}
        onDepthChange={vi.fn()}
        handMode="right"
        onHandModeChange={vi.fn()}
        onSwitchToExpertMode={vi.fn()}
      />,
    );

    expect(html).toContain('Modo Obra');
    expect(html).toContain('Modo Experto');
    expect(html).toContain('Ancho Total del Mueble');
    expect(html).toContain('900');
    expect(html).toContain('Paso 1 de 4');
    expect(html).toContain('👁️ Ver Modelo 3D');
  });

  it('navigates through steps using Siguiente and Anterior buttons interactively', () => {
    const handleWidthChange = vi.fn();
    const handleHeightChange = vi.fn();
    const handleView3d = vi.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);

    const rootInstance = createRoot(container);
    act(() => {
      rootInstance.render(
        <ModoObraWizard
          width={800}
          height={750}
          depth={580}
          thickness={18}
          onWidthChange={handleWidthChange}
          onHeightChange={handleHeightChange}
          onDepthChange={vi.fn()}
          handMode="right"
          onHandModeChange={vi.fn()}
          onSwitchToExpertMode={vi.fn()}
          onView3dClick={handleView3d}
        />,
      );
    });

    expect(container.textContent).toContain('Ancho Total del Mueble');

    // Click "Siguiente 🔽" button
    const nextBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Siguiente'),
    );
    expect(nextBtn).toBeDefined();
    act(() => {
      nextBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    // Should now be on Step 2 (Alto)
    expect(container.textContent).toContain('Alto Total del Mueble');
    expect(container.textContent).toContain('Paso 2 de 4');

    // Click "👁️ Ver Modelo 3D" button
    const view3dBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Ver Modelo 3D'),
    );
    expect(view3dBtn).toBeDefined();
    act(() => {
      view3dBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(handleView3d).toHaveBeenCalled();

    // Click "🔼 Anterior" button to return to Step 1
    const prevBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Anterior'),
    );
    expect(prevBtn).toBeDefined();
    act(() => {
      prevBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(container.textContent).toContain('Ancho Total del Mueble');

    act(() => {
      rootInstance.unmount();
    });
    container.remove();
  });

  it('renders "Volver a Medidas" when is3dViewActive is true', () => {
    const html = renderToString(
      <ModoObraWizard
        width={900}
        height={750}
        depth={580}
        thickness={18}
        onWidthChange={vi.fn()}
        onHeightChange={vi.fn()}
        onDepthChange={vi.fn()}
        handMode="right"
        onHandModeChange={vi.fn()}
        onSwitchToExpertMode={vi.fn()}
        is3dViewActive={true}
      />,
    );

    expect(html).toContain('✏️ Volver a Medidas');
  });
});
