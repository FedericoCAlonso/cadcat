import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { WorkshopContextDiagram } from '../src/ui/WorkshopContextDiagram';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('WorkshopContextDiagram Component (Modo Taller Technical Schematics)', () => {
  it('renders module-type diagram for base, wall, drawer, and door units without cluttered text boxes', () => {
    const htmlBase = renderToString(
      <WorkshopContextDiagram step="module-type" selectedTemplateId="base-modular" depth={580} />,
    );
    expect(htmlBase).toContain('BAJO MESADA BASE');
    expect(htmlBase).toContain('MESADA 580 mm');
    expect(htmlBase).toContain('NIVEL DE PISO');

    const htmlWall = renderToString(
      <WorkshopContextDiagram step="module-type" selectedTemplateId="wall-cabinet" />,
    );
    expect(htmlWall).toContain('ALACENA COLGANTE');
    expect(htmlWall).toContain('Despeje sobre mesada');

    const htmlDrawer = renderToString(
      <WorkshopContextDiagram step="module-type" selectedTemplateId="drawer-unit" />,
    );
    expect(htmlDrawer).toContain('CAJONERA MODULAR');
  });

  it('renders dimensions isometric wireframe with reactive cotas, interior light, and handles clicks', () => {
    const handleSelectDim = vi.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <WorkshopContextDiagram
          step="dimensions"
          width={800}
          height={750}
          depth={580}
          thickness={18}
          activeDimension="width"
          onSelectDimension={handleSelectDim}
        />,
      );
    });

    expect(container.textContent).toContain('800 mm');
    expect(container.textContent).toContain('750 mm');
    expect(container.textContent).toContain('580 mm');
    expect(container.textContent).toContain('e: 18 mm');
    expect(container.textContent).toContain('Luz útil:');

    // Click on depth cota
    const depthText = Array.from(container.querySelectorAll('text')).find((t) =>
      t.textContent?.includes('580 mm'),
    );
    expect(depthText).toBeDefined();
    act(() => {
      depthText?.parentElement?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(handleSelectDim).toHaveBeenCalledWith('depth');

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('renders unified base-roof diagram as well as base-support and roof-structure views', () => {
    const htmlBaseRoof = renderToString(
      <WorkshopContextDiagram
        step="base-roof"
        hasPlinth={true}
        plinthHeightMm={100}
        hasWallHangingRail={false}
        roofType="front-back-rails"
      />,
    );
    expect(htmlBaseRoof).toContain('1. CIERRE SUPERIOR (TECHO)');
    expect(htmlBaseRoof).toContain('2. APOYO INFERIOR (BASE)');
    expect(htmlBaseRoof).toContain('FAJA FRONTAL');
    expect(htmlBaseRoof).toContain('ZÓCALO 100 mm');

    const htmlHanging = renderToString(
      <WorkshopContextDiagram step="base-support" hasPlinth={false} hasWallHangingRail={true} />,
    );
    expect(htmlHanging).toContain('MÓDULO SUSPENDIDO');

    const htmlNone = renderToString(
      <WorkshopContextDiagram step="roof-structure" roofType="none" />,
    );
    expect(htmlNone).toContain('SIN TAPA (HASTA EL TECHO)');
  });

  it('renders backing cross-section with usable interior depth and per-bay count', () => {
    const htmlGroove = renderToString(
      <WorkshopContextDiagram
        step="backing"
        depth={580}
        hasBacking={true}
        backingType="groove"
        backingThicknessMm={3}
        gridType="2-bays-vertical"
      />,
    );
    expect(htmlGroove).toContain('FONDO RANURADO (3 mm)');
    expect(htmlGroove).toContain('Prof. útil vano: 562 mm');
    expect(htmlGroove).toContain('Placas de fondo: 2 (1 por vano)');

    const htmlNone = renderToString(
      <WorkshopContextDiagram step="backing" hasBacking={false} backingType="none" />,
    );
    expect(htmlNone).toContain('SIN FONDO (ABIERTO)');
  });

  it('renders bays-grid and dynamic bays-equipment elevations with real counts and hinge sides', () => {
    const dummyBays = [
      { id: 'b1', type: 'shelves' as const, count: 3, shelfType: 'adjustable' as const },
      { id: 'b2', type: 'doors' as const, count: 1 as const, hingeSide: 'right' as const, interiorShelvesCount: 2 },
    ];
    const htmlGrid = renderToString(
      <WorkshopContextDiagram
        step="bays-grid"
        width={900}
        gridType="2-bays-vertical"
        bays={dummyBays as any}
        activeBayIndex={0}
      />,
    );
    expect(htmlGrid).toContain('ORDEN OCCIDENTAL');
    expect(htmlGrid).toContain('VANO 1');
    expect(htmlGrid).toContain('VANO 2');

    const htmlEq = renderToString(
      <WorkshopContextDiagram
        step="bays-equipment"
        width={900}
        gridType="2-bays-vertical"
        bays={dummyBays as any}
        activeBayIndex={0}
      />,
    );
    expect(htmlEq).toContain('3 Estantes');
    expect(htmlEq).toContain('1 Hoja (Der) + 2 Est.');
    expect(htmlEq).toContain('Vano 1');
    expect(htmlEq).toContain('Vano 2');
  });

  it('renders 4-role material diagram in Step 3 (Placas y Espesores)', () => {
    const html = renderToString(
      <WorkshopContextDiagram
        step="material"
        materialRole="fronts"
        activeMaterialName="Roble Kendal"
        activeRoleThicknessMm={18}
      />,
    );
    expect(html).toContain('CASCO');
    expect(html).toContain('FRENTES');
    expect(html).toContain('CAJONES');
    expect(html).toContain('FONDOS');
    expect(html).toContain('Rol activo: Frentes y Puertas (18 mm) · Roble Kendal');
  });
});
