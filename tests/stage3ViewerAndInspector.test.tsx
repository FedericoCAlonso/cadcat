import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { renderToString } from 'react-dom/server';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import * as fs from 'fs';
import * as path from 'path';
import { Viewport3D } from '../src/ui/Viewport3D';
import { ViewerToolbar } from '../src/ui/ViewerToolbar';
import { DEFAULT_UI_CONFIG } from '../src/config';
import type { ResolvedPieceWithCutSize, ModuleSpatialBounds, SpatialPieceBox, KinematicMechanism, KinematicPieceBox } from '../src/resolver';

const mockBoxes: SpatialPieceBox[] = [
  {
    pieceId: 'piece-drawer-front-1',
    role: 'drawer-front',
    materialId: 'mat-1',
    thicknessMm: 18,
    sizeMm: { x: 564, y: 180, z: 18 },
    positionMm: { x: 18, y: 100, z: 0 },
    centerMm: { x: 300, y: 190, z: 9 },
  },
  {
    pieceId: 'piece-side-left',
    role: 'lateral-left',
    materialId: 'mat-1',
    thicknessMm: 18,
    sizeMm: { x: 18, y: 800, z: 560 },
    positionMm: { x: 0, y: 0, z: 0 },
    centerMm: { x: 9, y: 400, z: 280 },
  },
];

const mockBounds: ModuleSpatialBounds = {
  min: { x: 0, y: 0, z: 0 },
  max: { x: 600, y: 800, z: 560 },
  center: { x: 300, y: 400, z: 280 },
  size: { x: 600, y: 800, z: 560 },
};

const mockPieces: ResolvedPieceWithCutSize[] = [
  {
    id: 'piece-drawer-front-1',
    role: 'drawer-front',
    materialId: 'mat-1',
    thicknessMm: 18,
    contour: {
      points: [
        { x: 0, y: 0 },
        { x: 564, y: 0 },
        { x: 564, y: 180 },
        { x: 0, y: 180 },
      ],
    },
    faces: [],
    structural: true,
    referenceFace: 'A',
    positionMm: { x: 18, y: 100, z: 0 },
    dimensionsMm: { width: 564, height: 180 },
    cutDimensionsMm: { width: 564, height: 180 },
    cutContour: {
      points: [
        { x: 0, y: 0 },
        { x: 564, y: 0 },
        { x: 564, y: 180 },
        { x: 0, y: 180 },
      ],
    },
    bandedEdges: [],
  },
  {
    id: 'piece-side-left',
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

const mockMechanisms: KinematicMechanism[] = [
  {
    id: 'mech-drawer-1',
    name: 'Cajón 1',
    kind: 'drawer',
    pieceIds: ['piece-drawer-front-1'],
    travelMm: 450,
  },
];

const mockKinematicBoxes: KinematicPieceBox[] = [
  {
    pieceId: 'piece-drawer-front-1',
    role: 'drawer-front',
    materialId: 'mat-1',
    thicknessMm: 18,
    sizeMm: { x: 564, y: 180, z: 18 },
    positionMm: { x: 18, y: 100, z: 0 },
    centerMm: { x: 300, y: 190, z: 9 },
    kinematicPositionMm: { x: 18, y: 100, z: 0 },
    kinematicRotationRad: { x: 0, y: 0, z: 0 },
  },
];

describe('Stage 3: 3D Viewer Toolbar, Selection and Floating Inspector', () => {
  describe('ViewerToolbar Component', () => {
    it('renders three distinct tool groups: views, render, and exploded view', () => {
      const handleView = vi.fn();
      const handleWire = vi.fn();
      const handleMachining = vi.fn();
      const handleExploded = vi.fn();

      const html = renderToString(
        <ViewerToolbar
          onSetCameraView={handleView}
          wireframe={false}
          onToggleWireframe={handleWire}
          showMachining3D={true}
          onToggleMachining3D={handleMachining}
          explodedRatio={0.4}
          onExplodedRatioChange={handleExploded}
        />,
      );

      // Verify group labels and contents
      expect(html).toContain('Vistas:');
      expect(html).toContain('Isométrica');
      expect(html).toContain('Frente');
      expect(html).toContain('Planta');
      expect(html).toContain('Lateral');

      expect(html).toContain('Render:');
      expect(html).toContain('Líneas');
      expect(html).toContain('Mecanizados ON');

      expect(html).toContain('Despiece:');
      expect(html).toContain('40%');
      expect(html).toContain('id="toolbar-exploded-slider"');
    });

    it('marks wireframe and machining buttons as active when enabled', () => {
      const html = renderToString(
        <ViewerToolbar
          onSetCameraView={vi.fn()}
          wireframe={true}
          onToggleWireframe={vi.fn()}
          showMachining3D={false}
          onToggleMachining3D={vi.fn()}
          explodedRatio={0}
          onExplodedRatioChange={vi.fn()}
        />,
      );

      expect(html).toContain('Sólido');
      expect(html).toContain('Mecanizados OFF');
    });
  });

  describe('Viewport3D Floating Inspector & Kinematics (Stage 3)', () => {
    // Mock getContext for JSDOM
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    beforeAll(() => {
      HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(null);
    });
    afterAll(() => {
      HTMLCanvasElement.prototype.getContext = originalGetContext;
    });

    it('mounts PieceInspectorCard as a floating inspector on the right of the viewer when a piece is selected', () => {
      const html = renderToString(
        <Viewport3D
          boxes={mockBoxes}
          bounds={mockBounds}
          pieces={mockPieces}
          explodedRatio={0}
          onExplodedRatioChange={vi.fn()}
          selectedPieceId="piece-drawer-front-1"
          onSelectPiece={vi.fn()}
          kinematicMechanisms={mockMechanisms}
          kinematicBoxes={mockKinematicBoxes}
          kinematicsState={{ 'mech-drawer-1': 0 }}
        />,
      );

      expect(html).toContain('viewer-floating-inspector');
      expect(html).toContain('Inspector de Pieza Seleccionada');
      expect(html).toContain('piece-drawer-front-1');
      // Verifies inspector width is taken from config
      expect(html).toContain(`--inspector-width:${DEFAULT_UI_CONFIG.inspectorWidthPx}px`);
    });

    it('marks the active kinematics action button (Cerrar / 50% / Abrir)', () => {
      // 0% open -> Cerrar should have primary/active style
      const htmlClosed = renderToString(
        <Viewport3D
          boxes={mockBoxes}
          bounds={mockBounds}
          pieces={mockPieces}
          explodedRatio={0}
          onExplodedRatioChange={vi.fn()}
          selectedPieceId={null}
          onSelectPiece={vi.fn()}
          kinematicMechanisms={mockMechanisms}
          kinematicsState={{ 'mech-drawer-1': 0 }}
        />,
      );
      expect(htmlClosed).toMatch(/m3-btn--primary is-active[^>]*>Cerrar/);

      // 100% open -> Abrir should have primary/active style
      const htmlOpen = renderToString(
        <Viewport3D
          boxes={mockBoxes}
          bounds={mockBounds}
          pieces={mockPieces}
          explodedRatio={0}
          onExplodedRatioChange={vi.fn()}
          selectedPieceId={null}
          onSelectPiece={vi.fn()}
          kinematicMechanisms={mockMechanisms}
          kinematicsState={{ 'mech-drawer-1': 1 }}
        />,
      );
      expect(htmlOpen).toMatch(/m3-btn--primary is-active[^>]*>Abrir/);
    });

    it('does not show kinematics bar if module has no moving mechanisms', () => {
      const html = renderToString(
        <Viewport3D
          boxes={mockBoxes}
          bounds={mockBounds}
          pieces={mockPieces}
          explodedRatio={0}
          onExplodedRatioChange={vi.fn()}
          selectedPieceId={null}
          onSelectPiece={vi.fn()}
          kinematicMechanisms={[]}
        />,
      );

      expect(html).not.toContain('m3-kinematics-bar');
      expect(html).not.toContain('Cinemática / Apertura:');
    });

    it('closes inspector and deselects piece when Escape key is pressed', () => {
      const handleSelectPiece = vi.fn();
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
            selectedPieceId="piece-drawer-front-1"
            onSelectPiece={handleSelectPiece}
          />,
        );
      });

      // Dispatch Escape keydown event
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      });

      expect(handleSelectPiece).toHaveBeenCalledWith(null);

      act(() => {
        root.unmount();
      });
      container.remove();
    });

    it('allows user to minimize the inspector into a compact button so it does not hide the 3D model', () => {
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
            selectedPieceId="piece-drawer-front-1"
            onSelectPiece={vi.fn()}
          />,
        );
      });

      const minimizeBtn = container.querySelector('.viewer-inspector-minimize-btn') as HTMLButtonElement;
      expect(minimizeBtn).not.toBeNull();

      // Click minimize
      act(() => {
        minimizeBtn.click();
      });

      // Inspector collapses into an expand button
      const expandBtn = container.querySelector('.viewer-inspector-expand-btn') as HTMLButtonElement;
      expect(expandBtn).not.toBeNull();
      expect(expandBtn.textContent).toContain('Frente de cajón');

      // Click expand to re-open
      act(() => {
        expandBtn.click();
      });

      expect(container.querySelector('.viewer-inspector-minimize-btn')).not.toBeNull();

      act(() => {
        root.unmount();
      });
      container.remove();
    });

    it('verifies CSS rules hide inspector card from panel on desktop and from viewport on mobile', () => {
      const themeCss = fs.readFileSync(path.resolve(__dirname, '../src/ui/theme.css'), 'utf-8');

      // Desktop rule: remove inspector card from left panel at 1024px and above
      expect(themeCss).toContain('.layout-aside .piece-inspector-card');
      expect(themeCss).toContain('display: none !important');

      // Mobile rule: below 1024px, hide floating inspector in viewer (since card stays in panel)
      expect(themeCss).toContain('.viewer-floating-inspector');
    });
  });
});
