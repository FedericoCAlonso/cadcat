import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { AssemblySheetView } from '../src/ui/AssemblySheetView';
import { AssemblyDiagramModal } from '../src/ui/AssemblyDiagramModal';
import { DEFAULT_UI_CONFIG } from '../src/config';
import {
  createPiece,
  createRectangularContour,
  generateAssemblySheet,
  type ResolvedPiece,
  type AssemblySheet,
} from '../src/resolver';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('Stage 6B Step A: Assembly Guide Layout on the Phone', () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
      root = null;
    }
    container.remove();
  });

  const samplePieces: ResolvedPiece[] = [
    {
      ...createPiece({
        id: 'side-left',
        role: 'side-left',
        materialId: 'mat-1',
        contour: createRectangularContour(560, 800),
        thicknessMm: 18,
      }),
      positionMm: { x: 0, y: 0, z: 0 },
      dimensionsMm: { width: 560, height: 800 },
    },
    {
      ...createPiece({
        id: 'side-right',
        role: 'side-right',
        materialId: 'mat-1',
        contour: createRectangularContour(560, 800),
        thicknessMm: 18,
      }),
      positionMm: { x: 582, y: 0, z: 0 },
      dimensionsMm: { width: 560, height: 800 },
    },
    {
      ...createPiece({
        id: 'bottom',
        role: 'bottom',
        materialId: 'mat-1',
        contour: createRectangularContour(564, 560),
        thicknessMm: 18,
      }),
      positionMm: { x: 18, y: 0, z: 0 },
      dimensionsMm: { width: 564, height: 560 },
    },
  ];

  const sampleSheet: AssemblySheet = generateAssemblySheet({
    module: {
      moduleId: 'test-module-6b',
      pieces: samplePieces,
      joints: [],
    },
  });

  describe('Configuration Defaults', () => {
    it('defines responsive thresholds and modal zoom bounds in config', () => {
      expect(DEFAULT_UI_CONFIG.assemblyGuidePreMachiningColumnThresholdPx).toBe(640);
      expect(DEFAULT_UI_CONFIG.assemblyGuidePartsCardThresholdPx).toBe(560);
      expect(DEFAULT_UI_CONFIG.assemblyGuideModalMaxZoom).toBe(5.0);
      expect(DEFAULT_UI_CONFIG.assemblyGuideModalMinZoom).toBe(0.5);
    });
  });

  describe('Tab Row and Broken Text Prevention', () => {
    it('renders tabs with whiteSpace nowrap to prevent letter-by-letter breakage', () => {
      const html = renderToString(
        <AssemblySheetView
          assemblySheet={sampleSheet}
          pieces={samplePieces}
        />
      );

      expect(html).toContain('assembly-view-switcher');
      expect(html).toContain('white-space:nowrap');
      expect(html).toContain('flex-shrink:0');
      expect(html).toContain('Vista Completa');
      expect(html).toContain('Vista Explotada (#1, #2...)');
      expect(html).toContain('Detalle de Paneles (Datum X, Y)');
    });
  });

  describe('Exploded View Slider Layout', () => {
    it('renders preset tick buttons below the ends of the slider', () => {
      const onRatioChange = vi.fn();
      root = createRoot(container);
      act(() => {
        root?.render(
          <AssemblySheetView
            assemblySheet={sampleSheet}
            pieces={samplePieces}
            onExplodedRatioChange={onRatioChange}
          />
        );
      });

      const ticks = container.querySelectorAll('.assembly-slider-tick-btn');
      expect(ticks.length).toBe(3);

      const tickArmado = ticks[0] as HTMLButtonElement;
      const tick50 = ticks[1] as HTMLButtonElement;
      const tickMax = ticks[2] as HTMLButtonElement;

      expect(tickArmado.textContent).toContain('Armado (0%)');
      expect(tick50.textContent).toContain('50%');
      expect(tickMax.textContent).toContain('Máx. (100%)');

      act(() => {
        tickArmado.click();
      });
      expect(onRatioChange).toHaveBeenCalledWith(0);

      act(() => {
        tick50.click();
      });
      expect(onRatioChange).toHaveBeenCalledWith(0.5);

      act(() => {
        tickMax.click();
      });
      expect(onRatioChange).toHaveBeenCalledWith(1.0);
    });
  });

  describe('Pre-Machining Views Grid', () => {
    it('uses container-queried assembly-panel-detail-grid class', () => {
      const html = renderToString(
        <AssemblySheetView
          assemblySheet={sampleSheet}
          pieces={samplePieces}
        />
      );

      expect(html).toContain('assembly-panel-detail-grid');
    });
  });

  describe('Parts Reference Table vs Cards', () => {
    it('renders both cards wrapper and table wrapper for container-query responsiveness', () => {
      const html = renderToString(
        <AssemblySheetView
          assemblySheet={sampleSheet}
          pieces={samplePieces}
        />
      );

      expect(html).toContain('assembly-parts-cards-wrapper');
      expect(html).toContain('assembly-parts-table-wrapper');
      expect(html).toContain('assembly-piece-card');
      expect(html).toContain('#1');
      expect(html).toContain('(side-left)');
      expect(html).toContain('Corte (An × Al × Esp):');
      expect(html).toContain('Cantos:');
      expect(html).toContain('Pre-armado:');
    });
  });

  describe('AssemblyDiagramModal', () => {
    it('renders diagram modal with title, zoom controls, and close action', () => {
      const onClose = vi.fn();
      root = createRoot(container);
      act(() => {
        root?.render(
          <AssemblyDiagramModal
            title="Esquema de Prueba"
            onClose={onClose}
          >
            <svg data-testid="test-svg" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="40" />
            </svg>
          </AssemblyDiagramModal>
        );
      });

      expect(container.textContent).toContain('Esquema de Prueba');
      expect(container.querySelector('svg')).not.toBeNull();

      const closeBtn = Array.from(container.querySelectorAll('button')).find(
        (b) => b.textContent?.includes('Cerrar')
      );
      expect(closeBtn).toBeDefined();

      act(() => {
        closeBtn?.click();
      });
      expect(onClose).toHaveBeenCalled();
    });

    it('closes on Escape key press', () => {
      const onClose = vi.fn();
      root = createRoot(container);
      act(() => {
        root?.render(
          <AssemblyDiagramModal
            title="Esquema con Escape"
            onClose={onClose}
          >
            <div>Contenido</div>
          </AssemblyDiagramModal>
        );
      });

      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      });
      expect(onClose).toHaveBeenCalled();
    });

    it('opens diagram modal when tapping diagram wrapper in AssemblySheetView', () => {
      root = createRoot(container);
      act(() => {
        root?.render(
          <AssemblySheetView
            assemblySheet={sampleSheet}
            pieces={samplePieces}
          />
        );
      });

      const diagramWrappers = container.querySelectorAll('.assembly-diagram-wrapper');
      expect(diagramWrappers.length).toBeGreaterThan(0);

      const firstWrapper = diagramWrappers[0] as HTMLDivElement;
      act(() => {
        firstWrapper.click();
      });

      // Modal should be open
      const modal = container.querySelector('[role="dialog"]');
      expect(modal).not.toBeNull();

      const closeBtn = Array.from(container.querySelectorAll('button')).find(
        (b) => b.textContent?.includes('Cerrar')
      );
      expect(closeBtn).toBeDefined();

      // Close modal
      act(() => {
        closeBtn?.click();
      });
      expect(container.querySelector('[role="dialog"]')).toBeNull();
    });
  });
});
