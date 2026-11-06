import 'fake-indexeddb/auto';
import { act } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { createRoot } from 'react-dom/client';
import { ModuleForm } from '../src/ui/ModuleForm';
import type { Material, EdgeBand } from '../src/model';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mockMaterials: Material[] = [
  {
    schemaVersion: 1,
    id: 'mat-1',
    name: 'Blanco 18mm',
    thicknessMm: 18,
    sheetSizeMm: { length: 2800, width: 2070 },
    hasGrain: false,
    milling: { hidden: 'yes', visible: 'no', onStructuralPiece: 'limited' },
  },
];

const mockEdgeBands: EdgeBand[] = [
  {
    schemaVersion: 1,
    id: 'eb-1',
    kind: 'adhesive',
    thicknessMm: 0.45,
    pricePerMeter: 'TO_CONFIRM',
  },
];

describe('ModuleForm Mobile Expert UI (Modo Experto en Celular)', () => {
  it('renders sticky top header with Modo Experto title and section tabs in mobile mode', () => {
    const handleSwitchSite = vi.fn();

    const html = renderToString(
      <ModuleForm
        isMobile={true}
        width={700}
        height={850}
        depth={550}
        materials={mockMaterials}
        edgeBands={mockEdgeBands}
        onSwitchToSiteMode={handleSwitchSite}
      />,
    );

    // Verify Sticky Header
    expect(html).toContain('panel-sticky-header');
    expect(html).toContain('Modo Experto');
    expect(html).toContain('Modo Taller');

    // Verify Section Tabs and Toggle All button
    expect(html).toContain('Medidas');
    expect(html).toContain('Estructura');
    expect(html).toContain('Vanos');
    expect(html).toContain('Interior');
    expect(html).toContain('Materiales');
    expect(html).toContain('Abrir todo');
  });

  it('starts with all sections accessible and continuous on mobile, without blocking the user', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <ModuleForm
          isMobile={true}
          width={650}
          height={750}
          depth={560}
          materials={mockMaterials}
          edgeBands={mockEdgeBands}
          onSave={vi.fn()}
        />,
      );
    });

    // Width/Height/Depth are present
    const widthInput = container.querySelector('#input-width');
    expect(widthInput).not.toBeNull();

    // Estructura fieldset should be immediately accessible (not locked behind wizards)
    const legendEstructura = Array.from(container.querySelectorAll('legend')).find((l) =>
      l.textContent?.includes('Estructura del Casco'),
    );
    expect(legendEstructura).toBeDefined();

    // Special cell matrix button is accessible in compact module bar
    const specialHeaderBtn = container.querySelector('button[aria-label="Especial"]');
    expect(specialHeaderBtn).not.toBeNull();

    // Special cell matrix button is accessible in Vanos section
    const specialVanosBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Edición Especial: Matriz'),
    );
    expect(specialVanosBtn).toBeDefined();

    // First tab (Medidas) is active initially
    const firstTab = Array.from(container.querySelectorAll('.scroll-fade-tab')).find((b) =>
      b.textContent?.includes('Medidas'),
    );
    expect(firstTab?.classList.contains('scroll-fade-tab--active')).toBe(true);

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('navigates seamlessly between sections using step buttons when a specific section is filtered on mobile', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <ModuleForm
          isMobile={true}
          width={600}
          height={720}
          depth={560}
          materials={mockMaterials}
          edgeBands={mockEdgeBands}
          onSave={vi.fn()}
        />,
      );
    });

    // Select "Medidas" tab explicitly to filter
    const medidasTab = Array.from(container.querySelectorAll('.scroll-fade-tab')).find((b) =>
      b.textContent?.includes('Medidas'),
    ) as HTMLButtonElement | undefined;
    expect(medidasTab).toBeDefined();

    act(() => {
      medidasTab?.click();
    });

    // When filtered to Medidas, Estructura panel is hidden
    const estructuraPanel = container.querySelector('#accordion-panel-structure');
    expect(estructuraPanel?.getAttribute('hidden')).not.toBeNull();

    // Step 1: Click "Estructura ▶"
    const nextToEstructura = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Estructura ▶'),
    ) as HTMLButtonElement | undefined;
    expect(nextToEstructura).toBeDefined();

    act(() => {
      nextToEstructura?.click();
    });

    // Now in Estructura: Casco panel should not be hidden
    expect(container.querySelector('#accordion-panel-structure')?.getAttribute('hidden')).toBeNull();

    // Dimension panel should now be hidden
    expect(container.querySelector('#accordion-panel-dimensions')?.getAttribute('hidden')).not.toBeNull();

    // Back button to Medidas should be visible
    const backToMedidas = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Medidas'),
    );
    expect(backToMedidas).toBeDefined();

    // Next button to Vanos should be visible
    const nextToVanos = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Vanos ▶'),
    );
    expect(nextToVanos).toBeDefined();

    // Button to unfilter and return to continuous view is present
    const unfilterBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Ver Todo el Formulario Continuo'),
    ) as HTMLButtonElement | undefined;
    expect(unfilterBtn).toBeDefined();

    act(() => {
      unfilterBtn?.click();
    });

    // Now all sections are visible again (none hidden)
    expect(container.querySelector('#accordion-panel-dimensions')?.getAttribute('hidden')).toBeNull();
    expect(container.querySelector('#accordion-panel-structure')?.getAttribute('hidden')).toBeNull();

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('switches sections directly via top segmented tabs on mobile', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <ModuleForm
          isMobile={true}
          width={600}
          height={720}
          depth={560}
          materials={mockMaterials}
          edgeBands={mockEdgeBands}
        />,
      );
    });

    // Click "🚪 Interior" tab
    const interiorTab = Array.from(container.querySelectorAll('.scroll-fade-tab')).find((b) =>
      b.textContent?.includes('Interior'),
    ) as HTMLButtonElement | undefined;
    expect(interiorTab).toBeDefined();

    act(() => {
      interiorTab?.click();
    });

    // Interior equipment panel should be visible
    expect(container.querySelector('#accordion-panel-interior')?.getAttribute('hidden')).toBeNull();

    // Dimension panel should be hidden
    expect(container.querySelector('#accordion-panel-dimensions')?.getAttribute('hidden')).not.toBeNull();

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('shows export buttons and Save Module on final section (Materiales) on mobile', () => {
    const handleSave = vi.fn();
    const handleExportCsv = vi.fn();
    const handleExportPdf = vi.fn();

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <ModuleForm
          isMobile={true}
          width={600}
          height={720}
          depth={560}
          materials={mockMaterials}
          edgeBands={mockEdgeBands}
          onSave={handleSave}
          onExportCsv={handleExportCsv}
          onExportPdf={handleExportPdf}
        />,
      );
    });

    // Switch to final section tab (Materiales)
    const materialsTab = Array.from(container.querySelectorAll('.scroll-fade-tab')).find((b) =>
      b.textContent?.includes('Materiales'),
    ) as HTMLButtonElement | undefined;
    act(() => {
      materialsTab?.click();
    });

    // Verify Save Module button in footer
    const saveModuleBtn = Array.from(container.querySelectorAll('.expert-mobile-section-footer button')).find((b) =>
      b.textContent?.includes('Guardar Módulo'),
    ) as HTMLButtonElement | undefined;
    expect(saveModuleBtn).toBeDefined();
    act(() => {
      saveModuleBtn?.click();
    });
    expect(handleSave).toHaveBeenCalledTimes(1);

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('renders all sections simultaneously in desktop mode (isMobile={false})', () => {
    const html = renderToString(
      <ModuleForm
        isMobile={false}
        width={600}
        height={720}
        depth={560}
        materials={mockMaterials}
        edgeBands={mockEdgeBands}
      />,
    );

    // Desktop sticky header should be rendered
    expect(html).toContain('panel-sticky-header');

    // Both Dimensions and Estructura should be present in DOM
    expect(html).toContain('id="input-width"');
    expect(html).toContain('Estructura del Casco y Techo');
    expect(html).toContain('Materiales y Tapacantos');

    // Mobile-specific step footer should not be rendered
    expect(html).not.toContain('expert-mobile-section-footer');
  });

  it('renders panel sticky header on mobile and desktop', () => {
    const htmlMobile = renderToString(
      <ModuleForm
        isMobile={true}
        width={600}
        height={720}
        depth={560}
        materials={mockMaterials}
        edgeBands={mockEdgeBands}
      />,
    );

    expect(htmlMobile).toContain('panel-sticky-header');

    const htmlDesktop = renderToString(
      <ModuleForm
        isMobile={false}
        width={600}
        height={720}
        depth={560}
        materials={mockMaterials}
        edgeBands={mockEdgeBands}
      />,
    );

    expect(htmlDesktop).toContain('panel-sticky-header');
  });

  it('renders piece inspector and plinth grids with auto-fit minmax layout to avoid narrow text squishing', () => {
    const html = renderToString(
      <ModuleForm
        isMobile={false}
        width={600}
        height={720}
        depth={560}
        materials={mockMaterials}
        edgeBands={mockEdgeBands}
        hasPlinth={true}
        plinthHeightMm={100}
        plinthSetbackMm={50}
        activePieceId="p-1"
        pieces={[
          {
            id: 'p-1',
            role: 'left',
            materialId: 'mat-1',
            thicknessMm: 18,
            contour: { points: [{ x: 0, y: 0 }, { x: 560, y: 0 }, { x: 560, y: 720 }, { x: 0, y: 720 }] },
            faces: [],
            structural: true,
            referenceFace: 'A',
            positionMm: { x: 0, y: 0, z: 0 },
            dimensionsMm: { width: 560, height: 720 },
            cutDimensionsMm: { width: 559, height: 719 },
            cutContour: { points: [{ x: 0, y: 0 }, { x: 559, y: 0 }, { x: 559, y: 719 }, { x: 0, y: 719 }] },
            bandedEdges: [],
          },
        ]}
      />,
    );

    // Grid layout uses at least 140-160px minmax to prevent numeric and label squishing
    expect(html).toContain('repeat(auto-fit, minmax(160px, 1fr))');
    expect(html).toContain('repeat(auto-fit, minmax(140px, 1fr))');
  });

  it('renders strictly one button to activate Modo Taller / Obra on mobile without duplicates', () => {
    const htmlMobile = renderToString(
      <ModuleForm
        isMobile={true}
        width={600}
        height={720}
        depth={560}
        materials={mockMaterials}
        edgeBands={mockEdgeBands}
        onSwitchToSiteMode={vi.fn()}
      />,
    );

    // Exactly one button in expert-sticky-header for mobile
    const occurrences = (htmlMobile.match(/aria-label="Cambiar a Modo Taller"/g) || []).length;
    expect(occurrences).toBe(1);

    // Desktop button "Modo Obra (Táctil)" must NOT be present on mobile
    expect(htmlMobile).not.toContain('Modo Obra (Táctil)');
  });

  it('controls visibility of Interferencias elements based on showInterferences flag', () => {
    // 1. With showInterferences={false} (default)
    const htmlHidden = renderToString(
      <ModuleForm
        isMobile={false}
        width={600}
        height={720}
        depth={560}
        materials={mockMaterials}
        edgeBands={mockEdgeBands}
        showInterferences={false}
        columnObstacle={{
          enabled: true,
          type: 'vertical-column',
          referenceEdge: 'left',
          distanceFromReferenceMm: 0,
          widthMm: 150,
          depthMm: 120,
          corner: 'back-left',
        }}
      />,
    );
    expect(htmlHidden).not.toContain('accordion-section-interferences');
    expect(htmlHidden).not.toContain('interferencia');
    expect(htmlHidden).not.toContain('📐 Interferencias');

    // 2. With showInterferences={true}
    const htmlVisible = renderToString(
      <ModuleForm
        isMobile={false}
        width={600}
        height={720}
        depth={560}
        materials={mockMaterials}
        edgeBands={mockEdgeBands}
        showInterferences={true}
        columnObstacle={{
          enabled: true,
          type: 'vertical-column',
          referenceEdge: 'left',
          distanceFromReferenceMm: 0,
          widthMm: 150,
          depthMm: 120,
          corner: 'back-left',
        }}
      />,
    );
    expect(htmlVisible).toContain('accordion-section-interferences');
    expect(htmlVisible).toContain('interferencia');
  });
});
