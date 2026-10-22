import 'fake-indexeddb/auto';
import React, { act, useEffect } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { ModuleForm } from '../src/ui/ModuleForm';
import { Viewport3D } from '../src/ui/Viewport3D';
import { useModuleViewModel } from '../src/ui/useModuleViewModel';
import type { Material, EdgeBand } from '../src/model';
import type { BayContent, SpatialPieceBox, ModuleSpatialBounds, ResolvedPieceWithCutSize } from '../src/resolver';

// @ts-expect-error React act testing flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function createHookRunner<T>(useHook: () => T) {
  let latestResult: T | undefined;
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  function TestComponent() {
    const hookVal = useHook();
    useEffect(() => {
      latestResult = hookVal;
    });
    latestResult = hookVal;
    return null;
  }

  act(() => {
    root.render(React.createElement(TestComponent));
  });

  return {
    get current() {
      return latestResult!;
    },
    unmount() {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

const mockMaterials: Material[] = [
  {
    schemaVersion: 1,
    id: 'mat-1',
    name: 'Egger White 18mm',
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
    thicknessMm: 0.8,
    pricePerMeter: 10,
  },
];

const mockBoxes: SpatialPieceBox[] = [
  {
    pieceId: 'lateral-izq',
    role: 'lateral-izq',
    materialId: 'mat-1',
    thicknessMm: 18,
    positionMm: { x: 0, y: 0, z: 0 },
    sizeMm: { x: 18, y: 720, z: 580 },
    centerMm: { x: 9, y: 360, z: 290 },
  },
];

const mockBounds: ModuleSpatialBounds = {
  min: { x: 0, y: 0, z: 0 },
  max: { x: 600, y: 720, z: 580 },
  center: { x: 300, y: 360, z: 290 },
  size: { x: 600, y: 720, z: 580 },
};

const mockPieces: ResolvedPieceWithCutSize[] = [
  {
    id: 'lateral-izq',
    role: 'lateral-izq',
    materialId: 'mat-1',
    thicknessMm: 18,
    contour: {
      points: [
        { x: 0, y: 0 },
        { x: 580, y: 0 },
        { x: 580, y: 720 },
        { x: 0, y: 720 },
      ],
    },
    faces: [],
    structural: true,
    referenceFace: 'A',
    positionMm: { x: 0, y: 0, z: 0 },
    dimensionsMm: { width: 580, height: 720 },
    cutDimensionsMm: { width: 579, height: 719 },
    cutContour: {
      points: [
        { x: 0, y: 0 },
        { x: 579, y: 0 },
        { x: 579, y: 719 },
        { x: 0, y: 719 },
      ],
    },
    bandedEdges: [],
  },
];

describe('Desktop and Tablet Layout Enhancements', () => {
  const defaultBay: BayContent = {
    type: 'shelves',
    count: 2,
    shelfType: 'adjustable',
    shelfTracks: [
      { type: 'fractional', valueFr: 1 },
      { type: 'fractional', valueFr: 1 },
      { type: 'fractional', valueFr: 1 },
    ],
  };

  it('renders dimension inputs inside dimension-row-grid for PC inline navigation', () => {
    const onWidthChange = vi.fn();
    const onHeightChange = vi.fn();
    const onDepthChange = vi.fn();

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <ModuleForm
          width={800}
          height={720}
          depth={580}
          materials={mockMaterials}
          edgeBands={mockEdgeBands}
          selectedMaterialId="mat-1"
          selectedEdgeBandId="eb-1"
          isSaving={false}
          onWidthChange={onWidthChange}
          onHeightChange={onHeightChange}
          onDepthChange={onDepthChange}
          onMaterialChange={vi.fn()}
          onEdgeBandChange={vi.fn()}
          onSave={vi.fn()}
          bays={[defaultBay]}
          activeBayIndex={0}
        />,
      );
    });

    const grid = container.querySelector('.dimension-row-grid');
    expect(grid).not.toBeNull();
    const widthInput = container.querySelector('#input-width') as HTMLInputElement;
    const heightInput = container.querySelector('#input-height') as HTMLInputElement;
    const depthInput = container.querySelector('#input-depth') as HTMLInputElement;
    expect(widthInput).not.toBeNull();
    expect(heightInput).not.toBeNull();
    expect(depthInput).not.toBeNull();

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('renders shelf tracks input and quick recipe shortcuts for shelves bay', () => {
    const onShelfTracksChange = vi.fn();

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <ModuleForm
          width={800}
          height={720}
          depth={580}
          materials={mockMaterials}
          edgeBands={mockEdgeBands}
          selectedMaterialId="mat-1"
          selectedEdgeBandId="eb-1"
          isSaving={false}
          onWidthChange={vi.fn()}
          onHeightChange={vi.fn()}
          onDepthChange={vi.fn()}
          onMaterialChange={vi.fn()}
          onEdgeBandChange={vi.fn()}
          onSave={vi.fn()}
          bays={[defaultBay]}
          activeBayIndex={0}
          onShelfTracksChange={onShelfTracksChange}
        />,
      );
    });

    expect(container.textContent).toContain('Medidas de vanos/espacios');
    expect(container.textContent).toContain('1 estante (Iguales)');
    expect(container.textContent).toContain('Abajo grande (350mm)');

    // Find chip for Abajo grande (350mm)
    const chips = Array.from(container.querySelectorAll('button.m3-chip'));
    const recipeBtn = chips.find((c) => c.textContent?.includes('Abajo grande (350mm)')) as HTMLButtonElement;
    expect(recipeBtn).toBeDefined();

    act(() => {
      recipeBtn.click();
    });

    expect(onShelfTracksChange).toHaveBeenCalledWith(
      0,
      expect.arrayContaining([
        expect.objectContaining({ type: 'fixed', valueMm: 350 }),
      ]),
    );

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('renders floating inspector header with close button ✕ in Viewport3D when piece is selected', () => {
    const onSelectPiece = vi.fn();

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
          selectedPieceId="lateral-izq"
          onSelectPiece={onSelectPiece}
        />,
      );
    });

    const inspector = container.querySelector('.viewport-3d-inspector--floating');
    expect(inspector).not.toBeNull();

    const closeBtn = inspector?.querySelector('button[aria-label="Cerrar inspector y deseleccionar"]') as HTMLButtonElement;
    expect(closeBtn).toBeDefined();

    act(() => {
      closeBtn.click();
    });
    expect(onSelectPiece).toHaveBeenCalledWith(null);

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('updates shelfTracks and synchronizes count in useModuleViewModel', () => {
    const runner = createHookRunner(() => useModuleViewModel());

    // Switch bay 0 to shelves
    act(() => {
      runner.current.setBayContentType(0, 'shelves');
    });

    // Set custom tracks: [300mm, 1fr, 1fr] -> 2 shelves
    act(() => {
      runner.current.setShelfTracks(0, [
        { type: 'fixed', valueMm: 300 },
        { type: 'fractional', valueFr: 1 },
        { type: 'fractional', valueFr: 1 },
      ]);
    });

    const bay = runner.current.bays[0];
    expect(bay?.type).toBe('shelves');
    if (bay?.type === 'shelves') {
      expect(bay.count).toBe(2);
      expect(bay.shelfTracks).toHaveLength(3);
      expect(bay.shelfTracks?.[0]).toEqual({ type: 'fixed', valueMm: 300 });
    }

    // Add shelf should increment count and tracks
    act(() => {
      runner.current.addShelf(0);
    });

    const bayAfterAdd = runner.current.bays[0];
    if (bayAfterAdd?.type === 'shelves') {
      expect(bayAfterAdd.count).toBe(3);
      expect(bayAfterAdd.shelfTracks).toHaveLength(4);
    }

    runner.unmount();
  });
});
