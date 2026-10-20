import { act } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { createRoot } from 'react-dom/client';
import { ModoObraWizard } from '../src/ui/ModoObraWizard';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('ModoObraWizard Component (Modo Obra 8-Step Navigation & Gestures)', () => {
  const dummyTemplates = [
    { id: 'base-modular', name: 'Bajo Mesada Estándar', category: 'Cocina' },
    { id: 'wall-cabinet', name: 'Alacena Colgante', category: 'Cocina' },
  ];

  it('renders initial step (Módulo y Tipo) with 8-step indicator and persistent 3D inspection button', () => {
    const html = renderToString(
      <ModoObraWizard
        width={900}
        height={750}
        depth={580}
        thickness={18}
        templates={dummyTemplates}
        onWidthChange={vi.fn()}
        onHeightChange={vi.fn()}
        onDepthChange={vi.fn()}
        handMode="right"
        onHandModeChange={vi.fn()}
        onSwitchToExpertMode={vi.fn()}
      />,
    );

    expect(html).toContain('Paso 1 de 8');
    expect(html).toContain('Módulo y Tipo');
    expect(html).toContain('Bajo Mesada Estándar');
    expect(html).toContain('Alacena Colgante');
    expect(html).toContain('👁️ Ver Modelo 3D');
  });

  it('navigates through steps using Siguiente and Anterior buttons interactively', () => {
    const handleWidthChange = vi.fn();
    const handleRoofTypeChange = vi.fn();
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
          templates={dummyTemplates}
          onWidthChange={handleWidthChange}
          onHeightChange={vi.fn()}
          onDepthChange={vi.fn()}
          onRoofTypeChange={handleRoofTypeChange}
          handMode="right"
          onHandModeChange={vi.fn()}
          onSwitchToExpertMode={vi.fn()}
          onView3dClick={handleView3d}
        />,
      );
    });

    expect(container.textContent).toContain('Módulo y Tipo');
    expect(container.textContent).toContain('Paso 1 de 8');

    // Click "Siguiente ▶" button to go to Step 2 (Medidas Principales)
    const nextBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Siguiente'),
    );
    expect(nextBtn).toBeDefined();
    act(() => {
      nextBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).toContain('Medidas Principales');
    expect(container.textContent).toContain('Paso 2 de 8');

    // Click "Siguiente ▶" again to go to Step 3 (Base / Apoyo)
    act(() => {
      nextBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(container.textContent).toContain('Base / Apoyo');
    expect(container.textContent).toContain('Paso 3 de 8');

    // Click "Siguiente ▶" again to go to Step 4 (Techo / Amarres)
    act(() => {
      nextBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(container.textContent).toContain('Techo / Amarres');
    expect(container.textContent).toContain('Paso 4 de 8');
    expect(container.textContent).toContain('Sin Tapa (Hasta el Techo)');

    // Click the "Sin Tapa (Hasta el Techo)" button to test ceiling-flush alacena selection
    const noRoofBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Sin Tapa (Hasta el Techo)'),
    );
    expect(noRoofBtn).toBeDefined();
    act(() => {
      noRoofBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(handleRoofTypeChange).toHaveBeenCalledWith('none');

    // Click "👁️ Ver Modelo 3D" button
    const view3dBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Ver Modelo 3D'),
    );
    expect(view3dBtn).toBeDefined();
    act(() => {
      view3dBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(handleView3d).toHaveBeenCalled();

    // Click "◀ Anterior" button to return to Step 3
    const prevBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Anterior'),
    );
    expect(prevBtn).toBeDefined();
    act(() => {
      prevBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(container.textContent).toContain('Base / Apoyo');
    expect(container.textContent).toContain('Paso 3 de 8');

    act(() => {
      rootInstance.unmount();
    });
    container.remove();
  });

  it('renders "Volver a Ajustes" when is3dViewActive is true', () => {
    const html = renderToString(
      <ModoObraWizard
        width={900}
        height={750}
        depth={580}
        thickness={18}
        templates={dummyTemplates}
        onWidthChange={vi.fn()}
        onHeightChange={vi.fn()}
        onDepthChange={vi.fn()}
        handMode="right"
        onHandModeChange={vi.fn()}
        onSwitchToExpertMode={vi.fn()}
        is3dViewActive={true}
      />,
    );

    expect(html).toContain('✏️ Volver a Ajustes');
  });
});
