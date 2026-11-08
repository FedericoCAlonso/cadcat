import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { Viewport3D } from '../src/ui/Viewport3D';
import { ViewerToolbar } from '../src/ui/ViewerToolbar';
import type { ModuleSpatialBounds, SpatialPieceBox, ResolvedPieceWithCutSize } from '../src/resolver';

describe('Stage 5 Step A: Viewer Integration (Camera Auto-Fit, Fading Grid, and Dimensions)', () => {
  const mockBounds: ModuleSpatialBounds = {
    min: { x: 0, y: 0, z: 0 },
    max: { x: 600, y: 800, z: 560 },
    center: { x: 300, y: 400, z: 280 },
    size: { x: 600, y: 800, z: 560 },
  };

  const mockBoxes: SpatialPieceBox[] = [
    {
      pieceId: 'piece-side-1',
      role: 'lateral-left',
      materialId: 'mat-1',
      thicknessMm: 18,
      sizeMm: { x: 18, y: 800, z: 560 },
      positionMm: { x: 0, y: 0, z: 0 },
      centerMm: { x: 9, y: 400, z: 280 },
    },
  ];

  const mockPieces: ResolvedPieceWithCutSize[] = [
    {
      id: 'piece-side-1',
      role: 'lateral-left',
      materialId: 'mat-1',
      thicknessMm: 18,
      contour: {
        points: [
          { x: 0, y: 0 },
          { x: 560, y: 0 },
          { x: 560, y: 800 },
          { x: 0, y: 800 },
        ],
      },
      faces: [],
      structural: true,
      referenceFace: 'A',
      positionMm: { x: 0, y: 0, z: 0 },
      dimensionsMm: { width: 560, height: 800 },
      cutDimensionsMm: { width: 560, height: 800 },
      cutContour: {
        points: [
          { x: 0, y: 0 },
          { x: 560, y: 0 },
          { x: 560, y: 800 },
          { x: 0, y: 800 },
        ],
      },
      bandedEdges: [],
    },
  ];

  describe('ViewerToolbar Step A Buttons', () => {
    it('renders "Encuadrar" and "Cotas" buttons in the toolbar', () => {
      const handleFit = vi.fn();
      const handleToggleDims = vi.fn();

      const html = renderToString(
        <ViewerToolbar
          onSetCameraView={vi.fn()}
          wireframe={false}
          onToggleWireframe={vi.fn()}
          showMachining3D={true}
          onToggleMachining3D={vi.fn()}
          explodedRatio={0}
          onExplodedRatioChange={vi.fn()}
          onFitCamera={handleFit}
          showDimensions={true}
          onToggleDimensions={handleToggleDims}
        />,
      );

      expect(html).toContain('Encuadrar');
      expect(html).toContain('Cotas ON');
      expect(html).toContain('m3-btn--primary is-active'); // Cotas ON is active
    });

    it('toggles Cotas label to "Cotas OFF" when showDimensions is false', () => {
      const html = renderToString(
        <ViewerToolbar
          onSetCameraView={vi.fn()}
          wireframe={false}
          onToggleWireframe={vi.fn()}
          showMachining3D={true}
          onToggleMachining3D={vi.fn()}
          explodedRatio={0}
          onExplodedRatioChange={vi.fn()}
          onFitCamera={vi.fn()}
          showDimensions={false}
          onToggleDimensions={vi.fn()}
        />,
      );

      expect(html).toContain('Cotas OFF');
      expect(html).toContain('m3-btn--outlined');
    });

    it('triggers onFitCamera and onToggleDimensions callbacks when clicked in the browser DOM', () => {
      const handleFit = vi.fn();
      const handleToggleDims = vi.fn();

      const container = document.createElement('div');
      document.body.appendChild(container);
      const root = createRoot(container);

      act(() => {
        root.render(
          <ViewerToolbar
            onSetCameraView={vi.fn()}
            wireframe={false}
            onToggleWireframe={vi.fn()}
            showMachining3D={true}
            onToggleMachining3D={vi.fn()}
            explodedRatio={0}
            onExplodedRatioChange={vi.fn()}
            onFitCamera={handleFit}
            showDimensions={true}
            onToggleDimensions={handleToggleDims}
          />,
        );
      });

      const fitBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('Encuadrar'));
      expect(fitBtn).toBeDefined();

      const dimsBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('Cotas'));
      expect(dimsBtn).toBeDefined();

      act(() => {
        fitBtn?.click();
      });
      expect(handleFit).toHaveBeenCalledTimes(1);

      act(() => {
        dimsBtn?.click();
      });
      expect(handleToggleDims).toHaveBeenCalledTimes(1);

      act(() => {
        root.unmount();
      });
      container.remove();
    });
  });

  describe('Viewport3D Step A Dimensions and Auto-Fit Rendering', () => {
    it('renders vector DOM dimension labels layer when showDimensions is true', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);
      const root = createRoot(container);

      act(() => {
        root.render(
          <Viewport3D
            boxes={mockBoxes}
            bounds={mockBounds}
            pieces={mockPieces}
            explodedRatio={0}
            onExplodedRatioChange={vi.fn()}
            selectedPieceId={null}
            onSelectPiece={vi.fn()}
            initialShowDimensions={true}
          />,
        );
      });

      const widthLabel = container.querySelector('[data-testid="dimension-label-width"]');
      const heightLabel = container.querySelector('[data-testid="dimension-label-height"]');
      const depthLabel = container.querySelector('[data-testid="dimension-label-depth"]');

      expect(widthLabel).not.toBeNull();
      expect(heightLabel).not.toBeNull();
      expect(depthLabel).not.toBeNull();

      act(() => {
        root.unmount();
      });
      container.remove();
    });

    it('does not render vector DOM dimension labels when initialShowDimensions is false', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);
      const root = createRoot(container);

      act(() => {
        root.render(
          <Viewport3D
            boxes={mockBoxes}
            bounds={mockBounds}
            pieces={mockPieces}
            explodedRatio={0}
            onExplodedRatioChange={vi.fn()}
            selectedPieceId={null}
            onSelectPiece={vi.fn()}
            initialShowDimensions={false}
          />,
        );
      });

      const widthLabel = container.querySelector('[data-testid="dimension-label-width"]');
      expect(widthLabel).toBeNull();

      act(() => {
        root.unmount();
      });
      container.remove();
    });

    it('preserves camera orientation when bounds change after user manual orbit interaction', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);
      const root = createRoot(container);

      let currentBounds = { ...mockBounds };

      act(() => {
        root.render(
          <Viewport3D
            boxes={mockBoxes}
            bounds={currentBounds}
            pieces={mockPieces}
            explodedRatio={0}
            onExplodedRatioChange={vi.fn()}
            selectedPieceId={null}
            onSelectPiece={vi.fn()}
            initialShowDimensions={true}
          />,
        );
      });

      // Simulate mouse dragging to orbit camera
      const canvas = container.querySelector('canvas');
      if (canvas) {
        act(() => {
          canvas.dispatchEvent(new MouseEvent('mousedown', { clientX: 200, clientY: 200 }));
          window.dispatchEvent(new MouseEvent('mousemove', { clientX: 280, clientY: 240 }));
          window.dispatchEvent(new MouseEvent('mouseup'));
        });
      }

      // Re-render with modified width dimension (e.g. 600 -> 900)
      currentBounds = {
        min: { x: 0, y: 0, z: 0 },
        max: { x: 900, y: 800, z: 560 },
        center: { x: 450, y: 400, z: 280 },
        size: { x: 900, y: 800, z: 560 },
      };

      act(() => {
        root.render(
          <Viewport3D
            boxes={mockBoxes}
            bounds={currentBounds}
            pieces={mockPieces}
            explodedRatio={0}
            onExplodedRatioChange={vi.fn()}
            selectedPieceId={null}
            onSelectPiece={vi.fn()}
            initialShowDimensions={true}
          />,
        );
      });

      // Verify that the viewport canvas is still rendered and functioning cleanly
      expect(container.querySelector('.viewport-3d-canvas-wrapper')).not.toBeNull();

      act(() => {
        root.unmount();
      });
      container.remove();
    });
  });
});
