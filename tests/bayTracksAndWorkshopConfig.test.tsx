import { act } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { BayTracksInput, DEFAULT_BAY_TRACK_RECIPES } from '../src/ui/BayTracksInput';
import { useMachiningEditorViewModel } from '../src/ui/useMachiningEditorViewModel';
import type { TrackSize, ResolvedPieceWithCutSize } from '../src/resolver';
import type { ToolItem } from '../src/model';

// @ts-expect-error React act testing flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function setInputValue(input: HTMLInputElement, value: string): void {
  const nativeSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value',
  )?.set;
  nativeSetter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('BayTracksInput Component (Distribución de vanos por mm y fr)', () => {
  it('renders initial formatted bay tracks string correctly', () => {
    const tracks: TrackSize[] = [
      { type: 'fixed', valueMm: 400 },
      { type: 'fractional', valueFr: 1 },
    ];

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(<BayTracksInput tracks={tracks} />);
    });

    const input = container.querySelector('#input-bay-grid-tracks') as HTMLInputElement;
    expect(input).toBeDefined();
    expect(input.value).toBe('400mm 1fr');

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('triggers onChange when a quick recipe chip is clicked', () => {
    const tracks: TrackSize[] = [{ type: 'fractional', valueFr: 1 }, { type: 'fractional', valueFr: 1 }];
    const onChange = vi.fn();

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(<BayTracksInput tracks={tracks} onChange={onChange} />);
    });

    const chips = container.querySelectorAll<HTMLButtonElement>('.m3-chip');
    expect(chips.length).toBe(DEFAULT_BAY_TRACK_RECIPES.length);

    // Click on "300mm 1fr 300mm"
    const targetChip = Array.from(chips).find((c) => c.textContent?.includes('300mm 1fr 300mm'));
    expect(targetChip).toBeDefined();

    act(() => {
      targetChip?.click();
    });

    expect(onChange).toHaveBeenCalledWith([
      { type: 'fixed', valueMm: 300 },
      { type: 'fractional', valueFr: 1 },
      { type: 'fixed', valueMm: 300 },
    ]);

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('parses valid user input and invokes onChange', () => {
    const tracks: TrackSize[] = [{ type: 'fractional', valueFr: 1 }];
    const onChange = vi.fn();

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(<BayTracksInput tracks={tracks} onChange={onChange} />);
    });

    const input = container.querySelector('#input-bay-grid-tracks') as HTMLInputElement;

    act(() => {
      setInputValue(input, '350mm 1fr 350mm');
    });

    expect(onChange).toHaveBeenCalledWith([
      { type: 'fixed', valueMm: 350 },
      { type: 'fractional', valueFr: 1 },
      { type: 'fixed', valueMm: 350 },
    ]);

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});

describe('Workshop View Editor Configurations (useMachiningEditorViewModel)', () => {
  const mockPiece: ResolvedPieceWithCutSize = {
    id: 'lateral-izq-1',
    role: 'carcass-side-left',
    structural: true,
    materialId: 'mat-egger-white-18',
    thicknessMm: 18,
    dimensionsMm: { width: 500, height: 800 },
    cutDimensionsMm: { width: 500, height: 800 },
    cutContour: { points: [] },
    bandedEdges: [],
    positionMm: { x: 0, y: 0, z: 0 },
    referenceFace: 'A',
    contour: {
      points: [
        { x: 0, y: 0 },
        { x: 500, y: 0 },
        { x: 500, y: 800 },
        { x: 0, y: 800 },
      ],
    },
    faces: [
      { id: 'face-A', visible: true },
      { id: 'face-B', visible: true },
    ],
  };

  const mockTools: ToolItem[] = [
    {
      schemaVersion: 1,
      id: 'tool-drill-5',
      name: 'Broca Ø5mm',
      kind: 'drill-bit',
      diameterMm: 5,
      maxCutDepthMm: 30,
      drillType: 'blind',
    },
    {
      schemaVersion: 1,
      id: 'tool-drill-35',
      name: 'Fresa Cazoleta Ø35mm',
      kind: 'drill-bit',
      diameterMm: 35,
      maxCutDepthMm: 14,
      drillType: 'blind',
    },
  ];

  it('calculates datum coordinates correctly for all 4 corners', () => {
    let vmState: ReturnType<typeof useMachiningEditorViewModel> | null = null;

    function TestComponent() {
      const vm = useMachiningEditorViewModel({
        piece: mockPiece,
        customOperations: [],
        tools: mockTools,
        onAddOperation: vi.fn(),
        onRemoveOperation: vi.fn(),
        onClose: vi.fn(),
      });
      vmState = vm;
      return null;
    }

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(<TestComponent />);
    });

    expect(vmState).not.toBeNull();

    // 1. Bottom-Left (Standard: X=x, Y=y)
    act(() => {
      vmState!.setDatumCorner('bottom-left');
    });
    expect(vmState!.toDatumCoords(50, 100)).toEqual({ x: 50, y: 100 });

    // 2. Top-Left (Y measured from top edge: height - y)
    act(() => {
      vmState!.setDatumCorner('top-left');
    });
    expect(vmState!.toDatumCoords(50, 100)).toEqual({ x: 50, y: 700 });

    // 3. Bottom-Right (X measured from right edge: width - x)
    act(() => {
      vmState!.setDatumCorner('bottom-right');
    });
    expect(vmState!.toDatumCoords(50, 100)).toEqual({ x: 450, y: 100 });

    // 4. Top-Right
    act(() => {
      vmState!.setDatumCorner('top-right');
    });
    expect(vmState!.toDatumCoords(50, 100)).toEqual({ x: 450, y: 700 });

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('rotates bench view clockwise by 90-degree increments', () => {
    let vmState: ReturnType<typeof useMachiningEditorViewModel> | null = null;

    function TestComponent() {
      const vm = useMachiningEditorViewModel({
        piece: mockPiece,
        customOperations: [],
        tools: mockTools,
        onAddOperation: vi.fn(),
        onRemoveOperation: vi.fn(),
        onClose: vi.fn(),
      });
      vmState = vm;
      return null;
    }

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(<TestComponent />);
    });

    expect(vmState!.rotationDeg).toBe(0);

    act(() => {
      vmState!.handleRotateClockwise();
    });
    expect(vmState!.rotationDeg).toBe(90);

    act(() => {
      vmState!.handleRotateClockwise();
    });
    expect(vmState!.rotationDeg).toBe(180);

    act(() => {
      vmState!.handleRotateReset();
    });
    expect(vmState!.rotationDeg).toBe(0);

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('applies cup hinges shop preset in one click', () => {
    const onAddOp = vi.fn();
    let vmState: ReturnType<typeof useMachiningEditorViewModel> | null = null;

    function TestComponent() {
      const vm = useMachiningEditorViewModel({
        piece: mockPiece,
        customOperations: [],
        tools: mockTools,
        onAddOperation: onAddOp,
        onRemoveOperation: vi.fn(),
        onClose: vi.fn(),
      });
      vmState = vm;
      return null;
    }

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(<TestComponent />);
    });

    act(() => {
      vmState?.applyCupHingesPreset();
    });

    expect(onAddOp).toHaveBeenCalledTimes(2);
    const firstCall = onAddOp.mock.calls[0]![1];
    const secondCall = onAddOp.mock.calls[1]![1];

    expect(firstCall.diameterMm).toBe(35);
    expect(firstCall.depthMm).toBe(11.5);
    expect(firstCall.xMm).toBe(21.5);
    expect(firstCall.yMm).toBe(100);

    expect(secondCall.diameterMm).toBe(35);
    expect(secondCall.yMm).toBe(700); // 800 - 100

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('applies system 32 shelf pin rows shop preset in one click', () => {
    const onAddOp = vi.fn();
    let vmState: ReturnType<typeof useMachiningEditorViewModel> | null = null;

    function TestComponent() {
      const vm = useMachiningEditorViewModel({
        piece: mockPiece,
        customOperations: [],
        tools: mockTools,
        onAddOperation: onAddOp,
        onRemoveOperation: vi.fn(),
        onClose: vi.fn(),
      });
      vmState = vm;
      return null;
    }

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(<TestComponent />);
    });

    act(() => {
      vmState?.applySystem32ShelfPinsPreset();
    });

    expect(onAddOp).toHaveBeenCalledTimes(2);
    const frontRow = onAddOp.mock.calls[0]![1];
    const rearRow = onAddOp.mock.calls[1]![1];

    expect(frontRow.kind).toBe('hole-series');
    expect(frontRow.startXMm).toBe(37);
    expect(frontRow.pitchMm).toBe(32);
    expect(frontRow.diameterMm).toBe(5);

    expect(rearRow.kind).toBe('hole-series');
    expect(rearRow.startXMm).toBe(463); // 500 - 37

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('maintains bench operations checklist state', () => {
    let vmState: ReturnType<typeof useMachiningEditorViewModel> | null = null;

    function TestComponent() {
      const vm = useMachiningEditorViewModel({
        piece: mockPiece,
        customOperations: [
          {
            id: 'op-drill-1',
            pieceId: mockPiece.id,
            kind: 'drill',
            faceType: 'face-A',
            xMm: 100,
            yMm: 150,
            diameterMm: 5,
            depthMm: 12,
            isThrough: false,
          },
        ],
        tools: mockTools,
        onAddOperation: vi.fn(),
        onRemoveOperation: vi.fn(),
        onClose: vi.fn(),
      });
      vmState = vm;
      return null;
    }

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(<TestComponent />);
    });

    expect(vmState!.benchOperationsTable.length).toBeGreaterThan(0);
    const op = vmState!.benchOperationsTable[0]!;

    expect(vmState!.completedOps[op.id]).toBeUndefined();

    act(() => {
      vmState!.toggleOpCompleted(op.id);
    });
    expect(vmState!.completedOps[op.id]).toBe(true);

    act(() => {
      vmState!.toggleOpCompleted(op.id);
    });
    expect(vmState!.completedOps[op.id]).toBe(false);

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
