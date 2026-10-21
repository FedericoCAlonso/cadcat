import { act } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { createRoot } from 'react-dom/client';
import { ModoObraWizard } from '../src/ui/ModoObraWizard';
import { type Material } from '../src/model/material';
import { type BayContent } from '../src/resolver';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('ModoObraWizard Component (Modo Obra 7-Step Navigation & Gestures)', () => {
  const dummyTemplates = [
    { id: 'base-modular', name: 'Bajo Mesada Estándar', category: 'Cocina' },
    { id: 'wall-cabinet', name: 'Alacena Colgante', category: 'Cocina' },
  ];

  it('renders initial step (Módulo y Tipo) with 7-step indicator and persistent 3D inspection button', () => {
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

    expect(html).toContain('Paso 1 de 7');
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
    expect(container.textContent).toContain('Paso 1 de 7');

    // Click "Siguiente ▶" button to go to Step 2 (Medidas Principales)
    const nextBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Siguiente'),
    );
    expect(nextBtn).toBeDefined();
    act(() => {
      nextBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).toContain('Medidas Principales');
    expect(container.textContent).toContain('Paso 2 de 7');

    // Click "Siguiente ▶" again to go to Step 3 (Base / Apoyo)
    act(() => {
      nextBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(container.textContent).toContain('Base / Apoyo');
    expect(container.textContent).toContain('Paso 3 de 7');

    // Click "Siguiente ▶" again to go to Step 4 (Techo / Amarres)
    act(() => {
      nextBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(container.textContent).toContain('Techo / Amarres');
    expect(container.textContent).toContain('Paso 4 de 7');
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
    expect(container.textContent).toContain('Paso 3 de 7');

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

  it('navigates dimensions in Step 2 via carousel buttons, micro-dots, and gestures', () => {
    const handleSwitchExpert = vi.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);

    const rootInstance = createRoot(container);
    act(() => {
      rootInstance.render(
        <ModoObraWizard
          width={800}
          height={720}
          depth={560}
          thickness={18}
          templates={dummyTemplates}
          onWidthChange={vi.fn()}
          onHeightChange={vi.fn()}
          onDepthChange={vi.fn()}
          handMode="right"
          onHandModeChange={vi.fn()}
          onSwitchToExpertMode={handleSwitchExpert}
        />,
      );
    });

    // Verify prominent "Modo Experto" button is present and clickable in header
    const expertBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Modo Experto'),
    );
    expect(expertBtn).toBeDefined();
    act(() => {
      expertBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(handleSwitchExpert).toHaveBeenCalled();

    // Go to Step 2 (Medidas)
    const nextBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Siguiente'),
    );
    act(() => {
      nextBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).toContain('Medidas Principales');
    // Initially shows Ancho Total
    expect(container.textContent).toContain('Ancho Total:');
    expect(container.textContent).toContain('800 mm');
    expect(container.textContent).toContain('(1/4)');

    // Click carousel forward button ▶ to navigate to Alto Total (2/4)
    const dimForwardBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.getAttribute('aria-label')?.includes('Medida siguiente'),
    );
    expect(dimForwardBtn).toBeDefined();
    act(() => {
      dimForwardBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).toContain('Alto Total:');
    expect(container.textContent).toContain('720 mm');
    expect(container.textContent).toContain('(2/4)');

    // Click carousel forward button ▶ again to navigate to Profundidad (3/4)
    act(() => {
      dimForwardBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(container.textContent).toContain('Profundidad:');
    expect(container.textContent).toContain('560 mm');
    expect(container.textContent).toContain('(3/4)');

    // Click micro-dot for Espesor directly
    const dotEspesor = Array.from(container.querySelectorAll('button')).find(
      (b) => b.getAttribute('aria-label')?.includes('Espesor Placa'),
    );
    expect(dotEspesor).toBeDefined();
    act(() => {
      dotEspesor?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).toContain('Espesor Placa:');
    expect(container.textContent).toContain('18 mm');
    expect(container.textContent).toContain('(4/4)');

    // Click carousel back button ◀ to return to Profundidad (3/4)
    const dimBackBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.getAttribute('aria-label')?.includes('Medida anterior'),
    );
    expect(dimBackBtn).toBeDefined();
    act(() => {
      dimBackBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(container.textContent).toContain('Profundidad:');
    expect(container.textContent).toContain('(3/4)');

    act(() => {
      rootInstance.unmount();
    });
    container.remove();
  });

  it('renders zero-overlap 2-row top bar and compact 1-row bottom footer', () => {
    const html = renderToString(
      <ModoObraWizard
        width={800}
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

    // Header has step counter and title
    expect(html).toContain('Paso 1 de 7:');
    expect(html).toContain('Módulo y Tipo');
    expect(html).toContain('Modo Experto');
    expect(html).toContain('🖐️ D');

    // Footer is single-row with all 3 actions
    expect(html).toContain('◀ Anterior');
    expect(html).toContain('👁️ Ver Modelo 3D');
    expect(html).toContain('Siguiente ▶');
  });

  it('renders automatic workshop engineering notice in Step 1 explaining default tolerances and expert mode', () => {
    const html = renderToString(
      <ModoObraWizard
        width={800}
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

    expect(html).toContain('Ingeniería Automática de Taller');
    expect(html).toContain('2.5 mm perimetral');
    expect(html).toContain('Modo Experto');
    expect(html).toContain('configuraciones por defecto');
  });

  it('configures bay distribution and interior equipment in unified Step 6 (Vanos y Equipamiento)', () => {
    const handleGridTypeChange = vi.fn();
    const handleBayContentTypeChange = vi.fn();
    const handleActiveBayIndexChange = vi.fn();
    const handleAddShelf = vi.fn();

    const dummyBays: BayContent[] = [
      { type: 'shelves', count: 2, shelfType: 'adjustable' },
      { type: 'doors', count: 1, hingeSide: 'left', mountType: 'overlay', interiorShelvesCount: 1 },
    ];

    const container = document.createElement('div');
    document.body.appendChild(container);
    const rootInstance = createRoot(container);

    act(() => {
      rootInstance.render(
        <ModoObraWizard
          width={900}
          height={750}
          depth={580}
          thickness={18}
          onWidthChange={vi.fn()}
          onHeightChange={vi.fn()}
          onDepthChange={vi.fn()}
          gridType="2-bays-vertical"
          bays={dummyBays}
          activeBayIndex={0}
          onGridTypeChange={handleGridTypeChange}
          onActiveBayIndexChange={handleActiveBayIndexChange}
          onBayContentTypeChange={handleBayContentTypeChange}
          onAddShelf={handleAddShelf}
          handMode="right"
          onHandModeChange={vi.fn()}
          onSwitchToExpertMode={vi.fn()}
        />,
      );
    });

    // Advance 5 times to reach Step 6 (Vanos y Equipamiento)
    const nextBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Siguiente'),
    );
    for (let i = 0; i < 5; i++) {
      act(() => {
        nextBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
    }

    expect(container.textContent).toContain('Paso 6 de 7');
    expect(container.textContent).toContain('Vanos y Equipamiento');

    // Both Bay count (1 Vano, 2 Vanos, 3 Vanos) and Equipment options are present in same view
    expect(container.textContent).toContain('1 Vano');
    expect(container.textContent).toContain('2 Vanos');
    expect(container.textContent).toContain('3 Vanos');
    expect(container.textContent).toContain('📚 Estantes');
    expect(container.textContent).toContain('🗄️ Cajonera');
    expect(container.textContent).toContain('🚪 Puerta(s)');

    // Click on 3 Vanos button
    const threeBaysBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('3 Vanos'),
    );
    expect(threeBaysBtn).toBeDefined();
    act(() => {
      threeBaysBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(handleGridTypeChange).toHaveBeenCalledWith('3-bays-vertical');

    // Click on Cajonera equipment type
    const drawerBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Cajonera'),
    );
    expect(drawerBtn).toBeDefined();
    act(() => {
      drawerBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(handleBayContentTypeChange).toHaveBeenCalledWith(0, 'drawer-stack');

    // Test shelf addition (+)
    const addShelfBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent === '+',
    );
    expect(addShelfBtn).toBeDefined();
    act(() => {
      addShelfBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(handleAddShelf).toHaveBeenCalledWith(0);

    act(() => {
      rootInstance.unmount();
    });
    container.remove();
  });

  it('allows multi-role material selection (casco, frentes, cajones, fondos) in Step 7', () => {
    const dummyMaterials = [
      { id: 'mat-white', name: 'Melamina Blanca 18mm', thicknessMm: 18, color: '#ffffff', kind: 'melamine' as const, finish: 'matte' },
      { id: 'mat-oak', name: 'Roble Kendal 18mm', thicknessMm: 18, color: '#d2b48c', kind: 'melamine' as const, finish: 'textured' },
      { id: 'mat-mdf3', name: 'Fibrofácil 3mm', thicknessMm: 3, color: '#c4a482', kind: 'mdf' as const, finish: 'raw' },
    ] as unknown as Material[];

    const handleMaterialChange = vi.fn();
    const handleFrontsMaterialChange = vi.fn();
    const handleDrawerBoxesMaterialChange = vi.fn();
    const handleBackingsMaterialChange = vi.fn();

    const dummyBays = [
      {
        id: 'bay-1',
        type: 'drawer-stack' as const,
        drawerTracks: [{ id: 'dt-1', heightMm: 200 }, { id: 'dt-2', heightMm: 200 }],
        drawerType: 'simple' as const,
      },
    ] as unknown as BayContent[];

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
          onWidthChange={vi.fn()}
          onHeightChange={vi.fn()}
          onDepthChange={vi.fn()}
          materials={dummyMaterials}
          selectedMaterialId="mat-white"
          onMaterialChange={handleMaterialChange}
          frontsMaterialId=""
          onFrontsMaterialChange={handleFrontsMaterialChange}
          drawerBoxesMaterialId=""
          onDrawerBoxesMaterialChange={handleDrawerBoxesMaterialChange}
          backingsMaterialId="mat-mdf3"
          onBackingsMaterialChange={handleBackingsMaterialChange}
          hasBacking={true}
          backingType="groove"
          bays={dummyBays}
          handMode="right"
          onHandModeChange={vi.fn()}
          onSwitchToExpertMode={vi.fn()}
        />,
      );
    });

    // Advance 6 times to reach Step 7 (Tablero / Melamina)
    const nextBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Siguiente'),
    );
    expect(nextBtn).toBeDefined();

    for (let i = 0; i < 6; i++) {
      act(() => {
        nextBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
    }

    expect(container.textContent).toContain('Paso 7 de 7');
    expect(container.textContent).toContain('Tablero / Melamina');

    // Role selector chips should be present: Casco, Frentes, Cajones, Fondos
    expect(container.textContent).toContain('Casco');
    expect(container.textContent).toContain('Frentes');
    expect(container.textContent).toContain('Cajones');
    expect(container.textContent).toContain('Fondos');

    // Step 8 initially is on Casco -> click Roble Kendal
    const oakBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Roble Kendal'),
    );
    expect(oakBtn).toBeDefined();
    act(() => {
      oakBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(handleMaterialChange).toHaveBeenCalledWith('mat-oak');

    // Now switch to Frentes role tab
    const frontsTabBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.getAttribute('role') === 'tab' && b.textContent?.includes('Frentes'),
    );
    expect(frontsTabBtn).toBeDefined();
    act(() => {
      frontsTabBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).toContain('Frentes y Puertas');
    expect(container.textContent).toContain('Placa exterior para hojas de puerta');

    // Select Roble Kendal for Frentes
    act(() => {
      oakBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(handleFrontsMaterialChange).toHaveBeenCalledWith('mat-oak');

    // Test reset button: click "🔗 Igual al Casco"
    const syncBtn = container.querySelector(
      'button[aria-label="Restablecer para usar la misma placa que el casco"]',
    ) as HTMLButtonElement | null;
    expect(syncBtn).not.toBeNull();
    act(() => {
      syncBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(handleFrontsMaterialChange).toHaveBeenCalledWith('');

    act(() => {
      rootInstance.unmount();
    });
    container.remove();
  });
});
