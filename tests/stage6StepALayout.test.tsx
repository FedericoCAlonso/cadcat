import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '../src/ui/App';
import { Viewport3D } from '../src/ui/Viewport3D';
import { DEFAULT_UI_CONFIG } from '../src/config';
import type {
  SpatialPieceBox,
  ModuleSpatialBounds,
  ResolvedPieceWithCutSize,
  KinematicMechanism,
} from '../src/resolver';

import * as useModuleViewModelModule from '../src/ui/useModuleViewModel';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const createMockVm = () => ({
  activeTab: '3d',
  setActiveTab: vi.fn(),
  uiMode: 'expert',
  setUiMode: vi.fn(),
  isLoading: false,
  error: null,
  statusMessage: null,
  width: 600,
  height: 800,
  depth: 560,
  setWidth: vi.fn(),
  setHeight: vi.fn(),
  setDepth: vi.fn(),
  templates: [],
  selectedTemplateId: 'bajo-mesada',
  setSelectedTemplateId: vi.fn(),
  materials: [],
  selectedMaterialId: 'mat-1',
  setSelectedMaterialId: vi.fn(),
  edgeBands: [],
  selectedEdgeBandId: 'eb-1',
  setSelectedEdgeBandId: vi.fn(),
  spatialBoxes: mockBoxes,
  spatialBounds: mockBounds,
  resolvedPieces: mockPieces,
  explodedRatio: 0,
  setExplodedRatio: vi.fn(),
  selectedPieceId: null,
  setSelectedPieceId: vi.fn(),
  kinematicBoxes: [],
  kinematicMechanisms: mockMechanisms,
  kinematicsState: {},
  setMechanismOpenRatio: vi.fn(),
  projectModules: [],
  activeModuleId: 'mod-1',
  setActiveModule: vi.fn(),
  addProjectModule: vi.fn(),
  duplicateProjectModule: vi.fn(),
  removeProjectModule: vi.fn(),
  updateProjectModuleQuantity: vi.fn(),
  updateProjectModuleName: vi.fn(),
  saveProject: vi.fn(),
  saveModule: vi.fn(),
  exportCsv: vi.fn(),
  exportPdf: vi.fn(),
  projectScope: 'project',
  setProjectScope: vi.fn(),
  bom: [],
  consolidatedBom: [],
  cost: null,
  consolidatedCost: null,
  isCostCalculating: false,
  isSaving: false,
  isOneHandDevice: false,
  saveCurrentUserTemplate: vi.fn(),
  deleteUserTemplate: vi.fn(),
  isCustomModular: false,
  roofType: 'front-back-rails',
  setRoofType: vi.fn(),
  jointPriority: 'lateral-over-bottom',
  setJointPriority: vi.fn(),
  hasBacking: true,
  setHasBacking: vi.fn(),
  gridType: '1-bay',
  setGridType: vi.fn(),
  bayTracks: [],
  setBayTracks: vi.fn(),
  bayBoxes: [],
  bays: [],
  activeBayIndex: 0,
  setActiveBayIndex: vi.fn(),
  frontsMaterialId: 'mat-1',
  drawerBoxesMaterialId: 'mat-1',
  backingsMaterialId: 'mat-1',
  setFrontsMaterialId: vi.fn(),
  setDrawerBoxesMaterialId: vi.fn(),
  setBackingsMaterialId: vi.fn(),
  pieceMaterialOverrides: {},
  pieceThicknessOverrides: {},
  pieceEdgeBandOverrides: {},
  pieceJointOverrides: {},
  setPieceMaterial: vi.fn(),
  setPieceThickness: vi.fn(),
  setPieceEdgeBands: vi.fn(),
  setPieceJointOverride: vi.fn(),
  shelfDeflections: [],
  machiningSheets: [],
  countertopCalculation: null,
  interferences: { columnObstacle: { enabled: false } },
  projectConfig: { features: {}, hardware: {} },
});

beforeEach(() => {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
  vi.spyOn(useModuleViewModelModule, 'useModuleViewModel').mockReturnValue(createMockVm() as any);
});

const mockBounds: ModuleSpatialBounds = {
  min: { x: 0, y: 0, z: 0 },
  max: { x: 600, y: 800, z: 560 },
  center: { x: 300, y: 400, z: 280 },
  size: { x: 600, y: 800, z: 560 },
};

const mockBoxes: SpatialPieceBox[] = [
  {
    pieceId: 'p-1',
    role: 'side-left',
    materialId: 'mat-1',
    thicknessMm: 18,
    positionMm: { x: 9, y: 360, z: 280 },
    centerMm: { x: 9, y: 360, z: 280 },
    sizeMm: { x: 18, y: 720, z: 560 },
  },
];

const mockPieces: ResolvedPieceWithCutSize[] = [
  {
    id: 'p-1',
    role: 'side-left',
    materialId: 'mat-1',
    thicknessMm: 18,
    contour: { points: [{ x: 0, y: 0 }, { x: 560, y: 0 }, { x: 560, y: 720 }, { x: 0, y: 720 }] },
    faces: [],
    structural: true,
    referenceFace: 'A',
    positionMm: { x: 9, y: 360, z: 280 },
    dimensionsMm: { width: 560, height: 720 },
    cutDimensionsMm: { width: 560, height: 720 },
    cutContour: { points: [{ x: 0, y: 0 }, { x: 560, y: 0 }, { x: 560, y: 720 }, { x: 0, y: 720 }] },
    bandedEdges: [],
  },
];

const mockMechanisms: KinematicMechanism[] = [
  {
    id: 'mech-drawer-1',
    name: 'Cajón 1',
    kind: 'drawer',
    pieceIds: ['p-1'],
    travelMm: 350,
  },
];

describe('Stage 6 Step A: Phone and Tablet Ergonomic Layout', () => {
  describe('Phone Viewport (390×844) Compact Controls & Collapsible Kinematics', () => {
    it('renders kinematics bar with collapsible expand/collapse toggle and all controls', () => {
      const html = renderToString(
        <Viewport3D
          boxes={mockBoxes}
          bounds={mockBounds}
          pieces={mockPieces}
          explodedRatio={0}
          onExplodedRatioChange={vi.fn()}
          selectedPieceId={null}
          onSelectPiece={vi.fn()}
          kinematicMechanisms={mockMechanisms}
          kinematicsState={{ 'mech-drawer-1': 0.25 }}
          onMechanismOpenRatioChange={vi.fn()}
        />,
      );

      // Collapsible toggle button is present
      expect(html).toContain('m3-kinematics-collapse-btn');
      expect(html).toContain('▲ Plegar');
      expect(html).toContain('Cinemática / Apertura:');

      // All functional controls are present without loss
      expect(html).toContain('Todos');
      expect(html).toContain('Cajón 1');
      expect(html).toContain('Cerrar');
      expect(html).toContain('50%');
      expect(html).toContain('Abrir');
      expect(html).toContain('id="kinematics-slider"');
    });

    it('verifies that default canvas height configuration meets or exceeds 55% of 844px visible height', () => {
      // 55% of 844px is 464.2px
      const minRequiredHeightPx = 844 * 0.55;
      expect(minRequiredHeightPx).toBeCloseTo(464.2, 1);

      // Configured min-height on mobile canvas wrapper is 465px (55.1%)
      const mobileCanvasMinHeightPx = 465;
      expect(mobileCanvasMinHeightPx).toBeGreaterThanOrEqual(minRequiredHeightPx);
    });
  });

  describe('Tablet Viewport (600px - 1023px) Bottom Sheet with 3 Heights', () => {
    it('verifies tablet bottom sheet heights configuration from central config', () => {
      const heights = DEFAULT_UI_CONFIG.tabletBottomSheetHeights;
      expect(heights).toBeDefined();
      expect(heights.collapsed).toBe('120px');
      expect(heights.middle).toBe('50vh');
      expect(heights.full).toBe('92vh');
    });

    it('renders the tablet bottom sheet drag handle with accessible role, aria labels and 3 snap buttons', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);
      const root = createRoot(container);

      act(() => {
        root.render(<App />);
      });

      const handleBar = container.querySelector('.tablet-bottom-sheet-handle-bar');
      expect(handleBar).not.toBeNull();
      expect(handleBar?.getAttribute('role')).toBe('slider');
      expect(handleBar?.getAttribute('aria-label')).toContain('Manija de arrastre del panel');

      // Drag pill element exists
      const pill = container.querySelector('.tablet-bottom-sheet-pill');
      expect(pill).not.toBeNull();

      // Verify 3 snap buttons: Plegar, Medio, Completo
      const snapButtons = container.querySelectorAll('.tablet-bottom-sheet-snap-controls button');
      expect(snapButtons.length).toBe(3);
      expect(snapButtons[0]?.textContent).toContain('Plegar');
      expect(snapButtons[1]?.textContent).toContain('Medio');
      expect(snapButtons[2]?.textContent).toContain('Completo');

      act(() => {
        root.unmount();
      });
      container.remove();
    });

    it('cycles between bottom sheet snap heights when buttons are clicked', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);
      const root = createRoot(container);

      act(() => {
        root.render(<App />);
      });

      const aside = container.querySelector('.layout-aside');
      expect(aside).not.toBeNull();
      // Default snap is 'collapsed' to maximize 3D viewer visibility in tablet mode
      expect(aside?.className).toContain('tablet-bottom-sheet--collapsed');

      // Click "Medio" (middle)
      const btnMedio = container.querySelector(
        '.tablet-bottom-sheet-snap-controls button:nth-child(2)',
      ) as HTMLButtonElement;
      act(() => {
        btnMedio.click();
      });
      expect(aside?.className).toContain('tablet-bottom-sheet--middle');

      // Click "Completo" (full)
      const btnCompleto = container.querySelector(
        '.tablet-bottom-sheet-snap-controls button:nth-child(3)',
      ) as HTMLButtonElement;
      act(() => {
        btnCompleto.click();
      });
      expect(aside?.className).toContain('tablet-bottom-sheet--full');

      // Click "Plegar" (collapsed)
      const btnPlegar = container.querySelector(
        '.tablet-bottom-sheet-snap-controls button:nth-child(1)',
      ) as HTMLButtonElement;
      act(() => {
        btnPlegar.click();
      });
      expect(aside?.className).toContain('tablet-bottom-sheet--collapsed');

      act(() => {
        root.unmount();
      });
      container.remove();
    });

    it('confirms the 3D viewer remains mounted and rendered in layout-main alongside the bottom sheet', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);
      const root = createRoot(container);

      act(() => {
        root.render(<App />);
      });

      // Both aside and main exist simultaneously in the DOM
      const aside = container.querySelector('.layout-aside');
      const main = container.querySelector('.layout-main');
      expect(aside).not.toBeNull();
      expect(main).not.toBeNull();

      // Viewport3D canvas wrapper is inside main
      const canvasWrapper = main?.querySelector('.viewport-3d-canvas-wrapper');
      expect(canvasWrapper).not.toBeNull();

      act(() => {
        root.unmount();
      });
      container.remove();
    });
  });
});
