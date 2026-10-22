import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { WorkshopContextDiagram } from '../src/ui/WorkshopContextDiagram';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('WorkshopContextDiagram Component (Modo Taller Technical Schematics)', () => {
  it('renders module-type diagram for base and wall units without text boxes', () => {
    const htmlBase = renderToString(
      <WorkshopContextDiagram step="module-type" selectedTemplateId="base-modular" />,
    );
    expect(htmlBase).toContain('BAJO MESADA BASE');
    expect(htmlBase).toContain('MESADA 600 mm');
    expect(htmlBase).toContain('PISO DE OBRA');

    const htmlWall = renderToString(
      <WorkshopContextDiagram step="module-type" selectedTemplateId="wall-cabinet" />,
    );
    expect(htmlWall).toContain('ALACENA COLGANTE');
    expect(htmlWall).toContain('Despeje 550-600 mm');
  });

  it('renders dimensions isometric wireframe with reactive cotas and handles clicks', () => {
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

  it('renders base support details for plinth, floor direct, and wall hanging', () => {
    const htmlPlinth = renderToString(
      <WorkshopContextDiagram step="base-support" hasPlinth={true} hasWallHangingRail={false} />,
    );
    expect(htmlPlinth).toContain('ZÓCALO RETRAÍDO');
    expect(htmlPlinth).toContain('50mm');

    const htmlHanging = renderToString(
      <WorkshopContextDiagram step="base-support" hasPlinth={false} hasWallHangingRail={true} />,
    );
    expect(htmlHanging).toContain('MÓDULO SUSPENDIDO');
  });

  it('renders roof structure details for tie rails, solid panel, and open ceiling', () => {
    const htmlRails = renderToString(
      <WorkshopContextDiagram step="roof-structure" roofType="front-back-rails" />,
    );
    expect(htmlRails).toContain('FAJA FRONTAL (80 mm)');
    expect(htmlRails).toContain('FAJA TRASERA (80 mm)');

    const htmlNone = renderToString(
      <WorkshopContextDiagram step="roof-structure" roofType="none" />,
    );
    expect(htmlNone).toContain('SIN TAPA (HASTA EL TECHO)');
  });

  it('renders backing cross-section for 4mm groove, overlay, and open back', () => {
    const htmlGroove = renderToString(
      <WorkshopContextDiagram step="backing" hasBacking={true} backingType="groove" />,
    );
    expect(htmlGroove).toContain('RANURADO 4 mm');
    expect(htmlGroove).toContain('Embutido a 10 mm del borde');

    const htmlNone = renderToString(
      <WorkshopContextDiagram step="backing" hasBacking={false} backingType="none" />,
    );
    expect(htmlNone).toContain('SIN FONDO (VANO ABIERTO)');
  });

  it('renders dynamic front elevation bays and equipment in Step 6', () => {
    const dummyBays = [
      { id: 'b1', type: 'shelves' as const },
      { id: 'b2', type: 'doors' as const },
    ];
    const html = renderToString(
      <WorkshopContextDiagram
        step="bays-equipment"
        width={900}
        gridType="2-bays-vertical"
        bays={dummyBays as any}
        activeBayIndex={0}
      />,
    );
    expect(html).toContain('ESTANTES');
    expect(html).toContain('PUERTA');
    expect(html).toContain('Vano 1');
    expect(html).toContain('Vano 2');
  });

  it('renders material role exploded diagram in Step 7', () => {
    const html = renderToString(
      <WorkshopContextDiagram step="material" materialRole="fronts" />,
    );
    expect(html).toContain('CASCO');
    expect(html).toContain('FRENTES');
    expect(html).toContain('Editando Placa para: Frentes y Puertas');
  });
});
