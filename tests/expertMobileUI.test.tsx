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
  it('renders sticky top header with Modo Experto title, quick 3D button, and section tabs in mobile mode', () => {
    const handleView3d = vi.fn();
    const handleSwitchSite = vi.fn();

    const html = renderToString(
      <ModuleForm
        isMobile={true}
        width={700}
        height={850}
        depth={550}
        materials={mockMaterials}
        edgeBands={mockEdgeBands}
        onView3dClick={handleView3d}
        onSwitchToSiteMode={handleSwitchSite}
      />,
    );

    // Verify Sticky Header
    expect(html).toContain('expert-sticky-header');
    expect(html).toContain('Modo Experto');
    expect(html).toContain('Ver 3D');
    expect(html).toContain('Modo Taller');

    // Verify Section Tabs
    expect(html).toContain('📏 Medidas');
    expect(html).toContain('🏗️ Estructura');
    expect(html).toContain('🔲 Vanos');
    expect(html).toContain('🚪 Interior');
    expect(html).toContain('🎨 Materiales');
    expect(html).toContain('👁️ Todo');
  });

  it('starts in "Medidas" section on mobile, showing dimensions and next step to Estructura', () => {
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

    // In 'dimensions' section: Width/Height/Depth are present
    const widthInput = container.querySelector('#input-width');
    expect(widthInput).not.toBeNull();

    // Estructura fieldset should NOT be rendered when activeSection is 'dimensions'
    const legendEstructura = Array.from(container.querySelectorAll('legend')).find((l) =>
      l.textContent?.includes('Estructura del Casco'),
    );
    expect(legendEstructura).toBeUndefined();

    // Verify Mobile Step Navigation Footer has "Estructura ▶"
    const nextBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Estructura ▶'),
    );
    expect(nextBtn).toBeDefined();

    // Verify quick Save and 3D buttons exist in step footer
    const saveBtn = Array.from(container.querySelectorAll('.expert-mobile-section-footer button')).find((b) =>
      b.textContent?.includes('Guardar'),
    );
    expect(saveBtn).toBeDefined();

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('navigates seamlessly between sections using step buttons on mobile', () => {
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

    // Step 1: Click "Estructura ▶"
    const nextToEstructura = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Estructura ▶'),
    ) as HTMLButtonElement | undefined;
    expect(nextToEstructura).toBeDefined();

    act(() => {
      nextToEstructura?.click();
    });

    // Now in Estructura: Casco legend should be visible
    const legendEstructura = Array.from(container.querySelectorAll('legend')).find((l) =>
      l.textContent?.includes('Estructura del Casco'),
    );
    expect(legendEstructura).toBeDefined();

    // Dimension inputs should now be hidden
    expect(container.querySelector('#input-width')).toBeNull();

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
    const interiorTab = Array.from(container.querySelectorAll('.expert-sticky-header button')).find((b) =>
      b.textContent?.includes('Interior'),
    ) as HTMLButtonElement | undefined;
    expect(interiorTab).toBeDefined();

    act(() => {
      interiorTab?.click();
    });

    // Interior equipment fieldset should be visible
    const legendInterior = Array.from(container.querySelectorAll('legend')).find((l) =>
      l.textContent?.includes('Equipamiento Interior'),
    );
    expect(legendInterior).toBeDefined();

    // Dimension inputs should be hidden
    expect(container.querySelector('#input-width')).toBeNull();

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

    // Switch to Materiales tab
    const materialsTab = Array.from(container.querySelectorAll('.expert-sticky-header button')).find((b) =>
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

    // Verify CSV and PDF buttons are present in mobile materials section
    const csvBtn = Array.from(container.querySelectorAll('.expert-mobile-section-footer button')).find((b) =>
      b.textContent?.includes('CSV'),
    ) as HTMLButtonElement | undefined;
    expect(csvBtn).toBeDefined();
    act(() => {
      csvBtn?.click();
    });
    expect(handleExportCsv).toHaveBeenCalledTimes(1);

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

    // Desktop header should be rendered
    expect(html).toContain('📐 Medidas y Armado del Módulo');

    // Both Dimensions and Estructura should be present simultaneously (activeSection = 'all')
    expect(html).toContain('id="input-width"');
    expect(html).toContain('Estructura del Casco y Techo');
    expect(html).toContain('Materiales y Tapacantos');

    // Mobile-specific step footer should not be rendered
    expect(html).not.toContain('expert-mobile-section-footer');
  });
});
