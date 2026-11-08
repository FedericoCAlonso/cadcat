import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { renderToString } from 'react-dom/server';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { ViewerToolbar } from '../src/ui/ViewerToolbar';
import { PieceInspectorCard } from '../src/ui/PieceInspectorCard';
import { Viewport3D } from '../src/ui/Viewport3D';
import type { ModuleSpatialBounds, SpatialPieceBox, ResolvedPieceWithCutSize, PieceMachiningSheet } from '../src/resolver';

describe('Stage 5 Step B: Role Colors, On-Demand Machining, and Operations Counter', () => {
  beforeAll(() => {
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(null);
  });
  afterAll(() => {
    vi.restoreAllMocks();
  });

  const sampleBounds: ModuleSpatialBounds = {
    min: { x: 0, y: 0, z: 0 },
    max: { x: 600, y: 800, z: 560 },
    center: { x: 300, y: 400, z: 280 },
    size: { x: 600, y: 800, z: 560 },
  };

  const samplePieces: ResolvedPieceWithCutSize[] = [
    {
      id: 'side-left-1',
      role: 'side-left',
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

  const sampleBoxes: SpatialPieceBox[] = [
    {
      pieceId: 'side-left-1',
      role: 'side-left',
      materialId: 'mat-1',
      thicknessMm: 18,
      sizeMm: { x: 18, y: 800, z: 560 },
      positionMm: { x: 0, y: 0, z: 0 },
      centerMm: { x: 9, y: 400, z: 280 },
    },
  ];

  const sampleMachiningSheets: PieceMachiningSheet[] = [
    {
      pieceId: 'side-left-1',
      role: 'side-left',
      materialId: 'mat-1',
      dimensionsMm: { width: 560, height: 800, thickness: 18 },
      cutDimensionsMm: { width: 560, height: 800 },
      bandedEdges: { top: false, bottom: false, left: false, right: false },
      faceAOperations: [],
      faceBOperations: [],
      edgeOperations: [],
      totalOperations: 42,
      customOperations: [],
      requiresTurn: false,
      turnInstructions: '',
    },
  ];

  describe('ViewerToolbar Step B Buttons', () => {
    it('renders "Color por rol" toggle and 3-state "Mecanizados" button', () => {
      const handleToggleRole = vi.fn();
      const handleChangeMachining = vi.fn();

      const html = renderToString(
        <ViewerToolbar
          onSetCameraView={vi.fn()}
          wireframe={false}
          showLines={true}
          onToggleShowLines={vi.fn()}
          colorByRole={false}
          onToggleColorByRole={handleToggleRole}
          machiningMode="auto"
          onChangeMachiningMode={handleChangeMachining}
          explodedRatio={0}
          onExplodedRatioChange={vi.fn()}
        />,
      );

      // Lines button shows "Líneas ON" and is active
      expect(html).toContain('Líneas ON');
      // Color by role toggle is present
      expect(html).toContain('Rol OFF');
      // Machining mode displays "Mecanizados Auto"
      expect(html).toContain('Mecanizados Auto');
    });

    it('cycles machining mode from "auto" to "always" on button click', () => {
      const handleChangeMachining = vi.fn();
      const container = document.createElement('div');
      document.body.appendChild(container);
      const root = createRoot(container);

      act(() => {
        root.render(
          <ViewerToolbar
            onSetCameraView={vi.fn()}
            wireframe={false}
            showLines={true}
            colorByRole={true}
            onToggleColorByRole={vi.fn()}
            machiningMode="auto"
            onChangeMachiningMode={handleChangeMachining}
            explodedRatio={0}
            onExplodedRatioChange={vi.fn()}
          />,
        );
      });

      const machiningBtn = Array.from(container.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Mecanizados'),
      );
      expect(machiningBtn).toBeDefined();

      act(() => {
        machiningBtn?.click();
      });

      // Next in cycle: 'auto' -> 'always'
      expect(handleChangeMachining).toHaveBeenCalledWith('always');

      act(() => {
        root.unmount();
      });
      container.remove();
    });
  });

  describe('PieceInspectorCard Machining Operations Counter (Step B)', () => {
    it('renders "42 agujeros" badge in the inspector when piece has 42 operations', () => {
      const html = renderToString(
        <PieceInspectorCard
          selectedPiece={samplePieces[0]!}
          machiningSheets={sampleMachiningSheets}
        />,
      );

      expect(html).toContain('42 agujeros');
      expect(html).toContain('inspector-machining-count');
    });

    it('renders "0 agujeros" when piece has no machining operations', () => {
      const emptySheet: PieceMachiningSheet = {
        pieceId: 'side-left-1',
        role: 'side-left',
        materialId: 'mat-1',
        dimensionsMm: { width: 560, height: 800, thickness: 18 },
        cutDimensionsMm: { width: 560, height: 800 },
        bandedEdges: { top: false, bottom: false, left: false, right: false },
        faceAOperations: [],
        faceBOperations: [],
        edgeOperations: [],
        totalOperations: 0,
        customOperations: [],
        requiresTurn: false,
        turnInstructions: '',
      };

      const html = renderToString(
        <PieceInspectorCard
          selectedPiece={samplePieces[0]!}
          machiningSheets={[emptySheet]}
        />,
      );

      expect(html).toContain('0 agujeros');
    });
  });

  describe('Viewport3D Selected Piece Touch Hint Counter (Step B)', () => {
    it('shows machining counter in the bottom touch hint when piece is selected', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);
      const root = createRoot(container);

      act(() => {
        root.render(
          <Viewport3D
            boxes={sampleBoxes}
            bounds={sampleBounds}
            pieces={samplePieces}
            machiningSheets={sampleMachiningSheets}
            explodedRatio={0}
            onExplodedRatioChange={vi.fn()}
            selectedPieceId="side-left-1"
            onSelectPiece={vi.fn()}
            initialShowDimensions={false}
          />,
        );
      });

      const touchHint = container.querySelector('.viewport-touch-hint');
      expect(touchHint).not.toBeNull();
      expect(touchHint?.textContent).toContain('Lateral izquierdo');
      expect(touchHint?.textContent).toContain('42 agujeros');

      act(() => {
        root.unmount();
      });
      container.remove();
    });
  });
});
